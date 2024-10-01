const Moon = () => {
  return (
    <svg
      className="absolute left-1/2 top-8 z-0"
      width="226"
      height="234"
      viewBox="0 0 226 234"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g filter="url(#filter0_df_1128_217)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M129.122 81.8114C125.463 80.6356 121.557 80 117.5 80C96.7893 80 80 96.5655 80 117C80 137.435 96.7893 154 117.5 154C128.838 154 139.001 149.035 145.878 141.189C130.856 136.362 120 122.432 120 106C120 96.7526 123.438 88.2975 129.122 81.8114Z"
          fill="url(#paint0_linear_1128_217)"
        />
      </g>
      <defs>
        <filter
          id="filter0_df_1128_217"
          x="0"
          y="0"
          width="225.877"
          height="234"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset />
          <feGaussianBlur stdDeviation="40" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 1 0 0 0 0 0.905 0 0 0 0 0.7625 0 0 0 1 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_1128_217"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_1128_217"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="2"
            result="effect2_foregroundBlur_1128_217"
          />
        </filter>
        <linearGradient
          id="paint0_linear_1128_217"
          x1="332.606"
          y1="-53"
          x2="358.575"
          y2="26.1744"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFF6E9" />
          <stop offset="1" stopColor="#FDD9B0" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default Moon;
