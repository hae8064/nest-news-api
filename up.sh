#!/bin/bash

# .env.prod 파일 존재 확인
if [ ! -f ".env.prod" ]; then
    echo "Error: .env.prod file not found!"
    exit 1
fi

# 기존 컨테이너 중지 및 제거
echo "Stopping existing containers..."
docker compose down

# .env.prod를 적용하여 컨테이너 시작
echo "Starting containers with .env.prod..."
docker compose --env-file .env.prod up -d --build