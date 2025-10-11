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
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { growTransition } from "~/components/canvas/wrapper";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();
  // prefetch register and login
  useEffect(() => {
    void router.prefetch("/register");
    void router.prefetch("/login");
  }, [router]);

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
        <Link href="/register" prefetch={true}>
          <motion.div
            className="fixed right-24 top-6 z-50 w-fit md:right-28 lg:right-44"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: growTransition }}
            exit={{ opacity: 0 }}
          >
            <Button variant="primary">Apply</Button>
          </motion.div>
        </Link>
      </main>
    </>
  );
}
