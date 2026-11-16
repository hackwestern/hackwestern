"use client";

import { useRouter } from "next/router";
import { api } from "~/utils/api";
import SecondaryButton from "~/components/internals/secondary-button";

interface Activity {
  id: number;
  description: string | null;
  points: number;
  code: string;
  type: string;
  winPoints: number | null;
}

interface Category {
  title: string;
  items: Activity[];
}

const Scan = () => {
  const router = useRouter();
  const { data: items, isLoading } =
    api.scavengerHunt.getAllScavengerHuntItems.useQuery();

  // Categorize items by type
  const categorizeItems = (items: Activity[] | undefined): Category[] => {
    if (!items) return [];

    const categories: Category[] = [
      { title: "Meals", items: [] },
      { title: "Regular Workshops", items: [] },
      { title: "Sponsor Workshops", items: [] },
      { title: "Non-Winnable Activities", items: [] },
      { title: "Winnable Activities", items: [] },
      { title: "Bonus", items: [] },
    ];

    items.forEach((item) => {
      if (item.type === "meal") {
        categories[0]!.items.push(item);
      } else if (item.type === "workshop") {
        categories[1]!.items.push(item);
      } else if (item.type === "sponsor_workshop") {
        categories[2]!.items.push(item);
      } else if (item.type === "activity" && item.winPoints === null) {
        categories[3]!.items.push(item);
      } else if (item.type === "activity") {
        categories[4]!.items.push(item);
      } else if (item.type === "bonus") {
        categories[5]!.items.push(item);
      }
    });

    // Filter out empty categories
    return categories.filter((cat) => cat.items.length > 0);
  };

  const categories = categorizeItems(items);

  const handleActivityClick = (itemId: number): void => {
    void router.push(`/scan/${itemId}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-highlight">
      {/* Header */}
      <header className="flex items-center justify-between p-4">
        <div></div>
        <SecondaryButton
          size="sm"
          onClick={() => {
            void router.push("/scavenger/redeem");
          }}
        >
          Redeem Points
        </SecondaryButton>
      </header>

      {/* Main Content */}
      <main className="w-full flex-1 space-y-6 p-6">
        <h1 className="text-left font-primary text-3xl font-medium text-heavy">
          Select activity to scan
        </h1>

        {isLoading && (
          <div className="text-center font-secondary text-medium">
            Loading activities...
          </div>
        )}

        {!isLoading && categories.length === 0 && (
          <div className="text-center font-secondary text-medium">
            No activities found
          </div>
        )}

        {!isLoading &&
          categories.map((category) => (
            <section key={category.title} className="space-y-4">
              <h3 className="font-secondary text-base font-medium text-medium">
                {category.title}
              </h3>
              <div className="space-y-2">
                {category.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleActivityClick(item.id)}
                    className="w-full rounded-lg bg-offwhite px-4 py-3 text-left font-secondary font-semibold text-heavy shadow-md transition-colors hover:bg-blue-1 active:bg-blue-2"
                  >
                    {item.description ?? item.code}
                  </button>
                ))}
              </div>
            </section>
          ))}
      </main>
    </div>
  );
};

export default Scan;
