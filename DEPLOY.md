# EWSPLAT Portfolio

## Preview

```bash
npm run dev -- --host
```

## Publish

```bash
npm run publish -- "Update description"
```

This runs validation, build, R2 media sync, selective git staging, commit and push. GitHub Actions deploys automatically.

## Check deployment

```bash
npm run deploy:validate
```

## Live site

https://ewsplat.github.io/ewsplat-portfolio/

## Manager updates

Save your changes in the Manager, then run the same publish command:

```bash
cd C:\Users\Nic\Documents\Portfolio\satellite-solstice
npm run publish -- "Update description"
```

## Large video

Add an optimized external-media derivative, then run the same publish workflow. R2 sync and deployment are handled automatically.