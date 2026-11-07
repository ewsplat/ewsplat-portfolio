# EWSPLAT portfolio

An Astro portfolio for EWSPLAT, an independent creative practice working across illustration, animation, graphic design and visual experimentation.

## Run locally

```sh
npm install
npm run dev
```

Astro serves the site at `http://localhost:4321`. Run `npm run build` to generate the static site in `dist/`.

## Deploy to GitHub Pages

The GitHub Actions build reads `GITHUB_REPOSITORY` to configure Astro's `site` and `base` values. A project repository is deployed under `/<repository-name>/`; a user-site repository named `<owner>.github.io` is deployed at the domain root. Local development and local builds keep the root base path.

The workflow in `.github/workflows/deploy.yml` deploys on pushes to `main` and can also be started from the repository's **Actions** tab with **Run workflow**. If your production branch is not `main`, update the workflow's push branch before enabling deployment.

To publish the first time:

1. Create an empty GitHub repository (suggested name: `ewsplat-portfolio`; do not add a README, license or `.gitignore` on GitHub). From this project root, connect and push with:

   ```sh
   git add .
   git commit -m "Initial portfolio site"
   git remote add origin https://github.com/<OWNER>/ewsplat-portfolio.git
   git push -u origin main
   ```

   Replace `<OWNER>` with your GitHub username or organization. Do not add the original portfolio source directory; only the selected media already staged in `public/` is part of the site.
2. In the repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
3. Ensure Actions are enabled, then push to `main` or run **Deploy to GitHub Pages** manually from the Actions tab.
4. For a project repository, the expected URL is `https://<owner>.github.io/<repository-name>/`. For a user-site repository named `<owner>.github.io`, it is `https://<owner>.github.io/`. GitHub displays the actual URL under **Settings → Pages** after deployment.

## Projects and media

Projects are JSON entries in `src/content/projects/`. The file name provides the default URL slug; an optional `slug` field can override it. Published projects appear in the archive and can be featured on the homepage. Set `"draft": true` to keep an entry out of public routes and listings.

The collection supports optional client, collection, year, description, roles, thumbnail, hero, gallery, credits and external links. `collection` groups related entries in the archive; `archiveOrder` sets a deliberate order. Set `composition` to `standard`, `single-artwork`, `motion` or `graphic-sequence` to choose a project-page opening; `standard` preserves the usual hero/header arrangement. Ordered `sections` can interleave media and text in full, half-width or narrow layouts, aligned left or right, so a project's presentation can vary rather than relying on one fixed gallery pattern. Each media item supports `image`, `gif`, `video` or `placeholder`, an optional `aspect` ratio (for example `"1/1"`, `"16/9"` or `"9/16"`), optional alt text and placeholder color, and optional intentional cropping with `"crop": true`. Placeholders render as simple solid-color surfaces; they do not add labels or graphic motifs. Omit `aspect` to use the media's intrinsic proportions. Videos can specify a poster image and are user-controlled; they do not autoplay.

The three `compositionTest` entries are draft content built at `/projects/composition-single-artwork`, `/projects/composition-motion` and `/projects/composition-graphic-sequence`. They remain excluded from the homepage and archive.

To add a real project:

1. Add an entry such as `src/content/projects/my-project.json`.
2. Set its real title and any known details; omit unknown optional fields rather than inventing them.
3. Add image media under `public/images/` and video media under `public/media/`, then reference those public URLs from the project data.
4. Add a thumbnail and hero if available, then add any number of gallery items with their own ratios.
5. Use `draft: true` until the title, attribution and publication selection are ready; drafts do not appear in routes, the homepage or archive. Set `featured: true` with a unique `featuredOrder` only for homepage work.

Selected source media is staged under `public/images/portfolio/` and `public/media/portfolio/`; original files remain unchanged. The four original placeholder entries are kept as drafts and are not part of the public homepage or archive. Four unconfirmed project entries are also drafts pending attribution, creator review or a final presentation asset.

Internal source inventories, curation notes and outstanding publication questions are kept locally and excluded from the public repository. Do not add the original portfolio source directory or its unstaged assets to Git.

Published raster artwork uses quality-90 WebP derivatives, capped at a 3200 px longest edge, under `public/images/portfolio/web/` where conversion materially reduces file size. Selected videos use H.264 MP4 derivatives (CRF 22) under `public/media/portfolio/web/` when they are meaningfully smaller; dimensions and frame rates are retained, and existing audio is retained when present. Source copies of replaced staged media are kept locally in the ignored `.media-originals/` directory; they are not shipped or committed. The untouched originals remain in the external portfolio source directory.

## Type and themes

- Display: Bebas Neue (regular)
- Body: Inter (variable 100–900)
- Metadata: JetBrains Mono (variable 100–800)
- The site supports dark and light themes; the selected theme can be changed from the navigation and is saved in local storage.

## Screenshots

Run the local server, then run `node scripts/capture-screenshots.ts`. It writes full-page dark and light screenshots for desktop and mobile for the homepage, archive, actual project examples, composition tests, about and contact routes into `screenshots/`.
