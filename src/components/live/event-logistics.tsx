import ReactMarkdown from "react-markdown";
import { useState, useEffect } from "react";
import { PackingList, Item } from "~/constants/packingList";
import { Checkbox } from "~/components/ui/checkbox";
import { Button } from "~/components/ui/button";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { LogisticsSidebar } from "./logistics-sidebar";
import LogisticsTopbar from "./logistics-topbar";

const EventLogistics = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = searchParams.get("step")
    ? parseInt(searchParams.get("step")!, 10)
    : 1;

  const [markdownContent, setMarkdownContent] = useState("");

  const [title, setTitle] = useState("");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const allTitles = [
    "Packing List",
    "Communications",
    "Housekeeping",
    "General & Project Rules",
    "Contact Us",
    "Frequently Asked Questions",
  ];

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
    let id = "";
    switch (step) {
      case 1:
        setTitle("PACKING LIST");
        id = "packing-list";
        break;
      case 2:
        setTitle("COMMUNICATIONS");
        id = "communications";
        break;
      case 3:
        setTitle("HOUSEKEEPING");
        id = "housekeeping";
        break;
      case 4:
        setTitle("GENERAL & PROJECT RULES");
        id = "general-project-rules";
        break;
      case 5:
        setTitle("CONTACT US");
        id = "contact-us";
        break;
      case 6:
        setTitle("FREQUENTLY ASKED QUESTIONS");
        id = "faq";
        break;
    }
    if (step !== 1) {
      fetch(`/live-logistics/${id}.md`)
        .then((response) => response.text())
        .then((text) => setMarkdownContent(text))
        .catch((error) => console.error("Error fetching markdown:", error));
    }
  }, [step]);

  return (
    <div className="flex h-full flex-row pr-2">
      <div className="flex-1 overflow-auto">
        <div className="mb-4 mr-2 flex flex-row items-center justify-between">
          <div className="flex flex-col">
            <div className="flex flex-row items-center gap-2">
              <LogisticsTopbar />
              <p className="font-figtree text-light">Page {step} of 6</p>
            </div>
            <h1 className="font-jetbrains-mono text-2xl text-medium">
              {title}
            </h1>
          </div>
          <div className="flex flex-row gap-2 pl-4">
            {step !== 1 && (
              <Button
                variant="secondary"
                className="px-2 md:px-5"
                onClick={() => {
                  const newStep = step - 1;
                  router.push(
                    `live/?tab=event-logistics&step=${newStep.toString()}`,
                  );
                }}
              >
                <ArrowLeftIcon className="text-medium" />
              </Button>
            )}
            {step !== 6 && (
              <Button
                variant="secondary"
                className="px-2 md:px-5"
                onClick={() => {
                  const newStep = step + 1;
                  router.push(
                    `live/?tab=event-logistics&step=${newStep.toString()}`,
                  );
                }}
              >
                <ArrowRightIcon className="text-medium" />
              </Button>
            )}
          </div>
        </div>
        <hr className="mb-8 h-2 border-[#ebdff7]" />
        {step === 1 ? (
          PackingList.map((item: Item) => {
            return (
              <div key={item.id} className="items-left mt-4 flex flex-col">
                <div className="flex flex-row gap-4">
                  <Checkbox
                    id={item.id}
                    checked={checkedItems[item.id] ?? false}
                    onCheckedChange={(checked: boolean) =>
                      handleToggle(item.id, checked)
                    }
                  />
                  <h1 className="-mt-1 font-figtree text-lg text-heavy">
                    {item.heading}
                  </h1>
                </div>
                <p className="pl-7 font-figtree text-medium">{item.desc}</p>
              </div>
            );
          })
        ) : (
          <ReactMarkdown
            components={{
              h1: ({ node, ...props }) => (
                <h1
                  className="mb-4 mt-8 font-figtree text-2xl font-medium text-heavy"
                  {...props}
                />
              ),
              p: ({ node, ...props }) => (
                <p
                  className="mb-4 font-figtree leading-relaxed text-medium"
                  {...props}
                />
              ),
              a: ({ node, ...props }) => (
                <a
                  className="leading-relaxed text-medium underline transition-colors hover:text-light"
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                />
              ),
              b: ({ node, ...props }) => (
                <b
                  className="mb-4 font-figtree font-bold leading-relaxed text-medium"
                  {...props}
                />
              ),
              i: ({ node, ...props }) => (
                <i
                  className="font-italic mb-4 font-figtree leading-relaxed text-medium"
                  {...props}
                />
              ),
              ul: ({ node, ...props }) => (
                <ul
                  className="mb-4 list-disc space-y-1 pl-6 font-figtree text-medium"
                  {...props}
                />
              ),
              ol: ({ node, ...props }) => (
                <ol
                  className="mb-4 list-decimal space-y-1 pl-6 font-figtree text-medium"
                  {...props}
                />
              ),
            }}
          >
            {markdownContent}
          </ReactMarkdown>
        )}
        <div className="mt-8 flex flex-col items-end gap-4 md:flex-row md:justify-between">
          {step !== 1 && (
            <Button
              variant="tertiary"
              className="text-base md:text-lg"
              onClick={() => {
                const newStep = step - 1;
                router.push(
                  `live/?tab=event-logistics&step=${newStep.toString()}`,
                );
              }}
            >
              <ArrowLeftIcon width={16} />
              Back: {allTitles[step - 2]}
            </Button>
          )}
          {step !== 6 &&
            (step === 1 ? (
              <>
                <div></div>
                <Button
                  variant="tertiary"
                  className="text-lg"
                  onClick={() => {
                    const newStep = step + 1;
                    router.push(
                      `live/?tab=event-logistics&step=${newStep.toString()}`,
                    );
                  }}
                >
                  <ArrowRightIcon width={16} />
                  Next: {allTitles[step]}
                </Button>
              </>
            ) : (
              <Button
                variant="tertiary"
                className="text-base md:text-lg"
                onClick={() => {
                  const newStep = step + 1;
                  router.push(
                    `live/?tab=event-logistics&step=${newStep.toString()}`,
                  );
                }}
              >
                <ArrowRightIcon width={16} />
                Next: {allTitles[step]}
              </Button>
            ))}
        </div>
      </div>
      <LogisticsSidebar />
    </div>
  );
};

export default EventLogistics;
