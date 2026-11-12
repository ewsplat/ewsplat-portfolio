/** Extract a video ID only from a supported YouTube URL, not lookalike hosts. */
export function youtubeVideoId(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return undefined;
    const host = url.hostname.toLowerCase();
    let id: string | null | undefined;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
      id = url.pathname === '/watch'
        ? url.searchParams.get('v')
        : /^\/(?:embed|shorts|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1];
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}
