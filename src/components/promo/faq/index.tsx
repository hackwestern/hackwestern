import { coordinates } from "~/constants/canvas";
import { CanvasComponent } from "~/components/canvas/canvas";
import { FAQCard } from "./card";
import { PROMO_FAQ } from "~/constants/faq";

function FAQ() {
  return (
    <CanvasComponent offset={coordinates.faq}>
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-[900px]">
          <div className="mx-auto flex grid h-[900px] grid-flow-col grid-rows-3 gap-x-8 gap-y-8">
            {/* top 2 cards */}
            <div className="row-span-3 my-auto grid grid-rows-2 gap-10">
              <FAQCard
                title={PROMO_FAQ[0].question}
                desc={PROMO_FAQ[0].answer}
                rotation="6deg"
              />
              <FAQCard
                title={PROMO_FAQ[1].question}
                desc={PROMO_FAQ[1].answer}
                rotation="2deg"
              />
            </div>

            {/* next 3 cards */}
            <FAQCard
              title={PROMO_FAQ[2].question}
              desc={PROMO_FAQ[2].answer}
              rotation="-4deg"
            />
            <FAQCard title={PROMO_FAQ[3].question} desc={PROMO_FAQ[3].answer} />
            <FAQCard
              title={PROMO_FAQ[4].question}
              desc={PROMO_FAQ[4].answer}
              rotation="-2deg"
            />

            {/* middle cards and title */}
            <FAQCard
              title={PROMO_FAQ[5].question}
              desc={PROMO_FAQ[5].answer}
              rotation="3deg"
            />
            <div className="row-span-1 flex w-96 flex-col items-center justify-center">
              <div className="font-jetbrainsmono mb-6 text-base text-medium">
                FAQ
              </div>
              <h2 className="mb-4 text-center font-dico text-xl font-medium ">
                Frequently Asked Questions
              </h2>
              <div className="w-1/2 text-center font-figtree text-sm text-medium">
                Can&apos;t find an answer? Reach out to us at{" "}
                <a
                  href="mailto:hello@hackwestern.com"
                  className="text-blue-600 transition-all hover:text-blue-700"
                >
                  hello@hackwestern.com
                </a>
              </div>
            </div>
            <FAQCard
              title={PROMO_FAQ[6].question}
              desc={PROMO_FAQ[6].answer}
              rotation="-5deg"
            />

            <FAQCard
              title={PROMO_FAQ[7].question}
              desc={PROMO_FAQ[7].answer}
              rotation="-4deg"
            />
            <FAQCard
              title={PROMO_FAQ[8].question}
              desc={PROMO_FAQ[8].answer}
              rotation="-2deg"
            />
            <FAQCard
              title={PROMO_FAQ[9].question}
              desc={PROMO_FAQ[9].answer}
              rotation="3deg"
            />

            <div className="row-span-3 my-auto grid grid-rows-2 gap-10">
              <FAQCard
                title={PROMO_FAQ[10].question}
                desc={PROMO_FAQ[10].answer}
                rotation="-2deg"
              />
              <FAQCard
                title={PROMO_FAQ[11].question}
                desc={PROMO_FAQ[11].answer}
                rotation="3deg"
              />
            </div>
          </div>
        </div>
      </div>
    </CanvasComponent>
  );
}

export default FAQ;
