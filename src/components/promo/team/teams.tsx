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
          roundFrame={true}
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
          roundFrame={true}
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
              roundFrame={true}
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
          roundFrame={true}
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
          roundFrame={true}
        />
      </div>
    ),
    back: (
      <div>
        <div className="flex flex-col items-center">
          <div className="mt-24 flex justify-center align-middle">
            <Image
              src="/images/promo/book/events-book-title.svg"
              alt="events"
              width={120}
              height={80}
            />
          </div>
          <CdCard
            name="Marissa Wang"
            role="Events Lead"
            photo="/images/organizers/marissa.jpeg"
            imageWidth={217}
            imageHeight={171}
            frameWidth={246}
            frameHeight={200}
            style={{
              position: "absolute",
              top: 200,
              left: 56,
            }}
            roundFrame={true}
            roundImage={true}
          />
          <CdCard
            name="Jerry Zhang"
            role="Events Lead"
            photo="/images/organizers/jerry.jpeg"
            imageWidth={179}
            imageHeight={224}
            frameWidth={208}
            frameHeight={253}
            style={{
              position: "absolute",
              top: 317,
              left: 254,
            }}
            roundFrame={true}
          />
        </div>
      </div>
    ),
  },
  {
    label: "EVENTS",
    labelOffset: 195,
    front: (
      <div>
        <CdCard
          name="Yash Gandhi"
          role="Events Organizer"
          photo="/images/organizers/yash.jpg"
          imageWidth={189}
          imageHeight={150}
          frameWidth={220}
          frameHeight={180}
          style={{
            position: "absolute",
            top: 215,
            left: 259,
          }}
          roundFrame={true}
        />
        <CdCard
          name="Sarah Lieng"
          role="Events Organizer"
          photo="/images/organizers/lieng.jpeg"
          imageWidth={207}
          imageHeight={138}
          frameWidth={236}
          frameHeight={174}
          style={{
            position: "absolute",
            top: 109,
            left: 72,
          }}
          roundFrame={true}
        />

        <CdCard
          name="Julian Laxman"
          role="Events Organizer"
          photo="/images/organizers/julian.JPG"
          imageWidth={183}
          imageHeight={183}
          frameWidth={220}
          frameHeight={215}
          style={{
            position: "absolute",
            top: 355,
            left: 80,
          }}
          roundFrame={true}
        />
      </div>
    ),
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
          roundFrame={true}
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
          rotate={-4}
          roundFrame={true}
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
          rotate={9}
          roundFrame={true}
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
          frameWidth={234}
          frameHeight={284}
          style={{
            position: "absolute",
            top: 211,
            left: 146,
          }}
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
        <CdCard
          name="Sarina Cheng"
          role="Sponsorship Organizer"
          photo="/images/organizers/sarina.jpg"
          imageWidth={151}
          imageHeight={139}
          frameWidth={211}
          frameHeight={215}
          style={{
            position: "absolute",
            top: 44,
            left: 58,
          }}
          borderRadius="0px"
        />
        <CdCard
          name="Shaun Ahuja"
          role="Sponsorship Organizer"
          photo="/images/organizers/shaun.jpeg"
          imageWidth={147}
          imageHeight={139}
          frameWidth={220}
          frameHeight={220}
          style={{
            position: "absolute",
            top: 201,
            left: 280,
          }}
          borderRadius="0px"
        />
        <CdCard
          name="Derrick Ha"
          role="Sponsorship Organizer"
          photo="/images/organizers/derrick.png"
          imageWidth={137}
          imageHeight={161}
          frameWidth={183}
          frameHeight={223}
          style={{
            position: "absolute",
            top: 333,
            left: 70,
          }}
          borderRadius="0px"
        />
      </div>
    ),
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
          roundFrame={true}
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
          webRoleSide="left"
          roundFrame={true}
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
          alt="web organizers"
          width={169}
          height={557}
          style={{
            position: "absolute",
            top: 47,
            left: 179,
          }}
        />{" "}
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
