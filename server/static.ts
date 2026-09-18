import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { getSeoForPath, injectSeo } from "./seo";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve index.html itself through the catch-all below (so SEO injection
  // applies to it too) rather than as a static file match.
  app.use(express.static(distPath, {
    index: false,
    // Vite fingerprints everything under /assets (name-<hash>.js), so those files can
    // never change behind a given URL — tell browsers and any CDN in front of us to
    // keep them for a year. Without this every reload re-downloaded the whole bundle
    // and billed us for the request and the egress; now a returning user fetches only
    // the HTML. Non-hashed files (favicon, robots.txt, images) get a shorter TTL.
    setHeaders: (res, filePath) => {
      const isHashedAsset = /[.\-][a-zA-Z0-9_-]{8,}\.[a-z0-9]+$/.test(path.basename(filePath))
        && filePath.includes(`${path.sep}assets${path.sep}`);
      res.setHeader("Cache-Control", isHashedAsset
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600");
    },
  }));

  const indexPath = path.resolve(distPath, "index.html");
  // Read once at boot instead of on every single page view — this handler answers
  // every non-API route, so it was a synchronous disk read per request.
  const indexTemplate = fs.readFileSync(indexPath, "utf-8");
  // SEO injection is deterministic per path, so memoise the rendered HTML too.
  const renderedByPath = new Map<string, string>();

  app.use("*", (req, res) => {
    const routePath = req.originalUrl.split("?")[0];
    let html = renderedByPath.get(routePath);
    if (html === undefined) {
      const seo = getSeoForPath(routePath);
      html = seo ? injectSeo(indexTemplate, seo) : indexTemplate;
      // Bounded so a crawler hitting endless URLs can't grow this without limit.
      if (renderedByPath.size < 500) renderedByPath.set(routePath, html);
    }
    // The HTML shell references hashed assets, so it must stay revalidated, but a
    // short shared TTL still absorbs reload storms on the public queue board.
    res.set("Cache-Control", "public, max-age=0, must-revalidate");
    res.set("Content-Type", "text/html").send(html);
  });
}
