import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/meta/manifest.json" />
        <meta name="theme-color" content="#7C3AED" />
      </Head>
      <body>
        {/* --ui-scale: past 1440 wide, promo elements grow at half the rate of
            the width (1.17 at 1920, 1.39 at 2560), matching the section
            heights. Set before first paint so wide screens don't jump. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var r=document.documentElement;function s(){r.style.setProperty("--ui-scale",String(Math.max(1,0.5+r.clientWidth/2880)))}s();addEventListener("resize",s)})();`,
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
