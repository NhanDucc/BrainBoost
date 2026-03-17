export const API_BASE = process.env.REACT_APP_API_BASE;

/**
 * Converts a relative path into a full, absolute URL pointing to the backend server.
 * Typically used for resolving file paths (like user avatars or course images) 
 * stored on the server.
 * @param {string} u - The URL or path to evaluate.
 * @returns {string} The fully qualified absolute URL.
 */
export function toAbsolute(u) {
  // Guard clause: Return an empty string if no URL is provided
  if (!u) return '';

  // If the string is already an absolute URL (starts with http:// or https://), return it as-is
  if (/^https?:\/\//i.test(u)) return u;

  // Otherwise, safely concatenate the API base URL with the relative path,
  // ensuring there is exactly one slash ('/') between them to prevent malformed URLs.
  return `${API_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
}

/**
 * Appends a cache-busting query parameter to a URL.
 * Browsers aggressively cache static files (like images). By appending a dynamic timestamp (?v=...),
 * we force the browser to bypass its local cache and fetch the newest version of the file 
 * whenever the file's 'updatedAt' value changes.
 * @param {string} u - The original URL.
 * @param {string|Date} updatedAt - The timestamp indicating when the resource was last modified.
 * @returns {string} The cache-busted URL.
 */
export function withBust(u, updatedAt) {
  // Guard clauses: Return early if the URL or timestamp is missing
  if (!u) return '';
  if (!updatedAt) return u;

  // Convert the 'updatedAt' value into a numeric timestamp (milliseconds)
  const ts = typeof updatedAt === 'string' ? Date.parse(updatedAt) : +new Date(updatedAt);
  
  // Append the version tag to the URL.
  // Checks if the URL already contains a query string (?) to determine whether to use '&' or '?'.
  // Fallback to the current time (Date.now()) if the timestamp parsing fails.
  return `${u}${u.includes('?') ? '&' : '?'}v=${ts || Date.now()}`;
}