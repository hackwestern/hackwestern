import { coordinates } from "~/constants/canvas";
import { CanvasComponent } from "../canvas/canvas";
import { useState } from "react";
import { motion } from "framer-motion";
import { GENERALHACK_FAQ, OTHER_FAQ } from "~/constants/faq";

const FAQ_ITEMS = [...OTHER_FAQ, ...GENERALHACK_FAQ];

function Lines() {
  return (
    <div className="relative z-0">
      <div className="absolute left-0 right-0 mt-14 space-y-6 pt-0.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-full border-t border-[rgba(0,0,0,0.1)]" />
        ))}
      </div>
    </div>
  );
}

function FAQCard({
  title,
  desc,
  className,
  rotation,
}: {
  title: string;
  desc: string;
  className?: string;
  rotation?: string;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      className={`w-2xl relative h-64 cursor-pointer text-medium transition-all hover:scale-[1.02] ${className}`}
      style={{ perspective: 1200 }}
      onClick={() => setFlipped(!flipped)}
      onKeyDown={(e) => e.key === " " && setFlipped(!flipped)}
      tabIndex={0}
    >
      <motion.div
        className="absolute inset-0 preserve-3d"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        style={{ transformStyle: "preserve-3d", rotate: rotation }}
      >
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 p-6 shadow-lg backface-hidden">
          <div className="relative h-full w-full">
            <Lines />
            <h2 className="font-jetbrainsmono relative z-10 mx-auto flex h-full w-2/3 items-center justify-center text-center text-2xl font-normal">
              {title.toUpperCase()}
            </h2>
          </div>
        </div>
        <div
          className="absolute inset-0 bg-neutral-50 px-4 py-2 shadow-lg backface-hidden"
          style={{ transform: "rotateY(180deg)" }}
        >
          <div className="relative flex h-full w-full flex-col space-y-2 text-left">
            <Lines />
            <div className="z-10">
              <h2 className="font-jetbrainsmono relative z-10 min-h-14 text-lg font-normal">
                {title.toUpperCase()}
              </h2>
              <p className="text-md font-figtree leading-[25px]">{desc}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </button>
  );
}

function FAQ() {
  const FirstFour = FAQ_ITEMS.slice(0, 4);
  const LastFour = FAQ_ITEMS.slice(6, 10);

  return (
    <CanvasComponent offset={coordinates.faq}>
      <div className="flex h-screen w-screen min-w-[1800px] items-center justify-center">
        <div className="flex grid min-w-[1800px] grid-cols-4 flex-col items-center gap-4">
          {FirstFour.map((item, index) => (
            <FAQCard key={index} title={item.question} desc={item.answer} />
          ))}
          <FAQCard title={FAQ_ITEMS[4]!.question} desc={FAQ_ITEMS[4]!.answer} />
          <div className="col-span-2 flex flex-col items-center justify-center">
            <div className="font-jetbrainsmono mb-6 text-lg text-medium">
              FAQ
            </div>
            <h2 className="mb-4 text-center font-dico text-3xl font-medium tracking-wide">
              Frequently Asked Questions
            </h2>
            <div className="font-figtree text-lg text-medium">
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
