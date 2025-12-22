export function formatKoreanDate(dateString: string): string {
	try {
		const date = new Date(dateString);

		// 유효하지 않은 날짜인 경우 원본 반환
		if (isNaN(date.getTime())) {
			return dateString;
		}

		const year = date.getFullYear();
		const month = date.getMonth() + 1;
		const day = date.getDate();
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');

		const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
		const weekday = weekdays[date.getDay()];

		return `${year}년 ${month}월 ${day}일 (${weekday}) ${hours}:${minutes}`;
	} catch {
		return dateString;
	}
}
