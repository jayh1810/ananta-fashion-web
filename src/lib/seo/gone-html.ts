import { SITE_NAME } from "./constants";

/** Minimal HTML body for permanently removed products (HTTP 410). */
export function productGoneHtml(siteName = SITE_NAME): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="robots" content="noindex, nofollow"/>
  <title>Product no longer available | ${siteName}</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fafafa;color:#222}
    main{max-width:28rem;padding:2rem;text-align:center}
    h1{font-size:1.35rem;margin:0 0 .5rem}
    p{color:#666;font-size:.9rem;line-height:1.5;margin:0 0 1.25rem}
    a{display:inline-block;padding:.65rem 1.25rem;background:#0d9488;color:#fff;text-decoration:none;border-radius:.5rem;font-size:.875rem;font-weight:600}
  </style>
</head>
<body>
  <main>
    <h1>This product is no longer available</h1>
    <p>It has been permanently removed from our catalog.</p>
    <a href="/collections/all">Browse all products</a>
  </main>
</body>
</html>`;
}
