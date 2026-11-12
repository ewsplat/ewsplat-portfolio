import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const origin = site?.toString().replace(/\/$/, '');
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  const lines = ['User-agent: *', 'Allow: /'];
  if (origin) lines.push(`Sitemap: ${new URL(`${base}sitemap.xml`, `${origin}/`).toString()}`);
  return new Response(`${lines.join('\n')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
