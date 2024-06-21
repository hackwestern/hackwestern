import Head from "next/head";
import Image from "next/image";

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
      <main className="">
        <div className="relative h-screen flex-col items-center justify-center overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-full bg-hw-radial-gradient" />
          {/* Images */}
          <div>
            <div className="absolute bottom-0 left-0 h-full w-[80%]">
              <Image
                src="/images/cloud4.svg"
                alt="hack western cloud"
                layout="fill"
                objectFit="contain"
                objectPosition="bottom left"
              />
            </div>
            <div className="absolute bottom-0 left-0 h-full w-[30%]">
              <Image
                src="/images/cloud1.svg"
                alt="hack western cloud"
                layout="fill"
                objectFit="contain"
                objectPosition="bottom left"
              />
            </div>
            <div className="absolute bottom-0 right-0 h-full w-[70%]">
              <Image
                src="/images/cloud3.svg"
                alt="hack western cloud"
                layout="fill"
                objectFit="contain"
                objectPosition="bottom right"
              />
            </div>
            <div className="absolute bottom-0 right-0 h-full w-[30%]">
              <Image
                src="/images/cloud2.svg"
                alt="hack western cloud"
                layout="fill"
                objectFit="contain"
                objectPosition="bottom right"
              />
            </div>
            <div className="absolute bottom-10 right-[20%] h-[50%] w-[50%]">
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
          {/* Text */}
          <div className="relative flex h-screen w-screen justify-center">
            <div className="mt-[10%] flex flex-col items-center text-white">
              <h3 className="font-sans text-xl">Nov 29 - Dec 1</h3>
              <h1 className="bg-hw-hero-text-gradient bg-clip-text font-MagicRetro text-8xl leading-normal text-transparent mix-blend-screen">
                hack western 11
              </h1>
              <h2 className="font-sans text-2xl font-light italic">
                where ideas take flight
              </h2>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
