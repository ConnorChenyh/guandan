# Self-hosting

**English** | [简体中文](deployment.zh-CN.md)

## Direct deploy (recommended)

Run `sh deploy/package.sh` in the project folder. Upload `release/guandan-web.zip` to your server and unzip it into its own web directory:

```sh
sudo mkdir -p /var/www/guandan
sudo unzip -o guandan-web.zip -d /var/www/guandan
```

Add the server block from `deploy/nginx.conf` to your existing Nginx configuration, adjusting `server_name` and `root` to your setup. Don't overwrite server blocks used by other sites. After the first deploy, check the configuration, then reload:

```sh
sudo nginx -t
sudo systemctl reload nginx
```

Then open your server's address or configured domain. For HTTPS, reuse your existing reverse proxy or certificate setup. The game needs no special response headers, but JavaScript must be served with a JavaScript MIME type (the example config includes `mime.types`).

## Subdirectory of an existing site

Upload the contents of `dist/` as `/var/www/html/guandan/` and visit `https://example.com/guandan/`. An existing static site usually needs no extra `location`. Don't rewrite JS requests to the home page HTML. All modules, the Worker and styles use relative paths.

## Optional Docker

From the project root:

```sh
sh deploy/package.sh
docker build -f deploy/Dockerfile -t guandan-light .
docker run -d --name guandan-light --restart unless-stopped -p 8080:80 guandan-light
```

Then visit `http://<server-address>:8080`. The container is optional; uploading the static files directly uses fewer resources.

## Acceptance checks

1. The page opens and all 27 cards in your hand are visible.
2. Hint selects cards; after you play, the other players take their turns.
3. Switching between the three difficulties keeps the computer playing.
4. Refreshing returns to the same game.
5. The rules dialog, pause, resume and next round work.
6. The browser's network panel shows no 404s or JS MIME errors.

## Data and updates

All game state lives only in the browser's localStorage; the server stores no player data. Each browser is independent. Playing in several tabs of the same browser can overwrite the save, so keep one game tab open. If local storage is blocked, the game still works and shows that it can't save.

To update, replace the static files. The Nginx example uses `no-cache` so browsers revalidate resources. There is no Service Worker, so stale offline caches can't linger. The first visit and refreshes need the static server; once loaded, a game makes no network calls.
