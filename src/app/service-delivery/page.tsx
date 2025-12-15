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
//         const res = await post<Policy>('/policy/getlist', { policyType: 'Shipping & Delivery' });
//         setPolicy(res);
//       } catch (e) {
//         console.error(e);
//         setError('Failed to load Shipping & Delivery.');
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
//         <h1 className="text-2xl font-semibold mb-2">Shipping & Delivery Policy</h1>
//         {error ? (
//           <p className="text-center text-red-600">{error}</p>
//         ) : !policy ? (
//           <p className="text-center">Loading Shipping & Delivery policy…</p>
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

const HARD_CODED_SHIPPING_POLICY: Policy = {
  policyType: "Shipping & Delivery",
  effectiveDate: "2025-07-14",
  content: `
Shipping & Delivery Policy
Effective Date: 2025-07-14

Scope
This Shipping & Delivery Policy applies to all digital engagement services (for example: likes, comments, replies) got through CollabGlam at https://collabglam.com.

Delivery Method
All services offered by CollabGlam are delivered entirely online—there is no physical shipping of goods.

Order Confirmation
Once your payment is successfully processed via Razorpay, you will receive:

An email confirmation with your order details and expected delivery window.

A real-time status update on your CollabGlam dashboard.

Delivery Timeline

Initiation: Services begin within 1–24 hours of payment.

Completion: You will see engagements (likes, comments, replies) appear on your content within this timeframe.

No Physical Shipment
Since CollabGlam provides digital services, there is no packaging, shipping carrier, or tracking number. Your purchased campaigns go live automatically—no further action is required on your part.

Technical Failures & Delays
If there is any unexpected delay (for example, platform outages), we will notify you via email within two business hours and work to restore service delivery as quickly as possible.

Customer Support
For questions about delivery status or if you do not see activity within 24 hours:

Email: care@collabglam.com

Phone (IN): +91 9045054001

Phone (US): +1 904 219 4648

Hours: Mon–Fri, 10:30–18:30 IST

Governing Law
This policy is governed by the laws of the State of Florida for U.S. orders and by the laws of India for orders placed under our Indian entity.
  `.trim(),
};

export default function ShippingDeliveryPolicy() {
  const policy = HARD_CODED_SHIPPING_POLICY;

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
        <h1 className="text-2xl font-semibold mb-2">Shipping & Delivery Policy</h1>

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
