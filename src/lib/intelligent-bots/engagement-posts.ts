/**
 * Engagement Posts - Data-Grounded Community Engagement
 *
 * Generates dynamic, contextual posts designed to spark conversations.
 * All types are backed by real data or are clearly hypothetical/opinion-based.
 *
 * KEPT (data-grounded): weather_alert, route_pulse, this_or_that, prediction,
 * school_alert, farmers_market, confession_booth, neighbor_challenge,
 * would_you_rather, civic_alert, poll, recommendation
 */

import type { CityConfig, SituationContext, PostType, GeneratedPost, PredictionMetadata, PredictionCategory, PredictionDataSource, LandmarkEntry, ForecastDay } from "./types";
import { getLandmarkName, getLandmarkDisplay } from "./types";
import { getRandomLandmark, getNearestLandmark, getRandomRoad } from "./city-configs";
import { DATA_GROUNDED_ENGAGEMENT_TYPES, addDataAttribution, getPostDataSources } from "./data-grounding";

// ============================================================================
// ENGAGEMENT POST TYPES
// ============================================================================

export type EngagementType =
  | "poll"
  | "recommendation"
  | "school_alert"
  | "this_or_that"
  | "neighbor_challenge"
  | "would_you_rather"
  | "confession_booth"
  | "farmers_market"
  | "prediction"
  | "civic_alert"
  | "weather_alert"
  | "route_pulse";

export interface PostActionData {
  type: "navigate_tab" | "directions" | "website" | "traffic_check";
  target: string;
  label: string;
  venue?: {
    name: string;
    address: string;
    lat?: number;
    lon?: number;
    website?: string;
  };
}

export interface EngagementPost extends Omit<GeneratedPost, "tag"> {
  tag: PostType | "General";
  engagementType: EngagementType;
  options?: string[];
  action?: PostActionData;
  prediction?: PredictionMetadata;
}

// ============================================================================
// TEMPLATE DATA
// ============================================================================

const POLL_CONTEXTS = {
  food: [
    { topic: "tacos", emoji: "🌮", variants: ["breakfast tacos", "street tacos", "fish tacos"] },
    { topic: "coffee", emoji: "☕", variants: ["coffee shop", "espresso", "cold brew spot"] },
    { topic: "bbq", emoji: "🍖", variants: ["BBQ joint", "brisket", "smoked ribs"] },
    { topic: "pizza", emoji: "🍕", variants: ["pizza place", "NY style pizza", "wood-fired pizza"] },
    { topic: "burgers", emoji: "🍔", variants: ["burger spot", "smash burger", "loaded burger"] },
    { topic: "brunch", emoji: "🥞", variants: ["brunch spot", "weekend brunch", "mimosas"] },
    { topic: "happy hour", emoji: "🍻", variants: ["happy hour deals", "after-work drinks", "patio drinks"] },
    { topic: "date night", emoji: "💑", variants: ["date night restaurant", "romantic dinner", "special occasion"] },
  ],
  activities: [
    { topic: "hiking", emoji: "🥾", variants: ["hiking trail", "nature walk", "outdoor spot"] },
    { topic: "parks", emoji: "🌳", variants: ["park", "playground", "green space"] },
    { topic: "family fun", emoji: "👨‍👩‍👧‍👦", variants: ["family activity", "kids entertainment", "family outing"] },
    { topic: "live music", emoji: "🎸", variants: ["live music venue", "local band", "open mic"] },
  ],
  services: [
    { topic: "haircut", emoji: "💇", variants: ["barber", "hair stylist", "salon"] },
    { topic: "mechanic", emoji: "🔧", variants: ["auto mechanic", "car repair", "oil change"] },
    { topic: "vet", emoji: "🐕", variants: ["vet", "pet groomer", "dog park"] },
  ],
};

const SCHOOL_ALERT_TEMPLATES = [
  "🏫 Heads up! {school} letting out in ~15 min. {road} about to get spicy 🌶️",
  "🚸 School's almost out at {school}! {road} traffic incoming in 15...",
  "⏰ PSA: {school} dismissal soon. If you're on {road}, prepare yourself mentally.",
  "📚 3PM vibes: {school} parents assembling. {road} will need patience.",
  "🎒 The daily {school} exodus approaches. {road} veterans know the drill.",
  "⚠️ T-minus 15 min until {school} pickup chaos. {road} escapees, go now!",
  "🚗 {school} dismissal alert! {road} about to become a parking lot. Plan accordingly.",
  "🏃 Beat the {school} rush! Leave now or embrace the {road} crawl.",
];

const RECOMMENDATION_TEMPLATES = [
  "🤔 Looking for recommendations: {query}",
  "👋 Hey neighbors! Anyone got a go-to for {query}?",
  "💡 Need local knowledge: {query}",
  "🗣️ Crowdsourcing: Where do y'all go for {query}?",
  "📍 New to the area... best spot for {query}?",
  "🙋 Quick question: Your favorite place for {query}?",
  "🔍 On the hunt for {query}. What's your pick?",
  "💭 Been craving {query}. Where should I go?",
];

// ============================================================================
// THIS OR THAT - Contextual Polls
// ============================================================================

type PollChoice = {
  a: string;
  b: string;
  category: string;
  seasons?: ("spring" | "summer" | "fall" | "winter")[];
  weather?: ("hot" | "cold" | "rain" | "nice")[];
  timeOfDay?: ("morning" | "afternoon" | "evening" | "night")[];
  dayType?: ("weekday" | "weekend")[];
};

type ContextualPollTemplate = {
  template: string;
  optionA: string;
  optionB: string;
  conditions: {
    minTemp?: number;
    maxTemp?: number;
    weatherConditions?: string[];
    timeOfDay?: ("morning" | "afternoon" | "evening" | "night")[];
    dayType?: ("weekday" | "weekend")[];
    requiresEvents?: boolean;
    requiresTraffic?: boolean;
  };
};

const WEATHER_CONTEXTUAL_POLLS: ContextualPollTemplate[] = [
  { template: "🥵 {temp}°F outside. Perfect day for:", optionA: "🏊 Pool time", optionB: "❄️ AC & Netflix", conditions: { minTemp: 85 } },
  { template: "🌡️ It's {temp}°F in {city}. How are you beating the heat?", optionA: "🧊 Iced drinks patio", optionB: "🏠 Staying inside", conditions: { minTemp: 85 } },
  { template: "☀️ {temp}°F and sunny. Your move:", optionA: "🏖️ Lake day", optionB: "🎬 Movie theater AC", conditions: { minTemp: 90 } },
  { template: "🥶 {temp}°F in {city}. Perfect weather for:", optionA: "☕ Hot coffee run", optionB: "🛋️ Cozy at home", conditions: { maxTemp: 50 } },
  { template: "❄️ Brr! {temp}°F out there. You're reaching for:", optionA: "🧥 Jacket + outside", optionB: "🔥 Blanket + couch", conditions: { maxTemp: 45 } },
  { template: "☔ Rainy day in {city}. Your vibe:", optionA: "🍲 Soup & stay in", optionB: "☕ Cozy cafe", conditions: { weatherConditions: ["rain", "storm"] } },
  { template: "🌧️ Rain moving through {city}. Perfect excuse for:", optionA: "📚 Reading day", optionB: "🎮 Gaming session", conditions: { weatherConditions: ["rain", "storm"] } },
  { template: "✨ {temp}°F and gorgeous in {city}! You're:", optionA: "🚴 Outside exploring", optionB: "🍽️ Patio dining", conditions: { minTemp: 65, maxTemp: 80, weatherConditions: ["clear"] } },
];

