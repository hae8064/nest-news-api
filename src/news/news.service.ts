import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class NewsService {
  private baseUrl = 'https://openapi.naver.com/v1/search/news.json';

  async fetchNews(query: string) {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    // 환경변수 검증
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        '네이버 API 인증 정보가 설정되지 않았습니다. NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET 환경변수를 확인해주세요.',
      );
    }

    const res = await axios.get(this.baseUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      params: {
        query,
        display: 10, // 최대 50개까지
        sort: 'sim', // 정확도순 (관련도순) - 조회수 기준은 API에서 제공하지 않음
      },
    });

    return res.data.items.map((item: any) => ({
      title: item.title.replace(/<[^>]*>?/gm, ''),
      description: item.description.replace(/<[^>]*>?/gm, ''),
      originallink: item.originallink,
      link: item.link,
      pubDate: item.pubDate,
    }));
  }

  async fetchEconomyNews() {
    return this.fetchNews('경제');
  }

  async fetchRealEstateNews() {
    return this.fetchNews('부동산');
  }
}
