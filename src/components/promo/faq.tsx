import { coordinates } from "~/constants/canvas";
import { CanvasComponent } from "../canvas/canvas";
import { useState } from "react";
import { motion } from "framer-motion";
import { GENERALHACK_FAQ, OTHER_FAQ } from "~/constants/faq";

const FAQ_ITEMS = [...OTHER_FAQ, ...GENERALHACK_FAQ];

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
        className="preserve-3d absolute inset-0"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        style={{ transformStyle: "preserve-3d", rotate: rotation }}
      >
        <div className="backface-hidden absolute inset-0 flex items-center justify-center bg-neutral-50 p-6 shadow-lg">
          <h2 className="font-jetbrainsmono text-center text-2xl tracking-wide">
            {title}
          </h2>
        </div>
        <div
          className="backface-hidden absolute inset-0 bg-neutral-50 p-4 shadow-lg"
          style={{ transform: "rotateY(180deg)" }}
        >
          <div className="flex h-full flex-col space-y-2 text-left">
            <h2 className="font-jetbrainsmono text-lg">{title}</h2>
            <p className="text-md font-figtree">{desc}</p>
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
            <FAQCard
              key={index}
              title={item.question}
              desc={item.answer}
              className="rotate-30"
            />
          ))}
          <FAQCard
            title={FAQ_ITEMS[4]!.question}
            desc={FAQ_ITEMS[4]!.answer}
            className="rotate-30"
          />
          <div className="col-span-2 flex flex-col items-center justify-center">
            <div> FAQ</div>
            <h2 className="mb-4 text-center font-mono text-2xl font-semibold tracking-wide">
              Frequently Asked Questions
            </h2>
            <div>
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
