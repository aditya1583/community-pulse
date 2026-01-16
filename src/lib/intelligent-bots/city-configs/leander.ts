/**
 * Leander, TX City Configuration
 *
 * Real roads, landmarks, and schools for hyperlocal bot posts
 */

import type { CityConfig } from "../types";

export const LEANDER_CONFIG: CityConfig = {
  name: "Leander",
  state: "TX",
  coords: { lat: 30.5788, lon: -97.8531 },
  timezone: "America/Chicago",

  roads: {
    // STRICT 10-MILE RADIUS: Only roads actually in/through Leander
    major: [
      "Ronald Reagan Blvd",   // Main N-S artery through Leander
      "Crystal Falls Pkwy",   // East-west through north Leander
      "Bagdad Rd",            // Historic road through central Leander
      "San Gabriel Pkwy",     // Northern Leander connector
      "Old FM 2243",          // East-west through Leander
      "Hero Way",             // Central Leander near HEB
      "Mel Mathis Blvd",      // School zone area
      "Sonny Dr",             // Near Gateway at Leander
      // REMOVED: Lakeline Blvd (12.7mi - Austin), Parmer Ln (11mi - Austin), RM 620 (Cedar Park/Austin)
    ],
    highways: [
      "US-183",       // Runs through Leander
      "183A Toll",    // Toll road parallel to 183
      "TX-29",        // East-west highway north of Leander
      "RM 2243",      // Connects to Liberty Hill
    ],
    schoolZones: [
      "Horizon Park Dr",
      "Hero Way",
      "Mel Mathis Blvd",
      "Bagdad Rd",
      "Crystal Falls Pkwy",
      "San Gabriel Pkwy",
    ],
  },

  landmarks: {
    shopping: [
      "HEB Plus",
      "Gateway at Leander",
      "Lowe's",
      "Home Depot",
      "Target",
      "Walmart",
      "Costco",
    ],
    venues: [
      // VERIFIED LOCAL PARKS (within 10mi of Leander city center)
      "Robin Bledsoe Park",        // 2300 Bagdad Rd, Leander - 2mi
      "Devine Lake Park",          // 800 Crystal Falls Pkwy, Leander - 3mi
      "Cap Metro Rail Station",    // 800 N US-183, Leander - 1mi
      "Leander Public Library",    // 1011 S Bagdad Rd, Leander - 2mi
      "Pat Bryson Municipal Hall", // 201 N Brushy St, Leander - 1mi
      "Mason Creek Park",          // Off Crystal Falls Pkwy - 3mi
      "Benbrook Ranch Park",       // 2900 Mel Mathis Blvd, Leander - 4mi
      // NOTE: Old Settlers Park is in Round Rock (~15mi away) - NOT included
    ],
    restaurants: [
      "Torchy's Tacos",
      "Chick-fil-A",
      "Whataburger",
      "In-N-Out",
      "Dahlia Cafe",      // Local Leander spot
      "Black Walnut Cafe",
      "Pluckers Wing Bar",
    ],
  },

  schools: {
    high: [
      "Leander High School",
      "Rouse High School",
      "Glenn High School",
      "Vista Ridge High School",
    ],
    middle: [
      "Leander Middle School",
      "Running Brushy Middle School",
      "Wiley Middle School",
      "Canyon Ridge Middle School",
    ],
    elementary: [
      "Bagdad Elementary",
      "Block House Creek Elementary",
      "Whitestone Elementary",
      "Naumann Elementary",
      "Pleasant Hill Elementary",
    ],
  },

  rushHours: {
    morning: { start: 7, end: 9 },
    evening: { start: 16, end: 18 },
    schoolDismissal: 15, // 3 PM
  },

  altRoutes: {
    "Ronald Reagan Blvd": "183A Toll",
    "US-183": "183A Toll",
    "Crystal Falls Pkwy": "Bagdad Rd",
    "Bagdad Rd": "San Gabriel Pkwy",
    "Hero Way": "Crystal Falls Pkwy",
    "Old FM 2243": "Crystal Falls Pkwy",
    "Mel Mathis Blvd": "Hero Way",
  },

  funFacts: {
    traffic: [
      "US-183 follows part of the historic Chisholm Trail cattle drive route",
      "The 183A Toll Road was the first toll road in Williamson County, opening in 2007",
      "Ronald Reagan Blvd was originally called County Road 175",
      "Crystal Falls Pkwy is named after the waterfall in Crystal Falls subdivision",
      "Hero Way was named to honor military veterans and first responders",
    ],
    weather: [
      "Leander averages 228 sunny days per year - more than Miami",
      "The record high in Leander was 112°F in August 2023",
      "Williamson County averages just 33 inches of rain annually",
      "Leander sits at 981 feet elevation - one of the highest points in the Austin metro",
      "The Hill Country creates its own microclimate with sudden temperature swings",
    ],
    events: [
      "The Cap Metro Rail Red Line opened in 2010, connecting Leander to downtown Austin",
      "Leander's July 4th celebration is one of the largest in Williamson County",
      "Divine Nine Park was the city's first dedicated disc golf course",
      "The Leander Public Library opened in 1983 with just 3,000 books",
      "Robin Bledsoe Park hosts community events and has excellent sports fields",
    ],
    local: [
      "Leander was named after railroad official Leander 'Catfish' Brown in 1882",
      "The city's population exploded from 7,600 in 2000 to over 75,000 today",
      "Leander ISD is one of the fastest-growing school districts in Texas",
      "The original Leander townsite was platted by the Austin & Northwestern Railroad",
      "Bagdad Road is named after the historic Bagdad community founded in the 1850s",
    ],
    cuisine: {
      tacos: [
        "Austin area consumes more breakfast tacos per capita than anywhere in the US",
        "The breakfast taco originated in Austin in the 1970s at Cisco's Restaurant",
        "Texans eat an estimated 2.5 million breakfast tacos per week",
      ],
      bbq: [
        "Central Texas BBQ uses post-oak wood and serves meat without sauce",
        "The 'BBQ belt' runs through Williamson County from Taylor to Lockhart",
        "Texas Monthly calls the Austin area 'the BBQ capital of the world'",
      ],
      coffee: [
        "Texas is home to the oldest continuously operating coffeehouse west of the Mississippi",
        "Austin has more coffee shops per capita than Seattle",
        "The first Starbucks in Williamson County opened in Cedar Park in 1998",
      ],
      pizza: [
        "Austin's first pizzeria, Conan's Pizza, opened in 1976",
        "Texas ranks #4 in pizza consumption per capita in the US",
        "The 'Austin-style' pizza trend features local ingredients like brisket toppings",
      ],
      burgers: [
        "Texas consumes more beef per capita than any other state",
        "The hamburger may have originated in Athens, Texas in the 1880s",
        "Austin was named America's Best Burger City by TripAdvisor in 2022",
      ],
      general: [
        "Austin is America's #1 city for food trucks per capita",
        "The Tex-Mex cuisine style originated in South Texas in the 1940s",
        "Texas has more cattle than any other state - 13 million head",
        "Whataburger was founded in Corpus Christi in 1950",
        "HEB started in Kerrville in 1905 as a small family grocery store",
      ],
    },
  },
};
