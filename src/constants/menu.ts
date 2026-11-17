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

export const allMeals: AllMealData = {
  friday: {
    breakfast: [],
    lunch: [],
    dinner: [
      {
        // UNVERIFIED allergens: guessed (fried-rice style bowl; soy sauce)
        name: "Rice Bowls",
        vendor: "Mr. & Mrs. Bao",
        allergens: {
          Halal: null,
          Meat: true,
          Eggs: true,
          Nuts: false,
          Pork: true,
          Beef: false,
          Gluten: true,
        },
      },
    ],
    "midnight snack": [
      {
        // UNVERIFIED allergens: guessed
        name: "Mango Green Tea with Coconut Jelly",
        vendor: "Chatime",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
      },
      {
        // UNVERIFIED allergens: guessed
        name: "Pearl Milk Tea",
        vendor: "Chatime",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: false,
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
        // UNVERIFIED allergens: guessed (eggs, bacon/sausage, toast)
        name: "Breakfast Platter",
        vendor: "Black Walnut",
        allergens: {
          Halal: null,
          Meat: true,
          Eggs: true,
          Nuts: "May Contain",
          Pork: true,
          Beef: false,
          Gluten: true,
        },
      },
    ],
    lunch: [
      {
        // UNVERIFIED allergens: guessed (Summerfresh salads often have nuts/seeds)
        name: "Salad",
        vendor: "Summerfresh",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: false,
          Nuts: "May Contain",
          Pork: false,
          Beef: false,
          Gluten: false,
        },
      },
      {
        // UNVERIFIED allergens: guessed
        name: "Hot Dog Bar",
        vendor: "Frank & Furter's",
        allergens: {
          Halal: null,
          Meat: true,
          Eggs: false,
          Nuts: false,
          Pork: true,
          Beef: true,
          Gluten: true,
        },
      },
    ],
    dinner: [
      {
        // UNVERIFIED allergens: guessed (corn tortillas)
        name: "Tacos",
        vendor: "The Mule",
        allergens: {
          Halal: null,
          Meat: true,
          Eggs: false,
          Nuts: false,
          Pork: true,
          Beef: true,
          Gluten: false,
        },
      },
    ],
    "midnight snack": [
      {
        // UNVERIFIED allergens: guessed; dish name also guessed
        name: "Fritters",
        vendor: "The Fritter Shop",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: true,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
      },
    ],
  },

  sunday: {
    breakfast: [
      {
        // UNVERIFIED allergens: guessed
        name: "Baked Goods",
        vendor: "Daniel's Baked Goods",
        allergens: {
          Halal: null,
          Meat: false,
          Eggs: true,
          Nuts: "May Contain",
          Pork: false,
          Beef: false,
          Gluten: true,
        },
      },
    ],
    lunch: [
      {
        // UNVERIFIED allergens: guessed (pork, mayo, baguette)
        name: "Banh Mi",
        vendor: "Thy's",
        allergens: {
          Halal: null,
          Meat: true,
          Eggs: true,
          Nuts: false,
          Pork: true,
          Beef: false,
          Gluten: true,
        },
      },
    ],
    dinner: [],
    "midnight snack": [],
  },
};
