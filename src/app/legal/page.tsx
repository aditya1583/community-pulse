import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal & Attributions — Voxlo",
  description: "Data sources, attributions, and legal disclaimers for Voxlo.",
};

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black tracking-tight mb-8">Legal &amp; Attributions</h1>

      <section className="space-y-6 text-sm text-slate-300 leading-relaxed">
        <div>
          <h2 className="text-base font-bold text-white mb-2">Disclaimer</h2>
          <p className="text-slate-400">
            Voxlo displays user-submitted and AI-generated content. Posts may be inaccurate,
            incomplete, or misleading. Do not rely on this information for safety, travel,
            emergency, or decision-making purposes. All posts reflect the views of individual
            users, not the app&apos;s creators.
          </p>
        </div>

        <div>
          <h2 className="text-base font-bold text-white mb-2">Data Sources</h2>
          <p className="text-slate-400 mb-3">
            Voxlo aggregates real-time data from multiple sources to provide a hyperlocal experience.
          </p>
          <ul className="space-y-2 text-slate-400">
            <li>
              <strong className="text-slate-300">Weather</strong> —{" "}
              <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Open-Meteo</a>
            </li>
            <li>
              <strong className="text-slate-300">Traffic</strong> —{" "}
              <a href="https://www.tomtom.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">TomTom</a>
            </li>
            <li>
              <strong className="text-slate-300">Maps &amp; Geocoding</strong> —{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">OpenStreetMap</a> contributors
            </li>
            <li>
              <strong className="text-slate-300">Events</strong> —{" "}
              <a href="https://www.ticketmaster.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Ticketmaster</a>
            </li>
            <li>
              <strong className="text-slate-300">Places</strong> —{" "}
              <a href="https://foursquare.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Foursquare</a>
            </li>
            <li>
              <strong className="text-slate-300">Gas Prices</strong> —{" "}
              <a href="https://www.eia.gov/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">U.S. Energy Information Administration (EIA)</a>
            </li>
            <li>
              <strong className="text-slate-300">AI Content</strong> —{" "}
              <a href="https://openai.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">OpenAI</a> &amp;{" "}
              <a href="https://www.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Anthropic</a>
            </li>
            <li>
              <strong className="text-slate-300">Trust &amp; Safety</strong> —{" "}
              <a href="https://perspectiveapi.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Google Perspective API</a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-bold text-white mb-2">Contact</h2>
          <p className="text-slate-400">
            Questions? Reach us at{" "}
            <a href="mailto:support@voxlo.app" className="text-emerald-400 hover:underline">support@voxlo.app</a>
          </p>
        </div>
      </section>

      <div className="mt-12 pt-6 border-t border-slate-800">
        <a href="/" className="text-sm text-emerald-400 hover:underline">&larr; Back to Voxlo</a>
      </div>
    </main>
  );
}
