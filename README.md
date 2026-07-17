# Simple Life Saver Rebuild

Secure static Next.js rebuild generated from the validated recovery artifacts in `content/`.

## View Locally

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Validate

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Playwright smoke tests are available with:

```bash
npm run test:e2e
```

If Playwright browsers are missing on another machine, install Chromium with:

```bash
npx playwright install chromium
```

## Audit Note

`npm audit` currently reports unresolved advisories in the Next/PostCSS/dev-tool dependency tree. The remaining npm-suggested fixes require `--force` and breaking dependency changes. Those were not applied.

## Content Source

The site reads from `content/content-bundle.json` and applies an additional public-facing filter to avoid publishing casino/gambling spam recovered from the compromised database.

The app does not use WordPress, PHP, MySQL, old themes, old plugins, recovered JavaScript, or recovered CSS.
