/**
 * Austin, TX City Configuration
 *
 * Real roads, landmarks, and schools for hyperlocal bot posts
 */

import type { CityConfig } from "../types";

export const AUSTIN_CONFIG: CityConfig = {
  name: "Austin",
  state: "TX",
  coords: { lat: 30.2672, lon: -97.7431 },
  timezone: "America/Chicago",

  roads: {
    major: [
      "Congress Ave",
      "Lamar Blvd",
      "Guadalupe St",
      "Burnet Rd",
      "South 1st St",
      "East Riverside Dr",
      "Manor Rd",
      "MLK Blvd",
      "Cesar Chavez St",
      "6th Street",
    ],
    highways: [
      "I-35",
      "MoPac (Loop 1)",
      "US-183",
      "US-290",
      "TX-71",
      "TX-45 Toll",
      "TX-130 Toll",
    ],
    schoolZones: [
      "Lamar Blvd",
      "Burnet Rd",
      "Manor Rd",
      "South Congress",
    ],
  },

  landmarks: {
    shopping: [
      "The Domain",
      "Barton Creek Mall",
      "Mueller",
      "South Congress",
      "2nd Street District",
    ],
    venues: [
      "Zilker Park",
      "Lady Bird Lake",
      "ACL Live at Moody Theater",
      "Frank Erwin Center",
      "Darrell K Royal Stadium",
      "The Long Center",
      "Q2 Stadium",
      "Circuit of the Americas",
    ],
    restaurants: [
      "Franklin BBQ",
      "Torchy's Tacos",
      "Chuy's",
      "Home Slice Pizza",
      "Matt's El Rancho",
      "Uchi",
    ],
  },

  schools: {
    high: [
      "Austin High School",
      "McCallum High School",
      "Reagan High School",
      "LBJ High School",
      "Anderson High School",
    ],
    middle: [
      "O'Henry Middle School",
      "Lamar Middle School",
      "Kealing Middle School",
    ],
    elementary: [
      "Zilker Elementary",
      "Becker Elementary",
      "Mathews Elementary",
    ],
  },

  rushHours: {
    morning: { start: 7, end: 9 },
    evening: { start: 16, end: 19 }, // Austin evening rush is longer
    schoolDismissal: 15,
  },

  altRoutes: {
    "I-35": "MoPac (Loop 1)",
    "MoPac (Loop 1)": "Lamar Blvd",
    "Congress Ave": "Lamar Blvd",
    "Lamar Blvd": "South 1st St",
    "US-183": "TX-130 Toll",
    "US-290": "TX-71",
    "6th Street": "Cesar Chavez St",
  },

  funFacts: {
    traffic: [
      "I-35 through Austin is the most congested highway in Texas",
      "MoPac was named after the Missouri Pacific Railroad that ran along its route",
      "The Congress Avenue Bridge is home to 1.5 million Mexican free-tailed bats",
      "Austin's first traffic light was installed at Congress and 6th Street in 1929",
      "The city adds 150+ new residents per day, contributing to traffic growth",
      "Cesar Chavez St was renamed from 1st Street in 1993",
    ],
    weather: [
      "Austin averages 300 days of sunshine per year",
      "The city sits at the edge of 'Flash Flood Alley' - the most flood-prone region in North America",
      "Austin's record high was 112°F in September 2000 and August 2023",
      "The 2021 Winter Storm Uri brought 6 inches of snow - only the 4th time since 1900",
      "Austin experiences an average of 41 days over 100°F each year",
      "Lady Bird Lake rarely freezes - it last fully froze in 1949",
    ],
    events: [
      "SXSW started in 1987 with just 700 attendees - now draws 400,000+",
      "ACL Festival began in 2002 and expanded to two weekends in 2013",
      "Austin City Limits is the longest-running music show in American TV history",
      "The bats under Congress Ave Bridge attract 100,000 tourists annually",
      "Circuit of the Americas has hosted F1 since 2012",
      "Q2 Stadium opened in 2021 as Austin FC's first home",
    ],
    local: [
      "Austin's 'Keep Austin Weird' slogan started in 2000 to support local businesses",
      "The city was named after Stephen F. Austin, the 'Father of Texas'",
      "Austin has been the state capital since 1839",
      "UT Austin's tower turns orange after Longhorn victories",
      "Austin is known as the 'Live Music Capital of the World' with 250+ venues",
      "The city's population grew from 656k in 2000 to over 1 million today",
      "Barton Springs maintains a constant 68°F year-round",
    ],
    cuisine: {
      tacos: [
        "Austin claims to have invented the breakfast taco at Cisco's in the 1970s",
        "The city has over 1,500 restaurants serving tacos",
        "Austin's breakfast taco rivalry with San Antonio is legendary",
        "Torchy's Tacos started as a food trailer on South 1st in 2006",
      ],
      bbq: [
        "Franklin BBQ has been called 'the best BBQ in America' by Bon Appétit",
        "People regularly wait 3+ hours for Franklin's brisket",
        "Austin's BBQ style uses post-oak wood and no sauce",
        "The city has over 100 BBQ joints - more per capita than anywhere",
        "Aaron Franklin's 'Low and Slow' technique takes 12-14 hours per brisket",
      ],
      coffee: [
        "Austin has more coffee shops per capita than Seattle",
        "The city's first specialty coffee shop, Quack's, opened in 1988",
        "Austin's coffee scene employs over 2,000 baristas",
        "Cold brew originated in Austin's summer heat out of necessity",
      ],
      pizza: [
        "Home Slice on South Congress is consistently rated Austin's best pizza",
        "Via 313 Detroit-style pizza started in a trailer in 2011",
        "Austin consumes 3x more pizza during SXSW than a normal week",
        "The city has over 200 pizzerias",
      ],
      burgers: [
        "Austin was named America's Best Burger City by TripAdvisor",
        "Hopdoddy Burger Bar started in Austin in 2010",
        "Casino El Camino's buffalo burger is a 6th Street legend",
        "P. Terry's is Austin's beloved homegrown burger chain since 2005",
      ],
      general: [
        "Austin is America's #1 city for food trucks per capita",
        "The South Congress food trailer scene sparked a national movement",
        "Austin has over 3,500 restaurants - one for every 300 residents",
        "Queso was popularized in Austin in the 1970s at Tex-Mex joints",
        "The city's restaurant industry employs 65,000+ people",
        "Austin hosts the Austin Food & Wine Festival every April",
      ],
    },
  },
};
