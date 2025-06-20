import Head from "next/head";
import { Footer } from "~/components/footer";
import Hero from "~/components/promo/Hero";
import Image from "next/image";
import Canvas from "~/components/canvas/canvas";

export default function Home() {
  return (
    <>
      <Head>
        <title>Hack Western</title>
        <meta
          name="description"
          content="Hack Western: One of Canada's largest annual student-run hackathons based out of Western University in London, Ontario."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main id="home" className="cursor-grab">

        <Canvas>
          <Hero />
        </Canvas>
        {/* MLH Code of Conduct */}
        <Footer className="absolute bottom-2 right-2 z-20 cursor-[url('/customcursor.svg'),auto] text-sm sm:text-base" />
        <a
          id="mlh-trust-badge"
          href="https://mlh.io/na?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2026-season&utm_content=white"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed right-[50px] top-0 z-[10000] block w-[10%] min-w-[60px] max-w-[100px]"
        >
          <Image
            src="https://s3.amazonaws.com/logged-assets/trust-badge/2026/mlh-trust-badge-2026-white.svg"
            alt="Major League Hacking 2026 Hackathon Season"
            width={100}
            height={100}
            className="h-auto w-full"
            priority
          />
        </a>
      </main>
    </>
  );
}
