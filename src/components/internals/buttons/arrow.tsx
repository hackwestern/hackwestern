interface ArrowInterface {
  fill?: string;
  margin?: string;
  size?: "sm" | "lg";
  direction: "left" | "right";
}

export default function Arrow({
  fill,
  margin,
  size = "lg",
  direction,
}: ArrowInterface) {
  const arrows: Record<
    "sm" | "lg",
    { width: string; height: string; d: string }
  > = {
    lg: {
      width: "14",
      height: "13",
      d: "M8.53 0.53L8 0L6.94 1.06L7.47 1.59L11.44 5.56H0V7.06H11.44L7.47 11.03L6.94 11.56L8 12.62L8.53 12.09L13.604 7.017C13.7915 6.82947 13.8968 6.57516 13.8968 6.31C13.8968 6.04484 13.7915 5.79053 13.604 5.603L8.53 0.53Z",
    },
    sm: {
      width: "11",
      height: "10",
      d: "M6.3975 0.3975L6 0L5.205 0.795L5.6025 1.1925L8.58 4.17H0V5.295H8.58L5.6025 8.2725L5.205 8.67L6 9.465L6.3975 9.0675L10.203 5.26275C10.3436 5.1221 10.4226 4.93137 10.4226 4.7325C10.4226 4.53363 10.3436 4.3429 10.203 4.20225L6.3975 0.3975Z",
    },
  };

  return (
    <svg
      className={`${margin} ${direction == "left" && "-scale-x-100"}`}
      width={arrows[size].width}
      height={arrows[size].height}
      viewBox={`0 0 ${arrows[size].width} ${arrows[size].height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d={arrows[size].d}
        fill={fill ? fill : "currentColor"}
      />
    </svg>
  );
}
