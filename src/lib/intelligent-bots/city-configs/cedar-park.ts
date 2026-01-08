/**
 * Cedar Park, TX City Configuration
 *
 * Real roads, landmarks, and schools for hyperlocal bot posts
 */

import type { CityConfig } from "../types";

export const CEDAR_PARK_CONFIG: CityConfig = {
  name: "Cedar Park",
  state: "TX",
  coords: { lat: 30.5052, lon: -97.8203 },
  timezone: "America/Chicago",

  roads: {
    major: [
      "Cypress Creek Rd",
      "Whitestone Blvd",
      "Lakeline Blvd",
      "Parmer Ln",
      "Anderson Mill Rd",
      "New Hope Dr",
      "Buttercup Creek Blvd",
      "Quest Pkwy",
    ],
    highways: [
      "US-183",
      "183A Toll",
      "RM 1431",
      "FM 1431",
      "TX-45 Toll",
    ],
    schoolZones: [
      "Whitestone Blvd",
      "Cypress Creek Rd",
      "New Hope Dr",
      "Quest Pkwy",
    ],
  },

  landmarks: {
    shopping: [
      "1890 Ranch",
      "Lakeline Mall",
      "HEB",
      "Costco",
      "Target",
      "Best Buy",
    ],
    venues: [
      "HEB Center at Cedar Park",
      "Cedar Park Recreation Center",
      "Milburn Park",
      "Elizabeth Milburn Park",
      "Veterans Memorial Park",
    ],
    restaurants: [
      "Pluckers",
      "Trudy's",
      "Torchy's Tacos",
      "Saltgrass Steak House",
      "Black Walnut Cafe",
    ],
  },

  schools: {
    high: [
      "Cedar Park High School",
      "Vista Ridge High School",
    ],
    middle: [
      "Cedar Park Middle School",
      "Henry Middle School",
      "Deer Creek Middle School",
    ],
    elementary: [
      "Naumann Elementary",
      "Cypress Elementary",
      "Giddens Elementary",
      "Knowles Elementary",
    ],
  },

  rushHours: {
    morning: { start: 7, end: 9 },
    evening: { start: 16, end: 18 },
    schoolDismissal: 15,
  },

  altRoutes: {
    "Cypress Creek Rd": "Whitestone Blvd",
    "Whitestone Blvd": "Lakeline Blvd",
    "US-183": "183A Toll",
    "Parmer Ln": "Anderson Mill Rd",
    "FM 1431": "183A Toll",
  },

  funFacts: {
    traffic: [
      "FM 1431 was originally a farm-to-market road connecting ranches to Austin in the 1940s",
      "The 183A Toll has reduced commute times by up to 20 minutes since opening",
      "Whitestone Blvd is named after the white limestone that dominates the area",
      "Cedar Park's first traffic light was installed at US-183 and FM 1431 in 1988",
      "The TX-45 Toll extension connected Cedar Park to I-35 in 2006",
    ],
    weather: [
      "Cedar Park sits in 'Flash Flood Alley' - one of the most flood-prone regions in North America",
      "The area experiences an average of 5 severe thunderstorm warnings per year",
      "Cedar Park's elevation of 860 feet creates cooler evenings than downtown Austin",
      "The record rainfall in one day was 6.8 inches during the 2015 Memorial Day flood",
      "Cedar Park averages 90+ days over 90°F each year",
    ],
    events: [
      "HEB Center hosts over 150 events annually including Texas Stars hockey",
      "The Texas Stars have called Cedar Park home since 2009",
      "Cedar Park's July 4th celebration draws over 20,000 people to Elizabeth Milburn Park",
      "The Austin Spurs (G League) played at HEB Center from 2014-2025",
      "1890 Ranch is named after the year the original ranch was established",
    ],
    local: [
      "Cedar Park was named after a rail stop near a cedar brake in 1873",
      "The city incorporated in 1973 with just 300 residents",
      "Cedar Park grew from 5,000 to 80,000+ residents between 1990 and 2024",
      "The original Cedar Park consisted of just a post office and general store",
      "Cedar Park was voted one of America's Best Places to Live by Money Magazine",
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
