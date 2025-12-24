import { NextRequest, NextResponse } from "next/server";
import { findCity, getNearbyCities, City } from "../../data/cities";
import { generateNewsSummary, NewsArticleSummaryInput } from "@/lib/ai";
import { deduplicateArticles } from "./deduplication";
import type {
  LocalNewsArticle,
  LocalNewsResponse,
  LocalNewsSummary,
} from "@/types/news";

export type { LocalNewsArticle, LocalNewsResponse, LocalNewsSummary } from "@/types/news";

// =============================================================================
// THREE-TIER METRO FALLBACK SYSTEM
// =============================================================================
// When a small city lacks sufficient news coverage, we use a three-tier fallback:
//   Tier 1: Hard-coded metro area mappings (instant, most reliable)
//   Tier 2: Geographic proximity using getNearbyCities() (if city has coordinates)
//   Tier 3: State capital/major city as last resort
// =============================================================================

/**
 * TIER 1: Hard-coded metro area mappings
 * Maps suburban cities to their metropolitan anchor cities.
 * This is the most reliable fallback - instant lookup, no geo calculation needed.
 */
const METRO_FALLBACKS: Record<string, string[]> = {
  // Austin Metro (Texas)
  "Leander": ["Austin", "Cedar Park", "Round Rock"],
  "Cedar Park": ["Austin", "Round Rock", "Leander"],
  "Round Rock": ["Austin", "Cedar Park", "Georgetown"],
  "Pflugerville": ["Austin", "Round Rock", "Manor"],
  "Georgetown": ["Austin", "Round Rock", "Cedar Park"],
  "Kyle": ["Austin", "San Marcos", "Buda"],
  "Buda": ["Austin", "Kyle", "San Marcos"],
  "Lakeway": ["Austin", "Bee Cave", "Cedar Park"],
  "Bee Cave": ["Austin", "Lakeway", "Dripping Springs"],
  "Manor": ["Austin", "Pflugerville", "Round Rock"],
  "Hutto": ["Austin", "Round Rock", "Georgetown"],
  "Taylor": ["Austin", "Round Rock", "Georgetown"],
  "Bastrop": ["Austin", "Elgin", "Smithville"],
  "Dripping Springs": ["Austin", "Bee Cave", "Wimberley"],
  "Liberty Hill": ["Austin", "Cedar Park", "Georgetown"],

  // Dallas-Fort Worth Metro
  "Plano": ["Dallas", "Frisco", "Richardson"],
  "Frisco": ["Dallas", "Plano", "McKinney"],
  "McKinney": ["Dallas", "Frisco", "Allen"],
  "Allen": ["Dallas", "Plano", "McKinney"],
  "Irving": ["Dallas", "Fort Worth", "Arlington"],
  "Richardson": ["Dallas", "Plano", "Garland"],
  "Garland": ["Dallas", "Richardson", "Mesquite"],
  "Mesquite": ["Dallas", "Garland", "Sunnyvale"],
  "Carrollton": ["Dallas", "Addison", "Farmers Branch"],
  "Lewisville": ["Dallas", "Denton", "Flower Mound"],
  "Flower Mound": ["Dallas", "Lewisville", "Denton"],
  "Denton": ["Dallas", "Fort Worth", "Lewisville"],
  "Arlington, TX": ["Dallas", "Fort Worth", "Grand Prairie"],
  "Grand Prairie": ["Dallas", "Fort Worth", "Arlington"],
  "Grapevine": ["Dallas", "Fort Worth", "Southlake"],
  "Southlake": ["Dallas", "Fort Worth", "Grapevine"],
  "Colleyville": ["Dallas", "Fort Worth", "Grapevine"],
  "Keller": ["Fort Worth", "Dallas", "Southlake"],
  "Bedford": ["Fort Worth", "Dallas", "Arlington"],
  "Euless": ["Fort Worth", "Dallas", "Arlington"],
  "Hurst": ["Fort Worth", "Dallas", "Bedford"],
  "North Richland Hills": ["Fort Worth", "Dallas", "Hurst"],
  "Rockwall": ["Dallas", "Garland", "Rowlett"],
  "Rowlett": ["Dallas", "Garland", "Rockwall"],
  "Wylie": ["Dallas", "Plano", "Allen"],
  "Murphy": ["Dallas", "Plano", "Wylie"],
  "Sachse": ["Dallas", "Garland", "Wylie"],
  "The Colony": ["Dallas", "Plano", "Lewisville"],
  "Little Elm": ["Dallas", "Frisco", "The Colony"],
  "Prosper": ["Dallas", "Frisco", "McKinney"],
  "Celina": ["Dallas", "Frisco", "McKinney"],

  // Houston Metro
  "Sugar Land": ["Houston", "Missouri City", "Pearland"],
  "The Woodlands": ["Houston", "Conroe", "Spring"],
  "Pearland": ["Houston", "Sugar Land", "Friendswood"],
  "Katy": ["Houston", "Cypress", "Sugar Land"],
  "Cypress": ["Houston", "Katy", "Tomball"],
  "Pasadena, TX": ["Houston", "Deer Park", "La Porte"],
  "League City": ["Houston", "Clear Lake", "Friendswood"],
  "Friendswood": ["Houston", "League City", "Pearland"],
  "Missouri City": ["Houston", "Sugar Land", "Stafford"],
  "Baytown": ["Houston", "Pasadena", "La Porte"],
  "Conroe": ["Houston", "The Woodlands", "Spring"],
  "Spring": ["Houston", "The Woodlands", "Tomball"],
  "Tomball": ["Houston", "Spring", "Cypress"],
  "Humble": ["Houston", "Kingwood", "Atascocita"],
  "Kingwood": ["Houston", "Humble", "Atascocita"],
  "Atascocita": ["Houston", "Humble", "Kingwood"],
  "Richmond": ["Houston", "Sugar Land", "Rosenberg"],
  "Rosenberg": ["Houston", "Richmond", "Sugar Land"],
  "La Porte": ["Houston", "Pasadena", "Deer Park"],
  "Deer Park": ["Houston", "Pasadena", "La Porte"],
  "Galveston": ["Houston", "League City", "Texas City"],
  "Texas City": ["Houston", "Galveston", "La Marque"],

  // San Antonio Metro
  "New Braunfels": ["San Antonio", "San Marcos", "Seguin"],
  "Schertz": ["San Antonio", "New Braunfels", "Cibolo"],
  "Cibolo": ["San Antonio", "Schertz", "New Braunfels"],
  "Boerne": ["San Antonio", "Helotes", "Fair Oaks Ranch"],
  "Helotes": ["San Antonio", "Boerne", "Leon Valley"],
  "Converse": ["San Antonio", "Live Oak", "Universal City"],
  "Live Oak": ["San Antonio", "Converse", "Universal City"],
  "Universal City": ["San Antonio", "Live Oak", "Converse"],
  "Seguin": ["San Antonio", "New Braunfels", "San Marcos"],
  "Floresville": ["San Antonio", "Seguin", "Pleasanton"],

  // Phoenix Metro (Arizona)
  "Scottsdale": ["Phoenix", "Tempe", "Mesa"],
  "Tempe": ["Phoenix", "Scottsdale", "Mesa"],
  "Mesa": ["Phoenix", "Tempe", "Gilbert"],
  "Gilbert": ["Phoenix", "Mesa", "Chandler"],
  "Chandler": ["Phoenix", "Gilbert", "Tempe"],
  "Glendale, AZ": ["Phoenix", "Peoria", "Scottsdale"],
  "Peoria": ["Phoenix", "Glendale", "Surprise"],
  "Surprise": ["Phoenix", "Peoria", "Sun City"],
  "Goodyear": ["Phoenix", "Avondale", "Buckeye"],
  "Avondale": ["Phoenix", "Goodyear", "Tolleson"],
  "Buckeye": ["Phoenix", "Goodyear", "Avondale"],
  "Queen Creek": ["Phoenix", "Gilbert", "Mesa"],
  "Cave Creek": ["Phoenix", "Scottsdale", "Carefree"],
  "Fountain Hills": ["Phoenix", "Scottsdale", "Mesa"],
  "Paradise Valley": ["Phoenix", "Scottsdale", "Tempe"],
  "Apache Junction": ["Phoenix", "Mesa", "Gilbert"],

  // Denver Metro (Colorado)
  "Aurora, CO": ["Denver", "Centennial", "Lakewood"],
  "Lakewood, CO": ["Denver", "Aurora", "Golden"],
  "Thornton": ["Denver", "Westminster", "Northglenn"],
  "Arvada": ["Denver", "Westminster", "Golden"],
  "Westminster": ["Denver", "Thornton", "Arvada"],
  "Centennial": ["Denver", "Aurora", "Englewood"],
  "Highlands Ranch": ["Denver", "Centennial", "Lone Tree"],
  "Lone Tree": ["Denver", "Highlands Ranch", "Centennial"],
  "Parker": ["Denver", "Aurora", "Centennial"],
  "Castle Rock": ["Denver", "Lone Tree", "Parker"],
  "Littleton": ["Denver", "Englewood", "Centennial"],
  "Englewood": ["Denver", "Littleton", "Centennial"],
  "Golden": ["Denver", "Lakewood", "Arvada"],
  "Broomfield": ["Denver", "Boulder", "Westminster"],
  "Louisville": ["Denver", "Boulder", "Broomfield"],
  "Lafayette": ["Denver", "Boulder", "Broomfield"],
  "Erie": ["Denver", "Boulder", "Broomfield"],
  "Brighton": ["Denver", "Thornton", "Commerce City"],
  "Commerce City": ["Denver", "Thornton", "Brighton"],
  "Northglenn": ["Denver", "Thornton", "Westminster"],

  // Seattle Metro (Washington)
  "Bellevue": ["Seattle", "Redmond", "Kirkland"],
  "Redmond": ["Seattle", "Bellevue", "Kirkland"],
  "Kirkland": ["Seattle", "Bellevue", "Redmond"],
  "Kent": ["Seattle", "Renton", "Auburn"],
  "Renton": ["Seattle", "Kent", "Bellevue"],
  "Federal Way": ["Seattle", "Tacoma", "Kent"],
  "Auburn": ["Seattle", "Kent", "Federal Way"],
  "Sammamish": ["Seattle", "Bellevue", "Redmond"],
  "Issaquah": ["Seattle", "Bellevue", "Sammamish"],
  "Bothell": ["Seattle", "Kirkland", "Lynnwood"],
  "Lynnwood": ["Seattle", "Everett", "Bothell"],
  "Everett": ["Seattle", "Lynnwood", "Marysville"],
  "Marysville": ["Seattle", "Everett", "Lake Stevens"],
  "Lake Stevens": ["Seattle", "Everett", "Marysville"],
  "Shoreline": ["Seattle", "Lynnwood", "Edmonds"],
  "Edmonds": ["Seattle", "Shoreline", "Lynnwood"],
  "Burien": ["Seattle", "Renton", "SeaTac"],
  "SeaTac": ["Seattle", "Burien", "Tukwila"],
  "Tukwila": ["Seattle", "Renton", "SeaTac"],
  "Mercer Island": ["Seattle", "Bellevue", "Renton"],

  // Los Angeles Metro (California)
  "Santa Monica": ["Los Angeles", "Beverly Hills", "Culver City"],
  "Beverly Hills": ["Los Angeles", "Santa Monica", "West Hollywood"],
  "West Hollywood": ["Los Angeles", "Beverly Hills", "Hollywood"],
  "Pasadena, CA": ["Los Angeles", "Glendale", "Arcadia"],
  "Glendale, CA": ["Los Angeles", "Burbank", "Pasadena"],
  "Burbank": ["Los Angeles", "Glendale", "North Hollywood"],
  "Long Beach": ["Los Angeles", "Lakewood", "Carson"],
  "Torrance": ["Los Angeles", "Carson", "Redondo Beach"],
  "Carson": ["Los Angeles", "Torrance", "Long Beach"],
  "Downey": ["Los Angeles", "Norwalk", "South Gate"],
  "Norwalk": ["Los Angeles", "Downey", "Cerritos"],
  "Cerritos": ["Los Angeles", "Norwalk", "Lakewood"],
  "Lakewood, CA": ["Los Angeles", "Long Beach", "Cerritos"],
  "Whittier": ["Los Angeles", "La Mirada", "Pico Rivera"],
  "Fullerton": ["Los Angeles", "Anaheim", "Buena Park"],
  "Anaheim": ["Los Angeles", "Fullerton", "Orange"],
  "Irvine": ["Los Angeles", "Newport Beach", "Costa Mesa"],
  "Huntington Beach": ["Los Angeles", "Newport Beach", "Costa Mesa"],
  "Costa Mesa": ["Los Angeles", "Irvine", "Newport Beach"],
  "Newport Beach": ["Los Angeles", "Irvine", "Costa Mesa"],
  "Santa Ana": ["Los Angeles", "Anaheim", "Orange"],
  "Ontario": ["Los Angeles", "Rancho Cucamonga", "Pomona"],
  "Rancho Cucamonga": ["Los Angeles", "Ontario", "Fontana"],
  "Pomona": ["Los Angeles", "Ontario", "Claremont"],
  "Fontana": ["Los Angeles", "Rancho Cucamonga", "Rialto"],
  "San Bernardino": ["Los Angeles", "Riverside", "Fontana"],
  "Riverside": ["Los Angeles", "San Bernardino", "Corona"],
  "Corona": ["Los Angeles", "Riverside", "Norco"],

  // San Francisco Bay Area
  "Oakland": ["San Francisco", "Berkeley", "Alameda"],
  "Berkeley": ["San Francisco", "Oakland", "Albany"],
  "San Jose": ["San Francisco", "Santa Clara", "Sunnyvale"],
  "Sunnyvale": ["San Francisco", "San Jose", "Santa Clara"],
  "Santa Clara": ["San Francisco", "San Jose", "Sunnyvale"],
  "Mountain View": ["San Francisco", "Palo Alto", "Sunnyvale"],
  "Palo Alto": ["San Francisco", "Mountain View", "Menlo Park"],
  "Menlo Park": ["San Francisco", "Palo Alto", "Redwood City"],
  "Redwood City": ["San Francisco", "Menlo Park", "San Mateo"],
  "San Mateo": ["San Francisco", "Redwood City", "Foster City"],
  "Foster City": ["San Francisco", "San Mateo", "Redwood City"],
  "Daly City": ["San Francisco", "South San Francisco", "Pacifica"],
  "South San Francisco": ["San Francisco", "Daly City", "San Bruno"],
  "Fremont": ["San Francisco", "Newark", "Hayward"],
  "Hayward": ["San Francisco", "Fremont", "Castro Valley"],
  "Pleasanton": ["San Francisco", "Dublin", "Livermore"],
  "Dublin": ["San Francisco", "Pleasanton", "Livermore"],
  "Livermore": ["San Francisco", "Pleasanton", "Dublin"],
  "Walnut Creek": ["San Francisco", "Concord", "Pleasant Hill"],
  "Concord": ["San Francisco", "Walnut Creek", "Pleasant Hill"],
  "San Ramon": ["San Francisco", "Dublin", "Danville"],
  "Danville": ["San Francisco", "San Ramon", "Walnut Creek"],

  // Chicago Metro (Illinois)
  "Naperville": ["Chicago", "Aurora", "Bolingbrook"],
  "Aurora, IL": ["Chicago", "Naperville", "Oswego"],
  "Joliet": ["Chicago", "Bolingbrook", "Plainfield"],
  "Evanston": ["Chicago", "Skokie", "Wilmette"],
  "Skokie": ["Chicago", "Evanston", "Niles"],
  "Oak Park": ["Chicago", "Forest Park", "Berwyn"],
  "Schaumburg": ["Chicago", "Arlington Heights", "Hoffman Estates"],
  "Arlington Heights": ["Chicago", "Schaumburg", "Mount Prospect"],
  "Palatine": ["Chicago", "Arlington Heights", "Rolling Meadows"],
  "Elgin": ["Chicago", "Schaumburg", "South Elgin"],
  "Bolingbrook": ["Chicago", "Naperville", "Romeoville"],
  "Orland Park": ["Chicago", "Tinley Park", "Oak Lawn"],
  "Tinley Park": ["Chicago", "Orland Park", "Oak Lawn"],
  "Oak Lawn": ["Chicago", "Evergreen Park", "Orland Park"],
  "Downers Grove": ["Chicago", "Naperville", "Westmont"],
  "Lombard": ["Chicago", "Glen Ellyn", "Villa Park"],
  "Wheaton": ["Chicago", "Glen Ellyn", "Carol Stream"],
  "Glen Ellyn": ["Chicago", "Wheaton", "Lombard"],
  "Hoffman Estates": ["Chicago", "Schaumburg", "Streamwood"],
  "Streamwood": ["Chicago", "Hoffman Estates", "Bartlett"],
  "Des Plaines": ["Chicago", "Park Ridge", "Mount Prospect"],

  // Atlanta Metro (Georgia)
  "Marietta": ["Atlanta", "Smyrna", "Kennesaw"],
  "Sandy Springs": ["Atlanta", "Dunwoody", "Roswell"],
  "Roswell": ["Atlanta", "Alpharetta", "Sandy Springs"],
  "Alpharetta": ["Atlanta", "Roswell", "Johns Creek"],
  "Johns Creek": ["Atlanta", "Alpharetta", "Duluth"],
  "Duluth": ["Atlanta", "Johns Creek", "Suwanee"],
  "Suwanee": ["Atlanta", "Duluth", "Buford"],
  "Lawrenceville": ["Atlanta", "Snellville", "Duluth"],
  "Smyrna": ["Atlanta", "Marietta", "Vinings"],
  "Dunwoody": ["Atlanta", "Sandy Springs", "Brookhaven"],
  "Brookhaven": ["Atlanta", "Dunwoody", "Chamblee"],
  "Kennesaw": ["Atlanta", "Marietta", "Acworth"],
  "Acworth": ["Atlanta", "Kennesaw", "Marietta"],
  "Peachtree City": ["Atlanta", "Fayetteville", "Newnan"],
  "Newnan": ["Atlanta", "Peachtree City", "Carrollton"],
  "Decatur": ["Atlanta", "Stone Mountain", "Tucker"],
  "Tucker": ["Atlanta", "Stone Mountain", "Decatur"],
  "Stone Mountain": ["Atlanta", "Tucker", "Lilburn"],

  // Miami Metro (Florida)
  "Fort Lauderdale": ["Miami", "Hollywood", "Pompano Beach"],
  "Hollywood": ["Miami", "Fort Lauderdale", "Pembroke Pines"],
  "Pembroke Pines": ["Miami", "Miramar", "Hollywood"],
  "Miramar": ["Miami", "Pembroke Pines", "Hollywood"],
  "Hialeah": ["Miami", "Miami Lakes", "Hialeah Gardens"],
  "Miami Beach": ["Miami", "Sunny Isles Beach", "Surfside"],
  "Coral Gables": ["Miami", "South Miami", "Coconut Grove"],
  "Doral": ["Miami", "Sweetwater", "Hialeah"],
  "Boca Raton": ["Miami", "Delray Beach", "Pompano Beach"],
  "Pompano Beach": ["Miami", "Fort Lauderdale", "Deerfield Beach"],
  "Coral Springs": ["Miami", "Parkland", "Pompano Beach"],
  "Plantation": ["Miami", "Fort Lauderdale", "Sunrise"],
  "Sunrise": ["Miami", "Fort Lauderdale", "Plantation"],
  "Davie": ["Miami", "Fort Lauderdale", "Pembroke Pines"],
  "Weston": ["Miami", "Fort Lauderdale", "Pembroke Pines"],
  "Homestead": ["Miami", "Florida City", "Cutler Bay"],
  "Kendall": ["Miami", "Pinecrest", "South Miami"],
  "Aventura": ["Miami", "Sunny Isles Beach", "North Miami Beach"],

  // Boston Metro (Massachusetts)
  "Cambridge": ["Boston", "Somerville", "Arlington"],
  "Somerville": ["Boston", "Cambridge", "Medford"],
  "Brookline": ["Boston", "Newton", "Brighton"],
  "Newton": ["Boston", "Brookline", "Wellesley"],
  "Quincy": ["Boston", "Braintree", "Weymouth"],
  "Braintree": ["Boston", "Quincy", "Weymouth"],
  "Medford": ["Boston", "Somerville", "Malden"],
  "Malden": ["Boston", "Medford", "Revere"],
  "Revere": ["Boston", "Malden", "Chelsea"],
  "Chelsea": ["Boston", "Revere", "Everett"],
  "Waltham": ["Boston", "Newton", "Watertown"],
  "Watertown": ["Boston", "Waltham", "Cambridge"],
  "Arlington, MA": ["Boston", "Cambridge", "Lexington"],
  "Lexington": ["Boston", "Arlington", "Bedford"],
  "Woburn": ["Boston", "Winchester", "Burlington"],
  "Burlington": ["Boston", "Woburn", "Lexington"],
  "Framingham": ["Boston", "Natick", "Wellesley"],
  "Natick": ["Boston", "Framingham", "Wellesley"],

  // New York Metro
  "Jersey City": ["New York", "Hoboken", "Newark"],
  "Newark": ["New York", "Jersey City", "Elizabeth"],
  "Hoboken": ["New York", "Jersey City", "Weehawken"],
  "Yonkers": ["New York", "Mount Vernon", "New Rochelle"],
  "White Plains": ["New York", "Yonkers", "New Rochelle"],
  "New Rochelle": ["New York", "Yonkers", "White Plains"],
  "Stamford": ["New York", "Greenwich", "Norwalk"],
  "Greenwich": ["New York", "Stamford", "White Plains"],
  "Bridgeport": ["New York", "Stamford", "New Haven"],
  "Long Island City": ["New York", "Astoria", "Brooklyn"],
  "Staten Island": ["New York", "Brooklyn", "Jersey City"],
  "Brooklyn": ["New York", "Queens", "Staten Island"],
  "Queens": ["New York", "Brooklyn", "Long Island City"],
  "Bronx": ["New York", "Yonkers", "Mount Vernon"],
  "Paterson": ["New York", "Newark", "Passaic"],
  "Elizabeth": ["New York", "Newark", "Linden"],
};

