import { SearchAutocomplete } from "~/components/internals/search-autocomplete";

const SITE_SECTIONS = [
  { id: "page1", label: "page1", description: "page 1 description", href: "/" },
  { id: "page2", label: "page2", description: "page 2 description", href: "/" },
  { id: "page3", label: "page3", description: "page 3 description", href: "/" },
  { id: "page4", label: "page4", description: "page 4 description", href: "/" },
  { id: "page5", label: "page5", description: "page 5 description", href: "/" },
  { id: "page6", label: "page6", description: "page 6 description", href: "/" },
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
