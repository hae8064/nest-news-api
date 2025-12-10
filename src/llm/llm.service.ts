import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException(
        'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.',
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 공통 재시도 처리
  private async callWithRetry<T>(
    apiCall: () => Promise<T>,
    operationName: string,
    maxRetries = 2,
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        lastError = error;

        // Rate Limit 또는 서버 오류
        if (error?.status === 429 || error?.status >= 500) {
          const wait = attempt * 2000;
          this.logger.warn(
            `${operationName} 재시도중 (${attempt}/${maxRetries}) – ${wait}ms 대기`,
          );
          await this.delay(wait);
          continue;
        }

        // 기타 오류 → 즉시 종료
        this.logger.error(`${operationName} 에러:`, error?.message || error);
        throw error;
      }
    }

    this.logger.error(`${operationName} 실패`, lastError);
  }

  // Gemini 요약
  async summarize(title: string, content: string): Promise<string> {
    const prompt = `
다음 경제 뉴스를 3~4문장으로 간결하게 요약해줘.
제목: ${title}
내용: ${content}
    `;

    return this.callWithRetry(async () => {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 200,
        },
      });

      const response = await result.response;
      return response.text().trim();
    }, '요약');
  }

  // Gemini 인사이트 생성
  async generateInsights(
    newsList: Array<{ title: string; description: string }>,
  ): Promise<string> {
    const newsText = newsList
      .map((n, i) => `${i + 1}. ${n.title}: ${n.description}`)
      .join('\n\n');

    const prompt = `
다음 여러 경제 뉴스를 기반으로 최근 경제 흐름과 핵심 인사이트를 3~4문장으로 분석해줘.

뉴스 목록:
${newsText}
    `;

    return this.callWithRetry(async () => {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 300,
        },
      });

      const response = await result.response;
      return response.text().trim();
    }, '인사이트 생성');
  }
}
