import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.toString().replace(/\/$/, '');
  if (!origin) return new Response('Sitemap unavailable until Astro site is configured.\n', { status: 404 });
  const projects = await getCollection('projects');
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  const routes = ['/', '/archive/', '/about/', '/contact/', ...projects.filter(({ data }) => !data.draft && !data.compositionTest && !data.placeholder).map(({ data, id }) => `/projects/${data.slug ?? id}/`)];
  const urls = routes.map((route) => `  <url><loc>${new URL(`${base.replace(/\/$/, '')}${route}`, `${origin}/`).toString()}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
