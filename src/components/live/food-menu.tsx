import {
  Accordion,
  AccordionContent,
  AccordionBorderlessItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useState } from "react";
import { allMeals } from "~/constants/menu";
import type { DailyMeals, MealData } from "~/constants/menu";
import { Info } from "lucide-react";

function isOpenUntil(deadline: Date) {
  const now = new Date();
  return now <= deadline;
}

const FoodMenu = () => {
  const fridayOpen = isOpenUntil(new Date("November 22, 2025 05:30:00"));
  const saturdayOpen = isOpenUntil(new Date("November 23, 2025 01:00:00"));
  const sundayOpen = isOpenUntil(new Date("November 23, 2025 18:00:00"));

  const [expandedAllergens, setExpandedAllergens] = useState<
    Record<string, boolean>
  >({});

  const toggleAllergens = (key: string) => {
    setExpandedAllergens((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Build defaultOpen values
  const defaultValues = [
    fridayOpen ? "friday" : null,
    saturdayOpen ? "saturday" : null,
    sundayOpen ? "sunday" : null,
  ]
    .filter(Boolean)
    .filter((v): v is string => v !== null);

  const days = Object.keys(allMeals) as (keyof typeof allMeals)[];

  return (
    <div className="pb-48">
      <Accordion
        type="multiple"
        className="w-full md:w-[50%]"
        defaultValue={defaultValues}
      >
        {days.map((day) => (
          <AccordionBorderlessItem key={day} value={day}>
            <AccordionTrigger>
              <h1 className="font-jetbrains-mono text-lg text-heavy md:text-xl">
                {day.toUpperCase()}
              </h1>
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4 text-balance">
              <div className="flex w-full flex-row">
                <div className="flex w-full flex-col gap-4">
                  {(() => {
                    type MealKey = keyof DailyMeals;
                    const mealKeys = Object.keys(allMeals[day]) as MealKey[];
                    return mealKeys.map((meal) => {
                      const options = allMeals[day][meal];
                      if (options.length === 0) return null;
                      return (
                        <div key={meal} className="flex w-full flex-col gap-4">
                          <h2 className="font-jetbrains-mono text-medium">
                            {meal.toUpperCase()}
                          </h2>
                          {options.map((option: MealData) => {
                            const allergenKey = `${day}-${meal}-${option.name}`;
                            const isExpanded =
                              expandedAllergens[allergenKey] ?? false;
                            const hasAllergens =
                              option.allergens &&
                              Object.keys(option.allergens).length > 0;

                            return (
                              <div
                                key={option.name}
                                className="flex w-full flex-col gap-3 rounded-xl border border-[#f1f0f2] bg-white p-4"
                              >
                                <div className="flex flex-row items-start justify-between">
                                  <div className="flex flex-col justify-center">
                                    <h2 className="font-figtree font-medium text-heavy">
                                      {option.name}
                                    </h2>
                                    <h3 className="font-italic font-figtree text-medium">
                                      {option.vendor}
                                    </h3>
                                  </div>
                                  {hasAllergens && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleAllergens(allergenKey)
                                      }
                                      className={`flex flex-row items-center gap-2 rounded-md px-2 py-1 font-figtree text-sm font-medium transition-colors ${
                                        isExpanded
                                          ? "bg-primary-300 text-heavy"
                                          : "bg-highlight text-medium"
                                      } hover:bg-primary-300 hover:text-heavy`}
                                    >
                                      <Info className="h-4 w-4" />
                                      Allergens
                                    </button>
                                  )}
                                </div>
                                {hasAllergens && isExpanded && (
                                  <div className="flex flex-col gap-2 border-t border-[#f1f0f2] pt-3">
                                    <div className="overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="font-figtree text-heavy">
                                            {(
                                              Object.keys(
                                                option.allergens,
                                              ) as (keyof typeof option.allergens)[]
                                            ).map((allergen) => (
                                              <TableHead
                                                key={String(allergen)}
                                                className="text-xs"
                                              >
                                                {String(allergen)}
                                              </TableHead>
                                            ))}
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          <TableRow>
                                            {Object.entries(
                                              option.allergens ?? {},
                                            ).map(([allergen, value]) => {
                                              const v = value as
                                                | boolean
                                                | "May Contain"
                                                | null
                                                | undefined;
                                              let cell: React.ReactNode;
                                              if (v === true) cell = "✅";
                                              else if (v === false) cell = "❌";
                                              else if (v === "May Contain")
                                                cell = "May Contain";
                                              else cell = String(v ?? "");
                                              return (
                                                <TableHead
                                                  key={String(allergen)}
                                                  className="text-xs"
                                                >
                                                  {cell}
                                                </TableHead>
                                              );
                                            })}
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </AccordionContent>
          </AccordionBorderlessItem>
        ))}
      </Accordion>
    </div>
  );
};

export default FoodMenu;
