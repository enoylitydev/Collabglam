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