/**
 * TIER 3: State capital/major city fallbacks
 * When tier 1 and tier 2 fail, fall back to the state's largest city or capital.
 */
const STATE_CAPITALS: Record<string, string[]> = {
  "TX": ["Austin", "Houston", "Dallas"],
  "CA": ["Sacramento", "Los Angeles", "San Francisco"],
  "NY": ["Albany", "New York", "Buffalo"],
  "FL": ["Tallahassee", "Miami", "Orlando"],
  "IL": ["Springfield", "Chicago"],
  "PA": ["Harrisburg", "Philadelphia", "Pittsburgh"],
  "OH": ["Columbus", "Cleveland", "Cincinnati"],
  "GA": ["Atlanta", "Savannah"],
  "NC": ["Raleigh", "Charlotte", "Durham"],
  "MI": ["Lansing", "Detroit", "Grand Rapids"],
  "AZ": ["Phoenix", "Tucson"],
  "WA": ["Olympia", "Seattle", "Spokane"],
  "CO": ["Denver", "Colorado Springs"],
  "MA": ["Boston", "Worcester"],
  "TN": ["Nashville", "Memphis", "Knoxville"],
  "IN": ["Indianapolis", "Fort Wayne"],
  "MO": ["Jefferson City", "Kansas City", "St. Louis"],
  "MD": ["Annapolis", "Baltimore"],
  "WI": ["Madison", "Milwaukee"],
  "MN": ["St. Paul", "Minneapolis"],
  "SC": ["Columbia", "Charleston"],
  "AL": ["Montgomery", "Birmingham"],
  "LA": ["Baton Rouge", "New Orleans"],
  "KY": ["Frankfort", "Louisville", "Lexington"],
  "OR": ["Salem", "Portland"],
  "OK": ["Oklahoma City", "Tulsa"],
  "CT": ["Hartford", "New Haven", "Bridgeport"],
  "UT": ["Salt Lake City"],
  "IA": ["Des Moines", "Cedar Rapids"],
  "NV": ["Carson City", "Las Vegas", "Reno"],
  "AR": ["Little Rock"],
  "MS": ["Jackson"],
  "KS": ["Topeka", "Wichita", "Kansas City"],
  "NM": ["Santa Fe", "Albuquerque"],
  "NE": ["Lincoln", "Omaha"],
  "ID": ["Boise"],
  "HI": ["Honolulu"],
  "NH": ["Concord", "Manchester"],
  "ME": ["Augusta", "Portland"],
  "RI": ["Providence"],
  "MT": ["Helena", "Billings"],
  "DE": ["Dover", "Wilmington"],
  "SD": ["Pierre", "Sioux Falls"],
  "ND": ["Bismarck", "Fargo"],
  "AK": ["Juneau", "Anchorage"],
  "VT": ["Montpelier", "Burlington"],
  "WY": ["Cheyenne"],
  "WV": ["Charleston", "Huntington"],
  "VA": ["Richmond", "Virginia Beach", "Norfolk"],
  "NJ": ["Trenton", "Newark", "Jersey City"],
};

