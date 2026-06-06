#!/bin/bash

set -e

echo "========================================"
echo "  攀岩馆安全培训与入场预约系统 - 启动脚本"
echo "========================================"

echo ""
echo "检查Docker环境..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose未安装，请先安装docker-compose"
    exit 1
fi

echo "✅ Docker环境检查通过"

echo ""
echo "停止旧容器（如果存在）..."
docker-compose down 2>/dev/null || true

echo ""
echo "构建并启动容器..."
docker-compose up -d --build

echo ""
echo "等待服务启动..."
sleep 3

echo ""
echo "检查容器状态..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ 容器启动成功"
    echo ""
    echo "========================================"
    echo "  服务访问地址"
    echo "========================================"
    echo "  本地访问: http://localhost:8080"
    echo "  容器名称: climbing-gym-app"
    echo "========================================"
    echo ""
    echo "查看日志命令: docker-compose logs -f"
    echo "停止服务命令: docker-compose down"
    echo ""
else
    echo "❌ 容器启动失败，请检查日志"
    docker-compose logs
    exit 1
fi
