import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../ui/accordion";

import Runway from "./runway";
import Airport from "./airport";

import Plane from "./plane";
import { Cloud1, Cloud2, Cloud3 } from "./clouds";
import Moon from "./moon";
import { GENERALHACK_FAQ, OTHER_FAQ } from "~/constants/faq";
import { LeftHill, MiddleHill, RightHill } from "./hills";

const FAQ_ITEMS = [...GENERALHACK_FAQ, ...OTHER_FAQ];

const FAQ = () => {
  return (
    <div className="flex min-h-screen flex-col justify-between overflow-clip bg-[#320862] text-center">
      <div className="absolute h-screen w-full overflow-clip">
        <Moon />
        <Cloud1 />
        <Cloud2 />
        <Cloud3 />
      </div>
      <div className="z-50 my-auto flex flex-col justify-center pt-48 xl:min-h-[90vh] xl:pt-60 3xl:min-h-[70vh] 3xl:pt-72">
        <h2 className="font-MagicRetro text-3xl text-white md:text-6xl">
          frequently asked questions
        </h2>
        <div className="z-40 mx-auto h-full w-2/3 justify-center pb-20 pt-12 md:gap-8">
          <Accordion
            type="single"
            className="mx-auto grid gap-x-4 text-white md:w-5/6 md:grid-cols-2 md:gap-x-10 3xl:w-1/2"
          >
            {FAQ_ITEMS.map(({ question, answer }, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {question}
                </AccordionTrigger>
                <AccordionContent className="text-left">
                  <span dangerouslySetInnerHTML={{ __html: answer }} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
      <Airport />
      <div className="relative z-10">
        <LeftHill />
        <MiddleHill />
        <RightHill />
      </div>
      <div className="w-fill relative z-50">
        <Plane />
        <Runway />
      </div>
    </div>
  );
};

export default FAQ;