// GNews API (primary)
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;

// NewsAPI (fallback)
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// API endpoints
const GNEWS_API_URL = "https://gnews.io/api/v4/search";
const NEWS_API_EVERYTHING_URL = "https://newsapi.org/v2/everything";

// Article scaling + fallback tuning
const MINIMUM_ARTICLES = 3;
const IDEAL_ARTICLES = 6;
const MAX_ARTICLES = 8;
const FALLBACK_RADIUS_MILES = 100;
const FALLBACK_MIN_POPULATION = 50000;

// Filter out only severe negative content
const NEGATIVE_KEYWORDS = [
  "murder",
  "killed in",
  "fatal shooting",
  "mass shooting",
  "terrorism",
];

// Filter out non-local sports news
const NON_LOCAL_SPORTS_KEYWORDS = [
  "penn state",
  "ohio state",
  "michigan state",
  "florida state",
  "ncaa tournament",
  "ncaa women",
  "ncaa men",
  "bowl game",
  "march madness",
  "final four",
  "college football playoff",
];

// Local community topics to prioritize
const LOCAL_TOPIC_KEYWORDS = [
  "city council",
  "school district",
  "local business",
  "downtown",
  "traffic",
  "road closure",
  "construction",
  "weather",
  "festival",
  "community",
  "neighborhood",
  "residents",
  "mayor",
  "election",
  "development",
  "new restaurant",
  "opening",
  "library",
  "park",
  "local",
  "area",
  "district",
];

