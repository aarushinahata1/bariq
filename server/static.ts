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
  app.use(express.static(distPath, { index: false }));

  const indexPath = path.resolve(distPath, "index.html");

  app.use("*", (req, res) => {
    const template = fs.readFileSync(indexPath, "utf-8");
    const seo = getSeoForPath(req.originalUrl.split("?")[0]);
    res.set("Content-Type", "text/html").send(seo ? injectSeo(template, seo) : template);
  });
}
