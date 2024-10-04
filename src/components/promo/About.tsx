import Image from "next/image";

function About() {
  return (
    <div className="relative h-screen flex-col items-center justify-center overflow-hidden bg-hw-linear-gradient">
      {/* Grain Filter */}
      <div className="absolute left-0 top-0 h-full w-full">
        <Image
          className="opacity-20"
          src="/images/hwfilter.png"
          alt="Hack Western Main Page"
          fill
        />
      </div>
    </div>
  );
}

export default About;
