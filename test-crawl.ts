import axios from 'axios';
import * as cheerio from 'cheerio';

// 정렬 옵션 타입
type SortOption =
	| 'title'
	| 'title-desc'
	| 'description-length'
	| 'description-length-desc'
	| 'views' // 조회수 기준 추가
	| 'views-desc' // 조회수 역순 추가
	| 'none';

// 필터 옵션 타입
interface FilterOptions {
	includeKeywords?: string[]; // 포함할 키워드
	excludeKeywords?: string[]; // 제외할 키워드
	minDescriptionLength?: number; // 최소 설명 길이
	maxDescriptionLength?: number; // 최대 설명 길이
}

// 뉴스 아이템 타입에 views 추가
interface NewsItem {
	title: string;
	url: string;
	description: string;
	views?: number; // 조회수 (선택적)
}

async function fetchRssNews(
	sortBy: SortOption = 'none',
	filterOptions?: FilterOptions,
) {
	// 네이버 뉴스 금융 카테고리 URL (여러 형식 시도)
	const newsUrls = [
		'https://news.naver.com/main/list.naver?mode=LS2D&mid=sec&sid1=101&sid2=259', // 경제 > 금융
		'https://news.naver.com/main/list.naver?mode=LS2D&mid=sec&sid1=101&sid2=260', // 경제 > 부동산
		'https://news.naver.com/section/101', // 경제 전체
	];

	const newsItems: NewsItem[] = [];

	// 모든 URL을 순회하면서 기사 수집
	for (const newsUrl of newsUrls) {
		try {
			console.log(`시도 중: ${newsUrl}`);
			const res = await axios.get(newsUrl, {
				responseType: 'arraybuffer',
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					Accept:
						'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
					Referer: 'https://news.naver.com',
				},
				maxRedirects: 5,
				validateStatus: (status) => status < 500,
			});

			if (res.status !== 200) {
				console.log(`❌ 실패 (${res.status}): ${newsUrl}`);
				continue;
			}

			console.log(`✅ 성공: ${newsUrl}`);

			// 응답 데이터를 UTF-8로 명시적으로 디코딩
			let htmlContent: string;
			const buffer = Buffer.from(res.data);

			// Content-Type 헤더에서 인코딩 확인
			const contentType = res.headers['content-type'] || '';
			const charsetMatch = contentType.match(/charset=([^;]+)/i);
			const charset = charsetMatch ? charsetMatch[1].toLowerCase() : null;

			// HTML에서 charset 메타 태그 확인
			const htmlString = buffer.toString('utf-8');
			const metaCharsetMatch = htmlString.match(
				/<meta[^>]*charset\s*=\s*["']?([^"'\s>]+)/i,
			);
			const htmlCharset = metaCharsetMatch
				? metaCharsetMatch[1].toLowerCase()
				: null;

			// 인코딩 결정 (헤더 > HTML 메타 태그 > 기본값 UTF-8)
			const detectedCharset = charset || htmlCharset || 'utf-8';

			try {
				if (
					detectedCharset.includes('euc-kr') ||
					detectedCharset.includes('euckr')
				) {
					try {
						const iconv = require('iconv-lite');
						htmlContent = iconv.decode(buffer, 'euc-kr');
					} catch (e) {
						htmlContent = buffer.toString('utf-8');
					}
				} else {
					htmlContent = buffer.toString('utf-8');
				}
			} catch (e) {
				htmlContent = buffer.toString('utf-8');
			}

			// cheerio로 파싱
			const $ = cheerio.load(htmlContent);

			// 금융 관련 키워드 (필터링용)
			const financeKeywords = [
				'금융',
				'은행',
				'증권',
				'보험',
				'금리',
				'환율',
				'주식',
				'채권',
				'코스피',
				'코스닥',
				'금융권',
				'금융시장',
				'투자',
				'자산',
				'부채',
				'대출',
				'예금',
				'적금',
				'연금',
				'펀드',
				'파생상품',
				'외환',
				'비트코인',
				'가상화폐',
				'암호화폐',
				'블록체인',
				'핀테크',
			];

			// 네이버 뉴스 리스트 아이템 선택
			const listSelectors = [
				'.list_body li',
				'.type06 li',
				'.type06_headline',
				'.sa_item',
				'.cluster_item',
				'ul.list_body > li',
				'.list_body .type06',
				'.list_body .type06_headline',
				'li[class*="type06"]',
				'li[class*="list"]',
			];

			let foundCount = 0;

			for (const listSelector of listSelectors) {
				if (foundCount >= 20) break; // 각 URL당 최대 20개

				$(listSelector).each((index, element) => {
					if (foundCount >= 20) return false;

					const $item = $(element);

					// 제목 추출 (여러 방법 시도)
					let title = '';
					let url = '';

					// 방법 1: dt > a 태그
					const $titleLink = $item
						.find('dt a, .sa_text_title a, .cluster_text_headline a')
						.first();
					if ($titleLink.length > 0) {
						title = $titleLink.text().trim();
						url = $titleLink.attr('href') || '';
					}

					// 방법 2: 직접 a 태그
					if (!title || !url) {
						const $links = $item.find('a');
						$links.each((i, link) => {
							const $link = $(link);
							const href = $link.attr('href') || '';
							if (href.includes('article') || href.includes('mnews')) {
								title = $link.text().trim();
								url = href;
								return false;
							}
						});
					}

					// 방법 3: 클래스 기반
					if (!title || !url) {
						title = $item
							.find('.sa_text_title, .cluster_text_headline, .title, dt')
							.text()
							.trim();
						const $link = $item
							.find('a[href*="article"], a[href*="mnews"]')
							.first();
						url = $link.attr('href') || '';
					}

					// 제목이 "동영상기사", "동영상뉴스"이거나 동영상 관련이거나 너무 짧으면 스킵
					const titleLower = title.toLowerCase();
					if (
						!title ||
						title === '동영상기사' ||
						title === '동영상뉴스' ||
						titleLower.includes('동영상') ||
						titleLower.includes('video') ||
						title.length < 3
					)
						return;

					// URL이 없거나 article/mnews가 없으면 스킵
					if (!url || (!url.includes('article') && !url.includes('mnews')))
						return;

					// URL 정규화
					if (url && !url.startsWith('http')) {
						url = url.startsWith('/')
							? 'https://news.naver.com' + url
							: 'https://news.naver.com/' + url;
					}

					// 동영상 기사 URL 필터링
					if (
						url.includes('/video/') ||
						url.includes('/tv/') ||
						url.includes('videoId=') ||
						(url.includes('video') && !url.includes('article'))
					) {
						return;
					}

					// 중복 제거 (전체 newsItems에서)
					if (newsItems.some((item) => item.url === url)) return;

					// 설명 찾기
					const description =
						$item
							.find(
								'.cluster_text_lede, .sa_text_lede, .lede, .summary, .writing, dd',
							)
							.text()
							.trim() || '';

					// 조회수 추출 (개선된 버전)
					let views = 0;

					// 방법 1: info_group에서 직접 추출
					const $infoGroup = $item.find('.info_group');
					if ($infoGroup.length > 0) {
						const infoText = $infoGroup.text();
						// "조회수 1234" 패턴 찾기
						const match =
							infoText.match(/조회\s*수[:\s]*([0-9,]+)/i) ||
							infoText.match(/([0-9,]+)\s*회\s*조회/i) ||
							infoText.match(/조회[:\s]*([0-9,]+)/i);
						if (match) {
							views = parseInt(match[1].replace(/,/g, '')) || 0;
						}
					}

					// 방법 2: dd 태그 내부에서 찾기
					if (views === 0) {
						const $dd = $item.find('dd');
						if ($dd.length > 0) {
							const ddText = $dd.text();
							const match =
								ddText.match(/조회\s*수[:\s]*([0-9,]+)/i) ||
								ddText.match(/([0-9,]+)\s*회\s*조회/i);
							if (match) {
								views = parseInt(match[1].replace(/,/g, '')) || 0;
							}
						}
					}

					// 방법 3: 전체 아이템 텍스트에서 찾기 (마지막 시도)
					if (views === 0) {
						const itemText = $item.text();
						const match =
							itemText.match(/조회\s*수[:\s]*([0-9,]+)/i) ||
							itemText.match(/([0-9,]+)\s*회\s*조회/i);
						if (match) {
							views = parseInt(match[1].replace(/,/g, '')) || 0;
						}
					}

					// 카테고리별 필터링
					if (newsUrl.includes('sid2=259')) {
						// 금융 카테고리: 모든 기사 포함
						newsItems.push({
							title,
							url,
							description,
							views,
						});
						foundCount++;
					} else if (newsUrl.includes('sid2=260')) {
						// 부동산 카테고리: 모든 기사 포함 (또는 부동산 키워드로 필터링 가능)
						newsItems.push({
							title,
							url,
							description,
							views,
						});
						foundCount++;
					} else {
						// 경제 전체: 금융 키워드로 필터링
						const titleAndDesc = (title + ' ' + description).toLowerCase();
						const isFinanceRelated = financeKeywords.some((keyword) =>
							titleAndDesc.includes(keyword.toLowerCase()),
						);
						if (isFinanceRelated) {
							newsItems.push({
								title,
								url,
								description,
								views,
							});
							foundCount++;
						}
					}
				});
			}

			console.log(`  → ${foundCount}개 기사 수집\n`);
		} catch (error: any) {
			console.log(`❌ 오류: ${error.message}\n`);
			continue;
		}
	}

	console.log(`📊 총 ${newsItems.length}개 기사 수집됨\n`);

	// 필터링 적용
	let filteredItems = [...newsItems];

	if (filterOptions) {
		filteredItems = filteredItems.filter((item) => {
			const titleAndDesc = (item.title + ' ' + item.description).toLowerCase();

			// 포함 키워드 필터링
			if (
				filterOptions.includeKeywords &&
				filterOptions.includeKeywords.length > 0
			) {
				const hasIncludeKeyword = filterOptions.includeKeywords.some(
					(keyword) => titleAndDesc.includes(keyword.toLowerCase()),
				);
				if (!hasIncludeKeyword) return false;
			}

			// 제외 키워드 필터링
			if (
				filterOptions.excludeKeywords &&
				filterOptions.excludeKeywords.length > 0
			) {
				const hasExcludeKeyword = filterOptions.excludeKeywords.some(
					(keyword) => titleAndDesc.includes(keyword.toLowerCase()),
				);
				if (hasExcludeKeyword) return false;
			}

			// 설명 길이 필터링
			if (filterOptions.minDescriptionLength !== undefined) {
				if (item.description.length < filterOptions.minDescriptionLength)
					return false;
			}
			if (filterOptions.maxDescriptionLength !== undefined) {
				if (item.description.length > filterOptions.maxDescriptionLength)
					return false;
			}

			return true;
		});
	}

	// 정렬 적용
	let sortedItems = [...filteredItems];

	switch (sortBy) {
		case 'title':
			sortedItems.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
			break;
		case 'title-desc':
			sortedItems.sort((a, b) => b.title.localeCompare(a.title, 'ko'));
			break;
		case 'description-length':
			sortedItems.sort((a, b) => a.description.length - b.description.length);
			break;
		case 'description-length-desc':
			sortedItems.sort((a, b) => b.description.length - a.description.length);
			break;
		case 'views':
			// 조회수 오름차순 (조회수가 없는 항목은 맨 뒤로)
			sortedItems.sort((a, b) => {
				const aViews = a.views || 0;
				const bViews = b.views || 0;
				if (aViews === 0 && bViews === 0) return 0;
				if (aViews === 0) return 1;
				if (bViews === 0) return -1;
				return aViews - bViews;
			});
			break;
		case 'views-desc':
			// 조회수 내림차순 (조회수가 많은 순)
			sortedItems.sort((a, b) => {
				const aViews = a.views || 0;
				const bViews = b.views || 0;
				return bViews - aViews;
			});
			break;
		case 'none':
		default:
			// 정렬 없음 (원본 순서 유지)
			break;
	}

	return sortedItems.slice(0, 50);
}

