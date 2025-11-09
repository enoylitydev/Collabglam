import { API_BASE_URL } from "./api";

const apiBase = (API_BASE_URL || "").replace(/\/$/, "");

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);
const isDataOrBlob = (value: string) => /^data:|^blob:/i.test(value);

const joinBase = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!apiBase) return normalizedPath;
  return `${apiBase}${normalizedPath}`;
};

/**
 * Convert a stored GridFS filename or relative path into a fully-qualified URL.
 * Falls back gracefully when the API base URL isn't configured.
 */
export const resolveFileUrl = (input?: string | null): string => {
  const raw = (input || "").trim();
  if (!raw) return "";
  if (isAbsoluteUrl(raw) || isDataOrBlob(raw)) return raw;

  if (raw.startsWith("/file/")) {
    return apiBase ? `${apiBase}${raw}` : raw;
  }

  if (raw.startsWith("file/")) {
    return joinBase(`/${raw}`);
  }

  const encoded = encodeURIComponent(raw);
  return joinBase(`/file/${encoded}`);
};

export const resolveFileList = (values?: Array<string | null | undefined>): string[] => {
  if (!Array.isArray(values)) return [];
  const resolved: string[] = [];
  values.forEach((value) => {
    const url = resolveFileUrl(value);
    if (url) resolved.push(url);
  });
  return resolved;
};
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');


export const fileUrl = (v?: string) => {
if (!v) return '';
if (/^https?:\/\//i.test(v)) return v; // already absolute
if (v.startsWith('/file/')) return `${API_BASE}${v}`; // API-relative GridFS
return `${API_BASE}/file/${encodeURIComponent(v)}`; // bare filename
};


export const isPdfHref = (href: string) => /\.pdf(?:$|[?#])/i.test(href);
export const isPdfMime = (mime?: string) => (mime || '').toLowerCase().includes('pdf');
export const isImageMime = (mime?: string) => (mime || '').startsWith('image/');
export const isVideoMime = (mime?: string) => (mime || '').startsWith('video/');


export const withDownload = (href: string) => href.includes('?') ? `${href}&download=1` : `${href}?download=1`;


export async function downloadByHref(src: string, filename = 'download') {
try {
const res = await fetch(src, { credentials: 'include' });
const blob = await res.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename || src.split('/').pop() || 'download';
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);
} catch (err) {
console.error('download failed', err);
window.open(src, '_blank', 'noopener,noreferrer');
}
}