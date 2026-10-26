# 自部署

[English](deployment.md) | **简体中文**

## 直接部署（推荐）

在开发目录执行 `sh deploy/package.sh`。将 `release/guandan-web.zip` 上传服务器，在独立的网站目录解压：

```sh
sudo mkdir -p /var/www/guandan
sudo unzip -o guandan-web.zip -d /var/www/guandan
```

将 `deploy/nginx.conf` 中的 server 块加入现有 Nginx 配置，按实际环境修改 `server_name` 和 `root`。不要覆盖已有业务的 server 块。首次部署后检查配置再重新加载：

```sh
sudo nginx -t
sudo systemctl reload nginx
```

打开服务器 IP 或配置的域名即可。HTTPS 可沿用你已有的反向代理或证书配置。游戏不要求特殊响应头；JS 必须以 JavaScript MIME 类型提供（示例配置包含 mime.types）。

## 现有站点的子目录

将 dist 内容上传为 `/var/www/html/guandan/`，访问 `https://example.com/guandan/`。已有静态站点通常无需额外 location。不要把 JS 请求重写到首页 HTML。所有模块、Worker、样式使用相对路径。

## 可选 Docker

从项目根目录运行：

```sh
sh deploy/package.sh
docker build -f deploy/Dockerfile -t guandan-light .
docker run -d --name guandan-light --restart unless-stopped -p 8080:80 guandan-light
```

然后访问 `http://服务器IP:8080`。这是可选容器封装；直接上传静态文件更省资源。

## 验收

1. 页面可打开，27 张手牌可见。
2. 提示可选牌，出牌后其他玩家依次行动。
3. 切换三档难度，电脑继续出牌。
4. 刷新后回到同一牌局。
5. 规则弹窗、暂停、继续、下一局正常。
6. 浏览器网络面板没有 404 或 JS MIME 错误。

## 数据与更新

所有牌局状态仅保存在浏览器 localStorage，服务器不存玩家数据。不同浏览器各自独立；同一浏览器多标签同时玩可能覆盖存档，建议只开一个游戏标签。拒绝本地存储时仍能玩，页面会提示无法保存。

更新时替换静态文件即可。Nginx 示例使用 no-cache 让浏览器重新验证资源。没有 Service Worker，不会遇到旧离线缓存长期占用。首次访问和刷新需要能访问静态服务器；加载后的对局不调用网络服务。
