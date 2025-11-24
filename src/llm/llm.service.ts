import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class LlmService {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  async summarize(title: string, content: string): Promise<string> {
    const prompt = `
    다음 경제 뉴스를 3~4문장으로 요약해줘.
    제목: ${title}
    내용: ${content}
    `;

    const res = await this.client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: '너는 경제 전문 기자야.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
    });

    return res.choices[0].message?.content ?? '';
  }

  async sentiment(content: string) {
    const prompt = `
    다음 뉴스 내용의 감정을 분석해.
    결과는 JSON 형태로.
    {
      "sentiment": "positive|neutral|negative",
      "score": number(0~1)
    }
    뉴스: ${content}
    `;

    const res = await this.client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    return JSON.parse(res.choices[0].message?.content ?? '{}');
  }

  async extractKeywords(content: string): Promise<string[]> {
    const prompt = `
    뉴스의 핵심 키워드를 관련도 순으로 5개만 추출해줘.
    ${content}
    `;

    const res = await this.client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    return (
      res.choices[0].message?.content?.split(',').map((s) => s.trim()) ?? []
    );
  }
}
