import { blogPosts, getBlogPost } from "@shared/blog-posts";

const SITE = "https://bariq.tirthontech.com";

interface PageSeo {
  title: string;
  description: string;
  keywords: string;
  path: string;
  jsonLd?: object[];
  bodyHtml?: string; // pre-rendered snapshot injected into #root for non-JS crawlers
}

const STATIC_PAGES: Record<string, Omit<PageSeo, "path">> = {
  "/login": {
    title: "Sign In | BariQ Clinic Management Software",
    description: "Sign in to your BariQ account to manage your clinic's queue, patients, pharmacy, and billing from one dashboard.",
    keywords: "BariQ login, clinic management software login, clinic dashboard sign in",
  },
  "/signup": {
    title: "Start Your Free Trial | BariQ Clinic Management Software",
    description: "Start a free 7 day trial of BariQ, no credit card required. Get live queue management, patient records, a smart pharmacy, billing, and CRM in one platform.",
    keywords: "BariQ signup, clinic management software free trial, clinic software sign up India",
  },
  "/partner-signup": {
    title: "Become a BariQ Partner | Referral Program for Healthcare Consultants",
    description: "Join the BariQ partner program. Get your own referral code, track every clinic you refer, and earn ongoing commission from your partner dashboard.",
    keywords: "BariQ partner program, clinic software referral program, healthcare software affiliate India",
  },
};

function blogIndexBodyHtml(): string {
  const cards = blogPosts
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(
      (p) => `
      <article>
        <h2><a href="/blog/${p.slug}">${escapeHtml(p.title)}</a></h2>
        <p>${escapeHtml(p.excerpt)}</p>
      </article>`,
    )
    .join("\n");
  return `<div><h1>BariQ Blog</h1><p>Guides on clinic queue management, pharmacy inventory, patient CRM, and digital records for Indian clinics.</p>${cards}</div>`;
}

function blogPostBodyHtml(slug: string): string | undefined {
  const post = getBlogPost(slug);
  if (!post) return undefined;
  return `<article><h1>${escapeHtml(post.title)}</h1>${post.contentHtml}</article>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Returns SEO overrides for a request path, or null if the path should just
// use index.html's default (landing page) tags untouched. Covers the public,
// pre-auth routes only — authenticated app screens are disallowed in
// robots.txt and gain nothing from server-side tag injection.
export function getSeoForPath(path: string): PageSeo | null {
  if (path === "/" ) return null;

  if (path === "/blog") {
    return {
      path,
      title: "BariQ Blog | Clinic Management, Queue and Pharmacy Guides for Indian Clinics",
      description: "Practical guides on clinic queue management, FEFO pharmacy inventory, patient CRM, digital prescriptions, and choosing clinic management software in India.",
      keywords: "clinic management blog, clinic software guides, pharmacy management India, OPD queue system, patient CRM guide",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "BariQ Blog",
          url: `${SITE}/blog`,
          blogPost: blogPosts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: `${SITE}/blog/${p.slug}`,
            datePublished: p.date,
          })),
        },
      ],
      bodyHtml: blogIndexBodyHtml(),
    };
  }

  if (path.startsWith("/blog/")) {
    const slug = path.slice("/blog/".length);
    const post = getBlogPost(slug);
    if (!post) return null;
    return {
      path,
      title: `${post.title} | BariQ Blog`,
      description: post.description,
      keywords: post.keywords,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          dateModified: post.updated || post.date,
          author: { "@type": "Organization", name: post.author, url: SITE },
          publisher: { "@type": "Organization", name: "BariQ", logo: { "@type": "ImageObject", url: `${SITE}/bariq_logo.jpg` } },
          mainEntityOfPage: `${SITE}${path}`,
          image: `${SITE}/bariq_fullimage.jpg`,
        },
      ],
      bodyHtml: blogPostBodyHtml(slug),
    };
  }

  const staticPage = STATIC_PAGES[path];
  if (staticPage) return { path, ...staticPage };

  return null;
}

// String-replaces the static meta tags in index.html with page-specific ones,
// and injects a pre-rendered content snapshot into #root so crawlers that
// don't execute JavaScript (many AI assistants and share-link unfurlers) see
// real content immediately. React's createRoot() overwrites this the moment
// the bundle hydrates, so it never affects the interactive app.
export function injectSeo(html: string, seo: PageSeo): string {
  const canonical = `${SITE}${seo.path}`;
  let out = html;

  out = out.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(seo.title)}</title>`);
  out = out.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeHtml(seo.description)}$2`);
  out = out.replace(/(<meta name="keywords" content=")[^"]*(")/, `$1${escapeHtml(seo.keywords)}$2`);
  out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`);
  out = out.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapeHtml(seo.title)}$2`);
  out = out.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapeHtml(seo.description)}$2`);
  out = out.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`);
  out = out.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escapeHtml(seo.title)}$2`);
  out = out.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escapeHtml(seo.description)}$2`);

  if (seo.jsonLd?.length) {
    const scripts = seo.jsonLd
      .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
      .join("\n");
    out = out.replace("</head>", `${scripts}\n</head>`);
  }

  if (seo.bodyHtml) {
    out = out.replace('<div id="root"></div>', `<div id="root">${seo.bodyHtml}</div>`);
  }

  return out;
}

export function buildSitemapXml(): string {
  const staticUrls: Array<{ loc: string; changefreq: string; priority: string }> = [
    { loc: "/", changefreq: "weekly", priority: "1.0" },
    { loc: "/signup", changefreq: "monthly", priority: "0.8" },
    { loc: "/partner-signup", changefreq: "monthly", priority: "0.5" },
    { loc: "/login", changefreq: "monthly", priority: "0.3" },
    { loc: "/blog", changefreq: "weekly", priority: "0.7" },
  ];
  const blogUrls = blogPosts.map((p) => ({
    loc: `/blog/${p.slug}`,
    changefreq: "monthly",
    priority: "0.6",
    lastmod: p.updated || p.date,
  }));

  const entries = [...staticUrls, ...blogUrls]
    .map((u) => {
      const lastmod = "lastmod" in u && u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : "";
      return `  <url>\n    <loc>${SITE}${u.loc}</loc>${lastmod}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
