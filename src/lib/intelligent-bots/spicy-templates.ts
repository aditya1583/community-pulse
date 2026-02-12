/**
 * SPICY TEMPLATES - Bot content that's actually entertaining
 * 
 * Philosophy: Local gossip > corporate PSAs
 * 
 * These templates replace the bland "PSA: Beautiful weather today!"
 * with content people actually want to read and share.
 * 
 * CONTENT RULES (NON-NEGOTIABLE):
 * - NEVER fabricate specific deals, discounts, happy hours, or promotions
 * - NEVER claim specific prices unless pulled from a verified API
 * - NEVER use "ALERT:" prefix for non-emergency content
 * - All business-specific claims must be generic observations, not fabricated offers
 * - Keep it observational and community-focused, not promotional
 */

import type { WeatherData, TrafficData, EventData, FarmersMarketData } from "./types";

// ============================================================================
// TRAFFIC - The Complainer Bot (frustrated, relatable, slightly unhinged)
// ============================================================================

export const SPICY_TRAFFIC_TEMPLATES = {
  heavy: [
    "183 is a parking lot rn. I've aged 3 years in the last mile. Who cursed this road? 🚗💀",
    "Whoever caused the backup on 183... I just want to talk 🙂",
    "My car has been in park longer than drive today. This is fine. Everything is fine. 🔥",
    "Traffic update: I've memorized the license plate of every car around me. We're family now.",
    "183 said 'not today' and honestly I respect the audacity",
    "I could walk faster. I could CRAWL faster. Why do I live here again?",
    "Breaking: 183 has achieved sentience and chosen violence",
    "Traffic so bad I finished a whole podcast. Started another. Still haven't moved.",
    "At this point the traffic cones have more freedom than I do",
  ],
  
  moderate: [
    "183 is doing that thing where it's not terrible but not great. Classic 183.",
    "Traffic's moving but at 'my grandma driving to church' speed",
    "It's giving 'we'll get there eventually' vibes on 183 today",
    "183 is mid. Which for 183 is actually a win tbh",
    "Roads are passable if you have nowhere to be and unlimited patience",
  ],
  
  light: [
    "183 is EMPTY?? Did everyone get raptured and nobody told me?",
    "No traffic on 183. I'm suspicious. What does the road know that I don't?",
    "Clear roads today which means the universe is about to balance this out later",
    "Traffic is weirdly good. Quick, run your errands before it realizes its mistake!",
    "183 flowing smooth. Screenshot this, it won't happen again for months.",
  ],
  
  incident: [
    "Accident on {road}. Sending thoughts and prayers to everyone's commute time 🙏",
    "Wreck on {road} - take {altRoute} unless you enjoy sitting in your feelings",
    "Something happened on {road} and now we all suffer together. Community! 🥲",
  ],
  
  school_zone: [
    "School zone chaos hours activated. May the odds be ever in your favor 🚸",
    "It's school pickup time which means every parent has forgotten how to drive",
    "School zone traffic: where turn signals go to die",
  ],
};

// ============================================================================
// WEATHER - The Dramatic Local (overreacts appropriately to Texas weather)
// ============================================================================

export const SPICY_WEATHER_TEMPLATES = {
  hot: [
    "It's {temp}°F which means my car's steering wheel will cause 2nd degree burns",
    "{temp}°F. The sun chose violence today. Stay hydrated or become jerky.",
    "Weather update: it's hot. In other news, water is wet. Texas gonna Texas 🥵",
    "It's giving 'open the oven to check on food' temperature outside",
    "Friendly reminder that your car is now a convection oven. Don't leave anything alive in there.",
    "{temp}°F and my AC is earning its keep today. Poor thing is working overtime.",
  ],
  
  cold: [
    "{temp}°F?? In TEXAS?? I didn't sign up for this. Who do I speak to about the weather?",
    "It's {temp}°F and I've forgotten how cold works. Do I own a jacket? Unclear.",
    "Freeze warning which means HEB bread aisle is already cleared out",
    "Cold enough that I saw someone in actual winter clothes. Wild times.",
    "{temp}°F. If you're from up north, no we don't want to hear how this is 'nothing'",
    "It's cold. The city will shut down. This is the Texas way.",
  ],
  
  rain: [
    "Rain in Texas which means everyone forgot how to drive. Stay safe out there 🌧️",
    "It's raining so naturally 183 has become a slip-n-slide",
    "Wet roads + Texas drivers = absolutely not. Stay home if you can.",
    "Rain day! Perfect excuse to cancel plans and 'work from home' 😏",
    "Raining. Low water crossings are NOT the move. I know you think your truck can make it. It can't.",
  ],
  
  perfect: [
    "{temp}°F and gorgeous. This is the one (1) nice weather day we get. GO OUTSIDE.",
    "Perfect weather today. Quick, touch grass before it changes tomorrow",
    "Weather's nice which means every patio in town is packed rn",
    "{temp}°F, sunny, no humidity. Screenshot this weather, show your friends who ask why you live in Texas",
    "It's beautiful out. This is not a drill. Leave your house immediately.",
  ],
  
  wind: [
    "Wind's so strong my trash cans have gone on an adventure",
    "Windy enough that I saw a trampoline achieve flight",
    "Wind advisory: secure your stuff or it belongs to the neighborhood now",
  ],
};