type RawNewsArticle = {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
};

// GNews API article format
type GNewsArticle = {
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  image: string | null;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
};

function toLocalNewsArticle(
  article: RawNewsArticle,
  fallbackSource?: string
): LocalNewsArticle {
  return {
    title: article.title,
    source: article.source.name,
    publishedAt: article.publishedAt,
    url: article.url,
    description: article.description,
    urlToImage: article.urlToImage,
    _fallbackSource: fallbackSource,
  };
}

function isGeographicallyRelevant(
  article: RawNewsArticle,
  cityName: string,
  state?: string
): boolean {
  const text = `${article.title} ${article.description || ""}`.toLowerCase();
  const cityLower = cityName.toLowerCase();
  const stateLower = state?.toLowerCase();
  const sourceName = article.source.name.toLowerCase();

  // Must mention the city somewhere
  if (!text.includes(cityLower)) {
    return false;
  }

  // If we have a state, articles mentioning both city and state are highly relevant
  if (stateLower && text.includes(stateLower)) {
    return true;
  }

  // Check for state abbreviation (e.g., "TX", "CA")
  const stateAbbreviations: Record<string, string> = {
    tx: "texas", ca: "california", ny: "new york", fl: "florida",
    il: "illinois", pa: "pennsylvania", oh: "ohio", ga: "georgia",
    nc: "north carolina", mi: "michigan", nj: "new jersey", va: "virginia",
    wa: "washington", az: "arizona", ma: "massachusetts", tn: "tennessee",
    in: "indiana", mo: "missouri", md: "maryland", wi: "wisconsin",
    co: "colorado", mn: "minnesota", sc: "south carolina", al: "alabama",
    la: "louisiana", ky: "kentucky", or: "oregon", ok: "oklahoma",
    ct: "connecticut", ut: "utah", ia: "iowa", nv: "nevada",
    ar: "arkansas", ms: "mississippi", ks: "kansas", nm: "new mexico",
  };

  if (stateLower && stateAbbreviations[stateLower]) {
    // Check for patterns like "Austin, TX" or "Austin TX" or "Austin, Texas"
    const statePattern = new RegExp(`${cityLower}[,\\s]+${stateLower}\\b`, 'i');
    if (statePattern.test(text)) {
      return true;
    }
  }

  // Check for local news source names
  const localSourcePatterns = [
    cityLower,
    stateLower || "",
    "local",
    "chronicle",
    "tribune",
    "times",
    "journal",
    "post",
    "news",
    "observer",
  ].filter(Boolean);

  const hasLocalSource = localSourcePatterns.some((pattern) =>
    sourceName.includes(pattern as string)
  );

  if (hasLocalSource && text.includes(cityLower)) {
    return true;
  }

  // For cities with common names (Austin, Portland, etc.), be more lenient
  // Accept if article mentions the city and doesn't mention other major cities prominently
  const otherMajorCities = [
    "new york city",
    "los angeles",
    "chicago",
    "houston",
    "phoenix",
    "philadelphia",
    "san antonio",
    "san diego",
    "san jose",
    "san francisco",
    "seattle",
    "boston",
    "miami",
    "atlanta",
    "denver",
    "las vegas",
    "detroit",
    "nashville",
    "baltimore",
    "washington dc",
    "washington d.c.",
  ].filter((city) => !city.includes(cityLower));

  // Only filter if ANOTHER major city is prominently mentioned in the title
  const titleLower = article.title.toLowerCase();
  const mentionsOtherCityInTitle = otherMajorCities.some((city) =>
    titleLower.includes(city)
  );

  if (mentionsOtherCityInTitle) {
    return false;
  }

  // Accept if the article mentions the city - the API query already filters by city
  return true;
}

