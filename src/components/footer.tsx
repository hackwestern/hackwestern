import { cn } from "~/lib/utils";

type FooterProps = {
  className?: string;
};

export function Footer({ className }: FooterProps) {
  return (
    <footer
      className={cn(
        "z-[100] flex w-full flex-row-reverse items-center justify-between text-heavy md:px-4 md:py-4",
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