// ============================================================================
// EVENTS - The Hype Person (genuinely excited, FOMO-inducing)
// ============================================================================

export const SPICY_EVENT_TEMPLATES = {
  local: [
    "🎟️ {event} at {venue} on {date}. This is the one. You HAVE to go.",
    "{event} tickets are gonna go fast. I'm just saying. Don't @ me when it sells out.",
    "Okay but {event} at {venue}?? {date}?? Who's going because I need a crew",
    "{event} on {date}. I'm manifesting good vibes and available parking 🙏",
    "If you're not going to {event} at {venue}, what ARE you doing with your weekend?",
  ],
  
  distant: [
    "{event} at {venue} is {distance} away but honestly? Worth the drive. {date}.",
    "Road trip alert: {event} on {date} is in {venue} ({distance}). Who's carpooling?",
    "{event} is {distance} away which is far but also... look at that lineup 👀",
  ],
  
  free: [
    "FREE event alert: {event} at {venue}. {date}. Your wallet says you're welcome.",
    "{event} is free and I need everyone to understand what a W that is",
    "Free thing happening: {event}. Don't be the person who says 'I never know what's going on around here'",
  ],
  
  food_event: [
    "{event} at {venue}. Bring your appetite and elastic waistband 🍕",
    "Food event alert: {event} on {date}. Diet starts Monday as usual.",
    "{event} is happening and my only plan is to eat my way through it",
  ],
};

// ============================================================================
// FARMERS MARKET - The Local Food Enthusiast
// ============================================================================

export const SPICY_MARKET_TEMPLATES = {
  open_now: [
    "🥬 {market} is OPEN right now! Best produce, best vibes, go go go",
    "{market} is happening AS WE SPEAK. Who's grabbing the good tomatoes?",
    "Farmers market day! {market} is live. Early bird gets the good peaches 🍑",
    "{market} is open. This is your sign to touch grass AND buy local produce. Two birds.",
  ],
  
  tomorrow: [
    "{market} tomorrow morning! Set your alarm, future you will thank present you",
    "Reminder: {market} is tomorrow. Make a list or you'll end up with random vegetables again",
    "Tomorrow is {market} day. Prepare your reusable bags and your 'I support local' energy",
  ],
  
  recommendation: [
    "Hot tip: the {product} at {market} is unmatched. I will not be taking questions.",
    "If you're at {market}, hit up the {product} vendor. Life changing. Trust.",
    "PSA: {market} has {product} that will make you never buy grocery store stuff again",
  ],
};

// ============================================================================
// LOCAL RETAIL INTEL - Actually useful observations
// ============================================================================

export const SPICY_RETAIL_TEMPLATES = {
  crowded: [
    "HEB parking lot is giving hunger games energy rn. Plan accordingly.",
    "Costco on a Saturday was a CHOICE. I've seen things. Be warned.",
    "Target parking lot: full. My will to live: depleted. But I got my oat milk.",
    "Weekend HEB trip report: survived but at what cost 💀",
  ],
  
  gas: [
    "Costco gas line is {n} cars deep. Is it worth it? Math says yes. My patience says no.",
    "Gas prices looking rough everywhere except Costco but that line is... choices.",
    "Found gas at ${price}. Telling y'all because we're neighbors and neighbors share intel.",
  ],
  
  deals: [
    "HEB is packed in the {item} aisle. Either there's a sale or everyone had the same idea.",
    "Costco is stocked with {item} season vibes. Plan your trip accordingly.",
    "Pro tip: {store} early morning is the move. No crowds, full shelves.",
  ],
};

// ============================================================================
// HOT TAKES - Mildly spicy local opinions that drive engagement
// ============================================================================

