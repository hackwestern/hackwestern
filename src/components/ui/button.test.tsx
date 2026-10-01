import { describe, expect, test } from "vitest";
import { renderToString } from "react-dom/server";
import Link from "next/link";
import { Button } from "~/components/ui/button";

// asChild swaps the <button> for Radix Slot, which merges the button's props
// onto its one child. Slot throws "React.Children.only expected to receive a
// single React element child" when it is handed more than one, and design
// system v2 (#859) did exactly that: the top highlight span plus the children
// (or `false` plus the children for non-primary variants). Every
// <Button asChild> crashed, which took /register and /login down with a 500.
describe("Button asChild", () => {
  test("tertiary renders as its child element", () => {
    const html = renderToString(
      <Button asChild variant="tertiary">
        <Link href="/login">Log in</Link>
      </Button>,
    );

    expect(html).toContain('href="/login"');
    expect(html).not.toContain("<button");
  });

  test("primary renders as its child element and keeps the top highlight", () => {
    const html = renderToString(
      <Button asChild variant="primary">
        <Link href="/internal/cheat-check">Cheat Checks</Link>
      </Button>,
    );

    expect(html).toContain('href="/internal/cheat-check"');
    expect(html).not.toContain("<button");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Cheat Checks");
  });

  test("without asChild it is still a button with the highlight", () => {
    const html = renderToString(<Button variant="primary">Submit</Button>);

    expect(html).toContain("<button");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Submit");
  });
});
