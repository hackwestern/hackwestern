import Image from "next/image";

function MLHTrustBadge() {
  return (
    <a
      id="mlh-trust-badge"
      className="fixed top-0 z-50 block w-full min-w-5 max-w-16"
      href="https://mlh.io/na?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2025-season&utm_content=white"
      target="_blank"
    >
      <Image
        src="https://s3.amazonaws.com/logged-assets/trust-badge/2025/mlh-trust-badge-2025-white.svg"
        alt="Major League Hacking 2025 Hackathon Season"
        width={100}
        height={100}
        style={{ width: "100%", height: "auto" }}
      />
    </a>
  );
}

export default MLHTrustBadge;
