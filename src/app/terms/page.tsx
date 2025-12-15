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
//         const res = await post<Policy>('/policy/getlist', { policyType: 'Terms of Service' });
//         setPolicy(res);
//       } catch (e) {
//         console.error(e);
//         setError('Failed to load Terms of Service.');
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
//         <h1 className="text-2xl font-semibold mb-2">Terms of Service</h1>
//         {error ? (
//           <p className="text-center text-red-600">{error}</p>
//         ) : !policy ? (
//           <p className="text-center">Loading Terms of Service…</p>
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

const HARD_CODED_TOS: Policy = {
  policyType: "Terms of Service",
  effectiveDate: "2025-07-14",
  content: `
Terms of Service
Effective Date: 2025-07-14

Eligibility
You must be at least 18 years old and capable of forming a binding contract. By registering, you represent and warrant that you meet these requirements.

Account Registration
You create an account using a valid email address and may verify via OTP. You are responsible for maintaining the confidentiality of your credentials and all activity under your account. You agree to provide accurate, current and complete information and update it as needed.

Services
We offer digital engagement-boosting services such as likes, comments and replies for YouTube and Instagram. We do provide by means of Google ads, Instagram ads, etc. All descriptions, prices and timing estimates (for example, results within 1–24 hours) are subject to change.

Service Modifications and Suspension
We reserve the right to modify, suspend or discontinue the Service or any feature at any time, with or without notice. We are not liable for any modification, suspension or discontinuation of the Service.

Payment Terms
All fees are billed in U.S. Dollars. Payments are processed via Razorpay until additional gateways such as Stripe become available. Fees are charged upon order placement. You are responsible for all taxes, duties and charges. Late or failed payments may result in suspension or termination of your access.

Cancellations and Refunds
You may request cancellation by emailing support@collabglam.com or calling customer service before a campaign begins. If cancelled before initiation, we will refund your payment within five to seven business days. No refunds are available once a campaign has commenced.

Support and Service Levels
We offer email support via support@collabglam.com. We aim to respond to inquiries within 24 hours but do not guarantee any specific response time or service level.

User Conduct and Restrictions
You may not use the Service to violate third-party terms such as YouTube, Facebook or Instagram policies or any applicable laws. You may not resell the Service to competitors, engage in fraudulent activities, spam, hacking or misrepresent your identity.

Third-Party Links and Content
The Site may contain links to third-party websites or content that we do not control. We are not responsible for the availability, accuracy or policies of such third-party sites and you access them at your own risk.

No Professional Advice and No Reliance
Nothing on the Site or in the Service constitutes legal, financial or other professional advice. You assume all risk and responsibility for your use of the Service.

Intellectual Property
All trademarks, trade names, logos and content on the Site are owned by the Company or its licensors. You retain ownership of any content you submit and grant us a royalty-free license to use it to provide the Service.

Privacy and Cookies
Our Privacy Policy and Cookie Policy explain how we collect, use and share your information. By using the Service, you consent to our use of cookies and tracking as described in these policies.

Force Majeure
Neither party will be liable for delays or failures due to causes beyond its reasonable control, including acts of God, war, terrorism, civil unrest, government actions, strikes, epidemics, floods or telecommunications failures.

Export Controls and Compliance
You agree to comply with all applicable export, re-export and import laws and regulations. You may not use or export the Service in violation of these laws.

Record Retention and Audits
We are not obligated to retain campaign records indefinitely but may do so at our discretion. You may request records within thirty days of campaign completion.

Disclaimer of Warranties
The Service is provided “as-is” and “as available” without warranties of any kind. We disclaim all express, implied and statutory warranties, including merchantability and fitness for a particular purpose.

Performance Disclaimer
We do not guarantee any specific increase in followers, views, engagement or revenue. Actual results may vary based on platform algorithms and factors beyond our control.

Limitation of Liability
To the maximum extent permitted by law, our liability for any claim arising out of or relating to these Terms or the Service is limited to the amount you paid in the three months preceding the claim. We are not liable for indirect, incidental, special, consequential or punitive damages.

Indemnification
You agree to indemnify, defend and hold us and our affiliates harmless from any claim, loss, liability, damage or expense (including reasonable attorneys’ fees) arising from your breach of these Terms, your use of the Service or your violation of any law or third-party right.

Termination
We may suspend or terminate your access to the Service for any reason, including breach of these Terms. Upon termination, your rights under these Terms immediately cease but obligations that by their nature survive termination will remain in effect.

Governing Law
These Terms are governed by the laws of the State of Florida or India respectively, without regard to conflict-of-law principles.

Dispute Resolution
Any dispute arising under or relating to these Terms will be resolved by binding arbitration in Jacksonville, Florida under the rules of the American Arbitration Association, except that either party may bring individual claims in small claims court. Both parties waive any right to a jury trial and to participate in a class action.

Severability
If any provision of these Terms is held invalid or unenforceable, the remaining provisions will remain in full force and effect.

Entire Agreement and Controlling Language
These Terms, together with the Privacy Policy and Cookie Policy, constitute the entire agreement between you and the Company. If translated, the English version will control.

No Waiver
No failure or delay by us in exercising any right under these Terms will operate as a waiver of that right.

Assignment
You may not assign or transfer these Terms or any rights under them without our prior written consent. We may assign these Terms in connection with a merger or sale of assets.

Notices
All legal notices or communications must be in writing and delivered by email to care@collabglam.com or by mail to one of the following addresses:
Meru Land Private (00 Radha Rani place, Raman Reiti, Vrindaban, Mathura, Mathura, Uttar Pradesh, India, 281121)

Relationship of Parties
The parties are independent contractors. Nothing in these Terms creates a partnership, joint venture, agency or employment relationship.

DMCA and Copyright
We comply with the Digital Millennium Copyright Act. If you believe your copyrighted work has been infringed, send a notice with the required information to the address in clause 27.

Survival
Clauses that by their nature survive termination, including payment obligations, confidentiality, indemnification and governing law, will remain in effect.
  `.trim(),
};

export default function TermsOfServicePage() {
  const policy = HARD_CODED_TOS;

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
      <div className="h-14" aria-hidden={true} />

      {/* Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-12">
        <h1 className="text-2xl font-semibold mb-2">Terms of Service</h1>

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
