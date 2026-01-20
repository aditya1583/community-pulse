# Voxlo: The Hyperlocal "Vibe" Engine

**Voxlo (formerly Community Pulse)** is a next-generation local intelligence platform designed to capture the real-time "pulse" of a community. Unlike traditional maps or review sites that rely on static data, Voxlo focuses on **ephemeral, time-sensitive, and emotionally resonant** updates—the "vibes" of a specific 10-mile radius.

---

## 🎯 Core Purpose: The "Waze for Lifestyle"

The primary objective of Voxlo is to create a living, breathing dashboard of a city that feels **alive**. It answers the question: *"What does it feel like to be in [City Name] right now?"*

It achieves this by aggregating:
*   **Real-time Traffic:** Is the commute hell right now?
*   **Hyperlocal Weather:** Is it actually raining on *my* street? (Micro-climates)
*   **Live Events:** What's happening *tonight* that I shouldn't miss?
*   **Community Sentiment:** Are people frustrated, excited, or chill?
*   **Market Intelligence:** Who has the best produce at the farmers market *today*?

The app is built on the philosophy of **Strict Local Trust**:
*   **10-Mile Radius Rule:** Content is hyper-focused. No noise from the next town over.
*   **Ephemeral Content:** Old news is bad news. Updates expire (Traffic: 1.5h, Weather: 3h) to ensure the feed is always fresh.
*   **Verified Vibes:** A gamified "Trust Score" system (Local Hero, Trusted Local) rewards users for accurate reporting.

---

## 🧠 Intelligent Automation (The "Ghost in the Machine")

Voxlo is powered by a sophisticated **Intelligent Bot System** that ensures the feed is never empty ("Cold Start" problem solver) and always valuable.

### 1. Bot Personas
The system uses distinct AI personas to inject personality into data:
*   **Traffic Grump (😤):** Vents about congestion (relatable frustration).
*   **Event Promoter (🤩):** Hypes up local concerts and festivals.
*   **Weather Watcher (😊):** meaningful advice (e.g., "Bring plants inside, freeze warning!").
*   **Market Scout (🥕):** Specialized in farmers markets, identifying specific vendors and products.
*   **Oracle Bot (🔮):** Posts XP-staked predictions (e.g., "Will rain stop by 5 PM?") to drive engagement.

### 2. Contextual Intelligence
The bots don't just post templates; they analyze **Situation Context**:
*   *Is it raining?* -> Suggest cozy cafes or indoor activities.
*   *Is it Friday night?* -> Hype up nightlife and happy hours.
*   *Is traffic terrible?* -> Complain about specific roads (e.g., "Ronald Reagan Blvd is a parking lot").

---

## 🛠 Technical Architecture

**Stack:**
*   **Frontend:** Next.js (React), Tailwind CSS (Neon/Dark Mode aesthetic).
*   **Backend:** Next.js API Routes, Supabase (PostgreSQL + Realtime).
*   **AI/LLM:** OpenAI API (for dynamic content generation and summaries).
*   **Data Sources:** Ticketmaster (Events), TomTom (Traffic), Open-Meteo (Weather), USDA/OSM (Farmers Markets).

**Key Systems:**
1.  **Pulse System:** The core data unit. A "Pulse" is a short location-based update with a Mood, Tag (Traffic/Weather/etc), and Expiry.
2.  **Auto-Seed Engine:** A proactive background service that detects "stale" cities (empty feeds) and instantly populates them with fresh, real-world data derived from APIs.
3.  **Gamification:** Users earn XP and Badges (e.g., "Local Hero") for confirming vibes and winning predictions.
4.  **Content Decay:** A strict cleanup mechanism (CLIENT-SIDE and DB-SIDE) that hides content once it loses relevance to maintain "Now-ness".

---

## 🎨 Design Philosophy

*   **Cyber-Local Aesthetic:** Dark mode, neon accents, glassmorphism. It feels premium and modern, not corporate.
*   **Emoji-First:** Heavily utilizes emojis to convey emotion and category instantly.
*   **Map-Centric implies, Text-First delivers:** While location is key, the UI prioritizes the *narrative* feed of what's happening over just pins on a map.

---

## 🚀 Vision

Voxlo encourages users to disconnect from global noise and reconnect with their immediate physical reality. It turns the mundane (traffic, weather, grocery runs) into a shared community experience, fostering a sense of belonging and "in-the-know" status for its users.
