export default function PrivacyPage() {
  return (
    <div className="p-8 text-slate-100 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-sm text-slate-400 mb-6">Last updated: January 2026</p>

      <p className="mb-4">
        Voxlo (&quot;the Service&quot;) values your privacy. This policy explains what information
        we collect and how it is used.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">1. Information We Collect</h2>
      <p className="mb-4">
        The Service stores content you submit, including text, tags, moods, and city selections.
        We do not require account creation and do not collect personal identifiers unless you
        voluntarily include them in a post.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. How We Use Data</h2>
      <p className="mb-4">
        Your submissions are displayed publicly within the app. We may use aggregated,
        non-personal data to improve functionality.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. Third-Party Services</h2>
      <p className="mb-4">
        We use Supabase for data storage and Vercel for hosting. Their privacy policies also apply.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">4. No Tracking / No Ads</h2>
      <p className="mb-4">
        The Service does not use cookies, trackers, or advertising.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">5. Data Removal</h2>
      <p className="mb-4">
        If you wish to remove content you submitted, you may contact us. We may remove content at
        our discretion.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">6. Changes to This Policy</h2>
      <p className="mb-4">
        This policy may change over time. Continued use of the Service means you accept updates.
      </p>

      {/* GDPR Rights Section */}
      <h2 className="text-xl font-semibold mt-8 mb-2 text-emerald-400">
        7. Your Rights Under GDPR (European Union Users)
      </h2>
      <p className="mb-3">
        If you are located in the European Economic Area (EEA), you have the following rights
        regarding your personal data:
      </p>
      <ul className="list-disc list-inside mb-4 space-y-2 text-slate-300">
        <li>
          <strong>Right to Access:</strong> You can request a copy of the personal data we hold
          about you.
        </li>
        <li>
          <strong>Right to Rectification:</strong> You can request correction of inaccurate or
          incomplete data.
        </li>
        <li>
          <strong>Right to Erasure:</strong> You can request deletion of your personal data
          (&quot;right to be forgotten&quot;).
        </li>
        <li>
          <strong>Right to Restrict Processing:</strong> You can request that we limit how we use
          your data.
        </li>
        <li>
          <strong>Right to Data Portability:</strong> You can request your data in a
          machine-readable format.
        </li>
        <li>
          <strong>Right to Object:</strong> You can object to processing of your personal data.
        </li>
      </ul>
      <p className="mb-4 text-slate-400 text-sm">
        <strong>Legal Basis for Processing:</strong> We process data based on legitimate interest
        for providing community features and maintaining service quality.
      </p>

      {/* CCPA Rights Section */}
      <h2 className="text-xl font-semibold mt-8 mb-2 text-emerald-400">
        8. Your Rights Under CCPA (California Users)
      </h2>
      <p className="mb-3">
        If you are a California resident, you have specific rights under the California Consumer
        Privacy Act (CCPA):
      </p>
      <ul className="list-disc list-inside mb-4 space-y-2 text-slate-300">
        <li>
          <strong>Right to Know:</strong> You can request information about what personal data we
          collect, use, and disclose.
        </li>
        <li>
          <strong>Right to Delete:</strong> You can request deletion of your personal information.
        </li>
        <li>
          <strong>Right to Opt-Out of Sale:</strong> We do not sell your personal information to
          third parties.
        </li>
        <li>
          <strong>Right to Non-Discrimination:</strong> You will not receive different treatment
          for exercising your privacy rights.
        </li>
      </ul>
      <p className="mb-4 text-slate-400 text-sm">
        <strong>Notice:</strong> Voxlo does not sell, rent, or trade personal information. We never
        have and never will.
      </p>

      {/* Data Retention */}
      <h2 className="text-xl font-semibold mt-8 mb-2">9. Data Retention</h2>
      <p className="mb-3">We retain different types of data for different periods:</p>
      <ul className="list-disc list-inside mb-4 space-y-2 text-slate-300">
        <li>
          <strong>Pulses (Posts):</strong> Automatically removed after 7 days. This keeps content
          fresh and relevant.
        </li>
        <li>
          <strong>City Selection:</strong> Stored locally in your browser only. We do not track
          your location on our servers.
        </li>
        <li>
          <strong>Account Data:</strong> No accounts are required. We do not store login
          credentials or personal profiles.
        </li>
      </ul>

      {/* Data Processors */}
      <h2 className="text-xl font-semibold mt-8 mb-2">10. Data Processors</h2>
      <p className="mb-3">
        We use the following third-party services to operate Voxlo. Each maintains GDPR-compliant
        data processing agreements:
      </p>
      <ul className="list-disc list-inside mb-4 space-y-2 text-slate-300">
        <li>
          <strong>Supabase</strong> (Database) &ndash;{" "}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            Privacy Policy
          </a>{" "}
          |{" "}
          <a
            href="https://supabase.com/docs/company/terms#data-processing-agreement"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            DPA
          </a>
        </li>
        <li>
          <strong>Vercel</strong> (Hosting) &ndash;{" "}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            Privacy Policy
          </a>{" "}
          |{" "}
          <a
            href="https://vercel.com/legal/dpa"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            DPA
          </a>
        </li>
      </ul>

      {/* Contact for Privacy Requests */}
      <h2 className="text-xl font-semibold mt-8 mb-2">11. Contact for Privacy Requests</h2>
      <p className="mb-3">
        To exercise any of your privacy rights or ask questions about this policy, contact us at:
      </p>
      <p className="mb-4">
        <a
          href="mailto:support@voxlo.app"
          className="text-emerald-400 hover:underline font-medium"
        >
          support@voxlo.app
        </a>
      </p>
      <p className="mb-4 text-slate-400 text-sm">
        <strong>Response Timeline:</strong> We will respond to all privacy requests within 30 days,
        as required by GDPR. For complex requests, we may extend this by an additional 60 days with
        notice.
      </p>

      {/* Children's Privacy */}
      <h2 className="text-xl font-semibold mt-8 mb-2">12. Children&apos;s Privacy (COPPA)</h2>
      <p className="mb-4">
        Voxlo is not intended for use by children under the age of 13. We do not knowingly collect
        personal information from children under 13. If you are a parent or guardian and believe
        your child has provided us with personal information, please contact us at{" "}
        <a
          href="mailto:support@voxlo.app"
          className="text-emerald-400 hover:underline"
        >
          support@voxlo.app
        </a>{" "}
        and we will delete such information promptly.
      </p>

      <p className="text-sm text-slate-500 mt-8 pt-4 border-t border-slate-700">
        If you do not agree with this policy, please stop using the Service.
      </p>
    </div>
  );
}
