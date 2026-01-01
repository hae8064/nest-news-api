## 📰 Daily Economy News Digest


<img width="645" height="728" alt="image" src="https://github.com/user-attachments/assets/f820cd07-958c-42db-8a35-521f5560ad8f" />
<br/>
네이버 뉴스 API와 LLM(Google Gemini)을 활용하여
경제·부동산 뉴스를 자동으로 수집 → 요약 → 매일 아침 이메일로 전달하는 서비스입니다.



### 서비스 소개

이 프로젝트는 매일 쏟아지는 경제·부동산 뉴스를 효율적으로 소비하기 위해 만들어졌습니다.

네이버 뉴스 API를 통해 최신 뉴스를 수집하고 기사 원문을 직접 크롤링한 뒤

LLM(Gemini)을 활용해 핵심 내용만 요약 매일 오전 7시, 구독한 이메일로 자동 발송합니다.

운영 환경에서도 바로 사용할 수 있도록 Docker + Cron 기반의 완전 자동화 구조로 설계되었습니다.

### 동작 방식

1. 뉴스 수집
- Naver Developers News API 사용
- 경제 / 부동산 카테고리
- 각 카테고리 10개씩, 총 20개 기사 수집

2. 기사 본문 크롤링
- 뉴스 API에서 받은 기사 링크를 기반으로
- 실제 기사 본문 HTML 크롤링

3. LLM 요약
- 크롤링한 기사 본문을 Gemini API에 전달
- 핵심 위주의 요약 문장 생성

4. 이메일 발송
- 요약된 뉴스 데이터를 HTML 메일 템플릿으로 구성
- 구독자 이메일로 발송

5. 자동 실행
- crontab을 통해 매일 오전 7시 자동 실행

### 기술 스택
Backend
- NestJS
- TypeScript
- TypeORM

External APIs
- Naver Developers News API
- Google Gemini API

Database
- PostgreSQL 15

Infrastructure
- Docker / Docker Compose
- AWS EC2

