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