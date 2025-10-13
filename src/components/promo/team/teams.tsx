import Image from "next/image";
import { CdCard } from "./codirectors-profile-card";
import { SponsorshipLeadFrame } from "./frames";
import { Button } from "~/components/ui/button";

export const PAGES = [
  {
    label: undefined,
    labelOffset: 0,
    front: <></>,
    back: (
      <div>
        <div className="mt-16 flex justify-center align-middle">
          <div className="absolute h-[271px] w-[351px] translate-y-[67px] -rotate-2 rounded-md bg-white p-2.5 shadow-md">
            <Image
              src={"/images/promo/book/team.png"}
              alt="frame"
              width={351}
              height={271}
            />
            <div className="mt-2 text-center font-figtree text-[#776780]">
              Hack Western 12
            </div>
          </div>
          <Image
            src="/images/promo/book/dream-team.svg"
            alt="dream team"
            height={54}
            width={90}
            style={{
              position: "absolute",
              top: 458,
              left: 50,
            }}
          />
          <Image
            src="/images/promo/book/front-page-doodle.svg"
            alt="doodle"
            height={75}
            width={204}
            style={{
              position: "absolute",
              top: 465,
              left: 161,
            }}
          />
          <div className="relative h-28 w-28">
            <Image
              src="/horse.svg"
              alt="Frame"
              className="absolute inset-0 h-full w-full translate-x-[160px] translate-y-[287px] rotate-12 object-contain"
              draggable={false}
              width={112}
              height={112}
            />
          </div>
        </div>
      </div>
    ),
  },
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
        <Image
            src="/images/promo/book/stickers/headphones.png"
            alt="headphones"
            height={82}
            width={90}
            style={{
              position: "absolute",
              top: 120,
              left: 275,
              transform: "rotate(5deg)"
            }}
          />
        <Image
          src="/images/promo/book/stickers/palette.png"
          alt="palette"
          height={92}
          width={70}
          style={{
            position: "absolute",
            top: 250,
            left: 417,
          }}
        />
        <Image
          src="/images/promo/book/stickers/cello.png"
          alt="cello"
          height={50}
          width={60}
          style={{
            position: "absolute",
            top: 343,
            left: 20,
            transform: "rotate(-25deg)"
          }}
        />
        <Image
          src="/images/promo/book/stickers/uc-hill.png"
          alt="uc-hill"
          height={244}
          width={238}
          style={{
            position: "absolute",
            top: 464,
            left: 41,
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
              roundFrame={true}
            />
            <Image
              src="/images/promo/book/stickers/dancer.png"
              alt="dancer"
              height={152}
              width={150}
              style={{
                position: "absolute",
                top: 491,
                left: 316,
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
        <Image
          src="/images/promo/book/stickers/rainbow.png"
          alt="rainbow"
          height={163}
          width={136}
          style={{
            position: "absolute",
            top: 180,
            left: 102,
          }}
        />
        <Image
          src="/images/promo/book/stickers/cat.png"
          alt="cat"
          height={154}
          width={135}
          style={{
            position: "absolute",
            top: 500,
            left: 281,
          }}
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
            showCaption={false}
          />
          <div className="absolute left-[40px] top-[410px] ml-4 flex flex-col items-start justify-center gap-0">
            <span className="font-figtree font-bold leading-tight text-heavy">
              Marrissa Wang
            </span>
            <span className="text-md -mt-0.3 font-bold leading-tight text-medium">
              Events Lead
            </span>
          </div>{" "}
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
            showCaption={false}
          />
          <div className="absolute left-[340px] top-[275px] ml-4 flex flex-col items-end justify-center gap-0">
            <span className="font-figtree font-bold leading-tight text-heavy">
              Jerry Zhang
            </span>
            <span className="text-md -mt-0.3 font-bold leading-tight text-medium">
              Events Lead
            </span>
          </div>{" "}
          <Image
            src="/images/promo/book/stickers/bear.png"
            alt="bear"
            height={130}
            width={81}
            style={{
              position: "absolute",
              top: 511,
              left: 58,
            }}
          />
          <Image
            src="/images/promo/book/stickers/butterfly.png"
            alt="butterfly"
            height={67}
            width={101}
            style={{
              position: "absolute",
              top: 144,
              left: 335,
            }}
          />
          <Image
            src="/images/promo/book/stickers/star.png"
            alt="star"
            height={43}
            width={25}
            style={{
              position: "absolute",
              top: 162,
              left: 320,
            }}
          />
          <Image
            src="/images/promo/book/stickers/star.png"
            alt="star"
            height={48}
            width={32}
            style={{
              position: "absolute",
              top: 120,
              left: 336,
            }}
          />
          <Image
            src="/images/promo/book/stickers/star.png"
            alt="star"
            height={43}
            width={30}
            style={{
              position: "absolute",
              top: 197,
              left: 418,
            }}
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
          showCaption={false}
        />
        <div className="absolute left-20 top-[300px] ml-4 flex flex-col items-end justify-center gap-0">
          <span className="font-figtree font-bold leading-tight text-heavy">
            Yash Gandhi
          </span>
          <span className="text-md -mt-0.5 font-bold leading-tight text-medium">
            Events Organizer
          </span>
        </div>{" "}
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
          showCaption={false}
        />
        <div className="absolute left-[300px] top-[160px] ml-4 flex flex-col items-start justify-center gap-0">
          <span className="font-figtree font-bold leading-tight text-heavy">
            Sarah Lieng
          </span>
          <span className="text-md -mt-0.5 font-bold leading-tight text-medium">
            Events Organizer
          </span>
        </div>{" "}
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
          showCaption={false}
        />
        <div className="absolute left-[300px] top-[415px] ml-4 flex flex-col items-start justify-center gap-0">
          <span className="font-figtree font-bold leading-tight text-heavy">
            Julian Laxman
          </span>
          <span className="text-md -mt-0.5 font-bold leading-tight text-medium">
            Events Organizer
          </span>
        </div>{" "}
        <Image
            src="/images/promo/book/stickers/goggles.png"
            alt="goggles"
            height={66}
            width={134}
            style={{
              position: "absolute",
              top: 32,
              left: 274,
              transform: "rotate(10deg)"
            }}
          />
          <Image
            src="/images/promo/book/stickers/dancer-2.png"
            alt="dancer"
            height={90}
            width={117}
            style={{
              position: "absolute",
              top: 495,
              left: 315,
            }}
          />
          <Image
            src="/images/promo/book/stickers/can't-wait.svg"
            alt="can't wait for HW XII >.<"
            height={23}
            width={265}
            style={{
              position: "absolute",
              top: 595,
              left: 219,
            }}
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
        <Image
          src="/images/promo/book/stickers/keyboard.png"
          alt="keyboard"
          height={78}
          width={149}
          style={{
            position: "absolute",
            top: 530,
            left: 152,
          }}
        />
        <Image
          src="/images/promo/book/stickers/mouse.png"
          alt="mouse"
          height={99}
          width={89}
          style={{
            position: "absolute",
            top: 518,
            left: 290,
            transform: "scaleX(-1)"
          }}
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
          <Image
            src="/images/promo/book/stickers/cat-2.png"
            alt="cat"
            height={130}
            width={117}
            style={{
              position: "absolute",
              top: 522,
              left: 120,
              transform: "rotate(5deg)"
            }}
          />
          <Image
            src="/images/promo/book/stickers/treble.png"
            alt="treble clef"
            height={60}
            width={52}
            style={{
              position: "absolute",
              top: 571,
              left: 434,
            }}
          />
          <Image
            src="/images/promo/book/stickers/rope.png"
            alt="rope and rock"
            height={130}
            width={157}
            style={{
              position: "absolute",
              top: 200,
              left: 334,
            }}
          />
          <Image
            src="/images/promo/book/stickers/rock-1.png"
            alt="rock"
            height={90}
            width={80}
            style={{
              position: "absolute",
              top: 141,
              left: 255,
              transform: "rotate(-60deg)"
            }}
          />
          <Image
            src="/images/promo/book/stickers/rock-2.png"
            alt="rock"
            height={74}
            width={82}
            style={{
              position: "absolute",
              top: 72,
              left: 313,
            }}
          />
          <Image
            src="/images/promo/book/stickers/rock-climbing.svg"
            alt="rock climbing!"
            height={13}
            width={125}
            style={{
              position: "absolute",
              top: 154,
              left: 350,
            }}
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
        <Image
          src="/images/promo/book/stickers/sparkles.png"
          alt="sparkles"
          height={78}
          width={49}
          style={{
            position: "absolute",
            top: 211,
            left: 65,
          }}
        />
        <Image
          src="/images/promo/book/stickers/cat-3.png"
          alt="cat"
          height={95}
          width={118}
          style={{
            position: "absolute",
            top: 516,
            left: 337,
          }}
        />
        <Image
          src="/images/promo/book/stickers/moewww.svg"
          alt="meowww"
          height={12}
          width={65}
          style={{
            position: "absolute",
            top: 595,
            left: 265,
          }}
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
          CustomFrame={SponsorshipLeadFrame}
          photo="/images/organizers/derrick.png"
          imageWidth={137}
          imageHeight={161}
          frameWidth={190}
          frameHeight={240}
          style={{
            position: "absolute",
            top: 333,
            left: 65,
          }}
          borderRadius="0px"
        />
        <Image
          src="/images/promo/book/stickers/dog.png"
          alt="dog"
          height={115}
          width={111}
          style={{
            position: "absolute",
            top: 83,
            left: 286,
          }}
        />
        <Image
          src="/images/promo/book/stickers/comet.png"
          alt="comet"
          height={87}
          width={126}
          style={{
            position: "absolute",
            top: 440,
            left: 267,
          }}
        />
      </div>
    ),
    back: (
      <div>
        <Image
          src="/images/promo/book/web_book_title.svg"
          alt="web"
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
          frameWidth={235}
          frameHeight={226}
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
          frameHeight={210}
          frameWidth={226}
          style={{
            position: "absolute",
            top: 144,
            left: 58,
          }}
          webRoleSide="left"
          roundFrame={true}
          webRoleTop="30%"
        />
        <Image
          src="/images/promo/book/stickers/disco-ball.png"
          alt="disco ball"
          height={99}
          width={98}
          style={{
            position: "absolute",
            top: 345,
            left: 129,
          }}
        />
        <Image
          src="/images/promo/book/stickers/dancer-3.png"
          alt="dancer"
          height={180}
          width={151}
          style={{
            position: "absolute",
            top: 472,
            left: 43,
          }}
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
        />
        <Image
          src="/images/promo/book/stickers/basket.png"
          alt="basket"
          height={90}
          width={99}
          style={{
            position: "absolute",
            top: 23,
            left: 339,
          }}
        />
        <Image
          src="/images/promo/book/stickers/ball.png"
          alt="ball"
          height={64}
          width={90}
          style={{
            position: "absolute",
            top: 87,
            left: 406,
          }}
        />
        <Image
          src="/images/promo/book/stickers/mic.png"
          alt="mic"
          height={119}
          width={90}
          style={{
            position: "absolute",
            top: 408,
            left: 58,
          }}
        />
        <Image
          src="/images/promo/book/stickers/monkey.png"
          alt="monkey"
          height={129}
          width={108}
          style={{
            position: "absolute",
            top: 527,
            left: 406,
          }}
        />
      </div>
    ),
    back: (
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="flex flex-col items-center justify-center gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-center gap-6">
            <a
              href="https://www.instagram.com/hackwestern"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Hack Western on Instagram"
              className="text-medium transition-colors hover:scale-105 hover:text-heavy"
            >
              <svg
                className="h-8 w-8"
                viewBox="0 0 24 25"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g id="Instagram">
                  <path
                    id="Vector"
                    d="M17 2.08325H7C4.23858 2.08325 2 4.4151 2 7.29159V17.7083C2 20.5847 4.23858 22.9166 7 22.9166H17C19.7614 22.9166 22 20.5847 22 17.7083V7.29159C22 4.4151 19.7614 2.08325 17 2.08325Z"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    id="Vector_2"
                    d="M16 11.8437C16.1234 12.7106 15.9812 13.596 15.5937 14.3739C15.2062 15.1518 14.5931 15.7827 13.8416 16.1767C13.0901 16.5707 12.2384 16.7079 11.4077 16.5686C10.5771 16.4294 9.80971 16.0209 9.21479 15.4012C8.61987 14.7814 8.22768 13.9821 8.09402 13.1168C7.96035 12.2516 8.09202 11.3644 8.47028 10.5816C8.84854 9.79875 9.45414 9.16009 10.2009 8.75645C10.9477 8.3528 11.7977 8.20473 12.63 8.33328C13.4789 8.46441 14.2648 8.87647 14.8716 9.5086C15.4785 10.1407 15.8741 10.9594 16 11.8437Z"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    id="Vector_3"
                    d="M17.5 6.77075H17.51"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/company/hack-western"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Hack Western on LinkedIn"
              className="text-medium transition-colors hover:scale-105 hover:text-heavy"
            >
              <svg
                className="h-8 w-8"
                viewBox="0 0 22 23"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g id="linkedin">
                  <path
                    id="Vector 2"
                    d="M12.8529 8.21688H8.38098V22.4995H12.8529V17.0385C12.8529 15.5682 12.8529 13.6779 13.2594 13.0478C13.666 12.4176 14.6823 11.7875 16.1052 12.2076C17.5281 12.6277 17.5281 14.308 17.5281 14.518V22.4995H22V14.9381C22 9.47712 19.5608 8.42693 17.3248 8.21688C15.3217 8.02871 13.5305 9.4071 12.8529 10.3173V8.21688Z"
                    fill="currentColor"
                  />
                  <rect
                    id="Rectangle 3"
                    y="8.19983"
                    width="5.2381"
                    height="14.3"
                    fill="currentColor"
                  />
                  <ellipse
                    id="Ellipse 1"
                    cx="2.61905"
                    cy="3.25024"
                    rx="2.61905"
                    ry="2.75"
                    fill="currentColor"
                  />
                </g>
              </svg>
            </a>
            <a
              href="https://github.com/hackwestern"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Hack Western on GitHub"
              className="text-medium transition-colors hover:scale-105 hover:text-heavy"
            >
              <svg
                className="h-8 w-8"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1024 1024"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"
                  transform="scale(64)"
                />
              </svg>
            </a>
          </div>
          <a
            href="mailto:hello@hackwestern.com"
            className="flex items-center gap-2"
            aria-label="Email Hack Western"
          >
            <Button
              variant="tertiary"
              size="sm"
              className="-pb-3 p-0 text-center font-jetbrains-mono text-sm font-medium text-medium hover:text-heavy"
              secondClass="-mt-1"
            >
              hello@hackwestern.com
            </Button>
          </a>
        </div>
      </div>
    ),
  },
] as const;
