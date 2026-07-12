export const POI_CATEGORY_GROUPS = [
  {
    id: "food_drink",
    label: "Food & Drink",
    categories: [
      {
        id: "restaurant",
        label: "Restaurants",
        googleTypes: ["restaurant"],
        tomtomQueries: ["restaurant"],
      },
      {
        id: "breakfast",
        label: "Breakfast",
        googleTypes: ["breakfast_restaurant"],
        tomtomQueries: ["breakfast", "caf\u00e9"],
      },
      {
        id: "fast_food",
        label: "Fast Food",
        googleTypes: ["fast_food_restaurant"],
        tomtomQueries: ["fast food"],
      },
      {
        id: "pizza",
        label: "Pizza",
        googleTypes: ["pizza_restaurant"],
        tomtomQueries: ["pizza"],
      },
      {
        id: "italian",
        label: "Italian",
        googleTypes: ["italian_restaurant"],
        tomtomQueries: ["italian"],
      },
      {
        id: "chinese",
        label: "Chinese",
        googleTypes: ["chinese_restaurant"],
        tomtomQueries: ["chinese"],
      },
      {
        id: "sushi",
        label: "Sushi",
        googleTypes: ["sushi_restaurant"],
        tomtomQueries: ["sushi"],
      },
      {
        id: "mexican",
        label: "Mexican",
        googleTypes: ["mexican_restaurant"],
        tomtomQueries: ["mexican"],
      },
      {
        id: "thai",
        label: "Thai",
        googleTypes: ["thai_restaurant"],
        tomtomQueries: ["thai"],
      },
      {
        id: "indian",
        label: "Indian",
        googleTypes: ["indian_restaurant"],
        tomtomQueries: ["indian"],
      },
      {
        id: "seafood",
        label: "Seafood",
        googleTypes: ["seafood_restaurant"],
        tomtomQueries: ["seafood"],
      },
      {
        id: "steakhouse",
        label: "Steakhouse",
        googleTypes: ["steak_house"],
        tomtomQueries: ["steak house"],
      },
      {
        id: "vegan_vegetarian",
        label: "Vegan / Vegetarian",
        googleTypes: ["vegan_restaurant", "vegetarian_restaurant"],
        tomtomQueries: ["vegetarian", "organic"],
      },
    ],
  },
  {
    id: "coffee_treats",
    label: "Coffee & Treats",
    categories: [
      {
        id: "cafe",
        label: "Cafes",
        googleTypes: ["cafe"],
        tomtomQueries: ["caf\u00e9", "cafe"],
      },
      {
        id: "coffee",
        label: "Coffee",
        googleTypes: ["coffee_shop"],
        tomtomQueries: ["coffee shop"],
      },
      {
        id: "bakery",
        label: "Bakery",
        googleTypes: ["bakery"],
        tomtomQueries: ["food drinks: bakers"],
      },
      {
        id: "donuts",
        label: "Donuts",
        googleTypes: ["donut_shop"],
        tomtomQueries: ["doughnuts"],
      },
      {
        id: "ice_cream",
        label: "Ice Cream",
        googleTypes: ["ice_cream_shop"],
        tomtomQueries: ["ice cream parlor"],
      },
    ],
  },
  {
    id: "outdoors",
    label: "Outdoors",
    categories: [
      {
        id: "park",
        label: "Parks",
        googleTypes: ["park"],
        tomtomQueries: ["park"],
      },
      {
        id: "beach",
        label: "Beaches",
        googleTypes: ["beach"],
        tomtomQueries: ["beach", "beaches"],
      },
      {
        id: "hiking",
        label: "Hiking",
        googleTypes: ["hiking_area"],
        tomtomQueries: ["hiking", "trail system"],
      },
      {
        id: "scenic",
        label: "Scenic Lookouts",
        googleTypes: ["scenic_spot", "observation_deck"],
        tomtomQueries: ["scenic/panoramic view", "observation point"],
      },
      {
        id: "campground",
        label: "Campgrounds",
        googleTypes: ["campground"],
        tomtomQueries: ["camping ground"],
      },
    ],
  },
  {
    id: "attractions",
    label: "Attractions",
    categories: [
      {
        id: "tourist_attraction",
        label: "Tourist Attractions",
        googleTypes: ["tourist_attraction"],
        tomtomQueries: ["tourist attraction", "important tourist attraction"],
      },
      {
        id: "museum",
        label: "Museums",
        googleTypes: ["museum"],
        tomtomQueries: ["museum"],
      },
      {
        id: "historic",
        label: "Historic Sites",
        googleTypes: ["historical_place", "historical_landmark"],
        tomtomQueries: ["historic site", "historical site"],
      },
      {
        id: "winery",
        label: "Wineries",
        googleTypes: ["winery"],
        tomtomQueries: ["winery"],
      },
      {
        id: "zoo",
        label: "Zoos",
        googleTypes: ["zoo"],
        tomtomQueries: ["zoo"],
      },
      {
        id: "amusement",
        label: "Amusement Parks",
        googleTypes: ["amusement_park"],
        tomtomQueries: ["amusement park"],
      },
    ],
  },
  {
    id: "travel_essentials",
    label: "Travel Essentials",
    categories: [
      {
        id: "gas_station",
        label: "Gas Stations",
        googleTypes: ["gas_station"],
        tomtomQueries: ["petrol station", "gas station"],
      },
      {
        id: "ev_charging",
        label: "EV Charging",
        googleTypes: ["electric_vehicle_charging_station"],
        tomtomQueries: ["electric vehicle station"],
      },
      {
        id: "grocery",
        label: "Grocery Stores",
        googleTypes: ["grocery_store", "supermarket"],
        tomtomQueries: ["food drinks: grocers", "supermarkets hypermarkets"],
      },
      {
        id: "rest_stop",
        label: "Rest Stops",
        googleTypes: ["rest_stop"],
        tomtomQueries: ["rest area", "rest stop"],
      },
      {
        id: "parking",
        label: "Parking",
        googleTypes: ["parking", "parking_lot"],
        tomtomQueries: ["parking lot", "open parking area"],
      },
    ],
  },
];

