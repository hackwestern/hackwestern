import Head from "next/head";
import Image from "next/image";
import { Footer } from "~/components/footer";
import MLHTrustBadge from "~/components/promo/mlh-trust.badge";
import { PreregistrationForm } from "~/components/preregistration-form";
import Hero from "~/components/promo/Hero";
import About from "~/components/promo/About";
import FAQ from "~/components/promo/faq";
import Projects from "~/components/promo/projects";
import Header from "~/components/promo/header";

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
      <main>
        {/* Text, Plane, and Clouds */}
        <Hero />
        {/* About ticket and Window */}
        <About />
        {/* MLH Code of Conduct */}
        <Footer className="fixed bottom-0 z-50" />
      </main>
    </>
  );
}
