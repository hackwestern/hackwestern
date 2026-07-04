import Head from "next/head";
import { useRouter } from "next/router";

const SITE_URL = "https://hackwestern.com";
export const SITE_NAME = "Hack Western";
export const DEFAULT_TITLE = `${SITE_NAME} | Canada's Premier Student-Run Hackathon`;
export const DEFAULT_DESCRIPTION =
  "Hack Western is one of Canada's largest student-run hackathons, hosted annually at Western University in London, Ontario. Join 500+ students for a weekend of building, learning, and innovation.";
// Point at the canonical www host directly: the apex (SITE_URL) 308-redirects
// to www, and social scrapers fetch og:image poorly through redirects. Using
// the www URL also acts as a cache-bust so scrapers re-fetch the new image.
export const DEFAULT_OG_IMAGE = "https://www.hackwestern.com/meta/og-image.png";

interface SEOProps {
  title?: string;
  description?: string;
  ogImage?: string;
  noindex?: boolean;
}

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  ogImage = DEFAULT_OG_IMAGE,
  noindex = false,
}: SEOProps) {
  const router = useRouter();
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const canonicalUrl = `${SITE_URL}${router.asPath.split("?")[0]}`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} key="description" />
      <link rel="icon" href="/favicon.ico" />
      <link rel="canonical" href={canonicalUrl} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" key="og:type" />
      <meta property="og:site_name" content={SITE_NAME} key="og:site_name" />
      <meta property="og:title" content={fullTitle} key="og:title" />
      <meta
        property="og:description"
        content={description}
        key="og:description"
      />
      <meta property="og:url" content={canonicalUrl} key="og:url" />
      <meta property="og:image" content={ogImage} key="og:image" />
      <meta property="og:image:width" content="1200" key="og:image:width" />
      <meta property="og:image:height" content="630" key="og:image:height" />
      <meta property="og:locale" content="en_CA" key="og:locale" />

      {/* Twitter Card */}
      <meta
        name="twitter:card"
        content="summary_large_image"
        key="twitter:card"
      />
      <meta name="twitter:title" content={fullTitle} key="twitter:title" />
      <meta
        name="twitter:description"
        content={description}
        key="twitter:description"
      />
      <meta name="twitter:image" content={ogImage} key="twitter:image" />

      {/* Additional SEO */}
      <meta name="theme-color" content="#7C3AED" />
      <link rel="apple-touch-icon" href="/favicon.ico" />
    </Head>
  );
}
