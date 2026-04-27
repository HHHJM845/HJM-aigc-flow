#!/bin/bash
set -e

echo "=== 1. 安装 Node.js 20 ==="
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - 2>/dev/null || \
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs 2>/dev/null || yum install -y nodejs 2>/dev/null

echo "=== 2. 安装 PM2 ==="
npm install -g pm2

echo "=== 3. 拉取代码 ==="
mkdir -p /srv/hjm-aigc-flow
cd /srv/hjm-aigc-flow
if [ -d ".git" ]; then
  git pull origin main
else
  git clone https://github.com/HHHJM845/HJM-aigc-flow.git .
fi

echo "=== 4. 检查环境变量 ==="
if [ ! -f ".env" ]; then
  echo "⚠️  未找到 .env 文件，请手动创建后重新运行此脚本"
  echo "    参考命令：nano /srv/hjm-aigc-flow/.env"
  exit 1
fi

echo "=== 5. 安装依赖 ==="
npm install

echo "=== 6. 构建前端 ==="
npm run build

echo "=== 7. 启动服务（PM2） ==="
pm2 delete hjm-aigc-flow 2>/dev/null || true
pm2 start npm --name hjm-aigc-flow -- run start
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo ""
echo "✅ 部署完成！访问地址：http://122.152.224.125:3001"
pm2 status
