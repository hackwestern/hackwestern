import Image from "next/image";
import { CdCard } from "./codirectors-profile-card";

export const PAGES = [
  {
    label: "CO-DIRECTORS",
    labelOffset: 10,
    front: (
      <div>
        <div className="flex justify-center align-middle">
          <Image
            src="/images/promo/book/codirector-title.svg"
            alt="codirector"
            width={261}
            height={80}
          />
        </div>
        <CdCard
          name="Swathi Thushiyandan"
          role="Co-Director"
          photo="/images/organizers/swathi.JPG"
          rotate={-8}
          imageWidth={180}
          imageHeight={180}
          style={{
            position: "absolute",
            top: 136,
            left: 61,
          }}
        />
        <CdCard
          name="Sarah Huang"
          role="Co-Director"
          photo="/images/organizers/huang.png"
          imageWidth={180}
          imageHeight={180}
          rotate={9}
          style={{
            position: "absolute",
            top: 330,
            left: 280,
          }}
        />
      </div>
    ),
    back: (
      <div>
        <div>
          <CdCard
            name="Rachel Chen"
            role="Design Lead"
            photo="/images/organizers/rachel.jpg"
            imageWidth={220}
            imageHeight={263}
            style={{
              position: "absolute",
              top: 330,
              left: 280,
            }}
          />
          <div className="absolute bottom-4 z-20 w-full text-center text-sm font-bold">
            <div className="text-xs text-gray-500">Rachel Chen</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: "DESIGN",
    labelOffset: 126,
    front: (
      <div>
        horse horse horse
        <Image
          src="/images/organizers/william.jpeg"
          alt="bonnie"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
    back: <div></div>,
  },
  {
    label: "EVENTS",
    labelOffset: 195,
    front: <div></div>,
    back: (
      <div>
        <div className="ml-8 mt-8 flex justify-center align-middle">
          <Image
            src="/images/promo/book/marketing-book-title.svg"
            alt="marketing"
            width={215}
            height={80}
          />
        </div>

        <CdCard
          name="Laurel Dong"
          role="Marketing Lead"
          photo="/images/organizers/laurel.jpg"
          imageWidth={202}
          imageHeight={240}
          style={{
            position: "absolute",
            top: 160,
            left: 138,
          }}
          borderRadius="0px"
        />
      </div>
    ),
  },
  {
    label: "MARKETING",
    labelOffset: 264,
    front: (
      <div>
        <CdCard
          name="Brittney Chong"
          role="Marketing Organizer"
          photo="/images/organizers/brittney.jpg"
          imageWidth={156}
          imageHeight={188}
          style={{
            position: "absolute",
            top: 74,
            left: 65,
          }}
          borderRadius="0px"
          rotate={-4}
        />
        <CdCard
          name="Allison Ye"
          role="Marketing Organizer"
          photo="/images/organizers/allison.png"
          imageWidth={156}
          imageHeight={188}
          style={{
            position: "absolute",
            top: 340,
            left: 260,
          }}
          borderRadius="0px"
          rotate={9}
        />
      </div>
    ),
    back: (
      <div>
        <div className="mt-16 flex justify-center align-middle">
          <Image
            src="/images/promo/book/sponsorship-book-title.svg"
            alt="Sponsorship"
            width={261}
            height={80}
          />
        </div>
        <CdCard
          name="Freda Zhao"
          role="Sponsorship Lead"
          photo="/images/organizers/freda.jpg"
          imageWidth={177}
          imageHeight={199}
          borderRadius="0px"
        />
      </div>
    ),
  },
  {
    label: "SPONSORSHIP",
    labelOffset: 357,
    front: (
      <div>
        <Image
          src="/images/organizers/jerry.jpeg"
          alt="jerry"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
    back: (
      <div>
        web
        <Image
          src="/images/promo/book/web_book_title.svg"
          alt="joy"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
        <Image
          src="/images/promo/book/william_book.svg"
          alt="joy"
          width={226}
          height={248}
          className="mx-auto h-[226px] w-[248px]"
        />
      </div>
    ),
  },
  {
    label: "WEB",
    labelOffset: 466,
    front: (
      <div>
        <Image
          src="/images/promo/book/web_organizers.svg"
          alt="kyle"
          width={169}
          height={557}
          className="mx-auto h-[557px] w-[169px]"
        />
      </div>
    ),
    back: (
      <div>
        bonus page
        <Image
          src="/images/organizers/marissa.jpeg"
          alt="marissa"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
  },
] as const;
