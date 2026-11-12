// @ts-check
import { defineConfig } from 'astro/config';

const [repositoryOwner, repositoryName] = process.env.GITHUB_REPOSITORY?.split('/') ?? [];
const isUserSite = repositoryOwner
  && repositoryName?.toLowerCase() === `${repositoryOwner.toLowerCase()}.github.io`;
const configuredSite = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '');
const site = configuredSite || (repositoryOwner ? `https://${repositoryOwner}.github.io` : undefined);
const base = configuredSite
  ? new URL(configuredSite).pathname.replace(/\/$/, '') || '/'
  : repositoryOwner && repositoryName && !isUserSite ? `/${repositoryName}` : '/';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  devToolbar: {
    enabled: false,
  },
  // Deployment builds can point Astro at a curated staging directory while
  // local development continues using the complete working public directory.
  publicDir: process.env.DEPLOY_PUBLIC_DIR || 'public',
});
