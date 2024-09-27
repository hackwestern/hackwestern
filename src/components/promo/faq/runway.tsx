const Runway = () => {
  return (
    <svg
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="z-50 h-[150px] w-screen md:h-[208px]"
    >
      <rect
        x="-15"
        className="h-[150px] w-[5000px] md:h-[208px]"
        fill="#D9D9D9"
      />
      <rect
        x="-15"
        className="h-[150px] w-[5000px] md:h-[208px]"
        fill="url(#paint0_linear_1165_628)"
      />
      <defs>
        <linearGradient
          id="paint0_linear_1165_628"
          x1="1449"
          y1="-39.619"
          x2="1449"
          y2="208"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="#9D7FCF" />
          <stop offset="1" stop-color="#845BB9" />
        </linearGradient>
      </defs>
      <line
        className="md:invisible"
        x1="-2.5"
        y1="75"
        x2="5437.5"
        y2="75"
        stroke="#DAD7F1"
        strokeWidth="5"
        strokeDasharray="10 20"
      />
      <line
        className="invisible md:visible"
        x1="-2.5"
        y1="104"
        x2="5437.5"
        y2="104"
        stroke="#DAD7F1"
        strokeWidth="5"
        strokeDasharray="10 20"
      />
    </svg>
  );
};

export default Runway;
