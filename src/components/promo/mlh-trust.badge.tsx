import Image from "next/image";

function MLHTrustBadge() {
  return (
    <a
      id="mlh-trust-badge"
      className="fixed right-4 top-0 z-50 block w-24 scale-50 sm:scale-75 md:right-8 md:scale-90 lg:right-16 lg:scale-100"
      href="https://mlh.io/na?utm_source=na-hackathon&utm_medium=TrustBadge&`utm_campaign=2026-season&utm_content=white"
      target="_blank"
    >
      <Image
        src="https://s3.amazonaws.com/logged-assets/trust-badge/2026/mlh-trust-badge-2026-white.svg"
        alt="Major League Hacking 2026 Hackathon Season"
        width={100}
        height={100}
        style={{ width: "100%", height: "auto" }}
      />
    </a>
  );
}

export default MLHTrustBadge;
