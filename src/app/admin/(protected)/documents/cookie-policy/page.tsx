"use client";

import PolicyAdminEditor from "../PolicyAdminEditor";

export default function CookiePolicyAdmin() {
  return (
    <PolicyAdminEditor
      pageTitle="Cookie Policy Admin"
      contentLabel="Cookie Policy Content"
      policyKey="cookie_policy"
      policyTitle="Cookie Policy"
      fileName="collabglam_cookie_policy_final.docx"
    />
  );
}