import Image from "next/image";

function About() {
  return (
    <div className="bg-hw-linear-gradient relative flex-col items-center justify-center overflow-hidden">
      {/* Grain Filter */}
      <div
        className="relative left-0 top-0 h-[20vh] w-full sm:h-[50vh]"
        id="about"
      >
        <Image
          className="select-none opacity-20"
          src="/images/hwfilter.png"
          alt="Hack Western Main Page"
          fill
        />
        <div className="animate-cloud1 absolute z-40 h-[120%] w-[100%] delay-75 sm:h-[60%] lg:h-[100%] xl:-top-40 xl:h-[150%]">
          <Image
            src="/images/aboutcloud.svg"
            alt="hack western cloud"
            className="object-contain object-right"
            fill
          />
        </div>
        <div className="animate-cloud4 absolute -top-24 z-20 h-[300%] w-[100%] delay-75 sm:top-0 sm:h-[150%] lg:h-[150%] xl:-top-24 xl:h-[200%]">
          <Image
            src="/images/aboutcloud2.svg"
            alt="hack western cloud"
            className="object-contain object-left"
            fill
          />
        </div>
        <div className="relative z-30 mx-auto flex h-full w-[90%] lg:w-[50%]">
          <Image
            src="/images/aboutticket.svg"
            alt="hack western about ticket"
            className="object-contain"
            fill
          />
        </div>
        <div className="animate-star-pulse-1 absolute left-[7%] top-[130%] z-40 h-[70px] w-[70px]  ">
          <Image
            src="/images/promostar.svg"
            alt="hack western star"
            className="object-contain"
            fill
          />
        </div>
        <div className="animate-star-pulse-3 absolute left-[70%] top-[10%] z-40 hidden h-[55px] w-[55px] md:block  ">
          <Image
            src="/images/promostar.svg"
            alt="hack western star"
            className="object-contain"
            fill
          />
        </div>
        <div className="animate-star-pulse-1 absolute left-[85%] top-[80%] z-40 h-[70px] w-[70px]  ">
          <Image
            src="/images/promostar.svg"
            alt="hack western star"
            className="object-contain"
            fill
          />
        </div>
      </div>
      <div className="relative left-0 top-0 mb-10 h-[50vh] w-full sm:h-[50vh]">
        <Image
          className="opacity-20"
          src="/images/hwfilter.png"
          alt="Hack Western Main Page"
          fill
        />
        <div className="md: absolute left-[10%] top-24 z-40 h-full max-h-none w-[200%] max-w-none sm:left-1/4 md:h-[150%] lg:top-10 lg:h-[200%] 3xl:left-1/3">
          <Image
            src="/images/window.svg"
            alt="hack western window"
            className="object-contain object-left"
            fill
          />
        </div>
        <div className="absolute left-1/2 top-1/4 flex w-[48%] flex-col justify-center ">
          <h2 className="z-30 font-MagicRetro text-4xl text-white sm:top-20 md:top-24 xl:text-5xl  2xl:text-6xl">
            about us
          </h2>
          <p className="z-30 h-1/3 text-xs text-white sm:top-32 md:top-36 md:w-96 lg:text-sm xl:text-base 3xl:text-lg">
            Founded in 2014, we&apos;re a team of technologists,
            problem-solvers, and creatives dedicated to building the technology
            community at Western University. Our mission since day one has been
            to foster an approachable and accessible environment for students
            from all backgrounds to learn about technology. We host Hack
            Western—one of Canada&apos;s largest and oldest annual student-run
            hackathons to further this goal.
          </p>
        </div>
      </div>
    </div>
  );
}

export default About;
