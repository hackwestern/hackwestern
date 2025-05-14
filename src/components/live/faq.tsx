import React from "react";
import { HACKATHON_FAQ } from "~/constants/faq";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";

const FAQ_ITEMS = [...HACKATHON_FAQ];

const FAQ = () => {
  return (
    <div className="px-10 py-10 md:gap-8">
      <Accordion
        type="multiple"
        className="mx-auto grid gap-x-9 md:grid-cols-2 3xl:w-1/2"
      >
        {FAQ_ITEMS.map(({ question, answer }, index) => (
          <AccordionItem
            key={index}
            value={`item-${index}`}
            className="my-3 border-violet-300"
          >
            <AccordionTrigger className="text-left text-slate-600">
              {question}
            </AccordionTrigger>
            <AccordionContent className="text-left text-slate-600">
              <span dangerouslySetInnerHTML={{ __html: answer }} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default FAQ;
