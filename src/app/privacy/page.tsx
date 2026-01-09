export default function PrivacyPage() {
  return (
    <div className="p-8 text-slate-100 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>

      <p className="mb-4">
        Voxlo ("the Service") values your privacy. This policy explains what information
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
        The MVP does not use cookies, trackers, or advertising.
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

      <p className="text-sm text-slate-500 mt-6">
        If you do not agree with this policy, please stop using the Service.
      </p>
    </div>
  );
}
