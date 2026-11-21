import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import Head from "next/head";
import { useEffect, useState } from "react";
import localFont from "next/font/local";
import { api } from "~/utils/api";
import { SpeedInsights } from "@vercel/speed-insights/next";
import dynamic from "next/dynamic";

// Agentation: a toolbar to click elements and leave notes for the coding
// agent. In development it syncs live to the agentation MCP server on :4747.
// NEXT_PUBLIC_AGENTATION=1 (set only when building the laptop test copy for
// the spon team) also turns it on in a production build, without sync:
// testers copy their notes and send them. Never set on Vercel.
const AGENTATION_DEV = process.env.NODE_ENV === "development";
const Agentation =
  AGENTATION_DEV || process.env.NEXT_PUBLIC_AGENTATION === "1"
    ? dynamic(() => import("agentation").then((m) => m.Agentation), {
        ssr: false,
      })
    : null;

// Agentation is desktop only (its README: mobile not supported), and on a
// phone it sits over the sponsor portal's bottom tab bar. Show it only on a
// laptop-sized screen with a mouse.
const DESKTOP_QUERY = "(min-width: 1024px) and (pointer: fine)";
function useDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

import "~/styles/globals.css";
import { Toaster } from "~/components/ui/sonner";
import { Toaster as CustomToaster } from "~/components/ui/toaster";
import { TooltipProvider } from "~/components/ui/tooltip";
import {
  SocialMeta,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
} from "~/components/seo";

const cossetteTexte = localFont({
  src: [
    {
      path: "../../public/shared/fonts/cossetteTexte/CossetteTexte-Bold.woff2",
      weight: "700",
    },
    {
      path: "../../public/shared/fonts/cossetteTexte/CossetteTexte-Regular.woff2",
      weight: "400",
    },
  ],
  variable: "--font-cossetteTexte",
  display: "swap",
});

const pix32 = localFont({
  src: "../../public/shared/fonts/pix32/Pix32.woff2",
  variable: "--font-pix32",
  display: "swap",
});

// Self-hosted so builds don't fetch from Google Fonts (that fetch kept
// failing CI and Vercel builds)
const figtree = localFont({
  src: "../../public/shared/fonts/figtree/Figtree-Variable.woff2",
  weight: "300 900",
  variable: "--font-figtree",
  fallback: ["Inter", "sans-serif"],
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  const desktop = useDesktop();
  // Dialogs and other portals render into <body>, outside <main>, so give
  // <body> the font variables too or they fall back to the system font.
  useEffect(() => {
    document.body.classList.add(
      figtree.variable,
      cossetteTexte.variable,
      pix32.variable,
    );
  }, []);

  return (
    <SessionProvider session={session}>
      {/* Site-wide default social tags. Pages that render <SEO/> override
          these via matching `key`s; pages without it (e.g. the home page)
          fall back to these, so every route has a link preview. */}
      <SocialMeta
        title={DEFAULT_TITLE}
        description={DEFAULT_DESCRIPTION}
        image={DEFAULT_OG_IMAGE}
      />
      {/* Keyed so a page can swap the browser tint (the home page does) */}
      <Head>
        <meta name="theme-color" content="#7C3AED" key="theme-color" />
      </Head>
      <SpeedInsights />
      <main
        className={`${figtree.variable} font-secondary ${cossetteTexte.variable} font-cossetteTexte ${pix32.variable} font-pix32`}
      >
        <TooltipProvider>
          <Component {...pageProps} />
        </TooltipProvider>
      </main>
      <Toaster style={{ zIndex: 90 }} />
      <CustomToaster />
      {Agentation &&
        desktop &&
        (AGENTATION_DEV ? (
          <Agentation endpoint="http://localhost:4747" />
        ) : (
          <Agentation />
        ))}
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
