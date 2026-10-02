import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/meta/manifest.json" />
      </Head>
      <body>
        {/* --ui-scale: past 1440 wide, promo elements grow at a third of the
            rate of the width (1.11 at 1920, 1.26 at 2560), a bit slower than
            the section heights. Set before first paint so wide screens don't
            jump. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var r=document.documentElement;function s(){r.style.setProperty("--ui-scale",String(Math.max(1,(2+r.clientWidth/1440)/3)))}s();addEventListener("resize",s)})();`,
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