function scoreArticle(
  article: RawNewsArticle,
  cityName: string,
  state?: string
): {
  score: number;
  isValid: boolean;
} {
  const text = `${article.title} ${article.description || ""}`.toLowerCase();
  const cityLower = cityName.toLowerCase();
  const stateLower = state?.toLowerCase();

  // Check geographic relevance first
  if (!isGeographicallyRelevant(article, cityName, state)) {
    return { score: 0, isValid: false };
  }

  // Filter out severe negative content
  const isPositive = !NEGATIVE_KEYWORDS.some((keyword) =>
    text.includes(keyword)
  );

  // Filter out non-local sports
  const isNonLocalSports = NON_LOCAL_SPORTS_KEYWORDS.some((keyword) =>
    text.includes(keyword)
  );

  if (!isPositive || isNonLocalSports) {
    return { score: 0, isValid: false };
  }

  // Calculate score
  let score = 5; // Base score

  // Bonus for city + state mention
  if (stateLower && text.includes(cityLower) && text.includes(stateLower)) {
    score += 15;
  }

  // Bonus for local topic keywords
  const localTopicCount = LOCAL_TOPIC_KEYWORDS.filter((keyword) =>
    text.includes(keyword)
  ).length;
  score += localTopicCount * 3;

  // Bonus for local news sources
  if (article.source.name.toLowerCase().includes(cityLower)) {
    score += 10;
  }

  return {
    score,
    isValid: true,
  };
}

