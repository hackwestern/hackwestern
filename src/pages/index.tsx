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
import SEO from "~/components/seo";
import Head from "next/head";

export default function Home() {
  const router = useRouter();
  // prefetch register and login
  useEffect(() => {
    void router.prefetch("/register");
    void router.prefetch("/login");
  }, [router]);

  return (
    <>
      <SEO
        description="Hack Western is one of Canada's largest student-run hackathons, hosted annually at Western University in London, Ontario. Join 500+ students for a weekend of building, learning, and innovation."
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Event",
              name: "Hack Western",
              description:
                "One of Canada's largest student-run hackathons, hosted annually at Western University in London, Ontario.",
              url: "https://hackwestern.com",
              eventAttendanceMode:
                "https://schema.org/OfflineEventAttendanceMode",
              eventStatus: "https://schema.org/EventScheduled",
              location: {
                "@type": "Place",
                name: "Western University",
                address: {
                  "@type": "PostalAddress",
                  streetAddress: "1151 Richmond St",
                  addressLocality: "London",
                  addressRegion: "ON",
                  postalCode: "N6A 3K7",
                  addressCountry: "CA",
                },
              },
              organizer: {
                "@type": "Organization",
                name: "Hack Western",
                url: "https://hackwestern.com",
              },
              isAccessibleForFree: true,
              audience: {
                "@type": "Audience",
                audienceType: "Students",
              },
            }),
          }}
        />
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
        <Link href="/live" prefetch={true}>
          <motion.div
            className="fixed right-24 top-6 z-50 w-fit md:right-28 lg:right-44"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: growTransition }}
            exit={{ opacity: 0 }}
          >
            <Button variant="primary">Dashboard</Button>
          </motion.div>
        </Link>
      </main>
    </>
  );
}
