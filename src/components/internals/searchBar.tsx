import { SearchAutocomplete } from "~/components/internals/search-autocomplete";

const SITE_SECTIONS = [
  { id: "schedule", label: "Schedule", description: "Full event timeline", href: "/#schedule" },
  { id: "faq", label: "FAQ", description: "Common questions answered", href: "/#faq" },
  { id: "sponsors", label: "Sponsors", description: "Meet who's backing us", href: "/#sponsors" },
  { id: "prizes", label: "Prizes", description: "What you're hacking for", href: "/#prizes" },
  { id: "team", label: "Our Team", description: "The people behind HW13", href: "/#team" },
  { id: "apply", label: "Apply", description: "Submit your application", href: "/apply" },
];

export function SearchBar() {
  return (
    <div className="w-full max-w-[320px]">
      <SearchAutocomplete
        options={SITE_SECTIONS}
        placeholder="Search Hack Western…"
        emptyMessage="Nothing matches that — try “sponsors” or “faq”."
      />
    </div>
  );
}