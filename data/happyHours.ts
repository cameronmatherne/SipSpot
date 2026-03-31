export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export type TimeWindow = {
  days: Weekday[];
  start: string; // 24h format, e.g. "16:00"
  end: string; // 24h format, e.g. "18:30"
  items: string[];
};

export type DailyDeal = {
  day: Weekday;
  items: string[];
};

export type Spot = {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  dailyDeals: DailyDeal[];
  happyHours: TimeWindow[];
};

export const SPOTS: Spot[] = [
  {
    id: "petes",
    name: "Petes",
    location: {
      latitude: 30.2672,
      longitude: -97.7431,
    },
    dailyDeals: [
      {
        day: "Sun",
        items: [
          "$2 off appetizers",
          "BOGO 16oz & 22oz draft or 12 oz bottle",
          "$2 off select cocktails",
          "BOGO seltzers",
          "BOGO Frozen 76, Frozen Jim Beam Cold Fashioned",
        ],
      },
      {
        day: "Mon",
        items: ["BOGO Pete's margaritas", "$5 Lil Pete's burgers"],
      },
      {
        day: "Tue",
        items: ["$2 off espresso martinis", "$2 off Big Pete's burgers"],
      },
      {
        day: "Wed",
        items: ["$5 off wine", "$5 off RC ranch wagyu burgers"],
      },
      {
        day: "Thu",
        items: ["12 wings for the price of 6", "BOGO Yuengling"],
      },
      {
        day: "Fri",
        items: [
          "BOGO seltzers",
          "BOGO Frozen 76, Frozen Jim Beam Cold Fashioned",
        ],
      },
      {
        day: "Sat",
        items: [
          "BOGO seltzers",
          "BOGO Frozen 76, Frozen Jim Beam Cold Fashioned",
        ],
      },
    ],
    happyHours: [
      {
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        start: "11:00",
        end: "18:00",
        items: [
          "$2 off apps",
          "$2 off craft cocktails",
          "BOGO 16oz & 22oz draft or 12 oz bottle",
        ],
      },
    ],
  },
  {
    id: "tap-room",
    name: "Tap Room",
    location: {
      latitude: 30.2691,
      longitude: -97.7412,
    },
    dailyDeals: [
      {
        day: "Sun",
        items: ["$5 Bloody Marys", "$5 mimosas", "$10 domestic buckets"],
      },
      {
        day: "Mon",
        items: ["Half off Tito's", "Half off boneless wings", "Half off flatbreads"],
      },
      {
        day: "Wed",
        items: ["Half off food and drinks for ladies"],
      },
      {
        day: "Thu",
        items: ["$5 Jack & Crown"],
      },
      {
        day: "Fri",
        items: ["$5 bomb shots from 10 PM-close"],
      },
      {
        day: "Sat",
        items: ["$5 bomb shots from 10 PM-close"],
      },
    ],
    happyHours: [],
  },
  {
    id: "burgersmith",
    name: "Burgersmith",
    location: {
      latitude: 30.2656,
      longitude: -97.7386,
    },
    dailyDeals: [
      {
        day: "Sun",
        items: [
          "$10 bottomless mimosas",
          "$4 JT Meleck Bloody Mary's and screwdrivers",
        ],
      },
    ],
    happyHours: [
      {
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        start: "16:00",
        end: "18:00",
        items: [
          "1/2 price beer, wine, cocktails",
          "$3 hot dogs",
          "$2 side fries",
        ],
      },
    ],
  },
  {
    id: "bjs-brewhouse",
    name: "BJ's Brewhouse",
    location: {
      latitude: 30.2638,
      longitude: -97.7464,
    },
    dailyDeals: [
      {
        day: "Mon",
        items: [
          "$19.99 large pizzas or $14.99 tavern-cut pizza",
          "$6 BJ's Brewhouse margaritas",
        ],
      },
      {
        day: "Tue",
        items: ["$5 pizookies", "Half off wine"],
      },
      {
        day: "Wed",
        items: [
          "$12.99 loaded burger with unlimited fries",
          "$5 BJ's signature beers",
        ],
      },
      {
        day: "Thu",
        items: ["$19.99 slow roasted entree with dessert", "$6 call drinks"],
      },
    ],
    happyHours: [
      {
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        start: "15:00",
        end: "18:00",
        items: [
          "$4 domestic bottles",
          "$4 chips and dip",
          "$5 BJ's beers",
          "$5 dark horse wines",
          "$6 Brewhouse margarita",
          "$6 call drinks",
          "$7 select appetizers",
          "$7 personal deep dish pizza",
        ],
      },
    ],
  },

   {
    id: "mezcal",
    name: "Mezcal Mexican Restaurant",
    location: {
      latitude: 30.2638,
      longitude: -97.7464,
    },
    dailyDeals: [
      {
        day: "Mon",
        items: [
          "ACP (happy plate) for $13.99"
        ],
      },
      {
        day: "Tue",
        items: ["15 tacos for $22.99"],
      },
      {
        day: "Wed",
        items: [
          "Fajitas (steak, chicken, or mix) for $13.99",
        ],
      },
      {
        day: "Thu",
        items: ["Fajitas (steak, chicken, or mix) for $13.99"],
      },
      {
        day: "Fri",
        items: ["Chimichanga (beef or chicken) for $13.99"],
      },
      {
        day: "Sat",
        items: ["Students with school ID get 15% off "],
      },
      {
        day: "Sun",
        items: ["Show hurch bulletin for 15% off "],
      },
    ],
    happyHours: [],
  },
  {
    id: "mercy-kitchen",
    name: "Mercy Kitchen",
    location: {
      latitude: 30.2703,
      longitude: -97.7459,
    },
    dailyDeals: [],
    happyHours: [
      {
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        start: "14:00",
        end: "18:00",
        items: [
          "Select cocktails $8",
          "Select discounted draft",
          "$6 house wine",
          "Select discounted appetizers",
        ],
      },
    ],
  },
  {
    id: "chuys",
    name: "Chuy's",
    location: {
      latitude: 30.2622,
      longitude: -97.7417,
    },
    dailyDeals: [],
    happyHours: [
      {
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        start: "15:00",
        end: "18:00",
        items: ["Margarita specials", "$5 chips and dip"],
      },
    ],
  },
  {
    id: "agave",
    name: "Agave",
    location: {
      latitude: 30.2714,
      longitude: -97.7402,
    },
    dailyDeals: [],
    happyHours: [
      {
        days: ["Sun", "Mon", "Tue", "Wed", "Thu"],
        start: "14:00",
        end: "18:00",
        items: ["2 for 1 house margarita", "1/2 off draft beer"],
      },
    ],
  },
  {
    id: "bonefish-grill",
    name: "Bonefish Grill",
    location: {
      latitude: 30.2665,
      longitude: -97.7472,
    },
    dailyDeals: [],
    happyHours: [
      {
        days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        start: "15:00",
        end: "18:30",
        items: ["$7 / $9 appetizers", "$7 cocktails"],
      },
    ],
  },
];
