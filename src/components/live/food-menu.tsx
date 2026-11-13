import {
  Accordion,
  AccordionContent,
  AccordionBorderlessItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { useState } from "react";
import { allMeals } from "~/constants/menu";
import type { AllergenInfo, DailyMeals, MealData } from "~/constants/menu";
import { Info } from "lucide-react";
import { DashboardTag } from "~/components/internals/dashboard-tag";

function isOpenUntil(deadline: Date) {
  const now = new Date();
  return now <= deadline;
}

// Each day stays expanded until it's over (the midnight snack runs into the
// next morning). Hack Western 13 is Nov 20-22, 2026; times are Eastern.
const FRIDAY_ENDS = new Date("2026-11-21T05:30:00-05:00");
const SATURDAY_ENDS = new Date("2026-11-22T01:00:00-05:00");
const SUNDAY_ENDS = new Date("2026-11-22T18:00:00-05:00");

const DAY_DATES: Record<keyof typeof allMeals, string> = {
  friday: "Nov 20",
  saturday: "Nov 21",
  sunday: "Nov 22",
};

const allergenValue = (value: AllergenInfo[keyof AllergenInfo] | undefined) => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === "May Contain") return "May contain";
  return "TBD"; // not confirmed with the vendor yet
};

const FoodMenu = () => {
  const fridayOpen = isOpenUntil(FRIDAY_ENDS);
  const saturdayOpen = isOpenUntil(SATURDAY_ENDS);
  const sundayOpen = isOpenUntil(SUNDAY_ENDS);

  const [expandedAllergens, setExpandedAllergens] = useState<
    Record<string, boolean>
  >({});

  const toggleAllergens = (key: string) => {
    setExpandedAllergens((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const defaultValues = [
    fridayOpen ? "friday" : null,
    saturdayOpen ? "saturday" : null,
    sundayOpen ? "sunday" : null,
  ].filter((v): v is string => v !== null);

  const days = Object.keys(allMeals) as (keyof typeof allMeals)[];

  return (
    <div className="pb-48 font-figtree">
      <Accordion
        type="multiple"
        className="flex w-full max-w-[720px] flex-col gap-4"
        defaultValue={defaultValues}
      >
        {days.map((day) => (
          <AccordionBorderlessItem
            key={day}
            value={day}
            className="rounded-dashboard-lg bg-dashboard-bg-surface px-6 shadow-dashboard-card"
          >
            <AccordionTrigger className="py-5 hover:no-underline [&>svg]:size-5 [&>svg]:text-dashboard-text-light">
              <h2 className="flex items-baseline gap-3 text-2xl font-semibold leading-default text-dashboard-text-heavy">
                <span className="capitalize">{day}</span>
                <span className="text-base font-medium text-dashboard-text-light">
                  {DAY_DATES[day]}
                </span>
              </h2>
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-6 pb-6 text-base">
              {(Object.keys(allMeals[day]) as (keyof DailyMeals)[]).map(
                (meal) => {
                  const options = allMeals[day][meal];
                  if (options.length === 0) return null;
                  return (
                    <div key={meal} className="flex w-full flex-col gap-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-dashboard-text-light">
                        {meal}
                      </h3>
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
                            className="flex w-full flex-col gap-3 rounded-dashboard-lg border border-dashboard-border-subtle bg-dashboard-bg-page p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-col gap-0.5">
                                <p className="text-base font-semibold text-dashboard-text-heavy">
                                  {option.name}
                                </p>
                                <p className="text-sm font-medium text-dashboard-text-light">
                                  {option.vendor}
                                </p>
                              </div>
                              {hasAllergens && (
                                <DashboardTag
                                  selected={isExpanded}
                                  onClick={() => toggleAllergens(allergenKey)}
                                  className="gap-1.5 py-1.5 text-sm"
                                >
                                  <Info aria-hidden="true" className="size-4" />
                                  Allergens
                                </DashboardTag>
                              )}
                            </div>
                            {hasAllergens && isExpanded && (
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashboard-border-subtle pt-3 sm:grid-cols-4">
                                {(
                                  Object.entries(option.allergens) as [
                                    keyof AllergenInfo,
                                    AllergenInfo[keyof AllergenInfo],
                                  ][]
                                ).map(([allergen, value]) => (
                                  <div key={allergen} className="flex flex-col">
                                    <dt className="text-xs font-medium text-dashboard-text-light">
                                      {allergen}
                                    </dt>
                                    <dd className="text-sm font-semibold text-dashboard-text-heavy">
                                      {allergenValue(value)}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                },
              )}
            </AccordionContent>
          </AccordionBorderlessItem>
        ))}
      </Accordion>
    </div>
  );
};

export default FoodMenu;
