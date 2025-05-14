import Image from "next/image";

const CloudBackground = () => {
  return (
    <div className="z-0">
      {/* Clouds */}
      <div className="absolute bottom-0 left-0 h-full w-full md:h-full md:w-[80%]">
        <Image
          src="/images/cloud5.svg"
          alt="hack western cloud"
          className="object-contain object-left-bottom"
          fill
        />
      </div>
      <div className="absolute bottom-0 right-0 h-full w-full md:h-[90%] md:w-[70%] lg:h-[100%]">
        <Image
          src="/images/cloud6.svg"
          alt="hack western cloud"
          className="object-contain object-right-bottom"
          fill
        />
      </div>
      <div className="absolute bottom-0 left-0 h-full w-[50%] md:h-full md:w-[30%]">
        <Image
          src="/images/cloud7.svg"
          alt="hack western cloud"
          className="object-contain object-left-bottom"
          fill
        />
      </div>
      <div className="absolute bottom-0 right-0 h-full w-[50%] md:h-full md:w-[40%] lg:h-[50%] lg:w-[30%]">
        <Image
          src="/images/cloud8.svg"
          alt="hack western cloud"
          className="object-contain object-right-bottom"
          fill
        />
      </div>
      {/* Stars */}
      <div className="absolute bottom-[20%] left-[20%] h-full w-[20%] md:w-[10%] lg:w-[5%]">
        <Image
          src="/images/star.svg"
          alt="hack western star"
          className="object-contain"
          fill
        />
      </div>
      <div className="absolute bottom-[40%] right-[10%] h-full w-[15%] md:w-[7%] lg:w-[3%]">
        <Image
          src="/images/star.svg"
          alt="hack western star"
          className="object-contain"
          fill
        />
      </div>
      <div className="absolute bottom-[25%] right-[15%] h-full w-[20%] md:w-[10%] lg:w-[5%] ">
        <Image
          src="/images/star2.svg"
          alt="hack western star"
          className="object-contain"
          fill
        />
      </div>
      {/* Grain Filter */}
      <Image
        className="absolute left-0 top-0 select-none opacity-20"
        src="/images/hwfilter.png"
        alt="Hack Western Main Page"
        layout="fill"
        objectFit="cover"
      />
    </div>
  );
};

export default CloudBackground;