// Map state abbreviations to full names for better search
const STATE_FULL_NAMES: Record<string, string> = {
  tx: "Texas", ca: "California", ny: "New York", fl: "Florida",
  il: "Illinois", pa: "Pennsylvania", oh: "Ohio", ga: "Georgia",
  nc: "North Carolina", mi: "Michigan", nj: "New Jersey", va: "Virginia",
  wa: "Washington", az: "Arizona", ma: "Massachusetts", tn: "Tennessee",
  in: "Indiana", mo: "Missouri", md: "Maryland", wi: "Wisconsin",
  co: "Colorado", mn: "Minnesota", sc: "South Carolina", al: "Alabama",
  la: "Louisiana", ky: "Kentucky", or: "Oregon", ok: "Oklahoma",
  ct: "Connecticut", ut: "Utah", ia: "Iowa", nv: "Nevada",
  ar: "Arkansas", ms: "Mississippi", ks: "Kansas", nm: "New Mexico",
};

/**
 * Parsed result from a comma-separated city string
 */
export type ParsedCityString = {
  cityName: string;
  region?: string;
  country?: string;
};

/**
 * Parse a comma-separated city string into its components.
 * Handles formats like:
 *   - "Austin, TX, US" -> { cityName: "Austin", region: "TX", country: "US" }
 *   - "Austin, Texas, US" -> { cityName: "Austin", region: "Texas", country: "US" }
 *   - "Austin, TX" -> { cityName: "Austin", region: "TX" }
 *   - "Austin" -> { cityName: "Austin" }
 */
export function parseCityString(cityString: string): ParsedCityString {
  const parts = cityString.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length === 0) {
    return { cityName: cityString.trim() || "" };
  }

  if (parts.length === 1) {
    return { cityName: parts[0] };
  }

  if (parts.length === 2) {
    return { cityName: parts[0], region: parts[1] };
  }

  // 3+ parts: first is city, second is region, third is country
  return {
    cityName: parts[0],
    region: parts[1],
    country: parts[2],
  };
}

// Map full state names to abbreviations (reverse of STATE_FULL_NAMES)
const STATE_ABBREVS: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_FULL_NAMES).map(([abbrev, full]) => [full.toLowerCase(), abbrev.toUpperCase()])
);

// In-memory cache for news results
const newsCache = new Map<string, { data: RawNewsArticle[]; provider: "gnews" | "newsapi" | null; timestamp: number }>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch news from GNews API (primary)
 */
