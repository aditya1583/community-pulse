import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Voxlo",
  description: "Voxlo Privacy Policy",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-black text-white font-[family-name:var(--font-outfit)]">
      <div className="max-w-[800px] mx-auto px-6 py-12">
        <Link href="/" className="text-gray-400 hover:text-white text-sm mb-8 inline-block">
          ← Back to Voxlo
        </Link>

        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-400 mb-10">Effective Date: February 17, 2026</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <p>
            Voxlo (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates a hyperlocal community application that connects nearby users through anonymous posts called &quot;pulses.&quot; This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our mobile application and related services (collectively, the &quot;Service&quot;).
          </p>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">1. Information We Collect</h2>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">Location Data</h3>
            <p>We collect your device&apos;s GPS coordinates to deliver nearby content within an approximate 10-mile radius. Your precise location is used to determine your geographic area but is generalized before being stored. We do not maintain a continuous log of your movements.</p>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">User-Generated Content</h3>
            <p>Posts (&quot;pulses&quot;), comments, and emoji reactions you create are stored on our servers along with the approximate location and timestamp of creation.</p>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">Account Information</h3>
            <p>Voxlo supports anonymous and pseudonymous accounts. We do not require your real name. We may collect an email address or third-party authentication token for account recovery purposes, along with a user-chosen display name or handle.</p>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">Device Information</h3>
            <p>We automatically collect device type, operating system version, unique device identifiers, language settings, and app version to maintain and improve the Service.</p>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">Usage Data</h3>
            <p>We collect information about how you interact with the Service, including features used, content viewed, session duration, and crash reports.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Deliver location-relevant pulses, comments, and reactions from nearby users</li>
              <li>Generate and display AI-powered community content (weather updates, traffic conditions, local events)</li>
              <li>Moderate content to enforce our Community Guidelines and Terms of Service</li>
              <li>Send push notifications about nearby activity and relevant updates</li>
              <li>Improve, personalize, and optimize the Service</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">3. AI-Generated Content</h2>
            <p>Voxlo uses artificial intelligence to generate community content, including weather summaries, traffic updates, and local event highlights. This content is created by automated systems (&quot;bot posts&quot;) and is clearly labeled as such within the app. AI is also used to generate summaries and insights from aggregated, anonymized community activity. AI-generated content is provided for informational purposes only and should not be relied upon as professional advice.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">4. Content Moderation</h2>
            <p>We use a combination of automated systems and manual review to moderate content on Voxlo. Automated moderation powered by AI scans posts and comments for violations of our Community Guidelines, including hate speech, threats, harassment, spam, and sharing of personally identifiable information. Content flagged by automated systems may be blocked, removed, or escalated for human review. If your content is moderated, you may appeal the decision through the in-app appeals process.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">5. Third-Party Services</h2>
            <p>We share limited data with the following third-party service providers to operate the Service:</p>

            <ul className="space-y-4 mt-4">
              <li>
                <strong className="text-white">Supabase</strong> — Provides our database infrastructure and authentication services. Stores account data, posts, and app data.
              </li>
              <li>
                <strong className="text-white">TomTom</strong> — Provides traffic data for AI-generated traffic updates. Receives generalized location coordinates to return relevant traffic information.
              </li>
              <li>
                <strong className="text-white">Ticketmaster</strong> — Provides local event data. Receives generalized location data to return nearby events.
              </li>
              <li>
                <strong className="text-white">Google Places</strong> — Provides location and place data. Receives location coordinates to return nearby place information.
              </li>
              <li>
                <strong className="text-white">OpenAI</strong> — Powers content moderation and AI-generated summaries. Receives post text for moderation analysis and aggregated data for content generation. We do not send your identity or precise location to OpenAI.
              </li>
              <li>
                <strong className="text-white">Apple Push Notification Service (APNs)</strong> — Delivers push notifications to your device. Receives a device token and notification content.
              </li>
              <li>
                <strong className="text-white">Vercel</strong> — Hosts our web application and serverless functions. Processes requests and may log IP addresses and request metadata.
              </li>
            </ul>

            <p className="mt-4">Each third-party provider operates under its own privacy policy. We encourage you to review their policies.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">6. Data Retention</h2>
            <p>User-generated posts, comments, and reactions are retained indefinitely unless you request deletion. When content is removed (by you or through moderation), it is archived and removed from public view but may be retained in our systems for legal compliance and abuse prevention purposes.</p>
            <p className="mt-2">AI-generated bot posts (weather, traffic, events) are ephemeral and automatically expire after a set period, typically 24 to 72 hours.</p>
            <p className="mt-2">Account data is retained for as long as your account is active. If you delete your account, we will remove your personal data within 30 days, except where retention is required by law.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li><strong className="text-white">Access</strong> — Request a copy of the personal data we hold about you</li>
              <li><strong className="text-white">Deletion</strong> — Request that we delete your personal data and account</li>
              <li><strong className="text-white">Data Export</strong> — Request a portable copy of your data in a machine-readable format</li>
              <li><strong className="text-white">Correction</strong> — Request correction of inaccurate personal data</li>
              <li><strong className="text-white">Opt-Out</strong> — Opt out of push notifications or location tracking through your device settings</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, contact us at <a href="mailto:info@voxlo.app" className="text-blue-400 hover:underline">info@voxlo.app</a>.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">8. Data Deletion Process</h2>
            <p>To request deletion of your account and associated data:</p>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li>Send an email to <a href="mailto:info@voxlo.app" className="text-blue-400 hover:underline">info@voxlo.app</a> from the email associated with your account, or include your username/account identifier</li>
              <li>Include &quot;Data Deletion Request&quot; in the subject line</li>
              <li>We will verify your identity and process the request within 30 days</li>
              <li>You will receive confirmation once deletion is complete</li>
            </ol>
            <p className="mt-2">Please note that some data may be retained in anonymized or aggregated form, and certain data may be retained as required by law or for legitimate business purposes such as fraud prevention.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">9. Children&apos;s Privacy</h2>
            <p>Voxlo is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected data from a child under 13, we will take steps to delete that information promptly. If you believe a child under 13 has provided us with personal information, please contact us at <a href="mailto:info@voxlo.app" className="text-blue-400 hover:underline">info@voxlo.app</a>.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">10. Location Data</h2>
            <p>Location data is central to how Voxlo works. Here is how we handle it:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>We request location permission when you first use the app</li>
              <li>Your GPS coordinates are used to determine which pulses to show you (within approximately a 10-mile radius)</li>
              <li>Precise coordinates are generalized before storage — we do not store your exact GPS position with your posts</li>
              <li>Location data is sent to third-party services (TomTom, Ticketmaster, Google Places) in generalized form to provide local content</li>
              <li>You can revoke location permission at any time through your device settings, though this will limit the functionality of the Service</li>
              <li>We do not sell your location data to third parties</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">11. Push Notifications</h2>
            <p>We may send push notifications about nearby activity, new pulses, reactions to your content, and community updates. You can manage notification preferences within the app or disable them entirely through your device settings. Push notifications are delivered through Apple Push Notification Service (APNs), which requires a device token. This token does not reveal your personal identity.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">12. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. When we make material changes, we will notify you through the app or by other appropriate means. Your continued use of the Service after changes take effect constitutes your acceptance of the revised policy. We encourage you to review this page periodically.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">13. Contact Us</h2>
            <p>If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:</p>
            <p className="mt-2">
              <a href="mailto:info@voxlo.app" className="text-blue-400 hover:underline">info@voxlo.app</a>
            </p>
          </section>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-6 text-center text-gray-500 text-sm">
          © 2026 Voxlo. All rights reserved.
        </div>
      </div>
    </main>
  );
}
