import { coordinates } from "~/constants/canvas";
import { GENERALHACK_FAQ, OTHER_FAQ } from "~/constants/faq";
import { CanvasComponent } from "~/components/canvas/canvas";
import { FAQCard } from "./card";

const FAQ_ITEMS = [...OTHER_FAQ, ...GENERALHACK_FAQ];

function FAQ() {
  const FirstFour = FAQ_ITEMS.slice(0, 4);
  const LastFour = FAQ_ITEMS.slice(6, 10);

  return (
    <CanvasComponent offset={coordinates.faq}>
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex grid min-w-[1850px] grid-cols-4 flex-col items-center gap-8 gap-y-10">
          {FirstFour.map((item, index) => (
            <FAQCard key={index} title={item.question} desc={item.answer} />
          ))}
          <FAQCard title={FAQ_ITEMS[4]!.question} desc={FAQ_ITEMS[4]!.answer} />
          <div className="col-span-2 flex flex-col items-center justify-center">
            <div className="font-jetbrainsmono mb-6 text-base text-medium">
              FAQ
            </div>
            <h2 className="mb-4 text-center font-dico text-2xl font-medium tracking-wide">
              Frequently Asked Questions
            </h2>
            <div className="text-md w-1/2 text-center font-figtree text-medium">
              Can&apos;t find an answer? Reach out to us at{" "}
              <a
                href="mailto:hello@hackwestern.com"
                className="text-blue-600 transition-all hover:text-blue-700"
              >
                hello@hackwestern.com
              </a>
            </div>
          </div>
          <FAQCard title={FAQ_ITEMS[5]!.question} desc={FAQ_ITEMS[5]!.answer} />
          {LastFour.map((item, index) => (
            <FAQCard key={index} title={item.question} desc={item.answer} />
          ))}
        </div>
      </div>
    </CanvasComponent>
  );
}

export default FAQ;
