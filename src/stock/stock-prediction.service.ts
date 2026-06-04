import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual } from 'typeorm';
import { StockPrediction } from './stock-prediction.entity';
import { StockCrawlerService } from './stock-crawler.service';

@Injectable()
export class StockPredictionService {
  private readonly logger = new Logger(StockPredictionService.name);

  constructor(
    @InjectRepository(StockPrediction)
    private readonly repo: Repository<StockPrediction>,
    private readonly stockCrawlerService: StockCrawlerService,
  ) {}

  async savePrediction(
    analysisText: string,
    code: string,
    name: string,
    priceAtAnalysis: number,
  ): Promise<void> {
    try {
      const parsed = this.parseAnalysis(analysisText);
      if (!parsed) {
        this.logger.warn(`예측 데이터 파싱 실패: ${name}`);
        return;
      }

      const today = new Date().toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).replace(/\. /g, '-').replace('.', '');

      const prediction = this.repo.create({
        date: today,
        code,
        name,
        judgment: parsed.judgment,
        confidence: parsed.confidence,
        signalShort: parsed.signalShort,
        signalMid: parsed.signalMid,
        targetPrice: parsed.targetPrice,
        stopLoss: parsed.stopLoss,
        priceAtAnalysis,
      });

      await this.repo.save(prediction);
      this.logger.log(`예측 저장 완료: ${name} - ${parsed.judgment}(★${parsed.confidence})`);
    } catch (error) {
      this.logger.error(`예측 저장 실패: ${name}`, error);
    }
  }

  private parseAnalysis(text: string): {
    judgment: string;
    confidence: number;
    signalShort: string;
    signalMid: string;
    targetPrice: number;
    stopLoss: number;
  } | null {
    const parseNumber = (val: string): number => {
      const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
      return isNaN(num) ? 0 : num;
    };

    const dataMatch = text.match(
      /\[PREDICTION_DATA\]([\s\S]*?)\[\/PREDICTION_DATA\]/,
    );

    if (dataMatch) {
      const block = dataMatch[1];
      const getValue = (key: string): string => {
        const m = block.match(new RegExp(`${key}:\\s*(.+)`));
        return m ? m[1].trim() : '';
      };

      const judgment = getValue('판단');
      if (judgment) {
        return {
          judgment,
          confidence: parseInt(getValue('확신도'), 10) || 3,
          signalShort: getValue('단기시그널'),
          signalMid: getValue('중기시그널'),
          targetPrice: parseNumber(getValue('목표가')),
          stopLoss: parseNumber(getValue('손절가')),
        };
      }
    }

    // fallback: 본문에서 직접 추출
    let judgment = '';
    const judgmentMatch = text.match(/【종합 판단】\s*(호재|악재|중립)/);
    if (judgmentMatch) judgment = judgmentMatch[1];
    if (!judgment) return null;

    const starMatch = text.match(/★/g);
    const confidence = starMatch ? Math.min(starMatch.length, 5) : 3;

    const shortMatch = text.match(/단기.*?:\s*(매수|매도|보유)/);
    const midMatch = text.match(/중기.*?:\s*(매수|매도|보유)/);
    const targetMatch = text.match(/목표가[:\s]*([0-9,]+)/);
    const stopMatch = text.match(/손절[:\s]*([0-9,]+)/);

    return {
      judgment,
      confidence,
      signalShort: shortMatch?.[1] ?? '',
      signalMid: midMatch?.[1] ?? '',
      targetPrice: targetMatch ? parseNumber(targetMatch[1]) : 0,
      stopLoss: stopMatch ? parseNumber(stopMatch[1]) : 0,
    };
  }

  async updateActualPrices(): Promise<void> {
    this.logger.log('예측 실제 가격 업데이트 시작');

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const formatDate = (d: Date): string =>
      d.toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).replace(/\. /g, '-').replace('.', '');

    const weekTarget = formatDate(oneWeekAgo);
    const monthTarget = formatDate(oneMonthAgo);

    const pendingWeek = await this.repo.find({
      where: { priceAfter1w: IsNull(), date: LessThanOrEqual(weekTarget) },
    });

    const pendingMonth = await this.repo.find({
      where: { priceAfter1m: IsNull(), date: LessThanOrEqual(monthTarget) },
    });

    const allCodes = [
      ...new Set([
        ...pendingWeek.map((p) => p.code),
        ...pendingMonth.map((p) => p.code),
      ]),
    ];

    const priceMap = new Map<string, number>();
    await Promise.all(
      allCodes.map(async (code) => {
        const price = await this.stockCrawlerService.fetchStockPrice(code);
        if (price) {
          const num = parseInt(price.currentPrice.replace(/,/g, ''), 10);
          if (!isNaN(num)) priceMap.set(code, num);
        }
      }),
    );

    for (const pred of pendingWeek) {
      const currentPrice = priceMap.get(pred.code);
      if (!currentPrice) continue;

      const analysisPrice = Number(pred.priceAtAnalysis);
      const isDirectionCorrect = this.checkDirection(
        pred.judgment,
        analysisPrice,
        currentPrice,
      );
      const isTargetHit =
        pred.targetPrice > 0 && currentPrice >= Number(pred.targetPrice);

      await this.repo.update(pred.id, {
        priceAfter1w: currentPrice,
        isDirectionCorrect1w: isDirectionCorrect,
        isTargetHit1w: isTargetHit,
      });
    }

    for (const pred of pendingMonth) {
      const currentPrice = priceMap.get(pred.code);
      if (!currentPrice) continue;
      await this.repo.update(pred.id, { priceAfter1m: currentPrice });
    }

    this.logger.log(
      `예측 업데이트 완료: 1주 ${pendingWeek.length}건, 1개월 ${pendingMonth.length}건`,
    );
  }

  private checkDirection(
    judgment: string,
    analysisPrice: number,
    actualPrice: number,
  ): boolean {
    const changePercent =
      ((actualPrice - analysisPrice) / analysisPrice) * 100;

    if (judgment.includes('호재')) return changePercent > 0;
    if (judgment.includes('악재')) return changePercent < 0;
    return Math.abs(changePercent) <= 2;
  }

  async getRecentFeedback(code: string, limit = 4): Promise<string> {
    const predictions = await this.repo.find({
      where: { code },
      order: { date: 'DESC' },
      take: limit,
    });

    const verified = predictions.filter((p) => p.priceAfter1w !== null);
    if (verified.length === 0) return '';

    const lines = verified.map((p) => {
      const analysisPrice = Number(p.priceAtAnalysis);
      const actualPrice = Number(p.priceAfter1w);
      const diff = ((actualPrice - analysisPrice) / analysisPrice * 100).toFixed(1);
      const sign = Number(diff) >= 0 ? '+' : '';
      const dirIcon = p.isDirectionCorrect1w ? '✅' : '❌';
      const targetIcon = p.isTargetHit1w ? '✅' : '❌';

      return `- [${p.date}] ${p.judgment}(★${p.confidence}) / 목표가 ${Number(p.targetPrice).toLocaleString('ko-KR')}원 → 실제 ${actualPrice.toLocaleString('ko-KR')}원 (${sign}${diff}%) | 방향 ${dirIcon} 목표 ${targetIcon}`;
    });

    const directionCorrect = verified.filter((p) => p.isDirectionCorrect1w).length;
    const targetHit = verified.filter((p) => p.isTargetHit1w).length;
    const total = verified.length;
    const dirRate = Math.round((directionCorrect / total) * 100);
    const targetRate = Math.round((targetHit / total) * 100);

    lines.push(`- 최근 ${total}건 적중률: 방향 ${dirRate}% / 목표가 ${targetRate}%`);

    return lines.join('\n');
  }
}
