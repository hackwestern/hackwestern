"use client";

import { useRouter } from "next/router";

interface Activity {
  name: string;
  slug: string;
}

const meals: Activity[] = [
  { name: "Friday Dinner", slug: "friday-dinner" },
  { name: "Saturday Breakfast", slug: "saturday-breakfast" },
  { name: "Saturday Lunch", slug: "saturday-lunch" },
];

const workshops: Activity[] = [
  { name: "Intro to Hacking", slug: "intro-to-hacking" },
  { name: "Design Thinking", slug: "design-thinking" },
  { name: "Startup Pitch", slug: "startup-pitch" },
];

const Scan = () => {
  const router = useRouter();

  const handleActivityClick = (slug: string): void => {
    router.push(`/scan/${slug}`);
  };

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "#f5f2f6" }}
    >
      {/* Header */}
      <header className="flex items-center justify-end p-4">
        <button
          className="text-2xl text-heavy hover:text-emphasis"
          aria-label="Menu"
        >
          ☰
        </button>
      </header>

      {/* Main Content */}
      <main className="w-full flex-1 space-y-6 p-6">
        <h1 className="text-left font-dico text-3xl font-medium text-heavy">
          Select activity to scan
        </h1>

        {/* Meals Section */}
        <section className="space-y-4">
          <h3 className="font-figtree text-base font-medium text-medium">
            Meals
          </h3>
          <div className="space-y-2">
            {meals.map((meal) => (
              <button
                key={meal.slug}
                onClick={() => handleActivityClick(meal.slug)}
                className="w-full rounded-lg bg-white px-4 py-3 text-left font-figtree font-semibold text-heavy shadow-md transition-colors hover:bg-violet-100 active:bg-violet-200"
              >
                {meal.name}
              </button>
            ))}
          </div>
        </section>

        {/* Workshops Section */}
        <section className="space-y-4">
          <h3 className="font-figtree text-base font-medium text-medium">
            Workshops
          </h3>
          <div className="space-y-2">
            {workshops.map((workshop) => (
              <button
                key={workshop.slug}
                onClick={() => handleActivityClick(workshop.slug)}
                className="w-full rounded-lg bg-white px-4 py-3 text-left font-figtree font-semibold text-heavy shadow-md transition-colors hover:bg-violet-100 active:bg-violet-200"
              >
                {workshop.name}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Scan;
