import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Voxlo",
  description: "Terms of Service for Voxlo - Rules and guidelines for using our platform.",
};

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          ← Back to Voxlo
        </Link>

        <h1 className="mb-2 text-4xl font-bold text-white">Terms of Service</h1>
        <p className="mb-12 text-sm text-slate-500">Effective Date: February 17, 2026</p>

        <div className="space-y-10 leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Voxlo (&quot;the Service&quot;), accessible at voxlo.app, you agree to be bound
              by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not use the
              Service. We reserve the right to update these Terms at any time. Continued use of the Service
              after changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">2. Description of Service</h2>
            <p>
              Voxlo is a location-based community platform that allows users to view and share local
              information including user-generated posts (&quot;pulses&quot;), traffic conditions, events, local
              businesses, and other location-relevant content. Some content is generated automatically using
              AI and third-party data sources; other content is created by users.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">3. Accounts &amp; Registration</h2>
            <h3 className="mb-2 mt-4 text-lg font-medium text-white">3.1 Anonymous Accounts</h3>
            <p>
              Voxlo assigns each user an auto-generated anonymous username. You are not required to provide
              your real name. Your email address is collected solely for authentication purposes.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-medium text-white">3.2 Username Changes</h3>
            <p>
              Username changes are limited in frequency to prevent abuse. All usernames are subject to an
              automated profanity filter. Usernames that contain offensive, misleading, or inappropriate
              language may be rejected or reset.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-medium text-white">3.3 Account Security</h3>
            <p>
              You are responsible for maintaining the security of your account credentials. You agree to
              notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">4. User-Generated Content</h2>
            <h3 className="mb-2 mt-4 text-lg font-medium text-white">4.1 Ownership</h3>
            <p>
              You retain ownership of all content you create and post on Voxlo. By posting content, you
              grant Voxlo a worldwide, non-exclusive, royalty-free, transferable license to use, display,
              reproduce, and distribute your content within the Service and for the purpose of operating and
              promoting the Service.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-medium text-white">4.2 Public Visibility</h3>
            <p>
              All pulses (user posts) are public within the Voxlo app and visible to other users in the
              relevant geographic area. Do not post content you wish to keep private.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-medium text-white">4.3 Content Moderation</h3>
            <p>
              All user-generated content is subject to AI-powered content moderation. Posts are reviewed
              automatically across 10 content categories to enforce community standards. Posts that violate
              our guidelines may be <strong className="text-white">rejected before publication</strong> or removed
              after the fact. Moderation decisions are automated and may not always be perfect; if you
              believe your content was incorrectly rejected, contact us at{" "}
              <a href="mailto:info@voxlo.app" className="text-emerald-500 hover:text-emerald-400 underline">
                info@voxlo.app
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">5. Prohibited Content &amp; Conduct</h2>
            <p className="mb-4">You agree not to use the Service to post, transmit, or facilitate any content that:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Constitutes <strong className="text-white">hate speech</strong> or promotes discrimination based on race, ethnicity, gender, religion, sexual orientation, disability, or any other protected characteristic</li>
              <li>Contains <strong className="text-white">harassment</strong>, bullying, intimidation, or targeted abuse of any individual or group</li>
              <li>Includes <strong className="text-white">threats</strong> of violence, self-harm, or harm to others</li>
              <li>Promotes or facilitates <strong className="text-white">illegal activity</strong>, including but not limited to drug trafficking, fraud, or theft</li>
              <li>Constitutes <strong className="text-white">spam</strong>, including repetitive posting, unsolicited advertising, or promotional content</li>
              <li>Contains <strong className="text-white">misleading information</strong> presented as fact, including false emergency reports, fabricated events, or dangerous misinformation</li>
              <li>Infringes on the intellectual property rights of others</li>
              <li>Contains sexually explicit material or content inappropriate for a general audience</li>
              <li>Impersonates another person, entity, or Voxlo staff</li>
              <li>Attempts to circumvent content moderation or platform security measures</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">6. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account, without prior notice, if we
              reasonably believe you have violated these Terms. This includes, but is not limited to,
              posting prohibited content, engaging in abusive behavior, or attempting to manipulate or
              exploit the Service. Upon termination, your right to use the Service ceases immediately. You
              may request deletion of your data in accordance with our{" "}
              <Link href="/privacy" className="text-emerald-500 hover:text-emerald-400 underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">7. Intellectual Property</h2>
            <p>
              The Voxlo name, logo, design, and all original content, features, and functionality of the
              Service are owned by Voxlo and are protected by copyright, trademark, and other intellectual
              property laws. You may not reproduce, distribute, or create derivative works from any part of
              the Service without our express written permission.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">8. Disclaimer of Warranties</h2>
            <p>
              The Service is provided on an <strong className="text-white">&quot;AS IS&quot;</strong> and{" "}
              <strong className="text-white">&quot;AS AVAILABLE&quot;</strong> basis, without warranties of any kind,
              either express or implied, including but not limited to implied warranties of merchantability,
              fitness for a particular purpose, and non-infringement. We do not warrant that the Service
              will be uninterrupted, error-free, or secure. AI-generated content (traffic, events, local
              businesses) is provided for informational purposes only and may not be accurate or current.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">9. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by applicable law, Voxlo and its operators, employees, and
              affiliates shall not be liable for any indirect, incidental, special, consequential, or
              punitive damages, including but not limited to loss of data, profits, or goodwill, arising out
              of or related to your use of or inability to use the Service, regardless of the cause of
              action or the theory of liability.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">10. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Voxlo and its operators from and against any
              claims, liabilities, damages, losses, and expenses (including reasonable attorney&apos;s fees)
              arising out of or in any way connected with your access to or use of the Service, your
              violation of these Terms, or your violation of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">11. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the{" "}
              <strong className="text-white">State of Texas</strong>, United States, without regard to its conflict
              of law provisions. Any disputes arising under or in connection with these Terms shall be
              subject to the exclusive jurisdiction of the state and federal courts located in the State of
              Texas.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">12. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid by a court of
              competent jurisdiction, that provision shall be limited or eliminated to the minimum extent
              necessary, and the remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-emerald-500">13. Contact Us</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at:{" "}
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
