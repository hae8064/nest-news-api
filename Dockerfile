FROM node:20-alpine

# pnpm 활성화
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 의존성 파일 먼저 복사 (캐시 최적화)
COPY package.json pnpm-lock.yaml ./

# 의존성 설치
RUN pnpm install --frozen-lockfile

# 소스 복사
COPY . .

# NestJS 빌드
RUN pnpm build

# API 포트
EXPOSE 8008

# 운영 실행
CMD ["node", "dist/src/main.js"]
