import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException(
        'OPENAI_API_KEY 환경변수가 설정되지 않았습니다.',
      );
    }
    this.client = new OpenAI({ apiKey });
  }

  // 간단한 재시도 로직
  private async callWithRetry<T>(
    apiCall: () => Promise<T>,
    operationName: string,
    maxRetries = 2,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        lastError = error;

        // 쿼터 초과 에러를 먼저 확인
        const errorCode = error?.code || error?.error?.code;
        if (errorCode === 'insufficient_quota') {
          this.logger.error(`${operationName} 쿼터 초과`);
          throw new BadRequestException(
            'OpenAI API 쿼터가 초과되었습니다. 계정 설정을 확인해주세요.',
          );
        }

        // Rate Limit 에러인 경우
        if (error?.status === 429 && errorCode !== 'insufficient_quota') {
          const waitTime = attempt * 2000; // 2초, 4초
          this.logger.warn(
            `${operationName} Rate Limit 도달. ${waitTime}ms 후 재시도 (${attempt}/${maxRetries})`,
          );

          if (attempt < maxRetries) {
            await this.delay(waitTime);
            continue;
          }
        }

        // 마지막 시도 실패 시
        if (attempt === maxRetries) {
          this.logger.error(
            `${operationName} 실패 (${attempt}회 시도):`,
            error?.message || error?.error?.message || error,
          );
          throw error;
        }

        // 다른 에러는 짧은 대기 후 재시도
        await this.delay(1000 * attempt);
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async summarize(title: string, content: string): Promise<string> {
    const prompt = `
    다음 경제 뉴스를 3~4문장으로 요약해줘. 핵심 내용만 간결하게.
    제목: ${title}
    내용: ${content}
    `;

    return this.callWithRetry(async () => {
      const res = await this.client.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content:
              '너는 경제 전문 기자야. 뉴스를 간결하고 명확하게 요약해줘.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      return res.choices[0].message?.content?.trim() ?? '';
    }, '요약');
  }

  async generateInsights(
    newsList: Array<{ title: string; description: string }>,
  ): Promise<string> {
    const newsText = newsList
      .map((news, idx) => `${idx + 1}. ${news.title}: ${news.description}`)
      .join('\n\n');

    const prompt = `
    다음 경제 뉴스들을 종합적으로 분석해서 최근 경제 트렌드와 인사이트를 3~4문장으로 요약해줘.
    
    뉴스 목록:
    ${newsText}
    `;

    return this.callWithRetry(async () => {
      const res = await this.client.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content:
              '너는 경제 분석 전문가야. 여러 뉴스를 종합해서 트렌드와 인사이트를 도출해줘.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.5,
      });

      return res.choices[0].message?.content?.trim() ?? '';
    }, '인사이트 생성');
  }
}