const TIME_CONTEXTUAL_POLLS: ContextualPollTemplate[] = [
  { template: "Saturday morning in {city}! You're:", optionA: "🛏️ Sleeping in", optionB: "🥬 Farmers market run", conditions: { dayType: ["weekend"], timeOfDay: ["morning"] } },
  { template: "Weekend morning vibes. {city}, what's calling you:", optionA: "🥞 Big breakfast out", optionB: "☕ Slow coffee at home", conditions: { dayType: ["weekend"], timeOfDay: ["morning"] } },
  { template: "Friday night in {city}! Your plans:", optionA: "🍻 Going out", optionB: "🛋️ Staying in", conditions: { dayType: ["weekday"], timeOfDay: ["evening", "night"] } },
  { template: "After work in {city}. You're:", optionA: "🏋️ Hitting the gym", optionB: "🏠 Straight home", conditions: { dayType: ["weekday"], timeOfDay: ["evening"] } },
  { template: "Monday morning in {city}. Your fuel:", optionA: "☕ Coffee, obviously", optionB: "🏃 Morning workout", conditions: { dayType: ["weekday"], timeOfDay: ["morning"] } },
];

const EVENT_CONTEXTUAL_POLLS: ContextualPollTemplate[] = [
  { template: "🎉 {eventName} tonight in {city}! You're:", optionA: "🎟️ Going!", optionB: "😴 Skipping this one", conditions: { requiresEvents: true } },
  { template: "🎸 {eventName} at {venue}! How are you watching:", optionA: "🏟️ Live at the venue", optionB: "📺 From home", conditions: { requiresEvents: true } },
];

const TRAFFIC_CONTEXTUAL_POLLS: ContextualPollTemplate[] = [
  { template: "🚗 Traffic on {road} is rough. You're:", optionA: "😤 Sitting through it", optionB: "🗺️ Taking the long way", conditions: { requiresTraffic: true } },
  { template: "⏰ Rush hour in {city}. Your strategy:", optionA: "🏃 Leave early", optionB: "⏳ Wait it out", conditions: { requiresTraffic: true, timeOfDay: ["afternoon", "evening"] } },
];

const BASE_CHOICES: PollChoice[] = [
  { a: "☕ Coffee", b: "🍵 Tea", category: "beverage" },
  { a: "🌅 Early bird", b: "🌙 Night owl", category: "lifestyle" },
  { a: "📚 Book", b: "📺 Stream", category: "lifestyle" },
  { a: "🏠 Homebody", b: "🎉 Social butterfly", category: "lifestyle" },
  { a: "🐕 Dogs", b: "🐈 Cats", category: "lifestyle" },
];

const LIFESTYLE_CHOICES: PollChoice[] = [
  { a: "🏠 Homebody", b: "🎉 Social butterfly", category: "lifestyle" },
  { a: "☀️ Morning person", b: "🌙 Night owl", category: "lifestyle" },
  { a: "📚 Book", b: "📺 Netflix", category: "lifestyle" },
  { a: "🎸 Live music", b: "🎬 Movies", category: "lifestyle" },
  { a: "🐕 Dog person", b: "🐈 Cat person", category: "lifestyle" },
];

const THIS_OR_THAT_TEMPLATES = [
  "⚔️ {a} vs {b} — Choose your fighter!",
  "🤔 Settle this: {a} or {b}?",
  "⬅️ {a}  OR  {b} ➡️",
  "🔥 Hot take time: {a} vs {b}",
  "📊 {city} poll: {a} or {b}?",
  "👆 This or that: {a} vs {b}",
  "🎯 Pick one: {a} or {b}",
  "💭 Be honest: {a} or {b}?",
];

// ============================================================================
// NEIGHBOR CHALLENGES
// ============================================================================

const CHALLENGE_TEMPLATES = [
  "🎯 {city} CHALLENGE: Try a restaurant you've NEVER been to this week. Report back!",
  "📸 Photo challenge: Show us {city}'s {superlative} view. GO!",
  "🏃 Weekend challenge: Walk/bike somewhere you'd normally drive. Who's in?",
  "🌟 Kindness challenge: Do something nice for a neighbor this week. What'd you do?",
  "🍳 Cooking challenge: Make a meal using ONLY ingredients from {city} shops. Show us!",
  "🗺️ Explorer challenge: Find a street in {city} you've never been down. What did you discover?",
  "👋 Neighbor challenge: Introduce yourself to someone on your street. How'd it go?",
  "📱 Screen-free challenge: No phone for 2 hours this weekend. Can you do it?",
  "🌿 Green challenge: Plant something in {city} this week. Show us what you planted!",
  "💪 {city} fitness challenge: Take the stairs, park far away, walk to lunch. Track your steps!",
];

const CHALLENGE_VARIABLES = {
  superlative: ["best", "most underrated", "most photogenic", "most peaceful", "most surprising"],
};

// ============================================================================
// WOULD YOU RATHER
// ============================================================================

const WOULD_YOU_RATHER_TEMPLATES = [
  "🤔 Would you rather...\n\nA) {optionA}\nB) {optionB}\n\nChoose wisely, {city}!",
  "⚖️ {city} dilemma:\n\nA) {optionA}\nB) {optionB}\n\nNo cop-outs - pick one!",
  "🎲 Would you rather:\n\n👈 {optionA}\n👉 {optionB}\n\nThis says a lot about you...",
  "💭 Honest answers only:\n\nWould you rather {optionA} OR {optionB}?",
];

const WOULD_YOU_RATHER_OPTIONS = [
  { a: "free breakfast tacos for life at ONE place", b: "50% off everywhere forever" },
  { a: "zero traffic forever but no new restaurants", b: "keep the traffic but get a Trader Joe's" },
  { a: "perfect 75° weather every day", b: "keep our seasons but get a beach nearby" },
  { a: "live next to HEB but hear the carts 24/7", b: "live 15 min away in perfect quiet" },
  { a: "have {road} permanently fixed", b: "get a new highway that bypasses it entirely" },
  { a: "keep {city} small but lose some amenities", b: "grow bigger but get everything Austin has" },
  { a: "never hit another red light on {road}", b: "every restaurant delivery is always free" },
  { a: "get a direct train to downtown Austin", b: "keep cars but all highways are always clear" },
];

