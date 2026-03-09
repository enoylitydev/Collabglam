"use client";

import PublicPolicyPage from "@/components/common/PublicPolicyPage";

export default function SubprocessorListPage() {
  return (
    <PublicPolicyPage
      heading="Subprocessor List"
      policyKey="subprocessor_list"
      errorMessage="Failed to load Subprocessor List."
      loadingMessage="Loading Subprocessor List..."
    />
  );
}