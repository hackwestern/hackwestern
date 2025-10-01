import Head from "next/head";
import { Footer } from "~/components/footer";
import Hero from "~/components/promo/hero";
import Canvas from "~/components/canvas/canvas";
import Sponsors from "~/components/promo/sponsors";
import About from "~/components/promo/about";
import Projects from "~/components/promo/projects";
import FAQ from "~/components/promo/faq";
import Team from "~/components/promo/team";
import { coordinates } from "~/constants/canvas";
import MLHTrustBadge from "~/components/promo/mlh-trust.badge";

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
      <main
        id="home"
        className="relative min-h-screen cursor-[url('/customcursor.svg'),auto]"
      >
        <Canvas homeCoordinates={coordinates.home}>
          <Hero />
          <Sponsors />
          <About />
          <Projects />
          <FAQ />
          <Team />
        </Canvas>
        <Footer />
        <MLHTrustBadge />
      </main>
    </>
  );
}
