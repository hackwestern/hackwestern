import Head from "next/head";
import { useRouter } from "next/router";

const SITE_URL = "https://hackwestern.com";
const SITE_NAME = "Hack Western";
const DEFAULT_DESCRIPTION =
  "Hack Western is one of Canada's largest student-run hackathons, hosted annually at Western University in London, Ontario. Join 500+ students for a weekend of building, learning, and innovation.";
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-image.png`;

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
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Canada's Premier Student-Run Hackathon`;
  const canonicalUrl = `${SITE_URL}${router.asPath.split("?")[0]}`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="icon" href="/favicon.ico" />
      <link rel="canonical" href={canonicalUrl} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_CA" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Additional SEO */}
      <meta name="theme-color" content="#7C3AED" />
      <link rel="apple-touch-icon" href="/favicon.ico" />
    </Head>
  );
}
