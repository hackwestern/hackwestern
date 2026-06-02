import type { GetServerSidePropsContext } from "next";

const SITE_URL = "https://hackwestern.com";

function generateSiteMap() {
  const pages = [
    { path: "/", priority: "1.0", changefreq: "weekly" },
    { path: "/register", priority: "0.8", changefreq: "monthly" },
    { path: "/login", priority: "0.7", changefreq: "monthly" },
    { path: "/apply", priority: "0.9", changefreq: "monthly" },
    { path: "/live", priority: "0.6", changefreq: "daily" },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;
}

export default function SiteMap() {
  // This component is never rendered
  return null;
}

export function getServerSideProps({ res }: GetServerSidePropsContext) {
  const sitemap = generateSiteMap();

  res.setHeader("Content-Type", "text/xml");
  res.write(sitemap);
  res.end();

  return { props: {} };
}
