export interface NaverNewsItem {
	title: string;
	url: string;
	description: string;
	views?: number;
}

export interface NaverNewsResponse {
	items: NewsItem[];
}

export interface NewsItem {
	title: string;
	originallink: string;
	pubDate: string;
	description?: string;
	summary?: string;
	insights?: string;
	importance?: number;
}
