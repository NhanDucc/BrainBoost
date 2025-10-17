/* src/utils/url.js */
export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

export function toAbsolute(u) {
  if (!u) return '';
  // Nếu đã là absolute (http/https) thì trả nguyên
  if (/^https?:\/\//i.test(u)) return u;
  // Ghép API_BASE + đảm bảo có dấu /
  return `${API_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
}

export function withBust(u, updatedAt) {
  if (!u) return '';
  if (!updatedAt) return u;
  const ts =
    typeof updatedAt === 'string' ? Date.parse(updatedAt) : +new Date(updatedAt);
  // thêm query ?v=… để tránh cache
  return `${u}${u.includes('?') ? '&' : '?'}v=${ts || Date.now()}`;
}
