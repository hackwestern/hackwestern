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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useState } from "react";
import { allMeals } from "~/constants/menu";
import type { DailyMeals, MealData } from "~/constants/menu";
import { EggFried } from "lucide-react";

function isOpenUntil(deadline: Date) {
  const now = new Date();
  return now <= deadline;
}

const FoodMenu = () => {
  const fridayOpen = isOpenUntil(new Date("November 22, 2025 05:30:00"));
  const saturdayOpen = isOpenUntil(new Date("November 23, 2025 01:00:00"));
  const sundayOpen = isOpenUntil(new Date("November 23, 2025 18:00:00"));

  const [activePopovers, setActivePopovers] = useState<Record<string, boolean>>(
    {},
  );

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
    <div className="h-screen overflow-auto pb-48 [scrollbar-gutter:stable]">
      <Accordion
        type="multiple"
        className="w-[50%]"
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
                          {options.map((option: MealData) => (
                            <div
                              key={option.name}
                              className="flex w-full flex-row justify-between rounded-xl border border-[#f1f0f2] bg-white p-4"
                            >
                              <div className="flex flex-col justify-center">
                                <h2 className="font-figtree font-medium text-heavy">
                                  {option.name}
                                </h2>
                                <h3 className="font-italic font-figtree text-medium">
                                  {option.vendor}
                                </h3>
                              </div>
                              <Popover
                                open={activePopovers[option.name] ?? false}
                                onOpenChange={(open) =>
                                  setActivePopovers((prev) => ({
                                    ...prev,
                                    [option.name]: open,
                                  }))
                                }
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className={`flex flex-row items-center gap-2 rounded-md px-2 py-1 font-figtree text-sm font-medium ${
                                      activePopovers[option.name]
                                        ? "bg-primary-300 text-heavy"
                                        : "bg-highlight text-medium"
                                    } hover:bg-primary-300 hover:text-heavy`}
                                  >
                                    <EggFried />
                                    Allergen Info
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  side="right"
                                  align="center"
                                  className="w-fit"
                                >
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="font-figtree text-heavy">
                                        {(
                                          Object.keys(
                                            option.allergens,
                                          ) as (keyof typeof option.allergens)[]
                                        ).map((allergen) => (
                                          <TableHead key={String(allergen)}>
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
                                            <TableHead key={String(allergen)}>
                                              {cell}
                                            </TableHead>
                                          );
                                        })}
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </PopoverContent>
                              </Popover>
                            </div>
                          ))}
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
