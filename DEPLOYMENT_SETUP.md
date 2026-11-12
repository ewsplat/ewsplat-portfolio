# EWSPLAT Deployment Setup

This repository prepares the Astro portfolio for GitHub Pages, with the two largest portfolio videos delivered from Cloudflare R2. Nothing here publishes automatically.

## CLOUDFLARE R2

1. Create an R2 bucket, for example `ewsplat-media`.
2. Create a bucket-scoped R2 API token with Object Read/Write only.
3. Configure public delivery using an R2 public URL initially, or a custom media subdomain later.
4. Set `R2_PUBLIC_MEDIA_BASE_URL` to that origin without a trailing slash.

The uploader preserves portfolio-relative paths and never deletes remote objects. It uses the AWS CLI with the Cloudflare R2 S3-compatible endpoint.

## ENVIRONMENT

Copy `.env.example` to `.env` and provide local values. Real `.env` files are ignored and must never be committed. The selected external assets are Kaylee Bell and Plans After VJ Loop.

## GITHUB

Create the repository manually when ready and configure Pages to use GitHub Actions. The prepared workflow builds the curated static deployment; live deployment requires an explicit manual confirmation input.

## DOMAIN

Set `PUBLIC_SITE_URL` to the final HTTPS origin. For a repository site, set `GITHUB_REPOSITORY=owner/repository`; for a custom domain, set `PUBLIC_SITE_URL` and configure that domain in GitHub Pages.

## FIRST DEPLOYMENT

```powershell
npm ci
npm run deploy:validate
npm run deploy:build
npm run deploy:media
npm run deploy:preview
npm run deploy:publish
```

`deploy:media` is a dry run unless `R2_UPLOAD=true` and all R2 variables are present. `deploy:publish` remains locked until hosting is deliberately enabled.
