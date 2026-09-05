import { Link } from "wouter";
import { Stethoscope, ArrowRight, Calendar, Clock, MessageCircle, Phone } from "lucide-react";
import { blogPosts } from "@shared/blog-posts";
import { useSeo } from "@/lib/useSeo";

const WHATSAPP = "https://wa.me/918989496800";

export default function Blog() {
  useSeo({
    title: "BariQ Blog | Clinic Management, Queue and Pharmacy Guides for Indian Clinics",
    description:
      "Practical guides on clinic queue management, FEFO pharmacy inventory, patient CRM, digital prescriptions, and choosing clinic management software in India.",
    keywords:
      "clinic management blog, clinic software guides, pharmacy management India, OPD queue system, patient CRM guide",
    canonical: "/blog",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "BariQ Blog",
      url: "https://bariq.tirthontech.com/blog",
      description:
        "Practical guides on clinic queue management, pharmacy inventory, patient CRM, and digital records for Indian clinics.",
      blogPost: blogPosts.map((p) => ({
        "@type": "BlogPosting",
        headline: p.title,
        url: `https://bariq.tirthontech.com/blog/${p.slug}`,
        datePublished: p.date,
        author: { "@type": "Organization", name: p.author },
      })),
    },
  });

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

      <header className="pt-16 pb-12 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 border border-gray-300 bg-white/60 text-gray-600 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            The BariQ Blog
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Guides for running a smarter clinic
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed">
            Practical, no-fluff articles on queue management, pharmacy inventory, patient CRM, and digital records —
            written for Indian clinic owners and staff.
          </p>
        </div>
      </header>

      <main className="pb-24 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {blogPosts
            .slice()
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`}>
                <article className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-7 h-full flex flex-col cursor-pointer">
                  <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full mb-4 w-fit">
                    {post.category}
                  </span>
                  <h2 className="text-lg font-bold text-gray-900 mb-2 leading-snug">{post.title}</h2>
                  <p className="text-gray-500 text-sm leading-relaxed mb-5 flex-1">{post.excerpt}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400 mt-auto pt-4 border-t border-gray-100">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {post.readTime}
                    </span>
                  </div>
                </article>
              </Link>
            ))}
        </div>
      </main>

      <section className="py-16 px-6 border-t border-gray-200">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-3">Have a question about your clinic?</h2>
          <p className="text-gray-500 mb-6">Call or WhatsApp us directly — we reply the same day.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="tel:+918989496800" className="flex items-center gap-2 text-gray-700 font-semibold hover:text-teal-700">
              <Phone className="w-4 h-4 text-teal-600" /> +91 89894 96800
            </a>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-5 py-2.5 rounded-lg font-semibold text-sm"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp Us
            </a>
          </div>
        </div>
      </section>

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
