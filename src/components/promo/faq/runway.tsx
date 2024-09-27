const Runway = () => {
  return (
    <svg
      height="208"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="bottom-0 z-50 w-screen"
    >
      <rect x="-15" className="w-screen" height="208" fill="#D9D9D9" />
      <rect
        x="-15"
        className="w-screen"
        height="208"
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
        x1="-25.5"
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
