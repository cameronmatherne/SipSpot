import type { Spot } from "./spots";

export const MANUAL_SPOTS_ADDED_AT = "2026-03-31T00:00:00.000Z";

export const MANUAL_SPOTS: Spot[] = [
  {
    id: "manual-market-eatz",
    name: "Market Eatz",
    location: {
      latitude: 30.1406647,
      longitude: -92.0727909,
    },
    address: {
      houseNumber: "819",
      street: "E Broussard Rd",
      city: "Lafayette",
      state: "LA",
      postalCode: "70508",
    },
    phone: null,
    website: "https://marketeatzlouisiana.com/",
    openingHours: null,
    amenity: "restaurant",
    cuisine: null,
    source: {
      provider: "manual",
      fetchedAt: MANUAL_SPOTS_ADDED_AT,
      note: "Added manually (missing from OSM export); coordinates via address geocode.",
    },
    dailyDeals: [],
    happyHours: [],
  },
  {
    id: "manual-legends-downtown",
    name: "Legends Downtown",
    location: {
      latitude: 30.2263686,
      longitude: -92.0175118,
    },
    address: {
      houseNumber: "413",
      street: "Jefferson St",
      city: "Lafayette",
      state: "LA",
      postalCode: "70501",
    },
    phone: null,
    website: "https://legendsoflafayette.com/downtown",
    openingHours: null,
    amenity: "bar",
    cuisine: null,
    source: {
      provider: "manual",
      fetchedAt: MANUAL_SPOTS_ADDED_AT,
      note: "Added manually (missing from OSM export); coordinates via address geocode.",
    },
    dailyDeals: [],
    happyHours: [],
  },
  {
    id: "manual-minami-sushi-bar",
    name: "Minami Sushi Bar",
    location: {
      latitude: 30.2251932,
      longitude: -92.0186783,
    },
    address: {
      houseNumber: "533",
      street: "Jefferson St",
      city: "Lafayette",
      state: "LA",
      postalCode: "70501",
    },
    phone: null,
    website: null,
    openingHours: null,
    amenity: "restaurant",
    cuisine: "sushi",
    source: {
      provider: "manual",
      fetchedAt: MANUAL_SPOTS_ADDED_AT,
      note: "Added manually (missing from OSM export); coordinates via address geocode.",
    },
    dailyDeals: [],
    happyHours: [],
  },
];

