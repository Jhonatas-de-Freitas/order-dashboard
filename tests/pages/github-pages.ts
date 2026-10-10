import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

// Serves dist-pages the way GitHub Pages serves a project site: files under
// /order-dashboard/, and 404.html with status 404 for every address that is not a file.
const BASE = '/order-dashboard/';
const ROOT = join(import.meta.dirname, '../../dist-pages');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  const relative = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : null;
  let file = relative === null ? null : join(ROOT, normalize(relative || 'index.html'));
  let status = 200;
  if (!file?.startsWith(ROOT) || !isFile(file)) {
    file = join(ROOT, '404.html');
    status = 404;
  }
  response.writeHead(status, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(response);
}).listen(Number(process.argv[2]));
