// Dietary tags, matching the food-table menu screens ("HW13 Menu Screens" in
// Figma). A tag only appears when the source confirms it.
export const DIET_TAGS = [
  "Halal",
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "Nut-free",
  "Sesame-free",
] as const;

export type DietTag = (typeof DIET_TAGS)[number];

export interface Dish {
  name: string;
  // What's in it, shown under the tags
  items?: string;
  tags?: DietTag[];
  // Small print: allergens, limited quantity, etc.
  note?: string;
}

export interface Meal {
  // "Dinner", "Late-night snack", ...
  label: string;
  // Headline from the menu screen; the vendor is used when there isn't one
  title?: string;
  vendor: string;
  dishes: Dish[];
  // Footer from the menu screen
  footnote?: string;
}

export type MenuDay = "friday" | "saturday" | "sunday";

// Friday dinner and Saturday breakfast, lunch and dinner come from the Figma
// menu screens; the snacks and Sunday from the HW13 hacker package (Notion).
// Ask Events before changing anything.
export const menu: Record<MenuDay, Meal[]> = {
  friday: [
    {
      label: "Dinner",
      title: "Rice Bowls",
      vendor: "Mr. & Mrs. Bao",
      dishes: [
        {
          name: "Pork Belly",
          items: "Teriyaki · corn · lettuce · crispy onion · sesame seeds",
        },
        {
          name: "Bibimbap",
          items:
            "Gochujang · marinated egg · kimchi · crispy onion · sesame seeds",
        },
        {
          name: "Sweet & Spicy Chicken",
          tags: ["Halal"],
          items: "Sweet & spicy sauce · japanese pickle · lettuce · parsley",
        },
        {
          name: "Honey Garlic Chicken",
          tags: ["Halal", "Sesame-free"],
          items: "Honey garlic sauce · jalapeño · lettuce · crispy onion",
        },
        {
          name: "Jerk Chicken",
          tags: ["Halal"],
          items: "Ginger miso · carrot slaw · lettuce · crispy onion",
        },
        {
          name: "Sweet & Spicy Soy",
          tags: ["Vegan"],
          items: "Jalapeño · carrot slaw · parsley",
        },
        {
          name: "Honey Garlic Soy",
          tags: ["Vegan"],
          items: "Jalapeño · lettuce · crispy onion",
        },
        {
          name: "Chicken Bowl",
          tags: ["Gluten-free"],
          items: "Lettuce · carrot slaw",
        },
      ],
      footnote:
        "Bowls are labelled by type. Made in a shared kitchen, so cross-contact is possible.",
    },
    {
      label: "Late-night snack",
      title: "Bubble Tea",
      vendor: "Chatime",
      dishes: [
        {
          name: "Pearl Milk Tea",
          tags: [
            "Halal",
            "Vegetarian",
            "Gluten-free",
            "Nut-free",
            "Sesame-free",
          ],
          items: "Signature milk tea · chewy tapioca",
        },
        {
          name: "QQ Mango",
          tags: ["Halal", "Vegan", "Gluten-free", "Nut-free", "Sesame-free"],
          items:
            "Mango purée · jasmine green tea · tapioca pearls · coconut jelly",
        },
      ],
    },
  ],
  saturday: [
    {
      label: "Breakfast",
      title: "Bakery Spread",
      vendor: "Black Walnut Bakery Cafe",
      dishes: [
        {
          name: "Scones",
          tags: ["Vegetarian", "Nut-free", "Sesame-free"],
          items: "Oatmeal date · cranberry white cheddar",
          note: "Baked fresh in house. Not vegan or gluten-free.",
        },
        {
          name: "Muffins & Croissants",
          tags: ["Vegetarian", "Nut-free", "Sesame-free"],
          items:
            "Assorted muffins · plain mini croissants · chocolate mini croissants",
          note: "Not vegan or gluten-free.",
        },
        {
          name: "Fruit Platter",
          tags: ["Vegan", "Gluten-free"],
          items: "Watermelon · cantaloupe · berries · grapes · oranges",
          note: "The pick for vegan and gluten-free hackers.",
        },
        {
          name: "Coffee",
          items:
            "Medium roast, hand-roasted in house. Cream · milk · sugar on the side",
        },
      ],
      footnote:
        "Everything here is nut-free and sesame-free. No meat in the baked goods, but halal prep isn't guaranteed.",
    },
    {
      label: "Lunch",
      title: "Hot Dog Bar",
      vendor: "Frank & Furter's Hotdog Dive Bar",
      dishes: [
        {
          name: "The Dogs",
          tags: ["Halal", "Vegetarian"],
          items: "Regular · halal · vegetarian (not vegan) · served on buns",
          note: "Dogs and buns contain gluten. Veggie dogs may contain soy.",
        },
        {
          name: "Sauces",
          items:
            "Ketchup · mustard · mayo · chipotle · Dillhole · Firehole · Garlichole · Furter sauce",
          note: "Mayo and aioli sauces may contain egg. Mustard sauces contain mustard. Some creamy sauces have dairy.",
        },
        {
          name: "Toppings",
          items:
            "Relish · lettuce · tomatoes · white, red & green onions · black & green olives · sauerkraut · banana peppers · jalapeños · dill pickles",
        },
        {
          name: "Summer Fresh Salads",
          tags: ["Vegetarian"],
          items:
            "Dill Pickle Potato (vegetarian, contains egg) · Super Crunch (vegan)",
        },
      ],
      footnote:
        "Halal and vegetarian dogs are kept separate, but the topping bar is shared. No gluten-free or vegan dogs. Not guaranteed free of nuts or sesame.",
    },
    {
      label: "Dinner",
      title: "Taco Bar",
      vendor: "The Mule",
      dishes: [
        {
          name: "Cease and Desist",
          tags: ["Gluten-free"],
          items: "Beef & pork · 6″ corn tortillas",
          note: "Not halal.",
        },
        {
          name: "Vegan Cease",
          tags: ["Vegan", "Halal", "Gluten-free"],
          items: "Beans · 6″ corn tortillas",
        },
        {
          name: "Toppings",
          items: "Cabbage · cheese · hot sauce · lime crema · salsa · cilantro",
          note: "Cheese and lime crema contain dairy.",
        },
        {
          name: "Summer Fresh Salads",
          tags: ["Vegan", "Gluten-free"],
          items: "Mexican Bean · Chickpea & Edamame",
        },
      ],
      footnote:
        "Two tacos each. The Mule is a 100% gluten-free and nut-free kitchen.",
    },
    {
      label: "Late-night snack",
      title: "Fritters",
      vendor: "The Fritter Shop",
      dishes: [
        {
          name: "Sweet Fritters",
          tags: ["Halal", "Nut-free"],
          note: "Popular flavour mix.",
        },
        {
          name: "Vegan Fritters",
          tags: ["Vegan", "Halal", "Nut-free"],
          items: "Apple deluxe · blueberry · cherry · lemon · raspberry",
          note: "Packed separately.",
        },
        {
          name: "Gluten-Free Stroopwafels",
          tags: ["Gluten-free"],
          note: "Prepackaged.",
        },
      ],
      footnote: "Made in a nut-free facility, with no sesame.",
    },
  ],
  sunday: [
    {
      label: "Breakfast",
      vendor: "Daniel's Bake Bar",
      dishes: [
        {
          name: "Sesame Shaobing",
          tags: ["Halal", "Nut-free"],
        },
        {
          name: "Ube Brownies",
          tags: ["Halal", "Vegetarian", "Nut-free", "Sesame-free"],
        },
        {
          name: "Black Sesame Banana Muffin",
          tags: ["Halal", "Vegan", "Nut-free"],
        },
        {
          name: "Chocolate Chip Muffin",
          tags: ["Halal", "Vegan", "Nut-free", "Sesame-free"],
          note: "Contains wheat and soy. Not gluten-free.",
        },
        {
          name: "Coffee",
          tags: [
            "Halal",
            "Vegetarian",
            "Gluten-free",
            "Nut-free",
            "Sesame-free",
          ],
          items: "Cream · milk · sugar",
          note: "Cream and milk aren't vegan.",
        },
      ],
    },
    {
      label: "Lunch",
      title: "Banh Mi",
      vendor: "Thy's Banh Mi",
      dishes: [
        {
          name: "Grilled Chicken",
          tags: ["Halal"],
          note: "Mayo contains egg.",
        },
        {
          name: "Tofu (vegetarian)",
          tags: ["Vegetarian"],
          note: "Vegan mushroom pâté.",
        },
        {
          name: "Tofu (vegan)",
          tags: ["Vegan"],
          note: "Limited quantity.",
        },
        {
          name: "Grilled Chicken (gluten-free)",
          tags: ["Gluten-free"],
          note: "Limited quantity. Contains egg.",
        },
        {
          name: "Butter Garlic Chicken",
          tags: ["Nut-free", "Sesame-free"],
          note: "Limited quantity. Contains egg.",
        },
        {
          name: "Regular",
          items: "Cold cut · BBQ pork · sweet pork · sweet chicken",
          note: "Contains pork.",
        },
      ],
      footnote:
        "Sandwiches are individually wrapped and labelled with ingredients. House-made hot sauce on the side, made without nut or wheat ingredients.",
    },
  ],
};
