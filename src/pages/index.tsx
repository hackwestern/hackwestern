import Head from "next/head";
import { Footer } from "~/components/footer";
import Hero from "~/components/promo/Hero";
import About from "~/components/promo/About";
import FAQ from "~/components/promo/faq";
import Projects from "~/components/promo/projects";

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
        <Projects />
        <FAQ />
        {/* MLH Code of Conduct */}
        <Footer className="fixed bottom-0 z-50" />
      </main>
    </>
  );
}
