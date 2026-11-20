import {
  Accordion,
  AccordionContent,
  AccordionBorderlessItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { menu } from "~/constants/menu";
import type { DietTag, MenuDay } from "~/constants/menu";

function isOpenUntil(deadline: Date) {
  const now = new Date();
  return now <= deadline;
}

// Each day stays expanded until it's over (the midnight snack runs into the
// next morning). Hack Western 13 is Nov 20-22, 2026; times are Eastern.
const FRIDAY_ENDS = new Date("2026-11-21T05:30:00-05:00");
const SATURDAY_ENDS = new Date("2026-11-22T01:00:00-05:00");
const SUNDAY_ENDS = new Date("2026-11-22T18:00:00-05:00");

const DAY_DATES: Record<MenuDay, string> = {
  friday: "Nov 20",
  saturday: "Nov 21",
  sunday: "Nov 22",
};

// Same colours as the tags on the food-table menu screens
const TAG_STYLES: Record<DietTag, string> = {
  Halal: "bg-[#EEE7FA] text-[#5B3A99]",
  Vegetarian: "bg-[#EDF0DA] text-[#56601E]",
  Vegan: "bg-[#DFEFE3] text-[#1E6537]",
  "Gluten-free": "bg-[#FBEED3] text-[#86560A]",
  "Nut-free": "bg-[#F1E5DA] text-[#764628]",
  "Sesame-free": "bg-[#E3E9F2] text-[#3B5474]",
};

const FoodMenu = () => {
  const fridayOpen = isOpenUntil(FRIDAY_ENDS);
  const saturdayOpen = isOpenUntil(SATURDAY_ENDS);
  const sundayOpen = isOpenUntil(SUNDAY_ENDS);

  const defaultValues = [
    fridayOpen ? "friday" : null,
    saturdayOpen ? "saturday" : null,
    sundayOpen ? "sunday" : null,
  ].filter((v): v is string => v !== null);

  const days = Object.keys(menu) as MenuDay[];

  return (
    <div className="pb-48 font-figtree">
      <p className="mb-4 max-w-[720px] text-sm font-medium text-dashboard-text-medium">
        Allergy questions? Ask an organizer.
      </p>
      <Accordion
        type="multiple"
        className="flex w-full max-w-[720px] flex-col gap-4"
        defaultValue={defaultValues}
      >
        {days.map((day) => (
          <AccordionBorderlessItem
            key={day}
            value={day}
            className="rounded-dashboard-lg bg-dashboard-bg-surface px-4 shadow-dashboard-card sm:px-6"
          >
            <AccordionTrigger className="py-5 hover:no-underline [&>svg]:size-5 [&>svg]:text-dashboard-text-light">
              <h2 className="flex items-baseline gap-3 text-2xl font-semibold leading-default text-dashboard-text-heavy">
                <span className="capitalize">{day}</span>
                <span className="text-base font-medium text-dashboard-text-light">
                  {DAY_DATES[day]}
                </span>
              </h2>
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-8 pb-6 text-base">
              {menu[day].map((meal) => (
                <section key={meal.label} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-dashboard-text-light">
                      {meal.label}
                    </h3>
                    <p className="text-lg font-semibold text-dashboard-text-heavy">
                      {meal.title ?? meal.vendor}
                      {meal.title && (
                        <span className="font-medium text-dashboard-text-light">
                          {" "}
                          · {meal.vendor}
                        </span>
                      )}
                    </p>
                  </div>
                  <ul className="flex flex-col divide-y divide-dashboard-border-subtle rounded-dashboard-lg border border-dashboard-border-subtle bg-dashboard-bg-page">
                    {meal.dishes.map((dish) => (
                      <li key={dish.name} className="flex flex-col gap-1.5 p-4">
                        <p className="font-semibold text-dashboard-text-heavy">
                          {dish.name}
                        </p>
                        {dish.tags && (
                          <div className="flex flex-wrap gap-1.5">
                            {dish.tags.map((tag) => (
                              <span
                                key={tag}
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TAG_STYLES[tag]}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {dish.items && (
                          <p className="text-sm text-dashboard-text-medium">
                            {dish.items}
                          </p>
                        )}
                        {dish.note && (
                          <p className="text-sm italic text-dashboard-text-light">
                            {dish.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                  {meal.footnote && (
                    <p className="text-sm text-dashboard-text-medium">
                      {meal.footnote}
                    </p>
                  )}
                </section>
              ))}
            </AccordionContent>
          </AccordionBorderlessItem>
        ))}
      </Accordion>
    </div>
  );
};

export default FoodMenu;
