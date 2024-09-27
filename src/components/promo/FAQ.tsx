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
import { Cloud1, Cloud2, Cloud3 } from "./faq/clouds";
import Moon from "./faq/moon";

const FAQ = () => {
  return (
    <div className="flex min-h-screen flex-col justify-between overflow-clip bg-[#320862] text-center">
      <div className="absolute h-screen w-full overflow-clip">
        <Moon />
        <Cloud1 />
        <Cloud2 />
        <Cloud3 />
      </div>
      <div className="z-50 my-auto flex min-h-screen flex-col justify-center pt-48 xl:min-h-[90vh] xl:pt-60 3xl:min-h-[70vh] 3xl:pt-72">
        <h2 className="font-MagicRetro text-3xl text-white md:text-6xl">
          frequently asked questions
        </h2>
        <p className="py-6 text-xl text-white">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
        <div className="z-40 mx-auto h-full w-2/3 justify-center pb-20 pt-12 md:gap-8">
          <Accordion
            type="single"
            className=" mx-auto text-white md:w-2/3 md:columns-2 3xl:w-1/2"
          >
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
                Yes. It&apos;s animated by default, but you can disable it if
                you prefer.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Is it accessible?</AccordionTrigger>
              <AccordionContent>
                Yes. It adheres to the WAI-ARIA design pattern.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>Is it accessible?</AccordionTrigger>
              <AccordionContent>
                Yes. It adheres to the WAI-ARIA design pattern.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-6">
              <AccordionTrigger>Is it styled?</AccordionTrigger>
              <AccordionContent>
                Yes. It comes with default styles that matches the other
                components&apos; aesthetic.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-7">
              <AccordionTrigger>Is it animated?</AccordionTrigger>
              <AccordionContent>
                Yes. It&apos;s animated by default, but you can disable it if
                you prefer.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-8">
              <AccordionTrigger>Is it accessible?</AccordionTrigger>
              <AccordionContent>
                Yes. It adheres to the WAI-ARIA design pattern.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
      <Airport />
      <div className="relative z-10">
        <LeftHill />
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
