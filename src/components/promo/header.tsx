import Image from "next/image";
import { Button } from "../ui/button";
import Link from "next/link";

const HeadingLink = ({ href, text }: { href: string; text: string }) => {
  return (
    <Button asChild>
      <a
        href={href}
        className="drop-shadow-[0_0px_6px_rgba(255,212,251,0.25)] transition-all hover:text-primary-300 hover:drop-shadow-[0_2px_12px_rgba(255,212,251,0.5)]"
      >
        {text}
      </a>
    </Button>
  );
};

const Header = () => {
  return (
    <div className="fixed z-[1000] flex w-screen items-center justify-between scroll-smooth px-6 md:px-14">
      <Button asChild className="h-full w-12 bg-transparent p-0">
        <a className="mt-4 w-12 md:mt-0" href="#home">
          <Image
            src="/images/hwoutlinelogo.svg"
            alt="hack western logo"
            width={0}
            height={0}
            className="h-auto w-full"
          />
        </a>
      </Button>
      <div className="flex">
        <div className="flex hidden items-center gap-4 px-8 py-3 text-primary-100 md:flex">
          <HeadingLink href="#about" text="About" />
          <HeadingLink href="#projects" text="Projects" />
          <HeadingLink href="#sponsors" text="Sponsors" />
          <HeadingLink href="#faq" text="FAQ" />
          <Button
            className="rounded-md bg-[#5E28B8] p-5 drop-shadow-[0_2px_24px_rgba(255,212,251,0.25)] transition-all hover:bg-[#5C2FAA] hover:drop-shadow-[0_2px_12px_rgba(255,212,251,0.5)]"
            asChild
          >
            <Link href="/live">Live Site</Link>
          </Button>
        </div>
        <Button asChild className="flex h-auto bg-transparent p-0">
          <a
            id="mlh-trust-badge"
            className="md:max-w-18 z-50 block w-full min-w-5 max-w-16 xl:max-w-20"
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
        </Button>
      </div>
    </div>
  );
};

export default Header;
