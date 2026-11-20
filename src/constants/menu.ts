export interface AllergenInfo {
  Halal: boolean | null;
  Meat: boolean | null;
  Eggs: boolean | null;
  Nuts: boolean | null | "May Contain";
  Pork: boolean | null;
  Beef: boolean | null;
  Gluten: boolean | null;
}

export interface MealData {
  name: string;
  vendor: string;
  allergens: AllergenInfo;
  // Short dietary note from the vendor, shown under the vendor name.
  note?: string;
}

export interface DailyMeals {
  breakfast: MealData[];
  lunch: MealData[];
  dinner: MealData[];
  "midnight snack": MealData[];
}

export interface AllMealData {
  friday: DailyMeals;
  saturday: DailyMeals;
  sunday: DailyMeals;
}

// From Events' "Catering FINAL Details" doc and the HW13 hacker package
// (Nov 2026). null = not confirmed by the vendor yet, shown as TBD. Ask
// Events before changing a value.
export const allMeals: AllMealData = {
  friday: {
    breakfast: [],
    lunch: [],
    dinner: [
      {
        name: "Pork Belly Rice Bowl",
        vendor: "Mr. & Mrs. Bao",
        allergens: {
          Halal: false,
          Meat: true,
          Eggs: null,
          Nuts: null,
          Pork: true,
          Beef: false,
          Gluten: null,
        },
        note: "Shared kitchen, so cross-contact is possible.",
      },
      {
        name: "Bibimbap Rice Bowl",
        vendor: "Mr. & Mrs. Bao",
        allergens: {
          Halal: false,
          Meat: true,
          Eggs: true,
          Nuts: null,
          Pork: null,
          Beef: null,
          Gluten: null,
        },
        note: "Shared kitchen, so cross-contact is possible.",
      },
      {
        name: "Chicken Rice Bowls (Sweet Spicy, Honey Garlic, Jerk)",
        vendor: "Mr. & Mrs. Bao",
        allergens: {
          Halal: true,
          Meat: true,
          Eggs: null,
          Nuts: null,
          Pork: false,
          Beef: false,
          Gluten: null,
        },
        note: "Halal. Honey garlic is sesame-free. Shared kitchen, so cross-contact is possible.",
      },
      {
        name: "Soy Rice Bowls (Honey Garlic, Sweet Spicy)",
        vendor: "Mr. & Mrs. Bao",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: false,
          Nuts: null,
          Pork: false,
          Beef: false,
          Gluten: null,
        },
        note: "Vegan. Shared kitchen, so cross-contact is possible.",
      },
      {
        name: "Chicken Salad Bowl",
        vendor: "Mr. & Mrs. Bao",
        allergens: {
          Halal: null,
          Meat: true,
          Eggs: null,
          Nuts: null,
          Pork: null,
          Beef: null,
          Gluten: false,
        },
        note: "Gluten-free. Shared kitchen, so cross-contact is possible.",
      },
    ],
    "midnight snack": [
      {
        name: "Mango Green Tea with Coconut Jelly",
        vendor: "Chatime",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
      },
      {
        name: "Pearl Milk Tea",
        vendor: "Chatime",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: null,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
      },
    ],
  },
  saturday: {
    breakfast: [
      {
        name: "Baked Goods (Scones, Muffins, Mini Croissants)",
        vendor: "Black Walnut Bakery Cafe",
        allergens: {
          Halal: false,
          Meat: false,
          Eggs: null,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
        note: "Nut-free and sesame-free. No meat, but halal prep isn't guaranteed. No vegan or gluten-free baked goods.",
      },
      {
        name: "Fruit Platter",
        vendor: "Black Walnut Bakery Cafe",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
        note: "For vegan and gluten-free guests.",
      },
    ],
    lunch: [
      {
        name: "Hot Dogs",
        vendor: "Frank & Furter's",
        allergens: {
          Halal: false,
          Meat: true,
          Eggs: null,
          Nuts: "May Contain",
          Pork: null,
          Beef: null,
          Gluten: true,
        },
        note: "Build your own. No vegan or gluten-free option. No nuts or sesame as ingredients, but cross-contact is possible.",
      },
      {
        name: "Halal Hot Dogs",
        vendor: "Frank & Furter's",
        allergens: {
          Halal: true,
          Meat: true,
          Eggs: null,
          Nuts: "May Contain",
          Pork: false,
          Beef: null,
          Gluten: true,
        },
        note: "Kept separate from the regular hot dogs. No nuts or sesame as ingredients, but cross-contact is possible.",
      },
      {
        name: "Vegetarian Hot Dogs",
        vendor: "Frank & Furter's",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: null,
          Nuts: "May Contain",
          Pork: false,
          Beef: false,
          Gluten: true,
        },
        note: "Vegetarian, not vegan. Kept separate from the regular hot dogs.",
      },
      {
        name: "Dill Pickle Potato Salad",
        vendor: "Summerfresh",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: true,
          Nuts: null,
          Pork: false,
          Beef: false,
          Gluten: null,
        },
        note: "Vegetarian.",
      },
      {
        name: "Super Crunch Salad",
        vendor: "Summerfresh",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: false,
          Nuts: null,
          Pork: false,
          Beef: false,
          Gluten: null,
        },
        note: "Vegan.",
      },
    ],
    dinner: [
      {
        name: "Beef & Pork Tacos",
        vendor: "The Mule",
        allergens: {
          Halal: false,
          Meat: true,
          Eggs: null,
          Nuts: false,
          Pork: true,
          Beef: true,
          Gluten: false,
        },
        note: "Corn tortillas. The whole kitchen is gluten-free and nut-free. Toppings include cheese and lime crema.",
      },
      {
        name: "Bean Tacos",
        vendor: "The Mule",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
        note: "Vegan. The cheese and lime crema toppings aren't vegan.",
      },
      {
        name: "Mexican Bean Salad",
        vendor: "Summerfresh",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: false,
          Nuts: null,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
        note: "Vegan and gluten-free.",
      },
      {
        name: "Chickpea & Edamame Salad",
        vendor: "Summerfresh",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: false,
          Nuts: null,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
        note: "Vegan and gluten-free.",
      },
    ],
    "midnight snack": [
      {
        name: "Fritters",
        vendor: "The Fritter Shop",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: null,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
        note: "Made in a nut-free facility, no sesame. Not vegan.",
      },
      {
        name: "Vegan Fritters",
        vendor: "The Fritter Shop",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
        note: "Apple deluxe, blueberry, cherry, lemon and raspberry. Nut-free facility, no sesame.",
      },
      {
        name: "Gluten-Free Stroopwafels",
        vendor: "The Fritter Shop",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: null,
          Nuts: null,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
        note: "Prepackaged.",
      },
    ],
  },
  sunday: {
    breakfast: [
      {
        name: "Sesame Shaobing",
        vendor: "Daniel's Bake Bar",
        allergens: {
          Halal: true,
          Meat: true,
          Eggs: null,
          Nuts: false,
          Pork: false,
          Beef: null,
          Gluten: true,
        },
        note: "Contains sesame.",
      },
      {
        name: "Ube Brownies",
        vendor: "Daniel's Bake Bar",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: null,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
        note: "Vegetarian. Sesame-free.",
      },
      {
        name: "Black Sesame Banana Muffin",
        vendor: "Daniel's Bake Bar",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
        note: "Vegan. Contains sesame.",
      },
      {
        name: "Pandan Coconut Muffin",
        vendor: "Daniel's Bake Bar",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
        note: "Vegan and gluten-free. Sesame-free.",
      },
    ],
    lunch: [
      {
        name: "Banh Mi (Pork & Chicken)",
        vendor: "Thy's Banh Mi",
        allergens: {
          Halal: false,
          Meat: true,
          Eggs: null,
          Nuts: null,
          Pork: true,
          Beef: null,
          Gluten: true,
        },
        note: "Each sandwich is labelled with its ingredients.",
      },
      {
        name: "Halal Grilled Chicken Banh Mi",
        vendor: "Thy's Banh Mi",
        allergens: {
          Halal: true,
          Meat: true,
          Eggs: true,
          Nuts: null,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
        note: "Vietnamese mayo contains egg.",
      },
      {
        name: "Tofu Banh Mi",
        vendor: "Thy's Banh Mi",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: null,
          Nuts: null,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
        note: "Vegetarian. A vegan version with mushroom pâté is also available.",
      },
      {
        name: "Gluten-Free Grilled Chicken Banh Mi",
        vendor: "Thy's Banh Mi",
        allergens: {
          Halal: null,
          Meat: true,
          Eggs: true,
          Nuts: null,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
        note: "Vietnamese mayo contains egg.",
      },
      {
        name: "Butter Garlic Chicken Banh Mi",
        vendor: "Thy's Banh Mi",
        allergens: {
          Halal: null,
          Meat: true,
          Eggs: true,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
        note: "Sesame-free and nut-free. Vietnamese mayo contains egg.",
      },
    ],
    dinner: [],
    "midnight snack": [],
  },
};
