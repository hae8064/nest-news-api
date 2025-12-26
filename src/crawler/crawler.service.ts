import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import * as iconv from 'iconv-lite';

@Injectable()
export class CrawlerService {
	private readonly logger = new Logger(CrawlerService.name);

	/**
	 * URL에서 본문 내용을 크롤링합니다.
	 * @param url 크롤링할 URL
	 * @returns 본문 내용 (실패 시 빈 문자열)
	 */

	async fetchArticleContent(url: string): Promise<string> {
		try {
			const response: AxiosResponse<ArrayBuffer> = await axios.get(url, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					Accept:
						'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
					'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
				},
				timeout: 10000,
				responseType: 'arraybuffer',
			});

			// 인코딩 감지 및 변환
			const contentType =
				(response.headers['content-type'] as string | undefined) || '';
			let html = '';

			// HTML에서 charset 메타 태그도 확인
			const buffer = Buffer.from(response.data);
			const htmlPreview = buffer.toString(
				'utf-8',
				0,
				Math.min(5000, buffer.length),
			);
			const charsetMatch = htmlPreview.match(/charset\s*=\s*["']?([^"'\s>]+)/i);

			if (
				contentType.includes('charset=euc-kr') ||
				contentType.includes('charset=EUC-KR') ||
				url.includes('kookje.co.kr') ||
				charsetMatch?.[1]?.toLowerCase().includes('euc-kr')
			) {
				html = iconv.decode(buffer, 'euc-kr').toString();
			} else {
				html = buffer.toString('utf-8');
			}

			const $ = cheerio.load(html);

			// 스크립트, 스타일, 광고, 메뉴 등 제거
			$(
				'script, style, noscript, iframe, .ad, .advertisement, .ad-banner, nav, header, footer, .menu, .navigation, .sidebar, .related, .recommend, .summary, .ai-summary, .news_summary, .article_recommend, .article_relation, .article_tag, .article_share, .comment, .reply',
			).remove();

			// 도메인별 특화 선택자
			const domain = new URL(url).hostname;
			let content = '';
			let usedSelector = '';

			// 도메인별 특화 처리
			if (domain.includes('segye.com')) {
				content = $('#articleBodyContents, .article_body').text().trim();
				usedSelector = 'segye.com specific';
			} else if (domain.includes('hankyung.com')) {
				content = $('#articleBody, .article-body, #newsEndContents')
					.text()
					.trim();
				usedSelector = 'hankyung.com specific';
			} else if (domain.includes('mk.co.kr')) {
				$(
					'.news_summary, .ai-summary, .summary, .article_recommend, .article_relation, .article_tag',
				).remove();
				content = $(
					'#article_body, .news_view_body, #newsEndContents, .article_view',
				)
					.first()
					.text()
					.trim();
				content = content.split('AI가 뉴스를 읽고')[0].trim();
				content = content.split('기사 속 종목 이야기')[0].trim();
				content = content.split('이 기사가 마음에 들었다면')[0].trim();
				usedSelector = 'mk.co.kr specific';
			} else if (domain.includes('mbn.mk.co.kr')) {
				content = $('.article_view, .article-body, #articleBody').text().trim();
				usedSelector = 'mbn.mk.co.kr specific';
			} else if (domain.includes('busan.com')) {
				content = $('.article_view_box, #article-view-content-div')
					.text()
					.trim();
				usedSelector = 'busan.com specific';
			} else if (domain.includes('edaily.co.kr')) {
				// 메뉴 제외하고 본문만 추출
				$('nav, .menu, .navigation, header, .gnb, .lnb').remove();
				// 더 많은 선택자 시도
				const selectors = [
					'#articleBody',
					'.article_body',
					'.news_view_body',
					'#newsEndContents',
					'.article_view',
					'.article-content',
					'#content',
					'.content',
					'[class*="article"]',
					'[id*="article"]',
				];

				for (const selector of selectors) {
					const found = $(selector).first().text().trim();
					if (found && found.length > 100) {
						content = found;
						usedSelector = `edaily.co.kr: ${selector}`;
						break;
					}
				}

				// 여전히 못 찾은 경우
				if (!content || content.length < 100) {
					content = $('main, .content, #content').first().text().trim();
					usedSelector = 'edaily.co.kr: fallback';
				}
			} else if (domain.includes('kookje.co.kr')) {
				// 더 많은 선택자 시도
				const selectors = [
					'#articleBody',
					'.article_body',
					'.news_view_body',
					'.article_view',
					'#newsEndContents',
					'.article-content',
					'[class*="article"]',
					'[id*="article"]',
				];

				for (const selector of selectors) {
					const found = $(selector).first().text().trim();
					if (found && found.length > 100) {
						content = found;
						usedSelector = `kookje.co.kr: ${selector}`;
						break;
					}
				}
			} else if (domain.includes('yna.co.kr')) {
				$('.summary, .news_summary, .ai-summary, .article_summary').remove();
				content = $(
					'#articleBody, .article_body, .news_view_body, #article-view, .article_view',
				)
					.first()
					.text()
					.trim();
				content = content.split('관련 뉴스')[0].trim();
				content = content.split('제보는 카카오톡')[0].trim();
				usedSelector = 'yna.co.kr specific';
			}

			// 도메인별 처리로 찾지 못한 경우, 일반 선택자 시도
			if (!content || content.length < 100) {
				const contentSelectors = [
					'article#articleBodyContents',
					'#articleBodyContents',
					'.article_body',
					'.article-body',
					'#articleBody',
					'.articleBody',
					'#newsEndContents',
					'.news_end_body',
					'.article_view',
					'#article-view-content-div',
					'._article_body_contents',
					'.article-content',
					'#article-view',
					'.article_view_box',
					'#article_body',
					'.news_view_body',
					'.article_view_body',
				];

				for (const selector of contentSelectors) {
					const found = $(selector).first().text().trim();
					if (
						found &&
						found.length > 100 &&
						!found.includes('메뉴') &&
						!found.includes('navigation') &&
						!found.includes('요약') &&
						!found.includes('AI 요약') &&
						!found.match(/^[가-힣\s]{0,50}$/)
					) {
						content = found;
						usedSelector = `general: ${selector}`;
						break;
					}
				}
			}

			// 여전히 찾지 못한 경우, article 태그나 main 태그 시도
			if (!content || content.length < 100) {
				const articleContent = $('article, main, [role="article"]')
					.first()
					.text()
					.trim();
				if (
					articleContent &&
					articleContent.length > 100 &&
					!articleContent.includes('메뉴') &&
					!articleContent.includes('요약') &&
					!articleContent.match(/^[가-힣\s]{0,50}$/)
				) {
					content = articleContent;
					usedSelector = 'fallback: article/main';
				}
			}

			// 디버깅 로그 추가
			if (content && content.length > 0) {
				this.logger.debug(
					`크롤링 성공: ${url} | 선택자: ${usedSelector} | 길이: ${content.length}`,
				);
			}

			if (content && content.length > 100) {
				return content
					.replace(/\s+/g, ' ')
					.replace(/<!--[\s\S]*?-->/g, '')
					.replace(/googletag\.[\s\S]*?;/g, '')
					.replace(/document\.addEventListener[\s\S]*?\);/g, '')
					.replace(/Copyright[\s\S]*$/g, '')
					.replace(/무단[\s\S]*$/g, '')
					.replace(/세 줄 요약[\s\S]*?닫기/g, '')
					.replace(/AI 요약[\s\S]*?닫기/g, '')
					.replace(/요약쏙[\s\S]*?닫기/g, '')
					.replace(/최신뉴스[\s\S]*?송고/g, '')
					.replace(/관련 뉴스[\s\S]*$/g, '')
					.replace(/제보는[\s\S]*$/g, '')
					.replace(/이 기사가 마음에 들었다면[\s\S]*$/g, '')
					.replace(/기사 속 종목 이야기[\s\S]*$/g, '')
					.trim();
			}

			this.logger.warn(
				`본문 크롤링 실패: ${url} | 찾은 내용 길이: ${content.length} | 선택자: ${usedSelector}`,
			);
			return '';
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			this.logger.error(`본문 크롤링 에러: ${url}`, errorMessage);
			return '';
		}
	}

	/**
	 * 여러 URL의 본문을 병렬로 크롤링합니다.
	 * @param urls 크롤링할 URL 배열
	 * @returns URL과 본문 내용의 맵
	 */
	async fetchMultipleArticles(urls: string[]): Promise<Map<string, string>> {
		const results = await Promise.all(
			urls.map(async (url) => {
				const content = await this.fetchArticleContent(url);
				return { url, content };
			}),
		);

		const contentMap = new Map<string, string>();
		results.forEach(({ url, content }) => {
			contentMap.set(url, content);
		});

		return contentMap;
	}
}
