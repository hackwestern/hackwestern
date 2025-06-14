import Head from "next/head";
import { Footer } from "~/components/footer";
import Hero from "~/components/promo/Hero";
import Image from "next/image"
import About from "~/components/promo/About";
import FAQ from "~/components/promo/faq";
import Projects from "~/components/promo/projects";
import Sponsors from "~/components/promo/sponsors";
import Organizer from "~/components/promo/organizer";

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
      <main id="home" className="cursor-[url('/customcursor.svg'),auto]">
        
        {/* Text, Plane, and Clouds */}
        <Hero />
        {/* MLH Code of Conduct */}
        <Footer className="absolute bottom-4 right-4 z-50" />
        <a
          id="mlh-trust-badge"
          href="https://mlh.io/na?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2026-season&utm_content=white"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed top-0 right-[50px] z-[10000] w-[10%] max-w-[100px] min-w-[60px] block"
        >
          <Image
            src="https://s3.amazonaws.com/logged-assets/trust-badge/2026/mlh-trust-badge-2026-white.svg"
            alt="Major League Hacking 2026 Hackathon Season"
            width={100}
            height={100}
            className="w-full h-auto"
            priority
          />
        </a>
      </main>
    </>
  );
}
