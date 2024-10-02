import Image from "next/image";
import { Button } from "../ui/button";
import { useRouter } from "next/router";

const CompLink = ({ href, text }: { href: string; text: string }) => {
  return (
    <a
      href={href}
      className="my-2.5 drop-shadow-[0_0px_6px_rgba(255,212,251,0.25)] transition-all hover:text-primary-300 hover:drop-shadow-[0_2px_12px_rgba(255,212,251,0.5)]"
    >
      {text}
    </a>
  );
};

const Header = () => {
  const router = useRouter();

  return (
    <div className="fixed z-[1000] hidden w-screen justify-between px-14 md:flex scroll-smooth">
      <a className="my-5 h-12 w-12" href="#home">
        <Image
          src="/images/hwoutlinelogo.svg"
          alt="hack western logo"
          width={0}
          height={0}
          className="h-auto w-full"
        />
      </a>
      <div className="flex">
        <div className="my-4 flex gap-12 text-primary-100 mr-8">
          <CompLink href="#about" text="About" />
          <CompLink href="#projects" text="Projects" />
          <CompLink href="#faq" text="FAQ" />
          <CompLink href="#sponsors" text="Sponsors" />
          <Button
            className="rounded-md bg-[#5E28B8] p-5 drop-shadow-[0_2px_24px_rgba(255,212,251,0.25)] transition-all hover:bg-[#5C2FAA] hover:drop-shadow-[0_2px_12px_rgba(255,212,251,0.5)]"
            onClick={() => router.push("/register")}
          >
            Apply Now
          </Button>
        </div>
        <a
          id="mlh-trust-badge"
          className="z-50 block w-full min-w-5 max-w-16"
          href="https://mlh.io/na?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2025-season&utm_content=white"
          target="_blank"
        >
          <Image
            src="https://s3.amazonaws.com/logged-assets/trust-badge/2025/mlh-trust-badge-2025-white.svg"
            alt="Major League Hacking 2025 Hackathon Season"
            width={0}
            height={0}
            className="h-auto w-full"
          />
        </a>
      </div>
    </div>
  );
};

export default Header;
