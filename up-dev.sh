#!/bin/bash

# .env.dev 파일 존재 확인
if [ ! -f ".env.dev" ]; then
    echo "Error: .env.dev file not found!"
    exit 1
fi

# 기존 컨테이너 중지 및 제거
echo "Stopping existing containers..."
docker-compose -f docker-compose.dev.yml down

# .env.dev를 적용하여 컨테이너 시작
echo "Starting containers with .env.dev..."
docker-compose -f docker-compose.dev.yml --env-file ./.env.dev up -d