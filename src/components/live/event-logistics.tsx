import ReactMarkdown, { type Components } from "react-markdown";
import { useState, useEffect, useRef } from "react";
import { PackingList, type Item } from "~/constants/packingList";
import { logisticsHref, logisticsSteps } from "~/constants/event-logistics";
import { DashboardCheckbox } from "~/components/internals/dashboard-checkbox";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { LogisticsSidebar } from "./logistics-sidebar";
import LogisticsTopbar from "./logistics-topbar";

// Markdown styling from the Figma event logistics pages: 24px Medium section
// headings, 16px body, 36px between sections and 12px under each heading.
const markdownComponents: Components = {
  h1: ({ node: _node, ...props }) => (
    <h2
      className="mb-3 mt-9 text-2xl font-medium leading-default text-dashboard-text-heavy first:mt-0"
      {...props}
    />
  ),
  p: ({ node: _node, ...props }) => (
    <p
      className="mb-3 text-base font-medium leading-normal text-dashboard-text-medium"
      {...props}
    />
  ),
  a: ({ node: _node, ...props }) => (
    <a
      className="cursor-pixel-hover text-dashboard-text-link underline underline-offset-2 transition-colors hover:text-dashboard-text-active"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="font-bold" {...props} />
  ),
  // Italic lines (e.g. the help desk hours) are the small caption in Figma
  em: ({ node: _node, ...props }) => (
    <em className="text-sm font-medium not-italic" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul
      className="mb-3 list-disc pl-6 text-base font-medium leading-normal text-dashboard-text-medium"
      {...props}
    />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol
      className="mb-3 list-decimal space-y-3 pl-6 text-base font-medium leading-normal text-dashboard-text-medium"
      {...props}
    />
  ),
};

// Page text is a few KB of static markdown, so keep what we've fetched in
// memory (it survives switching tabs) and warm the neighbouring pages.
const markdownCache = new Map<string, string>();

const loadMarkdown = async (slug: string) => {
  const cached = markdownCache.get(slug);
  if (cached !== undefined) return cached;
  const response = await fetch(`/live/logistics/${slug}.md`);
  if (!response.ok)
    throw new Error(`Failed to load ${slug}: ${response.status}`);
  const text = await response.text();
  markdownCache.set(slug, text);
  return text;
};

const EventLogistics = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastStep = logisticsSteps.length;
  // Clamp so old links (there used to be 7 pages) still land on a real page
  const step = Math.min(
    Math.max(parseInt(searchParams.get("step") ?? "1", 10) || 1, 1),
    lastStep,
  );
  const current = logisticsSteps[step - 1]!;
  const prev = logisticsSteps[step - 2];
  const next = logisticsSteps[step];

  const [markdownContent, setMarkdownContent] = useState("");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  // Handler for checkbox
  const handleToggle = (id: string, checked: boolean) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: checked,
    }));
  };

  // Retrieve packing list checkbox data from local storage
  useEffect(() => {
    const saved = localStorage.getItem("packingListChecked");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        setCheckedItems(parsed);
      } catch (error) {
        console.error("Failed to parse packing list data:", error);
        const initialState: Record<string, boolean> = {};
        PackingList.forEach((item) => (initialState[item.id] = false));
        setCheckedItems(initialState);
      }
    } else {
      const initialState: Record<string, boolean> = {};
      PackingList.forEach((item) => (initialState[item.id] = false));
      setCheckedItems(initialState);
    }
    setLoaded(true);
  }, []);

  // Save packing list checkbox to local storage upon changed to checkedItems
  useEffect(() => {
    if (!loaded) {
      return;
    }
    localStorage.setItem("packingListChecked", JSON.stringify(checkedItems));
  }, [checkedItems, loaded]);

  useEffect(() => {
    if (step === 1) return;
    let cancelled = false;
    // Show the cached page straight away; otherwise clear the old one
    setMarkdownContent(markdownCache.get(current.slug) ?? "");
    loadMarkdown(current.slug)
      .then((text) => {
        if (!cancelled) setMarkdownContent(text);
      })
      .catch((error) => console.error("Error fetching markdown:", error));
    return () => {
      cancelled = true;
    };
  }, [step, current.slug]);

  // Warm the pages before and after this one (the packing list has no file)
  const prevSlug = step > 2 ? prev?.slug : undefined;
  const nextSlug = next?.slug;
  useEffect(() => {
    for (const slug of [prevSlug, nextSlug]) {
      if (slug) void loadMarkdown(slug).catch(() => undefined);
    }
  }, [prevSlug, nextSlug]);

  // Shallow navigation keeps the scroll position, so start each page at the
  // top. Reset this column and any scrolling ancestor (the live page body).
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    for (
      let el: HTMLElement | null = scrollRef.current;
      el;
      el = el.parentElement
    ) {
      if (el.scrollTop > 0) el.scrollTop = 0;
    }
  }, [step]);

  const goTo = (target: number) =>
    router.push(logisticsHref(target), undefined, { shallow: true });

  return (
    <div className="flex h-full flex-row gap-12 pr-2 font-figtree">
      <div
        ref={scrollRef}
        className="flex min-w-0 max-w-[717px] flex-1 flex-col overflow-auto pb-16"
      >
        {/* Stays pinned while the page content scrolls underneath */}
        <div className="sticky top-0 z-10 flex flex-col gap-[18px] border-b border-dashboard-border-default bg-dashboard-bg-page pb-[18px]">
          <div className="flex items-center gap-[18px]">
            <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
              <div className="flex items-center gap-2">
                <LogisticsTopbar />
                <p className="text-sm font-medium leading-default text-dashboard-text-light">
                  Page {step} of {lastStep}
                </p>
              </div>
              <h2 className="text-2xl font-semibold uppercase leading-default tracking-[-0.02em] text-dashboard-text-heavy">
                {current.pageTitle}
              </h2>
            </div>
            <div className="flex items-center gap-6">
              <DashboardButton
                variant="secondary"
                disabled={!prev}
                onClick={() => goTo(step - 1)}
              >
                <ArrowLeftIcon aria-hidden="true" />
                Prev
              </DashboardButton>
              <DashboardButton
                variant="secondary"
                disabled={!next}
                onClick={() => goTo(step + 1)}
              >
                Next
                <ArrowRightIcon aria-hidden="true" />
              </DashboardButton>
            </div>
          </div>
        </div>

        {step === 1 ? (
          <div className="mt-9 flex flex-col gap-6">
            {PackingList.map((item: Item) => (
              <div key={item.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5">
                  <DashboardCheckbox
                    id={item.id}
                    checked={checkedItems[item.id] ?? false}
                    onCheckedChange={(checked) =>
                      handleToggle(item.id, checked === true)
                    }
                  />
                  <label
                    htmlFor={item.id}
                    className="cursor-pixel-hover text-base font-medium leading-default text-dashboard-text-heavy"
                  >
                    {item.heading}
                  </label>
                </div>
                <p className="pl-[34px] text-sm font-medium leading-default text-dashboard-text-medium">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-9">
            <ReactMarkdown components={markdownComponents}>
              {markdownContent}
            </ReactMarkdown>
          </div>
        )}
      </div>
      <LogisticsSidebar />
    </div>
  );
};

export default EventLogistics;