const LEGACY_CATEGORY_ALIASES = {
  restaurants: "restaurant",
  food: "restaurant",
  coffee_shop: "coffee",
  attraction: "tourist_attraction",
  attractions: "tourist_attraction",
  parks: "park",
  museums: "museum",
  gas: "gas_station",
  gas_stations: "gas_station",
  "gas station": "gas_station",
  fuel: "gas_station",
};

const LEGACY_CATEGORY_LABELS = {
  bar: "Bar",
  bars: "Bars",
  lodging: "Lodging",
  hotel: "Hotel",
  hotels: "Hotels",
  motel: "Motel",
  motels: "Motels",
};

function normalizeCategoryId(id) {
  return String(id || "").trim().toLowerCase();
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function findPoiCategoryByProviderValue(providerField, providerValue) {
  const normalizedProviderValue = normalizeCategoryId(providerValue);

  if (!normalizedProviderValue) {
    return null;
  }

  return getAllPoiCategories().find((category) => {
    return (category[providerField] || []).some((value) => {
      return normalizeCategoryId(value) === normalizedProviderValue;
    });
  });
}

export function getAllPoiCategories() {
  return POI_CATEGORY_GROUPS.flatMap((group) => group.categories);
}

export function getPoiCategoryById(id) {
  const canonicalId = getCanonicalPoiCategoryId(id);

  return getAllPoiCategories().find((category) => category.id === canonicalId);
}

export function getPoiCategoryIdForGoogleType(googleType) {
  return findPoiCategoryByProviderValue("googleTypes", googleType)?.id || null;
}

export function getPoiCategoryIdForTomTomQuery(tomtomQuery) {
  return (
    findPoiCategoryByProviderValue("tomtomQueries", tomtomQuery)?.id || null
  );
}

export function getCanonicalPoiCategoryId(categoryId) {
  const normalizedId = normalizeCategoryId(categoryId);

  if (!normalizedId) {
    return "other";
  }

  const canonicalId = LEGACY_CATEGORY_ALIASES[normalizedId] || normalizedId;
  const categoryExists = getAllPoiCategories().some((category) => {
    return category.id === canonicalId;
  });

  return categoryExists ? canonicalId : normalizedId;
}

export function getCanonicalPoiCategoryIds(categoryIds = []) {
  if (!Array.isArray(categoryIds)) {
    return [];
  }

  return uniqueValues(categoryIds.map(getCanonicalPoiCategoryId));
}

export function getGoogleTypesForPoiCategoryIds(categoryIds = []) {
  if (!Array.isArray(categoryIds)) {
    return [];
  }

  return uniqueValues(
    categoryIds.flatMap((categoryId) => {
      return getPoiCategoryById(categoryId)?.googleTypes || [];
    }),
  );
}

export function getTomTomQueriesForPoiCategoryIds(categoryIds = []) {
  if (!Array.isArray(categoryIds)) {
    return [];
  }

  return uniqueValues(
    categoryIds.flatMap((categoryId) => {
      return getPoiCategoryById(categoryId)?.tomtomQueries || [];
    }),
  );
}

export function getPoiCategoryLabelById(id) {
  const normalizedId = normalizeCategoryId(id);
  const category = getPoiCategoryById(normalizedId);

  if (category?.label) {
    return category.label;
  }

  if (LEGACY_CATEGORY_LABELS[normalizedId]) {
    return LEGACY_CATEGORY_LABELS[normalizedId];
  }

  return String(id || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
