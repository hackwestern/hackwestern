import Image from "next/image";

function About() {
  return (
    <div className="relative flex-col items-center justify-center overflow-hidden bg-hw-linear-gradient">
      {/* Grain Filter */}
      <div className="relative left-0 top-0 h-[20vh] w-full sm:h-[50vh]">
        <Image
          className="opacity-20"
          src="/images/hwfilter.png"
          alt="Hack Western Main Page"
          fill
        />
        <div className="absolute z-40 h-[50%] w-[100%] animate-cloud2 delay-75 md:h-[60%] lg:h-[75%] xl:h-[90%]">
          <Image
            src="/images/aboutcloud.svg"
            alt="hack western cloud"
            className="object-contain object-right"
            fill
          />
        </div>
        <div className="relative z-30 mx-auto flex h-full w-[90%] lg:w-[50%]">
          <Image
            src="/images/aboutticket.svg"
            alt="hack western cloud"
            className="object-contain"
            fill
          />
        </div>
      </div>
      <div className="relative left-0 top-0 h-[50vh] w-full">
        <Image
          className="opacity-20"
          src="/images/hwfilter.png"
          alt="Hack Western Main Page"
          fill
        />
        <Image
          src="/images/window.svg"
          alt="hack western cloud"
          className="absolute -bottom-44 left-[10%] z-40 max-h-none max-w-none  sm:left-[20%] md:left-1/4 lg:left-1/3 3xl:-bottom-44"
          height={1080}
          width={1080}
        />
        <div className="absolute left-1/2 top-1/4 flex w-[48%] flex-col justify-center ">
          <h2 className="z-30 font-MagicRetro text-4xl text-white sm:top-20 md:top-24 xl:text-5xl">
            about us
          </h2>
          <p className="z-30 h-1/3 text-xs text-white sm:top-32 md:top-36 md:w-96 lg:text-sm xl:text-base">
            Founded in 2014, we&apos;re a team of technologists,
            problem-solvers, and creatives dedicated to building the technology
            community at Western University. Our mission since day one has been
            to foster an approachable and accessible environment for students
            from all backgrounds to learn about technology. We host Hack
            Western—one of Canada's largest and oldest annual student-run
            hackathons to further this goal.
          </p>
        </div>
      </div>
    </div>
  );
}

export default About;
