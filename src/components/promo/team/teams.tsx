import Image from "next/image";

export const PAGES = [
  {
    label: "CO-DIRECTORS",
    labelOffset: 10,
    front: (
      <div>
        Edison Swathi
        <Image
          src="/images/organizers/edison.png"
          alt="edison"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
        <Image
          src="/images/organizers/swathi.png"
          alt="swathi"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
    back: (
      <div>
        design design
        <Image
          src="/images/organizers/rachel.png"
          alt="swathi"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
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
          src="/images/organizers/william.png"
          alt="bonnie"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
    back: (
      <div>
        text text text
        <Image
          src="/images/organizers/arsalaan.png"
          alt="arsalaan"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
  },
  {
    label: "EVENTS",
    labelOffset: 195,
    front: (
      <div>
        events 2
        <Image
          src="/images/organizers/ben.png"
          alt="ben"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
    back: (
      <div>
        marketing
        <Image
          src="/images/organizers/laurel.png"
          alt="cynthia"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
  },
  {
    label: "MARKETING",
    labelOffset: 264,
    front: (
      <div>
        marketing marketing
        <Image
          src="/images/organizers/dennis.png"
          alt="dennis"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
    back: (
      <div>
        spon
        <Image
          src="/images/organizers/hunter.png"
          alt="hunter"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
  },
  {
    label: "SPONSORSHIP",
    labelOffset: 357,
    front: (
      <div>
        spon
        <Image
          src="/images/organizers/jerry.png"
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
          src="/images/organizers/joy.png"
          alt="joy"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
  },
  {
    label: "WEB",
    labelOffset: 466,
    front: (
      <div>
        web web web
        <Image
          src="/images/organizers/kyle.png"
          alt="kyle"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
    back: (
      <div>
        bonus page
        <Image
          src="/images/organizers/laura.png"
          alt="laura"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
  },
] as const;