// ============================================================================
// CONFESSION BOOTH
// ============================================================================

const CONFESSION_TEMPLATES = [
  "🙈 {city} confession booth is OPEN: What's your guilty pleasure spot that you're embarrassed to admit you love?",
  "🤫 Confess your sins, {city}: What local norm do you secretly hate but pretend to be okay with?",
  "😬 Safe space confession: What popular {city} opinion do you secretly disagree with?",
  "🙊 Confession time: What's something about living in {city} that you'd never say out loud?",
  "💀 Dead honest: What {city} restaurant do people LOVE that you just don't get?",
  "🎭 Anonymous confessions: Reply with your {city} unpopular opinion. No judgment zone.",
  "🤐 Secret confession: What's your {city} guilty pleasure that you hope your neighbors don't judge?",
  "😅 Confession booth: What {city} thing have you been pretending to understand but actually don't?",
];

// ============================================================================
// PREDICTIONS
// ============================================================================

interface PredictionTemplate {
  question: string;
  optionA: string;
  optionB: string;
  category: PredictionCategory;
  dataSource: PredictionDataSource;
  resolvesInHours: number;
  xpReward: number;
  conditions?: {
    minTemp?: number;
    maxTemp?: number;
    weatherConditions?: string[];
    timeOfDay?: ("morning" | "afternoon" | "evening" | "night")[];
    dayType?: ("weekday" | "weekend")[];
    requiresEvents?: boolean;
    requiresTraffic?: boolean;
  };
}

const WEATHER_PREDICTIONS: PredictionTemplate[] = [
  { question: "🔮 Prediction Time: Will it rain in {city} this weekend?", optionA: "🌧️ YES - Get the umbrella ready", optionB: "☀️ NO - We're staying dry", category: "weather", dataSource: "openweather", resolvesInHours: 72, xpReward: 25, conditions: { dayType: ["weekday"] } },
  { question: "🔮 Weather Oracle: Will {city} hit {temp}°F again tomorrow?", optionA: "🌡️ YES - Same heat tomorrow", optionB: "❄️ NO - Cooling down", category: "weather", dataSource: "openweather", resolvesInHours: 24, xpReward: 20, conditions: { minTemp: 85 } },
  { question: "🔮 Prediction: Will we see freezing temps in {city} this week?", optionA: "🥶 YES - Break out the jackets", optionB: "🌤️ NO - Texas winter is a myth", category: "weather", dataSource: "openweather", resolvesInHours: 168, xpReward: 30, conditions: { maxTemp: 50 } },
  { question: "🔮 Storm Watch: Will {city} get thunderstorms tonight?", optionA: "⛈️ YES - Storms are coming", optionB: "🌙 NO - Peaceful night ahead", category: "weather", dataSource: "openweather", resolvesInHours: 12, xpReward: 25, conditions: { weatherConditions: ["cloudy", "rain"] } },
];

const TRAFFIC_PREDICTIONS: PredictionTemplate[] = [
  { question: "🔮 Traffic Oracle: Will {road} be backed up during tomorrow's rush hour?", optionA: "🚗 YES - It's gonna be rough", optionB: "🏎️ NO - Smooth sailing", category: "traffic", dataSource: "traffic_api", resolvesInHours: 24, xpReward: 20, conditions: { dayType: ["weekday"] } },
  { question: "🔮 Friday Prediction: Will {road} be a parking lot at 5 PM?", optionA: "😤 YES - Total gridlock", optionB: "🙌 NO - Everyone left early", category: "traffic", dataSource: "traffic_api", resolvesInHours: 8, xpReward: 25, conditions: { dayType: ["weekday"], timeOfDay: ["morning", "afternoon"] } },
];

const EVENT_PREDICTIONS: PredictionTemplate[] = [
  { question: "🔮 Event Prediction: Will {eventName} sell out?", optionA: "🎟️ YES - It's gonna be packed", optionB: "🪑 NO - Plenty of space", category: "events", dataSource: "manual", resolvesInHours: 48, xpReward: 25, conditions: { requiresEvents: true } },
  { question: "🔮 Traffic Prediction: Will {eventName} cause major traffic in {city}?", optionA: "🚗 YES - Avoid the area", optionB: "🛣️ NO - It'll be fine", category: "events", dataSource: "manual", resolvesInHours: 24, xpReward: 20, conditions: { requiresEvents: true } },
];

const LOCAL_PREDICTIONS: PredictionTemplate[] = [
  { question: "🔮 Weekend Prediction: Will {park} be crowded this Saturday?", optionA: "👨‍👩‍👧‍👦 YES - Pack early", optionB: "🧘 NO - Plenty of space", category: "local", dataSource: "community", resolvesInHours: 72, xpReward: 20, conditions: { dayType: ["weekday"] } },
  { question: "🔮 Restaurant Bet: Will {restaurant} have a wait on Friday night?", optionA: "⏰ YES - Expect a line", optionB: "🪑 NO - Walk right in", category: "local", dataSource: "community", resolvesInHours: 48, xpReward: 15, conditions: { dayType: ["weekday"], timeOfDay: ["morning", "afternoon"] } },
  { question: "🔮 Weekend Vibe: Will downtown {city} be busy this Saturday night?", optionA: "🎉 YES - Party mode", optionB: "😴 NO - Ghost town", category: "local", dataSource: "community", resolvesInHours: 72, xpReward: 20, conditions: { dayType: ["weekday"] } },
];

// ============================================================================
// CIVIC AWARENESS
// ============================================================================

const CIVIC_AWARENESS_TEMPLATES = [
  { message: `🏛️ {city} Civic Question:\n\nDo you know when your local school board meets?\n\n📊 Quick poll:`, optionA: "Yes, I follow it", optionB: "No idea, honestly", category: "awareness" as const },
  { message: `🏫 {city} Community Check:\n\nSchool board decisions affect property values, curriculum, and taxes.\n\nAre you paying attention?`, optionA: "I try to follow along", optionB: "I should probably start", category: "awareness" as const },
  { message: `🏛️ Civic Truth Time:\n\nCity council meetings in {city} shape everything from zoning to taxes.\n\nHave you ever watched one?`, optionA: "Yes, been there", optionB: "Never, but curious", category: "awareness" as const },
  { message: `🔮 Civic Prediction: Budget Season\n\n{city} budget discussions are coming up. What's your prediction?\n\nWill property taxes...`, optionA: "Stay flat", optionB: "Go up (again)", category: "prediction" as const },
  { message: `🏫 School District Prediction:\n\nWith all the growth in {city}, will we see a new school announced this year?`, optionA: "Yes, it's overdue", optionB: "No, budget is tight", category: "prediction" as const },
  { message: `🏛️ {city} Development Watch:\n\nThat big empty lot everyone keeps asking about... prediction time:\n\nWhat gets built next?`, optionA: "More housing", optionB: "Commercial/retail", category: "prediction" as const },
];

