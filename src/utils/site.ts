const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const mediaBase = import.meta.env.PUBLIC_MEDIA_BASE_URL?.replace(/\/$/, '');
const externalPrefixes = (import.meta.env.PUBLIC_EXTERNAL_MEDIA_PREFIXES ?? '')
  .split(',')
  .map((value) => value.trim().replace(/^\/+|\/+$/g, ''))
  .filter(Boolean);

function isExternalMedia(path: string): boolean {
  const normalized = path.replace(/^\/+/, '');
  return Boolean(mediaBase && externalPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)));
}

export function withBase(path: string): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(path)) {
    return path;
  }

  if (isExternalMedia(path)) {
    return `${mediaBase}/${path.replace(/^\/+/, '')}`;
  }

  return `${basePath}${path.startsWith('/') ? path : `/${path}`}`;
}
