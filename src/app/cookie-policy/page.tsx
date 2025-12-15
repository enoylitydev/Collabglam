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
//         const res = await post<Policy>('/policy/getlist', { policyType: 'Cookie Policy' });
//         setPolicy(res);
//       } catch (e) {
//         console.error(e);
//         setError('Failed to load Cookie Policy.');
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
//         <h1 className="text-2xl font-semibold mb-2">Cookie Policy</h1>
//         {error ? (
//           <p className="text-center text-red-600">{error}</p>
//         ) : !policy ? (
//           <p className="text-center">Loading Cookie Policy…</p>
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

const HARD_CODED_COOKIE_POLICY: Policy = {
  policyType: "Cookie Policy",
  effectiveDate: "2025-07-14",
  content: `
Cookie Policy
Effective Date: 2025-07-14

Scope
This Cookie Policy explains how Meru Land Private (00 Radha Rani place, Raman Reiti, Vrindaban, Mathura, Mathura, Uttar Pradesh, India, 281121) use cookies and similar technologies on https://collabglam.com.

What are cookies
Cookies are small text files placed on your device when you visit a website. They help the site recognize your device and remember information about your visit.

Types of cookies we use
3.1 Strictly necessary cookies – required for core functions like account login and payment processing.
3.2 Performance and analytics cookies – collect information about how visitors use the Site (for example, pages visited, time spent) to improve functionality (Google Analytics).
3.3 Functionality and preferences cookies – remember choices you make (for example, language or region) to provide enhanced features.
3.4 Marketing and targeting cookies – track your browsing habits to deliver relevant advertising and measure campaign effectiveness.

Specific cookies and providers
• Session cookie – maintains your logged-in status.
• Authentication cookie – secures your account.
• Google Analytics – tracks usage metrics; you can opt out via the Google Analytics Opt-out Browser Add-on.
• Email marketing cookies – used by our email service to measure open and click rates.
• Facebook Pixel or similar – used for ad targeting on social platforms.

How we use cookies
We use cookies to enable essential Site features, analyze Site performance, remember your preferences, and deliver and measure advertising.

Third-party cookies
Our Site may allow third-party providers (for example, analytics and advertising partners) to set cookies. We do not control their tracking and recommend reviewing their privacy and cookie policies.

Managing and disabling cookies
You can manage or disable cookies through your browser settings (for example, Chrome, Firefox, Safari, etc.). Disabling cookies may affect Site functionality. To opt out of Google Analytics tracking, visit https://tools.google.com/dlpage/gaoptout. To opt out of Facebook Pixel tracking, adjust your ad settings at https://www.facebook.com/settings?tab=ads.

GDPR Compliance for EEA Users
For users in the European Economic Area (EEA), we process cookies based on your consent in accordance with the General Data Protection Regulation (GDPR). You have the right to withdraw consent at any time, access your data, request correction or deletion, restrict or object to processing, and exercise data portability. To exercise these rights, please contact us at support@collabglam.com or refer to our Privacy Policy.
 
Changes to this Policy
We may update this Cookie Policy at any time by posting a revised version with a new “Last updated” date. Continued use after changes constitutes acceptance.

Contact Information
For questions about this Cookie Policy, contact:

Email: care@collabglam.com

Addresses:
Meru Land Private (00 Radha Rani place, Raman Reiti, Vrindaban, Mathura, Mathura, Uttar Pradesh, India, 281121)

Governing Law
This Cookie Policy is governed by the laws of the State of Florida for U.S. orders and by the laws of India for orders placed under our Indian entity.
  `.trim(),
};

export default function CookiePolicyPage() {
  const policy = HARD_CODED_COOKIE_POLICY;

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
        <h1 className="text-2xl font-semibold mb-2">Cookie Policy</h1>

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