// ============================================================================
// FARMERS MARKET TEMPLATES
// ============================================================================

const FARMERS_MARKET_TEMPLATES = {
  openToday: [
    `🥬 {marketName} is OPEN NOW!\n📍 {address} ({landmarkAnchor})\n🕐 {schedule}\nFresh produce, local vendors & more!\n→ Tap for directions`,
    `🍅 MARKET DAY! {marketName} is open right now\n📍 {address} ({landmarkAnchor})\n🕐 {schedule}\nGet there before the good stuff sells out!\n→ See on Markets tab`,
    `🌽 {marketName} is OPEN for business!\n📍 {address}{distanceText}\n🕐 {schedule}\n{products} and more fresh from the farm\n→ Get directions`,
  ],
  upcoming: [
    `📅 This weekend: {marketName}\n📍 {address}{distanceText}\n🕐 {schedule}\n{products} - who's planning to go?\n→ Check the Markets tab for more`,
    `🥬 Mark your calendar: {marketName}\n📍 {address}{distanceText}\n🕐 {schedule}\nFresh local produce awaits!\n→ Get directions for the weekend`,
  ],
  discovery: [
    `Looking for fresh local produce? 🍅\n{marketName} in {city} has you covered:\n📍 {address}{distanceText}\n🕐 {schedule}\n→ Get directions`,
    `🥬 Local gem: {marketName}\n📍 {address}{distanceText}\n🕐 {schedule}\nAnyone been? What's the best booth?\n→ See on Markets tab`,
  ],
  tips: [
    `🤫 Insider tip: {marketName}\n📍 {address}{distanceText}\n🕐 {schedule}\nArrive early for the best {products}!\n→ Get directions`,
    `🥬 Pro tip for {marketName}:\n📍 {address}{distanceText}\n🕐 {schedule}\nBring cash & reusable bags. Trust me.\n→ See on Markets tab`,
  ],
};

// ============================================================================
// ROUTE PULSE
// ============================================================================

const ROUTE_PULSE_TEMPLATES = [
  "Planning a run to {landmark}? Traffic on {road} is {status} right now. Perfect time to beat the rush! 🚗",
  "Heading toward {landmark}? {road} is {status}. Might be a good window to grab that {item} you've been wanting. 🛒",
  "Retail check: Thinking about {landmark}? {road} is flows {status}. Should be an easy trip! ✨",
  "Quick update for {landmark} regulars: {road} is currently {status}. {tip}! 🎯",
];

const ROUTE_STATUS_MAP: Record<string, string> = {
  clear: "flowing smoothly",
  moderate: "seeing some moderate activity",
  heavy: "currently heavy",
  jam: "jammed - maybe wait 30 mins?",
};

