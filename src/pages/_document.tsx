import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/meta/manifest.json" />
        <meta name="theme-color" content="#7C3AED" />
      </Head>
      <body>
        {/* --ui-scale: how much the promo page's 1440-wide desktop layout grows
            on wider screens (1 up to 1440, capped at 4/3 from 1920 wide). Set
            before first paint so large displays don't load small, then jump. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var r=document.documentElement;function s(){r.style.setProperty("--ui-scale",String(Math.min(Math.max(r.clientWidth/1440,1),4/3)))}s();addEventListener("resize",s)})();`,
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
