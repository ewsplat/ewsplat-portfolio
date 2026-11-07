// @ts-check
import { defineConfig } from 'astro/config';

const [repositoryOwner, repositoryName] = process.env.GITHUB_REPOSITORY?.split('/') ?? [];
const isUserSite = repositoryOwner
  && repositoryName?.toLowerCase() === `${repositoryOwner.toLowerCase()}.github.io`;
const site = repositoryOwner ? `https://${repositoryOwner}.github.io` : undefined;
const base = repositoryOwner && repositoryName && !isUserSite ? `/${repositoryName}` : '/';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  devToolbar: {
    enabled: false,
  },
});
