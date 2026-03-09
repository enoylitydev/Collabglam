"use client";

import PublicPolicyPage from "@/components/common/PublicPolicyPage";

export default function DataProcessingAddendumPage() {
  return (
    <PublicPolicyPage
      heading="Data Processing Addendum"
      policyKey="data_processing_addendum"
      errorMessage="Failed to load Data Processing Addendum."
      loadingMessage="Loading Data Processing Addendum..."
    />
  );
}