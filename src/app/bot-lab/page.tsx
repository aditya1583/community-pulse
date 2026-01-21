"use client";

import { useState, useEffect } from "react";

type BotMode = "generic" | "intelligent";
type Scenario = "traffic" | "rain" | "event";

interface Message {
  role: "user" | "bot";
  content: string;
  mode?: BotMode;
}

const scenarios = {
  traffic: {
    user: "Ugh, stuck on Ronald Reagan again. Not moving.",
    generic: "Current traffic data indicates light congestion in the area. Drive safely!",
    intelligent:
      "It's 8:10 AM. 🕗 The High School drop-off line is backing up onto the main road. Avoid the right lane until you pass Hero Way. 💀",
  },
  rain: {
    user: "Is it raining for anyone else?",
    generic: "The current weather is cloudy with a chance of showers.",
    intelligent:
      "Yep, micro-burst just hit the North side. ⛈️ My sensors show temp dropped 10 degrees in 5 mins. Roll your windows up!",
  },
  event: {
    user: "Why are there so many people downtown?",
    generic: "There are several events happening in the city today.",
    intelligent:
      "The Jazz Fest just let out AND the Tech Mixer is starting at the Hotel. 🎷 + 🤓 = Chaos. Good luck parking.",
  },
};

export default function BotLabPage() {
  const [mode, setMode] = useState<BotMode>("intelligent");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const runScenario = (scenario: Scenario) => {
    const data = scenarios[scenario];

    // Clear messages
    setMessages([]);
    setIsTyping(false);

    // Add user message
    setTimeout(() => {
      setMessages([{ role: "user", content: data.user }]);
    }, 200);

    // Show typing indicator
    setTimeout(() => {
      setIsTyping(true);
    }, 800);

    // Add bot response
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: mode === "intelligent" ? data.intelligent : data.generic,
          mode,
        },
      ]);
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-6 sticky top-0 z-50 backdrop-blur-sm bg-opacity-90">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="text-pink-400">🧠</span> Sentient City Protocol
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Transforming the Bot from &quot;Observer&quot; to &quot;Participant&quot;
            </p>
          </div>
          <div className="flex gap-3">
            <span className="px-3 py-1 rounded-full bg-slate-800 text-xs border border-slate-700 text-slate-300">
              Strategy V2.0
            </span>
            <span className="px-3 py-1 rounded-full bg-purple-500/20 text-xs border border-purple-500/50 text-purple-400 animate-pulse">
              AI Active
            </span>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Section 1: Problem & Simulator */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* The Logic */}
          <div className="space-y-6">
            <div className="bg-slate-900/70 backdrop-blur-sm p-6 rounded-xl border border-slate-800 border-l-4 border-l-pink-500">
              <h2 className="text-xl font-bold text-white mb-2">
                The Authenticity Gap
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Generic bot responses use city-wide averages that{" "}
                <span className="text-pink-400 font-semibold">lie</span>.
                <br />
                <br />
                When a bot says <em>&quot;Traffic is light&quot;</em> because the
                city-wide average is low, but <strong>Ronald Reagan Blvd</strong>{" "}
                is a parking lot due to school drop-off, users lose trust.
                <br />
                <br />
                <strong>The Fix:</strong> The bot needs{" "}
                <strong>Hyper-Local Context</strong> - real road names, actual
                conditions, time awareness.
              </p>
            </div>

            {/* Architecture */}
            <div className="bg-slate-900/70 backdrop-blur-sm p-6 rounded-xl border border-slate-800">
              <h3 className="text-lg font-bold text-white mb-4">
                The &quot;Sentient&quot; Brain Architecture
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center text-xl">
                    📅
                  </div>
                  <div>
                    <h4 className="text-blue-400 font-bold text-sm">
                      Temporal Awareness
                    </h4>
                    <p className="text-xs text-slate-400">
                      Is it a School Day? Rush hour? Concert night? The bot
                      knows.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center text-xl">
                    🗺️
                  </div>
                  <div>
                    <h4 className="text-green-400 font-bold text-sm">
                      Segment-Level Data
                    </h4>
                    <p className="text-xs text-slate-400">
                      Queries specific roads, not city averages. TomTom Traffic
                      API per segment.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center text-xl">
                    💬
                  </div>
                  <div>
                    <h4 className="text-purple-400 font-bold text-sm">
                      Contextual Sass
                    </h4>
                    <p className="text-xs text-slate-400">
                      Don&apos;t apologize. Commiserate. Use real landmarks and
                      slang.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* The Simulator */}
          <div className="bg-slate-900/70 backdrop-blur-sm p-6 rounded-xl border border-slate-800 flex flex-col h-[500px]">
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
              <h3 className="font-bold text-white">Simulation Lab</h3>
              <div className="flex gap-2 bg-slate-950 p-1 rounded-lg">
                <button
                  onClick={() => setMode("generic")}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${mode === "generic"
                    ? "bg-slate-700 text-slate-300"
                    : "text-slate-500 hover:text-white"
                    }`}
                >
                  Generic Bot
                </button>
                <button
                  onClick={() => setMode("intelligent")}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${mode === "intelligent"
                    ? "bg-pink-500 text-white font-bold shadow-lg shadow-pink-500/20"
                    : "text-slate-500 hover:text-white"
                    }`}
                >
                  Intelligent Bot
                </button>
              </div>
            </div>

            {/* Chat Window */}
            <div className="flex-grow overflow-y-auto space-y-4 pr-2 mb-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                    } animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  {msg.role === "user" ? (
                    <div className="bg-slate-700 text-white px-4 py-2 rounded-l-xl rounded-tr-xl max-w-[80%] text-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="flex items-end gap-2">
                      <div
                        className={`w-6 h-6 rounded-full ${msg.mode === "intelligent"
                          ? "bg-pink-500 shadow-lg shadow-pink-500/50"
                          : "bg-slate-600"
                          } flex items-center justify-center text-[10px]`}
                      >
                        🤖
                      </div>
                      <div
                        className={`px-4 py-2 rounded-r-xl rounded-tl-xl max-w-[85%] text-sm shadow-md ${msg.mode === "intelligent"
                          ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-300"
                          : "bg-slate-800 text-slate-300"
                          }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-slate-800 text-slate-400 px-4 py-3 rounded-r-xl rounded-tl-xl text-xs italic flex items-center gap-1">
                    <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce"></span>
                    <span
                      className="w-1 h-1 bg-slate-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></span>
                    <span
                      className="w-1 h-1 bg-slate-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></span>
                  </div>
                </div>
              )}
            </div>

            {/* Scenario Buttons */}
            <div className="mt-auto pt-4 border-t border-slate-700">
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => runScenario("traffic")}
                  className="whitespace-nowrap px-3 py-1 rounded-full border border-slate-600 text-xs text-slate-300 hover:bg-slate-800 hover:border-blue-500 transition"
                >
                  🚗 The &quot;Reagan&quot; Commute
                </button>
                <button
                  onClick={() => runScenario("rain")}
                  className="whitespace-nowrap px-3 py-1 rounded-full border border-slate-600 text-xs text-slate-300 hover:bg-slate-800 hover:border-blue-500 transition"
                >
                  ⛈️ Sudden Rain
                </button>
                <button
                  onClick={() => runScenario("event")}
                  className="whitespace-nowrap px-3 py-1 rounded-full border border-slate-600 text-xs text-slate-300 hover:bg-slate-800 hover:border-blue-500 transition"
                >
                  🎸 Concert Night
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: The "Weird" Features */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            4 &quot;Weirdly Capable&quot; Features to Build
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              emoji="🕵️"
              title="The &quot;Fact Check&quot;"
              description={`Bot doesn't just reply; it validates. User: "Traffic sucks!" Bot: *Checks API* "Actually, average speed is 55mph. Are you just stuck behind a tractor?"`}
              tech="Google Traffic API"
              color="pink"
            />

            <FeatureCard
              emoji="📢"
              title="The &quot;Solicitor&quot;"
              description={`Bot initiates the pulse. Bot detects rain via Weather API. Bot Posts: "Radar shows hail in Leander. Can anyone confirm? @User_NorthSide?"`}
              tech="Open-Meteo + Push"
              color="blue"
            />

            <FeatureCard
              emoji="🔮"
              title="Context Injection"
              description={`User: "Why is it so busy?" Bot: "It's 8am + School Zone. It's the 'Mom Armada'. Avoid Main St until 8:45."`}
              tech="Custom Calendar DB"
              color="green"
            />

            <FeatureCard
              emoji="👻"
              title="The &quot;Ghost&quot; User"
              description="Treat the Bot as a user in the DB. It earns XP. It gets badges. Users can &apos;Out-Vibe&apos; the bot. It creates a rival, not a tool."
              tech="Gamification Logic"
              color="purple"
            />
          </div>
        </section>

        {/* Section 3: Implementation Stack */}
        <section className="bg-slate-900/70 backdrop-blur-sm p-6 rounded-xl border border-slate-800">
          <h3 className="text-xl font-bold text-white mb-4">
            Implementation: The &quot;Realism&quot; Stack
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <h4 className="font-bold text-blue-400">
                1. Data Sources (The Eyes)
              </h4>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    <strong>School Calendar JSON:</strong> Hardcode local school
                    drop-off/pickup times.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    <strong>TomTom / Mapbox:</strong> Use their &quot;Flow Segment&quot;
                    API, not just general tiles.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    <strong>Event Brite / TM:</strong> Know when doors open
                    (traffic spikes) vs when show starts.
                  </span>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-pink-400">
                2. The Logic (The Brain)
              </h4>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    <strong>Before Reply Hook:</strong> Inject context:
                    CurrentTime: 8:15am, Status: School_Rush, Weather: Raining.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    <strong>Geofence Triggers:</strong> If Pulse is inside
                    &quot;School Zone Geofence&quot; during &quot;Active Hours,&quot; append warning.
                  </span>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-green-400">
                3. The Tone (The Voice)
              </h4>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    <strong>System Prompt:</strong> &quot;You are a cynical but
                    helpful local. You know the roads are bad. You don&apos;t speak
                    like a robot.&quot;
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    <strong>Format:</strong> Use emojis, slang, and short
                    sentences. No paragraphs.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}

interface FeatureCardProps {
  emoji: string;
  title: string;
  description: string;
  tech: string;
  color: "pink" | "blue" | "green" | "purple";
}

function FeatureCard({
  emoji,
  title,
  description,
  tech,
  color,
}: FeatureCardProps) {
  const colorClasses = {
    pink: "text-pink-400",
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-purple-400",
  };

  return (
    <div className="bg-slate-900/70 backdrop-blur-sm p-5 rounded-xl border border-slate-800 hover:bg-slate-800 transition duration-300 group cursor-pointer">
      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
        {emoji}
      </div>
      <h3 className={`text-lg font-bold ${colorClasses[color]}`}>{title}</h3>
      <p className="text-xs text-slate-400 mt-2 h-24 leading-relaxed">
        {description}
      </p>
      <div className="mt-4 pt-4 border-t border-slate-700">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          Tech: {tech}
        </span>
      </div>
    </div>
  );
}
