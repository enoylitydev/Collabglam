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
//         const res = await post<Policy>('/policy/getlist', { policyType: 'Returns Policy' });
//         setPolicy(res);
//       } catch (e) {
//         console.error(e);
//         setError('Failed to load Returns policy.');
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
//         <h1 className="text-2xl font-semibold mb-2">Returns Policy</h1>
//         {error ? (
//           <p className="text-center text-red-600">{error}</p>
//         ) : !policy ? (
//           <p className="text-center">Loading Returns policy…</p>
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

const HARD_CODED_RETURNS_POLICY: Policy = {
  policyType: "Returns Policy",
  effectiveDate: "2025-07-14",
  content: `
Returns Policy
Effective Date: 2025-07-14

Scope
This policy applies to all digital engagement services (for example, likes, comments, replies) get through CollabGlam at https://collabglam.com.

Eligibility for Returns
You may request a return only if the ordered service has not yet been initiated. Once fulfillment has begun, the service is non-returnable and non-refundable.

Return Request Process
To request a return, contact care@collabglam.com or call customer service before the start of delivery. Include your order ID and reason for cancellation.

Refund Timeline
Approved refunds will be issued to the original payment method within five to seven business days after cancellation confirmation.

Non-Refundable Situations
No refunds are available for services that have commenced or been delivered in whole or in part. Any attempt to dispute or reverse charges after delivery completion will be considered outside this policy.

Chargebacks and Disputes
If you initiate a chargeback without prior authorization, we reserve the right to contest it and may suspend or terminate your account for abuse of this policy.

Contact Information
Meru Land Private (00 Radha Rani place, Raman Reiti, Vrindaban, Mathura, Mathura, Uttar Pradesh, India, 281121)
Email: support@collabglam.com

Governing Law
This policy is governed by the laws of the State of Florida for U.S. orders and by the laws of India for orders placed under our Indian entity.
  `.trim(),
};

export default function ReturnsPolicy() {
  const policy = HARD_CODED_RETURNS_POLICY;

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
        <h1 className="text-2xl font-semibold mb-2">Returns Policy</h1>

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
