"use client";

import PolicyAdminEditor from "../PolicyAdminEditor";

export default function PrivacyPolicyAdmin() {
  return (
    <PolicyAdminEditor
      pageTitle="Privacy Policy Admin"
      contentLabel="Privacy Policy Content"
      policyKey="privacy_policy"
      policyTitle="Privacy Policy"
      fileName="collabglam_privacy_policy_final.docx"
    />
  );
}