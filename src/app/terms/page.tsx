import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Voxlo",
  description: "Voxlo Terms of Service",
};

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-black text-white font-[family-name:var(--font-outfit)]">
      <div className="max-w-[800px] mx-auto px-6 py-12">
        <Link href="/" className="text-gray-400 hover:text-white text-sm mb-8 inline-block">
          ← Back to Voxlo
        </Link>

        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-400 mb-10">Effective Date: February 17, 2026</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using the Voxlo application and related services (the &quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Service. We may update these Terms from time to time, and your continued use constitutes acceptance of any changes.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>Voxlo is a hyperlocal community application that allows users to create and view anonymous posts (&quot;pulses&quot;) from people nearby, within an approximate 10-mile radius. The Service also provides AI-generated community content including weather updates, traffic conditions, and local event information. Users can interact with content through emoji reactions and comments.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">3. User Accounts</h2>
            <p>Voxlo supports anonymous and pseudonymous accounts. You are not required to provide your real name to use the Service. You may create an account using an email address or third-party authentication provider. You are responsible for maintaining the security of your account credentials. Each person may maintain only one active account. We reserve the right to suspend or terminate accounts that violate these Terms.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">4. User Content &amp; Conduct</h2>
            <p>You retain ownership of the content you post on Voxlo. By posting content, you grant us a non-exclusive, worldwide, royalty-free license to use, display, reproduce, and distribute your content in connection with operating and promoting the Service.</p>

            <p className="mt-3">You agree not to post content or engage in conduct that:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>Contains hate speech, slurs, or content that promotes discrimination based on race, ethnicity, gender, religion, sexual orientation, disability, or other protected characteristics</li>
              <li>Contains threats of violence or promotes harm against any individual or group</li>
              <li>Constitutes harassment, bullying, or targeted abuse of other users</li>
              <li>Is spam, including repetitive posts, unsolicited advertising, or promotional content</li>
              <li>Shares personally identifiable information (PII) of others without their consent, including real names, addresses, phone numbers, or photos</li>
              <li>Contains sexually explicit material or material exploiting minors</li>
              <li>Promotes illegal activities or facilitates the commission of crimes</li>
              <li>Impersonates another person, entity, or Voxlo staff</li>
              <li>Attempts to manipulate, interfere with, or reverse-engineer the Service</li>
            </ul>

            <p className="mt-3">Violations may result in content removal, account suspension, or permanent ban at our sole discretion.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">5. Content Moderation</h2>
            <p>Voxlo employs automated content moderation systems powered by artificial intelligence to detect and block content that violates our Community Guidelines. Content may be automatically removed or held for review before being published.</p>
            <p className="mt-2">If your content is removed or your account is actioned, you may submit an appeal through the in-app appeals process or by contacting <a href="mailto:info@voxlo.app" className="text-blue-400 hover:underline">info@voxlo.app</a>. We will review appeals within a reasonable timeframe and notify you of the outcome. Our moderation decisions are final after the appeals process is exhausted.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">6. AI-Generated Content</h2>
            <p>The Service includes content generated by artificial intelligence systems, including but not limited to weather summaries, traffic updates, local event highlights, and community insights. This content is produced by automated &quot;bot&quot; accounts and is labeled accordingly.</p>
            <p className="mt-2"><strong className="text-white">Disclaimer:</strong> AI-generated content is provided for general informational and entertainment purposes only. It may contain inaccuracies, errors, or outdated information. AI-generated content does not constitute professional advice of any kind, including but not limited to legal, medical, financial, safety, or travel advice. You should independently verify any information before relying on it. Voxlo is not liable for any decisions made or actions taken based on AI-generated content.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">7. Location-Based Features</h2>
            <p>Voxlo&apos;s core functionality depends on access to your device&apos;s location. By using the Service, you consent to the collection and use of your location data as described in our <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>. Location data is used to show you nearby pulses and deliver relevant local content. You may revoke location permission through your device settings at any time, but doing so will significantly limit the functionality of the Service. We generalize your coordinates before storage and do not track your movements.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">8. Intellectual Property</h2>
            <p>The Voxlo name, logo, application design, underlying code, AI models, and all associated intellectual property are owned by Voxlo and protected by applicable intellectual property laws. You may not copy, modify, distribute, sell, or create derivative works based on the Service or any part thereof without our prior written consent. User-generated content remains the property of the respective users, subject to the license granted in Section 4.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">9. Privacy</h2>
            <p>Your use of the Service is also governed by our <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>, which describes how we collect, use, and protect your information. By using the Service, you consent to the data practices described in the Privacy Policy.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">10. Disclaimers &amp; Limitation of Liability</h2>
            <p className="uppercase text-sm tracking-wide">The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
            <p className="mt-3">Voxlo does not warrant that the Service will be uninterrupted, error-free, or secure. We are not responsible for any user-generated content posted on the platform.</p>
            <p className="mt-3">To the maximum extent permitted by applicable law, Voxlo and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, use, or goodwill, arising out of or related to your use of the Service, whether based on warranty, contract, tort (including negligence), or any other legal theory, even if we have been advised of the possibility of such damages.</p>
            <p className="mt-3">Our total liability for any claims arising under these Terms shall not exceed the amount you paid us, if any, in the twelve (12) months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">11. Termination</h2>
            <p>You may stop using the Service and delete your account at any time. We reserve the right to suspend or terminate your account and access to the Service at our sole discretion, with or without notice, for conduct that we determine violates these Terms, is harmful to other users, or is otherwise objectionable. Upon termination, your right to use the Service ceases immediately. Provisions of these Terms that by their nature should survive termination shall survive, including ownership, warranty disclaimers, indemnification, and limitations of liability.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">12. Governing Law</h2>
            <p>These Terms shall be governed by and construed in accordance with the laws of the State of Texas, United States of America, without regard to its conflict of law provisions. Any disputes arising from or relating to these Terms or the Service shall be resolved exclusively in the state or federal courts located in Texas. You consent to the personal jurisdiction of such courts.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">13. Changes to These Terms</h2>
            <p>We may revise these Terms at any time by posting the updated version on this page with a new effective date. Material changes will be communicated through the app or other appropriate means. Your continued use of the Service after revised Terms take effect constitutes your acceptance of the changes. If you do not agree with the revised Terms, you must stop using the Service.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">14. Contact Us</h2>
            <p>If you have any questions about these Terms of Service, please contact us at:</p>
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
