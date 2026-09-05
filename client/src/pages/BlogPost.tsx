import { Link, useParams, Redirect } from "wouter";
import { Stethoscope, ArrowRight, ArrowLeft, Calendar, Clock, MessageCircle, Phone } from "lucide-react";
import { blogPosts, getBlogPost } from "@shared/blog-posts";
import { useSeo } from "@/lib/useSeo";

const WHATSAPP = "https://wa.me/918989496800";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = getBlogPost(slug || "");

  useSeo({
    title: post ? `${post.title} | BariQ Blog` : "Article not found | BariQ Blog",
    description: post?.description || "This article could not be found.",
    keywords: post?.keywords,
    canonical: post ? `/blog/${post.slug}` : undefined,
    type: "article",
    jsonLd: post
      ? [
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            dateModified: post.updated || post.date,
            author: { "@type": "Organization", name: post.author, url: "https://bariq.tirthontech.com" },
            publisher: {
              "@type": "Organization",
              name: "BariQ",
              logo: { "@type": "ImageObject", url: "https://bariq.tirthontech.com/bariq_logo.jpg" },
            },
            mainEntityOfPage: `https://bariq.tirthontech.com/blog/${post.slug}`,
            image: "https://bariq.tirthontech.com/bariq_fullimage.jpg",
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://bariq.tirthontech.com/" },
              { "@type": "ListItem", position: 2, name: "Blog", item: "https://bariq.tirthontech.com/blog" },
              { "@type": "ListItem", position: 3, name: post.title, item: `https://bariq.tirthontech.com/blog/${post.slug}` },
            ],
          },
        ]
      : undefined,
  });

  if (!post) {
    return <Redirect to="/blog" />;
  }

  const related = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: "#f0f0ea", color: "#111" }}>
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-[#f0f0ea]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 shrink-0 cursor-pointer">
              <div className="w-8 h-8 bg-teal-700 rounded-lg flex items-center justify-center">
                <Stethoscope className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">BariQ</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <button className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-2 transition-colors">
                Sign In
              </button>
            </Link>
            <Link href="/signup">
              <button className="bg-teal-700 hover:bg-teal-800 text-white px-5 h-9 text-sm font-semibold rounded-lg inline-flex items-center">
                Get Started
                <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <article className="pt-14 pb-10 px-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-teal-700 font-medium hover:underline mb-6">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Blog
          </Link>

          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full mb-4">
            {post.category}
          </span>

          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight mb-5">{post.title}</h1>

          <div className="flex items-center gap-4 text-sm text-gray-400 mb-10 pb-8 border-b border-gray-200">
            <span>{post.author}</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {post.readTime}
            </span>
          </div>

          <div
            className="prose-blog text-gray-700 leading-relaxed space-y-5 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-gray-900 [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mt-8 [&_h3]:mb-3 [&_p]:mb-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ul]:space-y-2 [&_li]:leading-relaxed [&_a]:text-teal-700 [&_a]:font-medium [&_a]:hover:underline [&_strong]:text-gray-900"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
        </div>
      </article>

      <section className="py-14 px-6 bg-white border-t border-gray-200">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl font-extrabold text-gray-900 mb-3">Ready to try BariQ in your clinic?</h2>
          <p className="text-gray-500 mb-6">Start a free 7 day trial, or talk to us first — no credit card required either way.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <button className="bg-teal-700 hover:bg-teal-800 text-white px-6 h-11 rounded-xl font-semibold text-sm inline-flex items-center">
                Start Free Trial <ArrowRight className="ml-1.5 w-4 h-4" />
              </button>
            </Link>
            <a href="tel:+918989496800" className="flex items-center gap-2 text-gray-700 font-semibold hover:text-teal-700">
              <Phone className="w-4 h-4 text-teal-600" /> +91 89894 96800
            </a>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-700 font-semibold hover:text-teal-700">
              <MessageCircle className="w-4 h-4 text-teal-600" /> WhatsApp
            </a>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-extrabold text-gray-900 mb-6">More from the blog</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {related.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`}>
                  <article className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-6 cursor-pointer h-full">
                    <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full mb-3">
                      {p.category}
                    </span>
                    <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug">{p.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{p.excerpt}</p>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-gray-200 px-6 py-8">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-400">
          © {new Date().getFullYear()} BariQ. Built by{" "}
          <a href="https://www.tirthontech.com" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline font-medium">
            TirthonTech
          </a>
          .
        </div>
      </footer>
    </div>
  );
}
