import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Voxlo",
  description: "Privacy Policy for Voxlo - Learn how we collect, use, and protect your data.",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          ← Back to Voxlo
        </Link>

        <h1 className="mb-2 text-4xl font-bold text-white">Privacy Policy</h1>
        <p className="mb-12 text-sm text-slate-500">Effective Date: February 17, 2026</p>

        <div className="space-y-10 leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">1. Introduction</h2>
            <p>
              Welcome to Voxlo (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). Voxlo is a location-based community platform
              accessible at voxlo.app. This Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you use our application. By using Voxlo, you agree to the
              collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">2. Information We Collect</h2>

            <h3 className="mb-2 mt-4 text-lg font-medium text-white">2.1 Account Information</h3>
            <p>
              When you create an account, we collect your <strong className="text-white">email address</strong> solely
              for authentication purposes. We do not require your real name. Each account is assigned an{" "}
              <strong className="text-white">anonymous, auto-generated username</strong>. You are never required to
              provide personally identifiable information beyond your email.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-medium text-white">2.2 Location Data</h3>
            <p>
              Voxlo uses your device&apos;s location to provide location-relevant content. Before storing any
              location data, coordinates are <strong className="text-white">rounded to 2 decimal places</strong>,
              providing approximately 1.1 km (~0.7 mile) precision. We do <strong className="text-white">not</strong>{" "}
              store your exact location. This rounding is applied server-side before being written to our database, ensuring precise coordinates are never persisted.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-medium text-white">2.3 User-Generated Content</h3>
            <p>
              Content you post (&quot;pulses&quot;) is public within the Voxlo app and visible to other users in
              your area. This includes text content, category selections, and the approximate location
              associated with the post.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-medium text-white">2.4 Push Notification Tokens</h3>
            <p>
              If you enable push notifications, we store your device&apos;s push notification token. This token
              is used <strong className="text-white">exclusively</strong> for delivering notifications and is not
              shared with third parties or used for tracking.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-medium text-white">2.5 Cookies &amp; Local Storage</h3>
            <p>
              We use cookies and browser local storage solely for <strong className="text-white">session management</strong>{" "}
              and authentication state. We do not use tracking cookies, advertising cookies, or any
              third-party analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">3. How We Use Your Information</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>To authenticate your account and maintain your session</li>
              <li>To display location-relevant content, events, traffic, and local business information</li>
              <li>To deliver push notifications you have opted into</li>
              <li>To moderate content using AI-powered content review</li>
              <li>To improve and maintain the functionality of the service</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">4. Third-Party Services</h2>
            <p className="mb-4">Voxlo integrates with the following third-party services to provide its functionality:</p>
            <ul className="list-disc space-y-3 pl-6">
              <li>
                <strong className="text-white">Supabase</strong> — Database hosting and user authentication.
                Your email and account data are stored in Supabase&apos;s infrastructure. See{" "}
                <a href="https://supabase.com/privacy" className="text-emerald-500 hover:text-emerald-400 underline" target="_blank" rel="noopener noreferrer">
                  Supabase&apos;s Privacy Policy
                </a>.
              </li>
              <li>
                <strong className="text-white">TomTom</strong> — Provides traffic and road condition data.
                Approximate location coordinates are sent to retrieve local traffic information. No personal
                data is shared.
              </li>
              <li>
                <strong className="text-white">Ticketmaster</strong> — Provides local event listings.
                Approximate location is used to fetch nearby events. No personal data is shared.
              </li>
              <li>
                <strong className="text-white">Google Places</strong> — Provides local business information.
                Approximate location is used to retrieve nearby businesses. No personal data is shared.
              </li>
              <li>
                <strong className="text-white">OpenAI</strong> — Used <strong className="text-white">exclusively for content moderation</strong>.
                Post text is sent to OpenAI for automated review to enforce community guidelines. We do not
                use OpenAI for profiling, advertising, or any purpose other than content safety.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">5. Data Sharing &amp; Sales</h2>
            <p>
              We do <strong className="text-white">not</strong> sell, rent, or trade your personal information to
              third parties. We do not share your data with advertisers. Information is shared with
              third-party services only as described in Section 4, and only to the extent necessary to
              provide the Voxlo service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">6. Data Retention</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong className="text-white">AI-generated content</strong> (traffic updates, event listings,
                local business info, weather, etc.) expires automatically on a rolling basis, typically
                between 2 and 24 hours depending on the content category.
              </li>
              <li>
                <strong className="text-white">User-generated posts</strong> (pulses) are archived over time but
                preserved in our database. They are not permanently deleted unless you request deletion.
              </li>
              <li>
                <strong className="text-white">Account data</strong> (email, username, preferences) is retained
                for the lifetime of your account unless you request deletion.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">7. Data Deletion</h2>
            <p>
              You may request the deletion of your account and all associated data at any time by contacting
              us at{" "}
              <a href="mailto:info@voxlo.app" className="text-emerald-500 hover:text-emerald-400 underline">
                info@voxlo.app
              </a>
              . Upon receiving a verified deletion request, we will remove your personal data from our
              systems within 30 days, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">8. Data Security</h2>
            <p>
              We implement commercially reasonable security measures to protect your data, including
              encrypted connections (TLS/SSL), secure authentication via Supabase, and access controls on
              our infrastructure. However, no method of electronic transmission or storage is 100% secure,
              and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">9. Children&apos;s Privacy</h2>
            <p>
              Voxlo is not directed at children under the age of 13. We do not knowingly collect personal
              information from children under 13. If we become aware that a child under 13 has provided us
              with personal information, we will take steps to delete that information promptly. If you
              believe a child under 13 has provided us with personal data, please contact us at{" "}
              <a href="mailto:info@voxlo.app" className="text-emerald-500 hover:text-emerald-400 underline">
                info@voxlo.app
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise the
              &quot;Effective Date&quot; at the top of this page and, where appropriate, notify you via the app or
              email. Your continued use of Voxlo after any changes constitutes acceptance of the updated
              policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">11. Contact Us</h2>
            <p>
              If you have any questions or concerns about this Privacy Policy or our data practices, please
              contact us at:{" "}
              <a href="mailto:info@voxlo.app" className="text-emerald-500 hover:text-emerald-400 underline">
                info@voxlo.app
              </a>
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-slate-800 pt-8 text-center text-sm text-slate-600">
          © 2026 Voxlo. All rights reserved.
        </div>
      </div>
    </main>
  );
}
