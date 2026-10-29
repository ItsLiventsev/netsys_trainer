#!/usr/bin/env node
/**
 * Мини-сервер для локальной проверки тренажёра и встраивания в iframe.
 * Без зависимостей: `npm start` или `node tools/serve.js`.
 *
 * Отдаёт репозиторий как статический сайт и не выставляет X-Frame-Options,
 * чтобы страницу можно было проверить внутри iframe локально.
 * Порт: PORT (по умолчанию 3000), хост: HOST (по умолчанию 0.0.0.0).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let pathname = decodeURIComponent(parsed.pathname || '/');
  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = path.join(ROOT, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ''));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 — файл не найден');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      // Для боевого размещения замените на заголовок с вашим доменом МЭШ:
      // 'Content-Security-Policy': "frame-ancestors 'self' https://school.mos.ru"
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log('Обжим витой пары — тренажёр запущен');
  console.log('  http://localhost:' + PORT + '/');
  console.log('  корень: ' + ROOT);
});
