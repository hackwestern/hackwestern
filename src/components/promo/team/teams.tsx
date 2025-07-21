export const PAGES = [
  {
    label: "CO-DIRECTORS",
    labelOffset: 10,
    front: (
      <div>
        <h1 className="text-3xl font-bold">A Guide to the Cosmos</h1>
        <p className="mt-4 text-lg">Page 1: The Cover</p>
        <p className="mt-20">Click the right side of the book to begin.</p>
      </div>
    ),
    back: (
      <div>
        <h2 className="text-2xl font-semibold">Page 2: Introduction</h2>
        <p className="mt-4">
          In the beginning, there was... a lot of empty space.
        </p>
      </div>
    ),
  },
  {
    label: "DESIGN",
    labelOffset: 126,
    front: (
      <div>
        <h2 className="text-2xl font-semibold">Page 3: The Stars</h2>
        <p className="mt-4">
          Stars are giant celestial bodies made mostly of hydrogen and helium.
        </p>
      </div>
    ),
    back: (
      <div>
        <h2 className="text-2xl font-semibold">Page 4: The Planets</h2>
        <p className="mt-4">
          Our solar system has eight planets. Pluto is a dwarf planet.
        </p>
      </div>
    ),
  },
  {
    label: "EVENTS",
    labelOffset: 195,
    front: (
      <div>
        <h2 className="text-2xl font-semibold">Page 5: The End?</h2>
        <p className="mt-4">The end of the book, but not the universe.</p>
      </div>
    ),
    back: (
      <div>
        <h2 className="text-2xl font-semibold">The Back Cover</h2>
        <p className="mt-4">Click the left side to go back.</p>
      </div>
    ),
  },
  {
    label: "MARKETING",
    labelOffset: 264,
    front: (
      <div>
        <h2 className="text-2xl font-semibold">Page 6: The Universe</h2>
        <p className="mt-4">
          The universe is vast and ever-expanding, filled with mysteries.
        </p>
      </div>
    ),
    back: (
      <div>
        <h2 className="text-2xl font-semibold">Page 6: The Universe</h2>
        <p className="mt-4">
          The universe is vast and ever-expanding, filled with mysteries.
        </p>
      </div>
    ),
  },
  {
    label: "SPONSORSHIP",
    labelOffset: 357,
    front: (
      <div>
        <h2 className="text-2xl font-semibold">Page 7: The Future</h2>
        <p className="mt-4">
          The future holds endless possibilities, driven by technology and
          innovation.
        </p>
      </div>
    ),
    back: (
      <div>
        <h2 className="text-2xl font-semibold">Page 8: The Future</h2>
        <p className="mt-4">
          The future holds endless possibilities, driven by technology and
          innovation.
        </p>
      </div>
    ),
  },
  {
    label: "WEB",
    labelOffset: 466,
    front: (
      <div>
        <h2 className="text-2xl font-semibold">Page 9: The Contributors</h2>
        <p className="mt-4">
          This book was made possible by the contributions of many talented
          individuals.
        </p>
      </div>
    ),
    back: (
      <div>
        <h2 className="text-2xl font-semibold">Page 10: The Contributors</h2>
        <p className="mt-4">
          This book was made possible by the contributions of many talented
          individuals.
        </p>
      </div>
    ),
  },
] as const;
