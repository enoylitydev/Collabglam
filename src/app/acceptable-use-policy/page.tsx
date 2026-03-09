"use client";

import PublicPolicyPage from "@/components/common/PublicPolicyPage";

export default function AcceptableUsePolicyPage() {
  return (
    <PublicPolicyPage
      heading="Acceptable Use & Communication Policy"
      policyKey="acceptable_use_and_communication_policy"
      errorMessage="Failed to load Acceptable Use & Communication Policy."
      loadingMessage="Loading Acceptable Use & Communication Policy..."
    />
  );
}