async function fetchFromGNewsAPI(
  cityName: string,
  state?: string
): Promise<RawNewsArticle[]> {
  if (!GNEWS_API_KEY) {
    return [];
  }

  // Build search query - city name with state for better locality
  let query = cityName;
  if (state) {
    const stateLower = state.toLowerCase();
    const stateFull = STATE_FULL_NAMES[stateLower] || state;
    query = `${cityName} ${stateFull}`;
  }

  const params = new URLSearchParams({
    q: query,
    token: GNEWS_API_KEY,
    lang: "en",
    country: "us",
    max: "10",
    sortby: "publishedAt",
  });

  try {
    const response = await fetch(`${GNEWS_API_URL}?${params}`, {
      headers: {
        "User-Agent": "CommunityPulse/1.0",
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("GNews API error:", response.status, errorData);
      return [];
    }

    const data = await response.json();

    // Transform GNews API response to our format
    const articles: RawNewsArticle[] = (data.articles || [])
      .filter(
        (article: GNewsArticle) =>
          article.title &&
          article.title !== "[Removed]" &&
          article.description
      )
      .map((article: GNewsArticle) => ({
        title: article.title,
        description: article.description,
        url: article.url,
        urlToImage: article.image,
        publishedAt: article.publishedAt,
        source: { name: article.source?.name || "Unknown" },
      }));

    // Filter, score, and sort articles
    const validArticles = articles
      .map((article: RawNewsArticle) => ({
        article,
        ...scoreArticle(article, cityName, state),
      }))
      .filter((item: { isValid: boolean }) => item.isValid)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .map((item: { article: RawNewsArticle }) => item.article);

    return validArticles;
  } catch (error) {
    console.error("Error fetching from GNews API:", error);
    return [];
  }
}

/**
 * Fetch news from NewsAPI (fallback)
 */
async function fetchFromNewsAPI(
  cityName: string,
  state?: string
): Promise<RawNewsArticle[]> {
  if (!NEWS_API_KEY) {
    return [];
  }

  // Build search query - use city name with OR for state variations
  let stateFull: string | undefined;
  let stateAbbrev: string | undefined;

  if (state) {
    const stateLower = state.toLowerCase();
    if (STATE_FULL_NAMES[stateLower]) {
      stateFull = STATE_FULL_NAMES[stateLower];
      stateAbbrev = state.toUpperCase();
    } else if (STATE_ABBREVS[stateLower]) {
      stateAbbrev = STATE_ABBREVS[stateLower];
      stateFull = state;
    } else {
      stateFull = state;
      stateAbbrev = state;
    }
  }

  let searchQuery = `"${cityName}"`;
  if (stateFull && stateAbbrev) {
    searchQuery = `"${cityName}" AND (${stateFull} OR ${stateAbbrev})`;
  } else if (stateFull) {
    searchQuery = `"${cityName}" AND ${stateFull}`;
  }

  const params = new URLSearchParams({
    q: searchQuery,
    apiKey: NEWS_API_KEY,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "100",
  });

  try {
    const response = await fetch(`${NEWS_API_EVERYTHING_URL}?${params}`, {
      headers: {
        "User-Agent": "CommunityPulse/1.0",
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("NewsAPI error:", response.status, errorData);
      return [];
    }

    const data = await response.json();

    // Filter, score, and sort articles
    const validArticles = (data.articles || [])
      .filter(
        (article: RawNewsArticle) =>
          article.title &&
          article.title !== "[Removed]" &&
          article.description &&
          article.description !== "[Removed]"
      )
      .map((article: RawNewsArticle) => ({
        article,
        ...scoreArticle(article, cityName, state),
      }))
      .filter((item: { isValid: boolean }) => item.isValid)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .map((item: { article: RawNewsArticle }) => item.article);

    return validArticles;
  } catch (error) {
    console.error("Error fetching from NewsAPI:", error);
    return [];
  }
}

/**
 * Fetch news using available API (prefers GNews, falls back to NewsAPI)
 */
async function fetchNewsForCity(
  cityName: string,
  state?: string
): Promise<{ articles: RawNewsArticle[]; provider: "gnews" | "newsapi" | null }> {
  // Check cache first
  const cacheKey = `${cityName}-${state || ""}`.toLowerCase();
  const cached = newsCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return { articles: cached.data, provider: cached.provider };
  }

  // Try GNews API first (primary)
  if (GNEWS_API_KEY) {
    const articles = await fetchFromGNewsAPI(cityName, state);
    if (articles.length > 0) {
      newsCache.set(cacheKey, { data: articles, provider: "gnews", timestamp: Date.now() });
      return { articles, provider: "gnews" };
    }
  }

  // Fall back to NewsAPI
  if (NEWS_API_KEY) {
    const articles = await fetchFromNewsAPI(cityName, state);
    if (articles.length > 0) {
      newsCache.set(cacheKey, { data: articles, provider: "newsapi", timestamp: Date.now() });
      return { articles, provider: "newsapi" };
    }
  }

  return { articles: [], provider: null };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cityParam = searchParams.get("city");

  if (!cityParam) {
    return NextResponse.json(
      { error: "City parameter is required" },
      { status: 400 }
    );
  }

  // Check if any news API is configured
  if (!NEWS_API_KEY && !GNEWS_API_KEY) {
    const response: LocalNewsResponse = {
      articles: [],
      aiSummary: null,
      city: cityParam,
      sourceCity: cityParam,
      fallbackSources: [],
      isNearbyFallback: false,
      fetchedAt: new Date().toISOString(),
      notConfigured: true,
    };
    return NextResponse.json(response);
  }

  // Parse the city string to extract components
  const parsed = parseCityString(cityParam);

  // Try to find the city in our database
  const city = findCity(parsed.cityName) || findCity(cityParam);

  // Use city database values if found, otherwise fall back to parsed values
  const cityName = city?.name || parsed.cityName;
  const state = city?.state || parsed.region;

  // Fetch news
  const primary = await fetchNewsForCity(cityName, state);
  let provider = primary.provider;
  let articles: LocalNewsArticle[] = primary.articles.map((a) => toLocalNewsArticle(a));
  const sourceCity = city?.displayName || cityParam;
  const fallbackSources: string[] = [];
  const existingUrls = new Set(articles.map((a) => a.url));

  // =============================================================================
  // THREE-TIER FALLBACK SYSTEM
  // =============================================================================
  // When primary city has insufficient articles, we use a three-tier fallback:
  //   Tier 1: Hard-coded metro area mappings (instant, most reliable)
  //   Tier 2: Geographic proximity using getNearbyCities() (if city has coordinates)
  //   Tier 3: State capital/major city as last resort
  // =============================================================================

  if (articles.length < IDEAL_ARTICLES) {
    console.log(`[NEWS FALLBACK] ${cityName} has only ${articles.length} articles, need ${IDEAL_ARTICLES}. Starting fallback...`);

    // -------------------------------------------------------------------------
    // TIER 1: Hard-coded metro area mappings (instant, most reliable)
    // -------------------------------------------------------------------------
    // Try multiple key formats: "Leander", "Leander, TX", city?.displayName
    const lookupKeys = [
      cityName,
      state ? `${cityName}, ${state.toUpperCase()}` : null,
      city?.displayName,
    ].filter(Boolean) as string[];

    let metroCities: string[] | undefined;
    for (const key of lookupKeys) {
      if (METRO_FALLBACKS[key]) {
        metroCities = METRO_FALLBACKS[key];
        console.log(`[NEWS FALLBACK] Tier 1: Found metro mapping using key "${key}"`);
        break;
      }
    }

    if (metroCities && metroCities.length > 0 && articles.length < IDEAL_ARTICLES) {
      console.log(`[NEWS FALLBACK] Tier 1: Found metro mapping for ${cityName}: ${metroCities.join(", ")}`);

      for (const metroCity of metroCities) {
        if (articles.length >= IDEAL_ARTICLES) break;

        // Find the metro city in the database to get its state
        const metroCityData = findCity(metroCity);
        const metroState = metroCityData?.state || state;

        console.log(`[NEWS FALLBACK] Tier 1: Fetching news from ${metroCity}, ${metroState}...`);
        const metroResult = await fetchNewsForCity(metroCity, metroState);

        if (!provider && metroResult.provider) {
          provider = metroResult.provider;
        }

        const newArticles = metroResult.articles
          .filter((a) => !existingUrls.has(a.url))
          .map((a) => toLocalNewsArticle(a, metroCityData?.displayName || `${metroCity}, ${metroState}`));

        if (newArticles.length > 0) {
          console.log(`[NEWS FALLBACK] Tier 1: Found ${newArticles.length} new articles from ${metroCity}`);
          for (const a of newArticles) existingUrls.add(a.url);
          articles = [...articles, ...newArticles];
          fallbackSources.push(metroCityData?.displayName || `${metroCity}, ${metroState}`);
        }
      }

      if (articles.length >= IDEAL_ARTICLES) {
        console.log(`[NEWS FALLBACK] Tier 1 SUCCESS: Now have ${articles.length} articles`);
      }
    }

    // -------------------------------------------------------------------------
    // TIER 2: Geographic proximity using getNearbyCities()
    // -------------------------------------------------------------------------
    if (articles.length < IDEAL_ARTICLES && city && city.lat && city.lng) {
      console.log(`[NEWS FALLBACK] Tier 2: Using geographic proximity for ${cityName}...`);

      const nearbyCities = getNearbyCities(
        cityParam,
        FALLBACK_RADIUS_MILES,
        FALLBACK_MIN_POPULATION
      );

      if (nearbyCities.length > 0) {
        console.log(`[NEWS FALLBACK] Tier 2: Found ${nearbyCities.length} nearby cities: ${nearbyCities.map(c => c.name).join(", ")}`);

        for (const nearbyCity of nearbyCities) {
          if (articles.length >= IDEAL_ARTICLES) break;

          // Skip if we already fetched from this city in Tier 1
          if (metroCities?.includes(nearbyCity.name)) {
            console.log(`[NEWS FALLBACK] Tier 2: Skipping ${nearbyCity.name} (already fetched in Tier 1)`);
            continue;
          }

          console.log(`[NEWS FALLBACK] Tier 2: Fetching news from ${nearbyCity.displayName}...`);
          const nearby = await fetchNewsForCity(nearbyCity.name, nearbyCity.state);

          if (!provider && nearby.provider) {
            provider = nearby.provider;
          }

          const newArticles = nearby.articles
            .filter((a) => !existingUrls.has(a.url))
            .map((a) => toLocalNewsArticle(a, nearbyCity.displayName));

          if (newArticles.length > 0) {
            console.log(`[NEWS FALLBACK] Tier 2: Found ${newArticles.length} new articles from ${nearbyCity.displayName}`);
            for (const a of newArticles) existingUrls.add(a.url);
            articles = [...articles, ...newArticles];
            fallbackSources.push(nearbyCity.displayName);
          }
        }

        if (articles.length >= IDEAL_ARTICLES) {
          console.log(`[NEWS FALLBACK] Tier 2 SUCCESS: Now have ${articles.length} articles`);
        }
      } else {
        console.log(`[NEWS FALLBACK] Tier 2: No nearby cities found within ${FALLBACK_RADIUS_MILES} miles with population >= ${FALLBACK_MIN_POPULATION}`);
      }
    } else if (articles.length < IDEAL_ARTICLES && city && (!city.lat || !city.lng)) {
      console.log(`[NEWS FALLBACK] Tier 2 SKIPPED: ${cityName} lacks coordinates in database`);
    }

    // -------------------------------------------------------------------------
    // TIER 3: State capital/major city as last resort
    // -------------------------------------------------------------------------
    if (articles.length < IDEAL_ARTICLES && state) {
      const stateUpper = state.toUpperCase();
      const stateMajorCities = STATE_CAPITALS[stateUpper];

      if (stateMajorCities && stateMajorCities.length > 0) {
        console.log(`[NEWS FALLBACK] Tier 3: Falling back to state major cities for ${stateUpper}: ${stateMajorCities.join(", ")}`);

        for (const majorCity of stateMajorCities) {
          if (articles.length >= IDEAL_ARTICLES) break;

          // Skip if we already fetched from this city
          if (metroCities?.includes(majorCity)) {
            console.log(`[NEWS FALLBACK] Tier 3: Skipping ${majorCity} (already fetched in Tier 1)`);
            continue;
          }

          // Find the major city to get its full display name
          const majorCityData = findCity(majorCity);

          console.log(`[NEWS FALLBACK] Tier 3: Fetching news from ${majorCity}, ${stateUpper}...`);
          const majorResult = await fetchNewsForCity(majorCity, stateUpper);

          if (!provider && majorResult.provider) {
            provider = majorResult.provider;
          }

          const newArticles = majorResult.articles
            .filter((a) => !existingUrls.has(a.url))
            .map((a) => toLocalNewsArticle(a, majorCityData?.displayName || `${majorCity}, ${stateUpper}`));

          if (newArticles.length > 0) {
            console.log(`[NEWS FALLBACK] Tier 3: Found ${newArticles.length} new articles from ${majorCity}`);
            for (const a of newArticles) existingUrls.add(a.url);
            articles = [...articles, ...newArticles];
            fallbackSources.push(majorCityData?.displayName || `${majorCity}, ${stateUpper}`);
          }
        }

        if (articles.length >= IDEAL_ARTICLES) {
          console.log(`[NEWS FALLBACK] Tier 3 SUCCESS: Now have ${articles.length} articles`);
        }
      } else {
        console.log(`[NEWS FALLBACK] Tier 3 SKIPPED: No major cities defined for state ${stateUpper}`);
      }
    }

    // Final logging
    if (articles.length >= IDEAL_ARTICLES) {
      console.log(`[NEWS FALLBACK] COMPLETE: ${cityName} now has ${articles.length} articles from ${fallbackSources.length} fallback source(s)`);
    } else {
      console.log(`[NEWS FALLBACK] INCOMPLETE: ${cityName} has only ${articles.length} articles after all fallback tiers`);
    }
  }

  // Deduplicate articles BEFORE slicing to final count
  // This removes duplicate AP wire stories that appear from multiple sources
  const dedupeResult = deduplicateArticles(articles, false);
  articles = dedupeResult.articles;
  const duplicatesRemoved = dedupeResult.duplicatesRemoved;
  if (duplicatesRemoved > 0) {
    console.log("[NEWS] Removed " + duplicatesRemoved + " duplicate article(s) for " + cityParam);
  }

  // Limit to MAX articles
  articles = articles.slice(0, MAX_ARTICLES);

  // Generate AI summary if we have articles
  let aiSummary: LocalNewsSummary | null = null;
  if (articles.length > 0) {
    try {
      const summaryInput: NewsArticleSummaryInput[] = articles.map((a) => ({
        title: a.title,
        description: a.description,
        source: a.source,
        publishedAt: a.publishedAt,
      }));
      aiSummary = await generateNewsSummary(cityName, summaryInput);
    } catch (error) {
      console.error("Error generating AI summary:", error);
    }
  }

  const response: LocalNewsResponse = {
    articles,
    aiSummary,
    city: city?.displayName || cityParam,
    sourceCity,
    fallbackSources: Array.from(new Set(fallbackSources)),
    isNearbyFallback: fallbackSources.length > 0 && articles.length > 0,
    fetchedAt: new Date().toISOString(),
    provider: provider || undefined,
    _duplicatesRemoved: duplicatesRemoved > 0 ? duplicatesRemoved : undefined,
  };

  return NextResponse.json(response);
}
