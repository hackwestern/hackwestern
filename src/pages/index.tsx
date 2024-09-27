import Head from "next/head";
import Image from "next/image";
import { Footer } from "~/components/footer";
import { PreregistrationForm } from "~/components/preregistration-form";
import Sponsors from "~/components/promo/sponsors";

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
      <main className="bg-hw-radial-gradient">
        <div className="relative h-screen flex-col items-center justify-center overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-full" />
          {/* Images */}
          <div className="absolute left-[39%] top-[59%] h-10 w-10 sm:left-[37%] sm:top-[55%] sm:h-16 sm:w-16 md:left-[37%] md:top-[50%] md:h-28 md:w-28 xl:left-[39%] xl:top-[50%] ">
            <Image src="/images/sun.svg" alt="hack western 11 sun" fill />
          </div>
          <div>
            <div className="absolute bottom-0 left-0 h-full w-full md:h-full md:w-[80%]">
              <Image
                src="/images/cloud4.svg"
                alt="hack western cloud"
                className="object-contain object-left-bottom"
                fill
              />
            </div>
            <div className="absolute bottom-0 right-0 h-full w-full md:h-full md:w-[70%]">
              <Image
                src="/images/cloud3.svg"
                alt="hack western cloud"
                className="object-contain object-right-bottom"
                fill
              />
            </div>
            <div className="absolute bottom-0 left-0 h-full w-[50%] md:h-full md:w-[30%]">
              <Image
                src="/images/cloud1.svg"
                alt="hack western cloud"
                className="object-contain object-left-bottom"
                fill
              />
            </div>
            <div className="absolute bottom-0 right-0 h-full w-[50%] md:h-full md:w-[30%]">
              <Image
                src="/images/cloud2.svg"
                alt="hack western cloud"
                className="object-contain object-right-bottom"
                fill
              />
            </div>
            <div className="absolute bottom-[40%] right-[50%] flex h-[80%] w-[80%] translate-x-1/2 translate-y-1/2 sm:bottom-[5%] sm:right-[15%] sm:h-[60%] sm:w-[60%] sm:translate-x-0 sm:translate-y-0 md:bottom-[10%] md:right-[30%] md:h-[40%] md:w-[40%] md:translate-x-0 md:translate-y-0 lg:bottom-[7%] lg:right-[27%] lg:h-[40%] lg:w-[40%] lg:translate-x-0 lg:translate-y-0">
              <Image
                src="/images/plane.svg"
                alt="hack western plane"
                layout="fill"
                objectFit="contain"
              />
            </div>
          </div>

          {/* Grain Filter */}
          <Image
            className="absolute left-0 top-0 opacity-20"
            src="/images/hwfilter.png"
            alt="Hack Western Main Page"
            layout="fill"
            objectFit="cover"
          />
          <div className="absolute left-0 top-0 m-7 h-10 w-10 md:h-14 md:w-14 ">
            <Image
              src="/images/hwoutlinelogo.svg"
              alt="hack western logo"
              layout="fill"
              objectFit="contain"
            />
          </div>
          {/* Text */}
          <div className="relative flex h-screen w-screen justify-center">
            <div className="flex flex-col items-center pt-32 text-white">
              <h3 className="pb-4 text-xl font-medium">
                November 29 - December 1st, 2024
              </h3>
              <h1 className="bg-hw-hero-text-gradient bg-clip-text font-MagicRetro text-5xl leading-normal text-transparent mix-blend-screen md:text-5xl lg:text-8xl 2xl:text-8xl">
                hack western 11
              </h1>
              <h2 className="-mt-3 font-sans text-xl font-light italic md:-mt-1 md:text-2xl lg:text-3xl 2xl:text-4xl">
                where ideas take flight
              </h2>
              <PreregistrationForm className="py-7" />
            </div>
          </div>
        </div>
        <Sponsors />
        <Footer className="fixed bottom-0" />
      </main>
    </>
  );
}
