import { cn } from "~/lib/utils";

type FooterProps = {
  className?: string;
};

export function Footer({ className }: FooterProps) {
  return (
    <footer
      className={cn(
        "flex w-full flex-row-reverse items-center justify-between py-4 text-white md:px-4 z-[100]",
        className,
      )}
    >
      <a
        href="https://static.mlh.io/docs/mlh-code-of-conduct.pdf"
        target="_blank"
      >
        MLH Code of Conduct
      </a>
    </footer>
  );
}
