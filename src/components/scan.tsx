"use client";

import { useRouter } from "next/router";
import { api } from "~/utils/api";

interface Activity {
  id: number;
  description: string | null;
  points: number;
  code: string;
}

interface Category {
  title: string;
  items: Activity[];
}

const Scan = () => {
  const router = useRouter();
  const { data: items, isLoading } =
    api.scavengerHunt.getAllScavengerHuntItems.useQuery();

  // Categorize items by suffix
  const categorizeItems = (items: Activity[] | undefined): Category[] => {
    if (!items) return [];

    const categories: Category[] = [
      { title: "Meals", items: [] },
      { title: "Regular Workshops", items: [] },
      { title: "Non-Winnable Activities", items: [] },
      { title: "Winnable Activities (Attendance)", items: [] },
      { title: "Winnable Activities (Win)", items: [] },
      { title: "Bonus", items: [] },
    ];

    items.forEach((item) => {
      if (item.code.endsWith("_meal")) {
        categories[0]!.items.push(item);
      } else if (item.code.endsWith("_ws")) {
        categories[1]!.items.push(item);
      } else if (item.code.endsWith("_act")) {
        categories[2]!.items.push(item);
      } else if (item.code.endsWith("_att")) {
        categories[3]!.items.push(item);
      } else if (item.code.endsWith("_win")) {
        categories[4]!.items.push(item);
      } else if (item.code.endsWith("_bonus")) {
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
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "#f5f2f6" }}
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4">
        <div></div>
        <button
          onClick={() => {
            void router.push("/scavenger/redeem");
          }}
          className="rounded-lg bg-white px-4 py-2 font-figtree font-medium text-heavy shadow-md transition-colors hover:bg-violet-100 active:bg-violet-200"
        >
          Redeem Points
        </button>
      </header>

      {/* Main Content */}
      <main className="w-full flex-1 space-y-6 p-6">
        <h1 className="text-left font-dico text-3xl font-medium text-heavy">
          Select activity to scan
        </h1>

        {isLoading && (
          <div className="text-center font-figtree text-medium">
            Loading activities...
          </div>
        )}

        {!isLoading && categories.length === 0 && (
          <div className="text-center font-figtree text-medium">
            No activities found
          </div>
        )}

        {!isLoading &&
          categories.map((category) => (
            <section key={category.title} className="space-y-4">
              <h3 className="font-figtree text-base font-medium text-medium">
                {category.title}
              </h3>
              <div className="space-y-2">
                {category.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleActivityClick(item.id)}
                    className="w-full rounded-lg bg-white px-4 py-3 text-left font-figtree font-semibold text-heavy shadow-md transition-colors hover:bg-violet-100 active:bg-violet-200"
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
