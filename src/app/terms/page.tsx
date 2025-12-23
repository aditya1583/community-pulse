"use client";

import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition mb-4"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Community Pulse
          </Link>
          <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
          <p className="text-sm text-slate-500 mt-2">
            Last updated: December 2024
          </p>
        </div>

        <div className="space-y-8">
          {/* Data Sources Disclosure */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              1. Data Sources Disclosure
            </h2>
            <p className="mb-3">
              Community Pulse aggregates data from multiple third-party sources:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 ml-4">
              <li>
                <strong className="text-slate-300">Weather data</strong> provided
                by OpenWeather API
              </li>
              <li>
                <strong className="text-slate-300">Event information</strong>{" "}
                sourced from Ticketmaster API
              </li>
              <li>
                <strong className="text-slate-300">News articles</strong> via
                Currents API and other news aggregators
              </li>
              <li>
                <strong className="text-slate-300">AI-powered features</strong>{" "}
                powered by Anthropic Claude
              </li>
            </ul>
            <p className="mt-3 text-sm text-slate-500">
              We are not responsible for the accuracy or availability of
              third-party data.
            </p>
          </section>

          {/* User-Generated Content */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              2. User-Generated Content
            </h2>
            <p className="mb-3">
              The Service displays content submitted by users (&ldquo;Pulses&rdquo;). We do
              not verify the accuracy or reliability of any user submissions.
              You understand and agree that:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 ml-4">
              <li>
                All content represents the views of individual users, not the
                Service
              </li>
              <li>
                Information may be inaccurate, incomplete, or misleading
              </li>
              <li>
                You should not rely on pulses for safety, travel, emergency, or
                decision-making purposes
              </li>
            </ul>
          </section>

          {/* Third-Party Links */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              3. Third-Party Links
            </h2>
            <p>
              The Service may contain links to third-party websites, including
              news articles, event pages, and external resources. We are not
              responsible for the content, privacy policies, or practices of any
              third-party sites. Clicking external links is at your own risk.
            </p>
          </section>

          {/* Location Data */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              4. Location Data Usage
            </h2>
            <p className="mb-3">
              The Service uses location data to provide localized content:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 ml-4">
              <li>City selection is stored locally in your browser</li>
              <li>
                We do not track or store your precise GPS location
              </li>
              <li>
                Location-based features (weather, events, news) use your
                selected city
              </li>
            </ul>
          </section>

          {/* Content Moderation */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              5. Content Moderation
            </h2>
            <p className="mb-3">
              We employ automated moderation to filter inappropriate content.
              You agree not to post:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 ml-4">
              <li>Harmful, violent, or threatening content</li>
              <li>Illegal or defamatory material</li>
              <li>Spam, advertisements, or promotional content</li>
              <li>Personal information of others without consent</li>
              <li>Content that violates any applicable laws</li>
            </ul>
            <p className="mt-3 text-sm text-slate-500">
              We reserve the right to remove content and restrict access at our
              discretion.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              6. Data Retention
            </h2>
            <p className="mb-3">
              Your data is handled as follows:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 ml-4">
              <li>
                Pulses are retained for 7 days and then automatically removed
                from public view
              </li>
              <li>
                Account data is retained until you delete your account
              </li>
              <li>
                Anonymous usage data may be collected for service improvement
              </li>
            </ul>
          </section>

          {/* Disclaimer */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              7. Disclaimer
            </h2>
            <p className="mb-3">
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND.
              We specifically disclaim:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 ml-4">
              <li>Any warranty of accuracy or reliability</li>
              <li>Fitness for any particular purpose</li>
              <li>Uninterrupted or error-free service</li>
            </ul>
            <p className="mt-3">
              Information should not be interpreted as professional advice,
              including but not limited to traffic, safety, legal, medical, or
              emergency advice.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              8. Limitation of Liability
            </h2>
            <p>
              In no event shall the Service or its creators be liable for any
              direct, indirect, incidental, special, consequential, or punitive
              damages arising from your use of or inability to use the Service.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              9. Governing Law
            </h2>
            <p>
              These terms are governed by applicable U.S. laws. Any disputes
              will be handled in accordance with applicable jurisdiction.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              10. Contact
            </h2>
            <p>
              If you have questions about these terms, please discontinue use
              of the Service. For general inquiries, contact us through the
              appropriate channels.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-800">
          <p className="text-xs text-slate-500 text-center">
            By using Community Pulse, you agree to these Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}
