export interface NaverNewsResponse {
	items: NewsItem[];
}

export interface NewsItem {
	title: string;
	originallink: string;
	pubDate: string;
	description?: string;
	content?: string;
}
