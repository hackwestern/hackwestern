import { Search, X } from "lucide-react";
import { useRouter } from "next/router";
import * as React from "react";
import { useDebounce } from "use-debounce";

import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";


export interface AutocompleteOption {
  id: string;
  label: string;
  description?: string;
  href?: string;
}

export interface SearchAutocompleteProps {
  options: AutocompleteOption[];
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (option: AutocompleteOption) => void;
  placeholder?: string;
  emptyMessage?: string;
  /** ms to wait before filtering — mirrors the debounced-filtering pattern from the reference component */
  debounceMs?: number;
  className?: string;
}

function highlightMatch(label: string, query: string) {
  const q = query.trim();
  if (!q) return <>{label}</>;

  const index = label.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return <>{label}</>;

  const before = label.slice(0, index);
  const match = label.slice(index, index + q.length);
  const after = label.slice(index + q.length);

  return (
    <>
      {before}
      <span className="text-heavy font-semibold">{match}</span>
      {after}
    </>
  );
}

const SearchAutocomplete = React.forwardRef<
  HTMLInputElement,
  SearchAutocompleteProps
>(
  (
    {
      options,
      value,
      onChange,
      onSelect,
      placeholder = "Search…",
      emptyMessage = "No results found.",
      debounceMs = 200,
      className,
    },
    ref,
  ) => {
    const router = useRouter();

    const [query, setQuery] = React.useState(value ?? "");
    const [debouncedQuery] = useDebounce(query, debounceMs);
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);

    const containerRef = React.useRef<HTMLDivElement>(null);
    const listboxId = React.useId();

    // Keep in sync if this is used as a controlled input
    React.useEffect(() => {
      if (value !== undefined) setQuery(value);
    }, [value]);

    const filtered = React.useMemo(() => {
      const q = debouncedQuery.trim().toLowerCase();
      if (!q) return options;
      return options.filter(
        (option) =>
          option.label.toLowerCase().includes(q) ||
          option.description?.toLowerCase().includes(q),
      );
    }, [options, debouncedQuery]);

    // Reset the active (highlighted) row whenever the result set changes
    React.useEffect(() => {
      setActiveIndex(filtered.length > 0 ? 0 : -1);
    }, [filtered]);

    // Click-outside to close
    React.useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function commitSelection(option: AutocompleteOption) {
      setQuery(option.label);
      onChange?.(option.label);
      setOpen(false);

      if (onSelect) {
        onSelect(option);
      } else if (option.href) {
        void router.push(option.href);
      }
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
      if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        setOpen(true);
        return;
      }
      if (!open) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setActiveIndex((prev) => (prev + 1 >= filtered.length ? 0 : prev + 1));
          break;
        case "ArrowUp":
          event.preventDefault();
          setActiveIndex((prev) => (prev - 1 < 0 ? filtered.length - 1 : prev - 1));
          break;
        case "Enter":
          if (activeIndex >= 0 && filtered[activeIndex]) {
            event.preventDefault();
            commitSelection(filtered[activeIndex]);
          }
          break;
        case "Escape":
          setOpen(false);
          break;
        default:
          break;
      }
    }

    const activeOptionId =
      activeIndex >= 0 && filtered[activeIndex]
        ? `${listboxId}-${filtered[activeIndex].id}`
        : undefined;

    return (
      <div ref={containerRef} className={cn("relative w-full", className)}>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-[10px] top-1/2 h-4 w-4 -translate-y-1/2 text-gray-3"
          />

          <Input
            ref={ref}
            variant="default"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            autoComplete="off"
            value={query}
            placeholder={placeholder}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              onChange?.(next);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className="pl-[32px] pr-[32px]"
          />

          {query.length > 0 && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                onChange?.("");
                setOpen(false);
              }}
              className="absolute right-[8px] top-1/2 -translate-y-1/2 text-gray-3 transition-colors hover:text-gray-5"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {open && (
          <ul
            id={listboxId}
            role="listbox"
            className={cn(
              "absolute z-50 mt-[8px] max-h-[320px] w-full overflow-auto",
              "rounded-md border border-border-light bg-offwhite p-[4px]",
              "shadow-button-secondary",
            )}
          >
            {filtered.length === 0 ? (
              <li className="p3 px-[12px] py-[8px] text-light">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((option, index) => (
                <li
                  key={option.id}
                  id={`${listboxId}-${option.id}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    // keep focus on the input so the click can still commit
                    event.preventDefault();
                  }}
                  onClick={() => commitSelection(option)}
                  className={cn(
                    "flex cursor-pixel-hover flex-col rounded-sm px-[12px] py-[8px]",
                    index === activeIndex ? "bg-highlight" : "bg-transparent",
                  )}
                >
                  <span className="p2 text-medium">
                    {highlightMatch(option.label, debouncedQuery)}
                  </span>
                  {option.description && (
                    <span className="p3 text-light">{option.description}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    );
  },
);

SearchAutocomplete.displayName = "SearchAutocomplete";

export { SearchAutocomplete };