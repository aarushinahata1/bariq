import { useEffect } from "react";

export interface SeoOptions {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article";
  jsonLd?: object | object[];
}

const SITE = "https://bariq.tirthontech.com";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Updates <title>, meta description/keywords, canonical, OG/Twitter tags, and
// JSON-LD for the current route. Runs client side only — index.html already
// ships sensible defaults for "/", and the server injects real tags for
// known public routes before React ever mounts (see server/seo.ts), so this
// hook exists mainly to keep tags correct once the SPA navigates client side.
export function useSeo({ title, description, keywords, canonical, image, type = "website", jsonLd }: SeoOptions) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    setMeta("name", "description", description);
    if (keywords) setMeta("name", "keywords", keywords);

    const url = canonical ? `${SITE}${canonical}` : undefined;
    let canonicalEl = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (url) {
      if (!canonicalEl) {
        canonicalEl = document.createElement("link");
        canonicalEl.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute("href", url);
    }

    setMeta("property", "og:type", type);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    if (url) setMeta("property", "og:url", url);
    setMeta("property", "og:image", image || `${SITE}/bariq_fullimage.jpg`);

    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image || `${SITE}/bariq_fullimage.jpg`);

    const scripts: HTMLScriptElement[] = [];
    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      for (const item of items) {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.textContent = JSON.stringify(item);
        script.dataset.seoInjected = "true";
        document.head.appendChild(script);
        scripts.push(script);
      }
    }

    return () => {
      document.title = prevTitle;
      scripts.forEach((s) => s.remove());
    };
  }, [title, description, keywords, canonical, image, type, jsonLd]);
}