const RETAIL_ITEMS = ["grocery run", "coffee fix", "supply run", "quick errand", "treat"];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getCurrentSeason(): "spring" | "summer" | "fall" | "winter" {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

function getWeatherCategory(temp: number, condition: string): "hot" | "cold" | "rain" | "nice" {
  if (condition === "rain" || condition === "storm") return "rain";
  if (temp > 85) return "hot";
  if (temp < 50) return "cold";
  return "nice";
}

function getTimeOfDay(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillEngagementTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (let i = 0; i < 3; i++) {
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
  }
  return result;
}

function getCityVariables(city: CityConfig): Record<string, string> {
  const randomDisplay = (arr: LandmarkEntry[]): string => getLandmarkDisplay(arr[Math.floor(Math.random() * arr.length)]);
  const parkEntry = city.landmarks.venues.find(v => getLandmarkName(v).toLowerCase().includes('park'));
  const parkDisplay = parkEntry ? getLandmarkDisplay(parkEntry) : randomDisplay(city.landmarks.venues);

  return {
    city: city.name,
    road: city.roads.major[Math.floor(Math.random() * city.roads.major.length)],
    altRoute: city.roads.highways[Math.floor(Math.random() * city.roads.highways.length)],
    restaurant: randomDisplay(city.landmarks.restaurants),
    venue: randomDisplay(city.landmarks.venues),
    landmark: randomDisplay(city.landmarks.shopping),
    park: parkDisplay,
  };
}

function matchesConditions(
  conditions: ContextualPollTemplate["conditions"],
  ctx: SituationContext,
  timeOfDay: "morning" | "afternoon" | "evening" | "night",
  dayType: "weekday" | "weekend"
): boolean {
  const { weather, events, traffic } = ctx;
  if (conditions.minTemp !== undefined && weather.temperature < conditions.minTemp) return false;
  if (conditions.maxTemp !== undefined && weather.temperature > conditions.maxTemp) return false;
  if (conditions.weatherConditions?.length && !conditions.weatherConditions.includes(weather.condition)) return false;
  if (conditions.timeOfDay?.length && !conditions.timeOfDay.includes(timeOfDay)) return false;
  if (conditions.dayType?.length && !conditions.dayType.includes(dayType)) return false;
  if (conditions.requiresEvents && (!events || events.length === 0)) return false;
  if (conditions.requiresTraffic && (!traffic || traffic.congestionLevel <= 0.3)) return false;
  return true;
}

// ============================================================================
// GENERATORS
// ============================================================================

export async function generatePollPost(ctx: SituationContext): Promise<EngagementPost | null> {
  const { city, weather, time } = ctx;
  let contextPool: typeof POLL_CONTEXTS.food;

  if (time.hour >= 7 && time.hour <= 10) {
    contextPool = POLL_CONTEXTS.food.filter(c => ["coffee", "tacos", "brunch"].includes(c.topic));
  } else if (time.hour >= 11 && time.hour <= 14) {
    contextPool = POLL_CONTEXTS.food.filter(c => ["tacos", "bbq", "pizza", "burgers"].includes(c.topic));
  } else if (time.hour >= 17 && time.hour <= 21) {
    contextPool = POLL_CONTEXTS.food.filter(c => ["date night", "happy hour", "pizza", "bbq"].includes(c.topic));
  } else if (time.isWeekend) {
    contextPool = [...POLL_CONTEXTS.food, ...POLL_CONTEXTS.activities];
  } else {
    contextPool = POLL_CONTEXTS.food;
  }

  if (weather.condition === "rain" || weather.condition === "storm") {
    contextPool = POLL_CONTEXTS.food;
  } else if (weather.temperature > 75 && weather.temperature < 90) {
    contextPool = [...contextPool, ...POLL_CONTEXTS.activities];
  }

  const context = contextPool[Math.floor(Math.random() * contextPool.length)];
  const variant = context.variants[Math.floor(Math.random() * context.variants.length)];

  const pollFormats = [
    `${context.emoji} Best ${variant} in ${city.name}? Drop your picks below!`,
    `${context.emoji} ${city.name} poll: Your favorite spot for ${variant}?`,
    `${context.emoji} Hot debate time: Where's the best ${variant} around here?`,
    `${context.emoji} ${city.name} locals: Where do you go for ${variant}?`,
  ];

  return {
    message: pollFormats[Math.floor(Math.random() * pollFormats.length)],
    tag: "General", mood: context.emoji,
    author: `${city.name} Pulse Bot 🤖`,
    is_bot: true, hidden: false, engagementType: "poll",
  };
}

export async function generateRecommendationPost(ctx: SituationContext): Promise<EngagementPost | null> {
  const { city, time, weather } = ctx;
  const queries: string[] = [];

  if (time.hour >= 7 && time.hour <= 10) queries.push("breakfast tacos that hit different", "good coffee that's not Starbucks");
  else if (time.hour >= 11 && time.hour <= 14) queries.push("solid lunch spot under $15", "hidden gem for lunch");
  else if (time.hour >= 17 && time.hour <= 21) queries.push("dinner that won't break the bank", "date night spot");

  if (time.isWeekend) queries.push("brunch with good mimosas", "something fun to do today");
  if (weather.temperature > 90) queries.push("best AC'd spots to escape the heat");

  const randomService = POLL_CONTEXTS.services[Math.floor(Math.random() * POLL_CONTEXTS.services.length)];
  queries.push(`a trustworthy ${randomService.variants[0]}`);

  const query = queries[Math.floor(Math.random() * queries.length)];
  const template = RECOMMENDATION_TEMPLATES[Math.floor(Math.random() * RECOMMENDATION_TEMPLATES.length)];

  return {
    message: template.replace("{query}", query),
    tag: "General", mood: "🤔",
    author: `${city.name} Pulse Bot 🤖`,
    is_bot: true, hidden: false, engagementType: "recommendation",
  };
}

export async function generateSchoolAlertPost(ctx: SituationContext): Promise<EngagementPost | null> {
  const { city, time } = ctx;
  if (!time.isWeekday) return null;

  const dismissalHour = city.rushHours.schoolDismissal;
  const minutesToDismissal = (dismissalHour * 60) - (time.hour * 60 + new Date().getMinutes());
  if (minutesToDismissal < 10 || minutesToDismissal > 30) return null;

  const allSchools = [...city.schools.high, ...city.schools.middle, ...city.schools.elementary];
  const school = allSchools[Math.floor(Math.random() * allSchools.length)];
  const road = city.roads.schoolZones[Math.floor(Math.random() * city.roads.schoolZones.length)];
  const template = SCHOOL_ALERT_TEMPLATES[Math.floor(Math.random() * SCHOOL_ALERT_TEMPLATES.length)];

  return {
    message: template.replace("{school}", school).replace(/{road}/g, road),
    tag: "Traffic", mood: "🏫",
    author: `${city.name} Pulse Bot 🤖`,
    is_bot: true, hidden: false, engagementType: "school_alert",
  };
}

export async function generateThisOrThatPost(ctx: SituationContext): Promise<EngagementPost | null> {
  const { city, weather, time, events, traffic } = ctx;
  const timeOfDay = getTimeOfDay(time.hour);
  const dayType = time.isWeekend ? "weekend" : "weekday";

  const vars: Record<string, string> = {
    city: city.name,
    temp: String(Math.round(weather.temperature)),
    road: city.roads.major[Math.floor(Math.random() * city.roads.major.length)],
  };
  if (events?.length > 0) { vars.eventName = events[0].name; vars.venue = events[0].venue; }

  const matchingTemplates: ContextualPollTemplate[] = [];
  for (const poll of WEATHER_CONTEXTUAL_POLLS) { if (matchesConditions(poll.conditions, ctx, timeOfDay, dayType)) matchingTemplates.push(poll); }
  for (const poll of TIME_CONTEXTUAL_POLLS) { if (matchesConditions(poll.conditions, ctx, timeOfDay, dayType)) matchingTemplates.push(poll); }
  if (events?.length > 0) { for (const poll of EVENT_CONTEXTUAL_POLLS) { if (matchesConditions(poll.conditions, ctx, timeOfDay, dayType)) matchingTemplates.push(poll); } }
  if (traffic && traffic.congestionLevel > 0.3) { for (const poll of TRAFFIC_CONTEXTUAL_POLLS) { if (matchesConditions(poll.conditions, ctx, timeOfDay, dayType)) matchingTemplates.push(poll); } }

  if (matchingTemplates.length > 0) {
    const selected = matchingTemplates[Math.floor(Math.random() * matchingTemplates.length)];
    let message = selected.template;
    for (const [key, value] of Object.entries(vars)) { message = message.replace(new RegExp(`\\{${key}\\}`, "g"), value); }
    return { message, tag: "General", mood: "📊", author: `${city.name} Pulse Bot 🤖`, is_bot: true, hidden: false, engagementType: "this_or_that", options: [selected.optionA, selected.optionB] };
  }

  // Fallback
  const fallback = [...BASE_CHOICES, ...LIFESTYLE_CHOICES];
  const choice = fallback[Math.floor(Math.random() * fallback.length)];
  const template = THIS_OR_THAT_TEMPLATES[Math.floor(Math.random() * THIS_OR_THAT_TEMPLATES.length)];
  const message = template.replace("{a}", choice.a).replace("{b}", choice.b).replace("{city}", city.name);
  return { message, tag: "General", mood: "⚔️", author: `${city.name} Pulse Bot 🤖`, is_bot: true, hidden: false, engagementType: "this_or_that", options: [choice.a, choice.b] };
}

export async function generateNeighborChallengePost(ctx: SituationContext): Promise<EngagementPost | null> {
  const { city } = ctx;
  const vars = getCityVariables(city);
  const template = pickRandom(CHALLENGE_TEMPLATES);
  const extendedVars = { ...vars, superlative: pickRandom(CHALLENGE_VARIABLES.superlative) };
  return {
    message: fillEngagementTemplate(template, extendedVars),
    tag: "General", mood: "📣",
    author: `${city.name} Pulse Bot 🤖`,
    is_bot: true, hidden: false, engagementType: "neighbor_challenge",
  };
}

export async function generateWouldYouRatherPost(ctx: SituationContext): Promise<EngagementPost | null> {
  const { city } = ctx;
  const vars = getCityVariables(city);
  const template = pickRandom(WOULD_YOU_RATHER_TEMPLATES);
  const choice = pickRandom(WOULD_YOU_RATHER_OPTIONS);
  const optionA = fillEngagementTemplate(choice.a, vars);
  const optionB = fillEngagementTemplate(choice.b, vars);
  const message = fillEngagementTemplate(template, { ...vars, optionA, optionB });
  return {
    message, tag: "General", mood: "🤔",
    author: `${city.name} Pulse Bot 🤖`,
    is_bot: true, hidden: false, engagementType: "would_you_rather",
    options: [optionA, optionB],
  };
}

export async function generateConfessionBoothPost(ctx: SituationContext): Promise<EngagementPost | null> {
  const { city } = ctx;
  const vars = getCityVariables(city);
  return {
    message: fillEngagementTemplate(pickRandom(CONFESSION_TEMPLATES), vars),
    tag: "General", mood: "🙈",
    author: `${city.name} Pulse Bot 🤖`,
    is_bot: true, hidden: false, engagementType: "confession_booth",
  };
}

export async function generatePredictionPost(
  ctx: SituationContext,
  options: { skipEventPredictions?: boolean } = {}
): Promise<EngagementPost | null> {
  const { city, weather, time, events, traffic } = ctx;
  const { skipEventPredictions = false } = options;
  const timeOfDay = getTimeOfDay(time.hour);
  const dayType = time.isWeekday ? "weekday" : "weekend";

  const vars = getCityVariables(city);
  const extendedVars: Record<string, string> = { ...vars, temp: String(Math.round(weather.temperature)) };
  if (events?.length > 0) { extendedVars.eventName = events[0].name; extendedVars.venue = events[0].venue; }

  const matchingTemplates: PredictionTemplate[] = [];
  const hasSnowInForecast = weather.forecast?.some(day => day.snowfallCm > 0) ?? false;

  const matchesPredictionConditions = (template: PredictionTemplate): boolean => {
    const cond = template.conditions;
    if (!cond) return true;
    if (cond.minTemp !== undefined && weather.temperature < cond.minTemp) return false;
    if (cond.maxTemp !== undefined && weather.temperature > cond.maxTemp) return false;
    if (cond.weatherConditions?.length && !cond.weatherConditions.includes(weather.condition)) return false;
    if (cond.timeOfDay?.length && !cond.timeOfDay.includes(timeOfDay)) return false;
    if (cond.dayType?.length && !cond.dayType.includes(dayType)) return false;
    if (cond.requiresEvents && (!events || events.length === 0)) return false;
    if (cond.requiresTraffic && (!traffic || traffic.congestionLevel <= 0.3)) return false;
    return true;
  };

  if (hasSnowInForecast) {
    matchingTemplates.push({
      question: `🔮 Prediction Time: How much snow will ${city.name} actually get?`,
      optionA: "❄️ More than forecast - Winter wonderland!", optionB: "🥱 Less than expected - Texas tease",
      category: "weather", dataSource: "openweather", resolvesInHours: 72, xpReward: 25,
    });
  } else {
    for (const t of WEATHER_PREDICTIONS) { if (matchesPredictionConditions(t)) matchingTemplates.push(t); }
  }

  for (const t of TRAFFIC_PREDICTIONS) { if (matchesPredictionConditions(t)) matchingTemplates.push(t); }
  if (!skipEventPredictions && events?.length > 0) { for (const t of EVENT_PREDICTIONS) { if (matchesPredictionConditions(t)) matchingTemplates.push(t); } }
  for (const t of LOCAL_PREDICTIONS) { if (matchesPredictionConditions(t)) matchingTemplates.push(t); }

  // Fallback: forecast-based predictions
  if (matchingTemplates.length === 0) {
    const getWeekendForecast = (forecast: ForecastDay[] | undefined): ForecastDay | null => {
      if (!forecast?.length) return null;
      for (const day of forecast) { if ([0, 6].includes(new Date(day.date).getDay())) return day; }
      return forecast[forecast.length - 1];
    };
    const wf = getWeekendForecast(weather.forecast);
    if (wf) {
      if (wf.snowfallCm > 0) matchingTemplates.push({ question: `🔮 How much snow will ${city.name} get this weekend?`, optionA: "❄️ More than forecast!", optionB: "🥱 Less than expected", category: "weather", dataSource: "openweather", resolvesInHours: 72, xpReward: 25 });
      else if (wf.precipitationMm > 1 || wf.condition === 'rain') matchingTemplates.push({ question: `🔮 Will rain in ${city.name} ruin weekend plans?`, optionA: "🌧️ YES - Stay inside", optionB: "☀️ NO - Plenty of dry time", category: "weather", dataSource: "openweather", resolvesInHours: 72, xpReward: 25 });
      else if (wf.tempHigh > 85) matchingTemplates.push({ question: `🔮 Will ${city.name} hit ${Math.round(wf.tempHigh)}°F this weekend?`, optionA: "🔥 YES - Pool weather", optionB: "🌤️ NO - Slightly cooler", category: "weather", dataSource: "openweather", resolvesInHours: 72, xpReward: 25 });
      else matchingTemplates.push({ question: `🔮 Will ${city.name} stay around ${wf.tempHigh}°F this weekend?`, optionA: "☀️ YES", optionB: "🎲 NO - Weather will surprise us", category: "weather", dataSource: "openweather", resolvesInHours: 72, xpReward: 25 });
    } else {
      matchingTemplates.push({ question: `🔮 Will ${city.name} have perfect patio weather this weekend?`, optionA: "☀️ YES", optionB: "😬 NO", category: "weather", dataSource: "openweather", resolvesInHours: 72, xpReward: 25 });
    }
  }

  const selected = pickRandom(matchingTemplates);
  let message = fillEngagementTemplate(selected.question, extendedVars);
  const resolvesAt = new Date(Date.now() + selected.resolvesInHours * 60 * 60 * 1000);
  const votingDeadline = new Date(resolvesAt.getTime() - 2 * 60 * 60 * 1000);
  const deadlineStr = votingDeadline.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
  message += `\n\n💎 Correct guessers get ${selected.xpReward} XP! Voting closes ${deadlineStr}.`;

  let tag: PostType = "General";
  if (selected.category === "weather") tag = "Weather";
  else if (selected.category === "traffic") tag = "Traffic";
  else if (selected.category === "events") tag = "Events";

  return {
    message, tag, mood: "🔮",
    author: `${city.name} Pulse Bot 🤖`,
    is_bot: true, hidden: false, engagementType: "prediction",
    options: [selected.optionA, selected.optionB],
    prediction: { resolvesAt, xpReward: selected.xpReward, category: selected.category, dataSource: selected.dataSource },
  };
}

export async function generateCivicAlertPost(ctx: SituationContext): Promise<EngagementPost | null> {
  const { city } = ctx;
  const template = pickRandom(CIVIC_AWARENESS_TEMPLATES);
  const message = template.message.replace(/{city}/g, city.name);

  if (template.category === "prediction") {
    const resolvesAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const deadlineStr = resolvesAt.toLocaleString("en-US", { weekday: "short", hour: "numeric" });
    return {
      message: `${message}\n\n💎 Correct guessers earn 50 XP! Resolution by ${deadlineStr}.`,
      tag: "General" as PostType, mood: "🏛️",
      author: `${city.name} Pulse Bot 🤖`,
      is_bot: true, hidden: false, engagementType: "civic_alert",
      options: [template.optionA, template.optionB],
      prediction: { resolvesAt, xpReward: 50, category: "civic", dataSource: "manual" },
    };
  }

  return {
    message, tag: "General" as PostType, mood: "🏛️",
    author: `${city.name} Pulse Bot 🤖`,
    is_bot: true, hidden: false, engagementType: "civic_alert",
    options: [template.optionA, template.optionB],
  };
}

export async function generateWeatherAlertPost(ctx: SituationContext): Promise<EngagementPost | null> {
  const { city, weather } = ctx;
  if (!weather.forecast?.length) return null;

  let alertType: "snow" | "storm" | "freeze" | "heat" | null = null;
  let alertDay: typeof weather.forecast[0] | null = null;

  for (const day of weather.forecast) {
    if (day.snowfallCm > 0) { alertType = "snow"; alertDay = day; break; }
    if ((day.condition === "storm" || day.precipitationMm > 25) && (!alertType || alertType === "freeze" || alertType === "heat")) { alertType = "storm"; alertDay = day; }
    if (day.tempLow < 32 && (!alertType || alertType === "heat")) { alertType = "freeze"; alertDay = day; }
    if (day.tempHigh > 100 && !alertType) { alertType = "heat"; alertDay = day; }
  }

  if (!alertType || !alertDay) return null;

  const alertDate = new Date(alertDay.date);
  const isToday = alertDate.toDateString() === new Date().toDateString();
  const isTomorrow = alertDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
  const timeframe = isToday ? "TODAY" : isTomorrow ? "tomorrow" : alertDate.toLocaleDateString("en-US", { weekday: "long" });

  let message: string, mood: string;
  switch (alertType) {
    case "snow":
      message = `❄️ SNOW ALERT: ${city.name} may see snow ${timeframe}!` + (alertDay.snowfallCm > 1 ? ` Expecting ~${Math.round(alertDay.snowfallCm / 2.54)} inches.` : "") + `\n\n🚗 Roads could get icy - plan ahead!`;
      mood = "❄️"; break;
    case "storm":
      message = `⛈️ STORM ALERT: Heavy weather heading to ${city.name} ${timeframe}!\n\n🌧️ Expected: ${Math.round(alertDay.precipitationMm / 25.4)}"+ of rain\n⚡ Possible thunderstorms!`;
      mood = "⛈️"; break;
    case "freeze":
      message = `🥶 FREEZE WARNING: ${city.name} dropping to ${alertDay.tempLow}°F ${timeframe}!\n\n💧 Protect pipes!\n🌱 Bring plants inside\n🚗 Watch for icy bridges`;
      mood = "🥶"; break;
    case "heat":
      message = `🔥 EXTREME HEAT: ${city.name} hitting ${alertDay.tempHigh}°F ${timeframe}!\n\n💧 Stay hydrated\n🐕 Keep pets inside during peak heat`;
      mood = "🔥"; break;
  }

  return { message, tag: "Weather", mood, author: `${city.name} Pulse Bot 🤖`, is_bot: true, hidden: false, engagementType: "weather_alert" };
}

export async function generateFarmersMarketPost(ctx: SituationContext): Promise<EngagementPost | null> {
  const { city, farmersMarkets, time } = ctx;
  if (!farmersMarkets?.length) return null;

  const marketPool = farmersMarkets.slice(0, 3);
  const market = marketPool[Math.floor(Math.random() * marketPool.length)];

  let templateCategory: keyof typeof FARMERS_MARKET_TEMPLATES;
  if (market.isOpenToday) templateCategory = "openToday";
  else if (time.isWeekend) templateCategory = Math.random() < 0.5 ? "discovery" : "tips";
  else templateCategory = Math.random() < 0.6 ? "upcoming" : "discovery";

  const template = pickRandom(FARMERS_MARKET_TEMPLATES[templateCategory]);
  const productsStr = market.products.length > 0 ? market.products.slice(0, 3).join(", ").toLowerCase() : "fresh produce";
  const distanceText = market.distance ? ` (${market.distance.toFixed(1)} mi)` : "";
  const nearest = getNearestLandmark(city, { lat: market.lat || city.coords.lat, lon: market.lon || city.coords.lon });
  const landmarkAnchor = nearest ? `near ${nearest.landmark}` : `in ${city.name}`;
  const address = market.address && market.address !== "Address not available" ? market.address : `near ${city.name}`;

  const message = fillEngagementTemplate(template, { marketName: market.name, address, landmarkAnchor, distanceText, schedule: market.schedule || "Hours vary", products: productsStr, city: city.name });

  const directionsUrl = market.lat && market.lon
    ? `https://www.google.com/maps/dir/?api=1&destination=${market.lat},${market.lon}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(market.name + " " + market.address)}`;

  return {
    message, tag: "Events", mood: "🥬",
    author: `${city.name} Pulse Bot 🤖`,
    is_bot: true, hidden: false, engagementType: "farmers_market",
    action: { type: "directions", target: directionsUrl, label: "Get Directions", venue: { name: market.name, address: market.address, lat: market.lat, lon: market.lon, website: market.website ?? undefined } },
  };
}

export async function generateRoutePulsePost(ctx: SituationContext): Promise<EngagementPost | null> {
  const { city, traffic } = ctx;
  if (!traffic) return null;

  const congestion = traffic.congestionLevel * 100;
  const status = congestion >= 80 ? "jam" : congestion >= 50 ? "heavy" : congestion >= 20 ? "moderate" : "clear";
  const landmark = getRandomLandmark(city, "shopping");
  const road = getRandomRoad(city);
  const message = pickRandom(ROUTE_PULSE_TEMPLATES)
    .replace(/{landmark}/g, landmark)
    .replace(/{road}/g, road)
    .replace(/{status}/g, ROUTE_STATUS_MAP[status])
    .replace(/{item}/g, pickRandom(RETAIL_ITEMS))
    .replace(/{tip}/g, status === "clear" ? "Now's the time" : "Patience recommended");

  return {
    message, tag: "Traffic", mood: status === "clear" ? "✅" : "🚥",
    author: `${city.name} Pulse Bot 🤖`,
    is_bot: true, hidden: false, engagementType: "route_pulse",
    action: { type: "traffic_check", target: "traffic", label: "Check Traffic Map" },
  };
}

// ============================================================================
// HIGH-LEVEL ENGAGEMENT ANALYSIS & GENERATION
// ============================================================================

export interface EngagementDecision {
  shouldPost: boolean;
  engagementType: EngagementType | null;
  reason: string;
}

export function analyzeForEngagement(ctx: SituationContext): EngagementDecision {
  const { time, events } = ctx;
  const hour = time.hour;
  const isAllowed = (type: EngagementType): boolean => DATA_GROUNDED_ENGAGEMENT_TYPES.has(type);

  // ROUTE PULSE (Actionable Traffic/Retail)
  if (ctx.traffic && (hour >= 10 && hour <= 18) && Math.random() < 0.4) {
    return { shouldPost: true, engagementType: "route_pulse", reason: "Active shopping window + traffic data" };
  }

  // WEATHER ALERTS (Forecast outliers)
  if (ctx.weather.forecast?.length) {
    if (ctx.weather.forecast.some(d => d.snowfallCm > 0)) return { shouldPost: true, engagementType: "weather_alert", reason: "Snow in forecast" };
    if (ctx.weather.forecast.some(d => d.condition === 'storm' || d.precipitationMm > 25)) return { shouldPost: true, engagementType: "weather_alert", reason: "Storm in forecast" };
    if (ctx.weather.forecast.some(d => d.tempLow < 32)) return { shouldPost: true, engagementType: "weather_alert", reason: "Freezing temps in forecast" };
    if (ctx.weather.forecast.some(d => d.tempHigh > 100)) return { shouldPost: true, engagementType: "weather_alert", reason: "Extreme heat in forecast" };
  }

  // SCHOOL ALERTS
  if (time.isWeekday) {
    const minutesToDismissal = (ctx.city.rushHours.schoolDismissal * 60) - (hour * 60 + new Date().getMinutes());
    if (minutesToDismissal >= 10 && minutesToDismissal <= 30) return { shouldPost: true, engagementType: "school_alert", reason: "School dismissal approaching" };
  }

  // CIVIC ALERTS (weekday evenings)
  if (time.isWeekday && hour >= 16 && hour <= 19 && time.dayOfWeek >= 2 && time.dayOfWeek <= 4 && Math.random() < 0.25) {
    return { shouldPost: true, engagementType: "civic_alert", reason: "Weekday evening civic meeting window" };
  }

  // PREDICTIONS
  if ((hour >= 7 && hour <= 10) || (hour >= 18 && hour <= 21)) {
    if (Math.random() < 0.3) return { shouldPost: true, engagementType: "prediction", reason: "Prime prediction window" };
  } else if (Math.random() < 0.15) {
    return { shouldPost: true, engagementType: "prediction", reason: "Prediction post" };
  }

  // CONFESSION BOOTH
  if (Math.random() < 0.18) return { shouldPost: true, engagementType: "confession_booth", reason: "Confession booth" };

  // NEIGHBOR CHALLENGES
  if (Math.random() < 0.2) return { shouldPost: true, engagementType: "neighbor_challenge", reason: "Challenge CTA" };

  // WOULD YOU RATHER
  if (Math.random() < 0.2) return { shouldPost: true, engagementType: "would_you_rather", reason: "Would you rather" };

  // THIS OR THAT
  if (Math.random() < 0.25) return { shouldPost: true, engagementType: "this_or_that", reason: "This or That poll" };

  // POLLS (meal times)
  if (((hour >= 7 && hour <= 10) || (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 20)) && Math.random() < 0.18) {
    return { shouldPost: true, engagementType: "poll", reason: "Meal time food poll" };
  }

  // RECOMMENDATION
  if (Math.random() < 0.12) return { shouldPost: true, engagementType: "recommendation", reason: "Community recommendation" };

  return { shouldPost: false, engagementType: null, reason: "No engagement post needed" };
}

export async function generateEngagementPost(
  ctx: SituationContext,
  engagementType?: EngagementType,
  options: { isSeedMode?: boolean } = {}
): Promise<EngagementPost | null> {
  const type = engagementType || analyzeForEngagement(ctx).engagementType;
  if (!type) return null;

  if (!DATA_GROUNDED_ENGAGEMENT_TYPES.has(type)) {
    console.log(`[Engagement] Blocked fabricating type: ${type}`);
    return null;
  }

  const addAttribution = (post: EngagementPost | null): EngagementPost | null => {
    if (!post) return null;
    const sources = getPostDataSources(post.tag, type);
    if (sources.length > 0) post.message = addDataAttribution(post.message, sources);
    return post;
  };

  switch (type) {
    case "poll": return generatePollPost(ctx);
    case "recommendation": return generateRecommendationPost(ctx);
    case "school_alert": return addAttribution(await generateSchoolAlertPost(ctx));
    case "this_or_that": return addAttribution(await generateThisOrThatPost(ctx));
    case "neighbor_challenge": return generateNeighborChallengePost(ctx);
    case "would_you_rather": return generateWouldYouRatherPost(ctx);
    case "confession_booth": return generateConfessionBoothPost(ctx);
    case "farmers_market": return addAttribution(await generateFarmersMarketPost(ctx));
    case "prediction": return addAttribution(await generatePredictionPost(ctx, { skipEventPredictions: options.isSeedMode }));
    case "civic_alert": return generateCivicAlertPost(ctx);
    case "weather_alert": return addAttribution(await generateWeatherAlertPost(ctx));
    case "route_pulse": return addAttribution(await generateRoutePulsePost(ctx));
    default: return null;
  }
}

export async function generateEngagementSeedPosts(
  ctx: SituationContext,
  count: number = 2
): Promise<EngagementPost[]> {
  const posts: EngagementPost[] = [];
  const usedTypes = new Set<EngagementType>();

  const priorities: EngagementType[] = [
    "prediction", "this_or_that", "would_you_rather",
  ];

  if (ctx.time.isWeekday) {
    const minutesToDismissal = (ctx.city.rushHours.schoolDismissal * 60) - (ctx.time.hour * 60 + new Date().getMinutes());
    if (minutesToDismissal >= 10 && minutesToDismissal <= 30) priorities.push("school_alert");
  }

  priorities.push("confession_booth", "neighbor_challenge");

  if (ctx.time.isWeekday && ctx.time.hour >= 16 && ctx.time.hour <= 20) priorities.push("civic_alert");

  priorities.push("poll", "recommendation");

  for (const type of priorities) {
    if (posts.length >= count) break;
    if (usedTypes.has(type)) continue;
    const post = await generateEngagementPost(ctx, type, { isSeedMode: true });
    if (post) { posts.push(post); usedTypes.add(type); }
  }

  return posts;
}
