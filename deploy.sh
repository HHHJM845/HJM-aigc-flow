#!/bin/bash
set -e

echo "=== 1. 安装 Node.js 20 ==="
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update -y
sudo apt-get install -y nodejs

echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"

echo "=== 2. 安装 PM2 ==="
sudo npm install -g pm2

echo "=== 3. 拉取代码 ==="
sudo mkdir -p /srv/hjm-aigc-flow
sudo chown -R $USER:$USER /srv/hjm-aigc-flow
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
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo ""
echo "✅ 部署完成！访问地址：http://122.152.224.125:3001"
pm2 status
