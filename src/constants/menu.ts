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
        name: "Jerk Chicken",
        vendor: "Rose's Tree of Life",
        allergens: {
          Halal: true,
          Meat: true,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
      },
      {
        name: "Curry Vegetables",
        vendor: "Rose's Tree of Life",
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
        name: "Rice & Peas",
        vendor: "Rose's Tree of Life",
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
    ],
    "midnight snack": [
      {
        name: "Mango Green Tea with Coconut Jelly",
        vendor: "CoCo",
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
        vendor: "CoCo",
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
    ],
  },

  saturday: {
    breakfast: [
      {
        name: "Bakery Goods",
        vendor: "Costco",
        allergens: {
          Halal: null,
          Meat: null,
          Eggs: null,
          Nuts: null,
          Pork: null,
          Beef: null,
          Gluten: null,
        },
      },
    ],
    lunch: [
      {
        name: "Chicken Alfredo Pasta",
        vendor: "Aunty's Kitchen",
        allergens: {
          Halal: true,
          Meat: true,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
      },
      {
        name: "Spinach Mushroom Alfredo Pasta",
        vendor: "Aunty's Kitchen",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
      },
    ],
    dinner: [
      {
        name: "White Rice",
        vendor: "Aunty's Kitchen",
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
        name: "Naan",
        vendor: "Aunty's Kitchen",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
      },
      {
        name: "Butter Chicken",
        vendor: "Aunty's Kitchen",
        allergens: {
          Halal: true,
          Meat: true,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
      },
      {
        name: "Chickpea Curry",
        vendor: "Aunty's Kitchen",
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
    ],
    "midnight snack": [
      {
        name: "Gluten Free Cookie",
        vendor: "Craig's Cookies",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: true,
          Nuts: "May Contain",
          Pork: false,
          Beef: false,
          Gluten: false,
        },
      },
      {
        name: "Classic Cookie",
        vendor: "Craig's Cookies",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: true,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
      },
      {
        name: "Mars",
        vendor: "Craig's Cookies",
        allergens: {
          Halal: true,
          Meat: false,
          Eggs: true,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: true,
        },
      },
      {
        name: "Brownie",
        vendor: "Craig's Cookies",
        allergens: {
          Halal: true,
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
        name: "Bakery Goods",
        vendor: "Tims",
        allergens: {
          Halal: null,
          Meat: null,
          Eggs: null,
          Nuts: null,
          Pork: null,
          Beef: null,
          Gluten: null,
        },
      },
    ],
    lunch: [
      {
        name: "Chicken Shawarma",
        vendor: "Sultan's",
        allergens: {
          Halal: true,
          Meat: true,
          Eggs: false,
          Nuts: false,
          Pork: false,
          Beef: false,
          Gluten: false,
        },
      },
      {
        name: "Falafel Shawarma",
        vendor: "Sultan's",
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
    ],
    dinner: [],
    "midnight snack": [],
  },
};
