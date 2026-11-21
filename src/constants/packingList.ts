export type Item = {
  id: string;
  heading: string;
  desc: string;
};

export const PackingList: Item[] = [
  {
    id: "photo-id",
    heading: "🪪 Valid Photo ID",
    desc: "You'll need a valid government-issued photo ID (Driver's License, Passport, Health Card, etc.) to check-in. Student IDs don't count!",
  },
  {
    id: "tech",
    heading: "💻 Tech",
    desc: "Your laptop, charger, phone charger, and any other devices you need to make your hacking experience as productive as possible!",
  },
  {
    id: "water-bottle",
    heading: "💧 Water Bottle",
    desc: "A reusable water bottle to stay hydrated and reduce waste!",
  },
  {
    id: "toiletries",
    heading: "🪥 Toiletries",
    desc: "Toiletries (soap, toothpaste, toothbrush, deodorant, etc.) to stay as fresh and comfortable as possible!",
  },
  {
    id: "clothing-sleep",
    heading: "🧥 Warm Clothing + Blanket / Sleeping Bag",
    desc: "It'll be chilly here in London, ON, so pack a cozy sweater and other warm clothing as well as a blanket or sleeping bag if you plan on staying at the venue (mattresses will be provided on a first come, first serve basis)",
  },
  {
    id: "positive",
    heading: "😊 A Positive Mindset",
    desc: "Endless enthusiasm and a positive mindset to make the best hack possible!",
  },
];
