// "use client";

// import React, { useEffect, useState } from "react";
// import NextLink from "next/link";
// import Footer from "@/components/common/Footer";
// import { post } from "@/lib/api";

// interface Policy {
//   policyType: string;
//   effectiveDate: string;
//   content: string;
// }

// export default function PrivacyPolicy() {
//   const [policy, setPolicy] = useState<Policy | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     (async () => {
//       try {
//         const res = await post<Policy>('/policy/getlist', { policyType: 'Privacy Policy' });
//         setPolicy(res);
//       } catch (e) {
//         console.error(e);
//         setError('Failed to load privacy policy.');
//       }
//     })();
//   }, []);

//   return (
//     <div className="flex flex-col min-h-screen bg-white text-gray-900">
//       {/* Header */}
//       <header className="fixed inset-x-0 top-0 bg-white shadow-sm z-50">
//         <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-2">
//           <NextLink href="/" className="flex items-center gap-2">
//             <img src="/logo.png" alt="Collabglam Logo" className="h-8 w-auto" />
//             <span className="text-lg font-bold text-gray-800">Collabglam</span>
//           </NextLink>
//         </div>
//       </header>

//       {/* Spacer for fixed header */}
//       <div className="h-14" aria-hidden="true" />

//       {/* Content */}
//       <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-12">
//         <h1 className="text-2xl font-semibold mb-2">Privacy Policy</h1>
//         {error ? (
//           <p className="text-center text-red-600">{error}</p>
//         ) : !policy ? (
//           <p className="text-center">Loading privacy policy…</p>
//         ) : (
//           <>            
//             <p className="mb-4 text-sm text-gray-600">
//               Effective Date: {policy.effectiveDate.split('T')[0]}
//             </p>
//             <article className="prose max-w-none">
//               <div style={{ whiteSpace: 'pre-wrap' }}>{policy.content}</div>
//             </article>
//           </>
//         )}
//       </main>

//       <Footer />
//     </div>
//   );
// }

"use client";

import React from "react";
import NextLink from "next/link";
import Footer from "@/components/common/Footer";

interface Policy {
  policyType: string;
  effectiveDate: string;
  content: string;
}

const HARD_CODED_POLICY: Policy = {
  policyType: "Privacy Policy",
  effectiveDate: "2025-07-14",
  content: `

This Privacy Policy explains how Meru Land Private (00 Radha Rani place, Raman Reiti, Vrindaban, Mathura, Mathura, Uttar Pradesh, India, 281121) (collectively “Company,” “we,” “us” or “our”) collect, use, disclose and protect personal information when you use https://collabglam.com and related services.

Information We Collect
2.1 Account Information: name, email address, password, OTP verification codes.
2.2 Payment Information: billing details processed through Razorpay, Stripe, etc. We do not store full card data.
2.3 Usage Data: log data (IP address, browser type, pages visited, timestamps).
2.4 Cookies and Tracking: strictly necessary cookies for login, analytics cookies (Google Analytics), marketing cookies for email campaigns, and preference cookies.

How We Use Information
3.1 To provide and improve our Engagement Services.
3.2 To process payments and prevent fraud.
3.3 To communicate account alerts, service updates and marketing messages (you may opt out).
3.4 To comply with legal obligations and enforce our Terms of Use.

Disclosure of Information
4.1 Service Providers: payment processors, hosting, analytics, email marketing.
4.2 Legal Requirements: when required by law, court order or government request.
4.3 Business Transfers: in connection with a merger, acquisition or sale of assets.
4.4 Third-Party Platforms: we do not share your credentials with YouTube, Instagram or other platforms.

International Data Transfers
Your information may be transferred to and stored in the United States, India or other countries. We implement safeguards to protect data in transit and at rest.

Data Retention
We retain personal information for as long as necessary to provide services, comply with legal obligations and resolve disputes. Usage data may be retained for up to two years.

Your Rights
7.1 Access and Correction: you may request a copy of or corrections to your personal data.
7.2 Deletion: you may request deletion of your account (subject to legal retention requirements).
7.3 Marketing Opt-Out: you may unsubscribe from promotional emails at any time by following the link in those emails.

Security
We use administrative, technical and physical safeguards to protect your data against unauthorized access, disclosure or destruction.

Third-Party Services
Our Site may link to or embed content from third parties. We are not responsible for their privacy practices. Please review their policies before interacting.

Cookies and Tracking
You can disable cookies via your browser settings, but this may affect Site functionality. For details, see our Cookie Policy.

Children
Our services are not intended for persons under 18. We do not knowingly collect information from minors.

Changes to This Policy
We may update this Policy by posting a new version on the Site with a revised “Last updated” date. Continued use after changes constitutes acceptance.

Contact Information
For privacy questions or to exercise your rights, contact us at:
Email: care@collabglam.com

Mailing addresses:
Meru Land Private (00 Radha Rani place, Raman Reiti, Vrindaban, Mathura, Mathura, Uttar Pradesh, India, 281121)
  `.trim(),
};

export default function PrivacyPolicy() {
  const policy = HARD_CODED_POLICY;

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 bg-white shadow-sm z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-2">
          <NextLink href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Collabglam Logo" className="h-8 w-auto" />
            <span className="text-lg font-bold text-gray-800">Collabglam</span>
          </NextLink>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-14" aria-hidden="true" />

      {/* Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-12">
        <h1 className="text-2xl font-semibold mb-2">Privacy Policy</h1>

        <p className="mb-4 text-sm text-gray-600">
          Effective Date: {policy.effectiveDate}
        </p>

        <article className="prose max-w-none">
          <div style={{ whiteSpace: "pre-wrap" }}>{policy.content}</div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
