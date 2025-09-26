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
        <div className="mt-16 flex justify-center align-middle">
          <div className="flex flex-col items-center">
            <div className="flex justify-center align-middle">
              <Image
                src="/images/promo/book/design-book-title.svg"
                alt="design"
                width={135}
                height={80}
              />
            </div>
            <CdCard
              name="Rachel Chen"
              role="Design Lead"
              photo="/images/organizers/rachel.jpg"
              imageWidth={220}
              imageHeight={263}
              style={{
                position: "absolute",
                top: 182,
                left: 121,
              }}
            />
          </div>
        </div>{" "}
      </div>
    ),
  },
  {
    label: "DESIGN",
    labelOffset: 126,
    front: (
      <div>
        <CdCard
          name="Jessica Wang"
          role="Design Organizer"
          photo="/images/organizers/jessica.jpg"
          imageWidth={149}
          imageHeight={191}
          frameWidth={190}
          frameHeight={229}
          style={{
            position: "absolute",
            top: 94,
            left: 266,
          }}
          rotate={8}
        />
        <CdCard
          name="Anthony Ung"
          role="Design Organizer"
          photo="/images/organizers/anthony.jpeg"
          imageWidth={153}
          imageHeight={186}
          frameWidth={187}
          frameHeight={216}
          style={{
            position: "absolute",
            top: 316,
            left: 53,
          }}
          rotate={-9}
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
          frameHeight={256}
          frameWidth={187}
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
          frameHeight={256}
          frameWidth={194}
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
    front: <div></div>,
    back: (
      <div>
        <Image
          src="/images/promo/book/web_book_title.svg"
          alt="joy"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
        <CdCard
          name="William Liu"
          role="Web Lead"
          photo="/images/organizers/william.jpeg"
          imageWidth={191}
          imageHeight={179}
          style={{
            position: "absolute",
            top: 305,
            left: 220,
          }}
          borderRadius="0px"
        />
        <CdCard
          name="Hunter Chen"
          role="Web Lead"
          photo="/images/organizers/hunter.jpg"
          imageWidth={167}
          imageHeight={160}
          frameHeight={218}
          frameWidth={226}
          style={{
            position: "absolute",
            top: 144,
            left: 58,
          }}
          borderRadius="0px"
          webRoleSide="left"
        />
      </div>
    ),
  },
  {
    label: "WEB",
    labelOffset: 466,
    front: <div></div>,
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
