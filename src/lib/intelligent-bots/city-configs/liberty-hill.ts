/**
 * Liberty Hill, TX City Configuration
 *
 * Liberty Hill is ~8 miles north of Leander, part of the Austin metro area.
 * Population ~5,000 but rapidly growing due to proximity to 183A Toll.
 */

import type { CityConfig } from "../types";

export const LIBERTY_HILL_CONFIG: CityConfig = {
  name: "Liberty Hill",
  state: "TX",
  coords: { lat: 30.6649, lon: -97.9225 },
  timezone: "America/Chicago",

  roads: {
    major: [
      "Main Street",
      "Loop 332",
      "CR 200",
      "CR 201",
      "CR 214",
      "Dairy Rd",
      "Gabriel Mills Dr",
    ],
    highways: [
      "US-183",
      "TX-29",
      "183A Toll", // Just south in Leander
      "RM 1869",
    ],
    schoolZones: [
      "Main Street",
      "School St",
      "CR 200",
    ],
  },

  landmarks: {
    shopping: [
      "HEB Liberty Hill",
      "Dollar General",
      "Liberty Hill Town Center",
      "Valero",
    ],
    venues: [
      // VERIFIED LOCAL (within 10mi of Liberty Hill center)
      "Liberty Hill City Park",         // Main St, Liberty Hill - 0.5mi
      "Stiles Farm at Santa Rita Ranch", // Gabriel Mills Dr - 3mi
      "Santa Rita Ranch Amenity Center", // Santa Rita community - 4mi
      "Liberty Hill High School Stadium", // School sports venue - 1mi
      "Liberty Hill Public Library",     // Main St - 0.5mi
    ],
    restaurants: [
      "Dahlia Cafe",           // Popular local spot
      "Liberty Hill Bistro",
      "Stumpy's Lakeside Grill",
      "Double Dave's Pizzaworks",
      "Whataburger",
      "Sonic Drive-In",
    ],
  },

  schools: {
    high: [
      "Liberty Hill High School",
    ],
    middle: [
      "Liberty Hill Middle School",
      "Liberty Hill Junior High",
    ],
    elementary: [
      "Santa Rita Elementary",
      "Rancho Sienna Elementary",
      "Liberty Hill Elementary",
      "Burden Elementary",
    ],
  },

  rushHours: {
    morning: { start: 7, end: 9 },
    evening: { start: 16, end: 18 },
    schoolDismissal: 15,
  },

  altRoutes: {
    "US-183": "CR 200 through town",
    "TX-29": "Main Street to Loop 332",
    "183A Toll": "US-183 through Leander",
  },

  funFacts: {
    traffic: [
      "Liberty Hill was once a stagecoach stop on the Austin-to-Burnet route.",
      "The town name comes from Liberty Hill, the highest point in the area.",
      "TX-29 through Liberty Hill is part of the original Georgetown-to-Burnet highway.",
    ],
    weather: [
      "Liberty Hill sits in the Texas Hill Country transition zone.",
      "The area averages 33 inches of rain per year, mostly in spring.",
      "Flash floods are common along Gabriel Creek during heavy rain.",
    ],
    events: [
      "The Liberty Hill Festival has been an annual tradition since 1975.",
      "Santa Rita Ranch hosts community events throughout the year.",
      "Liberty Hill High School football games pack the stadium on Friday nights.",
    ],
    local: [
      "Liberty Hill is one of the fastest-growing cities in Texas.",
      "The population has tripled since 2010 due to Austin metro expansion.",
      "Many residents commute to Austin via 183A Toll through Leander.",
    ],
    cuisine: {
      tacos: ["Breakfast tacos are a morning staple at local gas stations."],
      bbq: ["Texas BBQ trucks often set up at local events."],
      coffee: ["Dahlia Cafe is the local go-to for coffee."],
      pizza: ["Double Dave's serves the local pizza crowd."],
      burgers: ["Stumpy's has been serving burgers since the 1990s."],
      general: ["Farm-to-table is growing as local farms expand."],
    },
  },
};