(async () => {
	try {
		console.log('🔍 네이버 경제뉴스 > 금융 카테고리 크롤링 시작...\n');

		// 필터 및 정렬 옵션 설정
		const filterOptions: FilterOptions = {
			excludeKeywords: ['광고', '이벤트', '동영상', 'video'], // 동영상 관련 키워드 추가
			minDescriptionLength: 5,
		};

		const sortBy: SortOption = 'views-desc'; // 조회수 내림차순 정렬

		const news = await fetchRssNews(sortBy, filterOptions);

		console.log(`📌 금융 기사 ${news.length}개 (정렬: 조회수 높은 순):\n`);
		news.forEach((item, index) => {
			console.log(`${index + 1}. ${item.title}`);
			console.log(`   URL: ${item.url}`);
			if (item.views !== undefined && item.views > 0) {
				console.log(`   조회수: ${item.views.toLocaleString()}회`);
			}
			if (item.description) {
				console.log(`   설명: ${item.description.substring(0, 100)}...`);
			}
			console.log('');
		});
		console.log(`✅ 총 ${news.length}개 금융 기사 수집 완료!`);
	} catch (error: any) {
		console.error('❌ 오류 발생:', error.message);
		if (error.response) {
			console.error(`   상태 코드: ${error.response.status}`);
			console.error(`   URL: ${error.config?.url}`);
		}
		process.exit(1);
	}
})();