export const SPICY_HOT_TAKES = [
  "The {road} vs {road2} commute debate is getting old. They both suck. There.",
  "Hot take: {neighborhood} is overhyped. I said what I said.",
  "Controversial but true: the best {food} in town isn't where you think",
  "I will die on this hill: {local_place} at peak hours is chaos. Go at 2pm.",
  "Nobody talks about how good the sunsets are from {landmark}. Underrated.",
  "Every time I drive past {landmark} I wonder how many people actually know it's there.",
];

// ============================================================================
// COMMUNITY OBSERVATIONS - The nosy neighbor (affectionate)
// ============================================================================

export const SPICY_OBSERVATIONS = [
  "Someone in {neighborhood} is having a party and I can hear the bass from here. Living their best life I guess.",
  "To whoever's dog has been barking for 2 hours: we're all concerned. Is it okay? Are YOU okay?",
  "Spotted a cat just vibing on {street}. Zero urgency. Living the dream.",
  "Someone's learning to play drums in my neighborhood. We're all in this together now.",
  "Heard fireworks or gunshots? Classic {city} guessing game continues.",
  "Power flickered. Now we all check Nextdoor in unison. The ritual.",
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a random template from a category
 */
export function getRandomTemplate(templates: string[]): string {
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Fill in template variables
 */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

/**
 * Generate a spicy traffic post based on conditions
 */
export function generateSpicyTrafficPost(
  traffic: TrafficData,
  roadName: string,
  altRoute?: string
): { message: string; mood: string } {
  const congestion = traffic.congestionLevel;
  
  let templates: string[];
  let mood: string;
  
  if (congestion > 0.6) {
    templates = SPICY_TRAFFIC_TEMPLATES.heavy;
    mood = "😤";
  } else if (congestion > 0.3) {
    templates = SPICY_TRAFFIC_TEMPLATES.moderate;
    mood = "😐";
  } else {
    templates = SPICY_TRAFFIC_TEMPLATES.light;
    mood = "😌";
  }
  
  let message = getRandomTemplate(templates);
  message = fillTemplate(message, { road: roadName, altRoute: altRoute || "side streets" });
  
  return { message, mood };
}

/**
 * Generate a spicy weather post based on conditions
 */
export function generateSpicyWeatherPost(weather: WeatherData): { message: string; mood: string } {
  const { temperature, condition } = weather;
  
  let templates: string[];
  let mood: string;
  
  if (temperature > 95) {
    templates = SPICY_WEATHER_TEMPLATES.hot;
    mood = "🥵";
  } else if (temperature < 40) {
    templates = SPICY_WEATHER_TEMPLATES.cold;
    mood = "🥶";
  } else if (condition === "rain" || condition === "storm") {
    templates = SPICY_WEATHER_TEMPLATES.rain;
    mood = "🌧️";
  } else if (temperature >= 65 && temperature <= 80 && condition === "clear") {
    templates = SPICY_WEATHER_TEMPLATES.perfect;
    mood = "☀️";
  } else {
    // Default to perfect for mild weather
    templates = SPICY_WEATHER_TEMPLATES.perfect;
    mood = "😊";
  }
  
  const message = fillTemplate(getRandomTemplate(templates), { temp: temperature });
  return { message, mood };
}

/**
 * Generate a spicy event post
 */
export function generateSpicyEventPost(
  event: EventData,
  isLocal: boolean = true
): { message: string; mood: string } {
  const templates = isLocal ? SPICY_EVENT_TEMPLATES.local : SPICY_EVENT_TEMPLATES.distant;
  
  const st = event.startTime instanceof Date ? event.startTime : new Date(event.startTime);
  const date = st.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric" 
  });
  
  const message = fillTemplate(getRandomTemplate(templates), {
    event: event.name,
    venue: event.venue,
    date,
    distance: event.distanceMiles ? `${Math.round(event.distanceMiles)} mi` : "nearby",
  });
  
  return { message, mood: "🤩" };
}

/**
 * Generate a spicy farmers market post
 */
export function generateSpicyMarketPost(
  market: FarmersMarketData
): { message: string; mood: string } {
  const templates = market.isOpenToday 
    ? SPICY_MARKET_TEMPLATES.open_now 
    : SPICY_MARKET_TEMPLATES.tomorrow;
  
  const product = market.products[Math.floor(Math.random() * market.products.length)] || "fresh produce";
  
  const message = fillTemplate(getRandomTemplate(templates), {
    market: market.name,
    product,
  });
  
  return { message, mood: "🥬" };
}
