const path = require('node:path');

function assetPath(root, url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'pace:' || parsed.host !== 'app') return null;
  let pathname;
  try { pathname = decodeURIComponent(parsed.pathname); } catch { return null; }
  if (pathname.includes('\\') || pathname.includes('\0')) return null;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(path.resolve(root) + path.sep)) return null;
  if (!['.html', '.css', '.js', '.woff2', '.woff'].includes(path.extname(file))) return null;
  return file;
}

module.exports = { assetPath };
