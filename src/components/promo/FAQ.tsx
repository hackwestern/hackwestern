import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";

import Runway from "./faq/runway";
import Airport from "./faq/airport";
import RightHill from "./faq/rightHill";
import LeftHill from "./faq/leftHill";
import Plane from "./faq/plane";

const FAQ = () => {
  return (
    <div className="flex flex-col justify-between bg-[#320862] text-center overflow-clip">
      <h2 className="pt-48 font-MagicRetro text-6xl text-white">
        frequently asked questions
      </h2>
      <p className="py-6 text-xl text-white">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </p>
      <div className="z-40 flex justify-center gap-8 pb-20 pt-12">
        <Accordion type="multiple" className="w-1/3 text-white">
          <AccordionItem value="item-1">
            <AccordionTrigger>Is it accessible?</AccordionTrigger>
            <AccordionContent>
              Yes. It adheres to the WAI-ARIA design pattern.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Is it styled?</AccordionTrigger>
            <AccordionContent>
              Yes. It comes with default styles that matches the other
              components&apos; aesthetic.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>Is it animated?</AccordionTrigger>
            <AccordionContent>
              Yes. It&apos;s animated by default, but you can disable it if you
              prefer.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger>Is it accessible?</AccordionTrigger>
            <AccordionContent>
              Yes. It adheres to the WAI-ARIA design pattern.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Accordion type="multiple" className="w-1/3 text-white">
          <AccordionItem value="item-1">
            <AccordionTrigger>Is it accessible?</AccordionTrigger>
            <AccordionContent>
              Yes. It adheres to the WAI-ARIA design pattern.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Is it styled?</AccordionTrigger>
            <AccordionContent>
              Yes. It comes with default styles that matches the other
              components&apos; aesthetic.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>Is it animated?</AccordionTrigger>
            <AccordionContent>
              Yes. It&apos;s animated by default, but you can disable it if you
              prefer.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger>Is it accessible?</AccordionTrigger>
            <AccordionContent>
              Yes. It adheres to the WAI-ARIA design pattern.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      <Airport />
      <div className="relative z-10">
        <LeftHill />
        <RightHill />
      </div>
      <div className="relative z-50">
        <Plane />
        <Runway />
      </div>

    </div>
  );
};

export default FAQ;
