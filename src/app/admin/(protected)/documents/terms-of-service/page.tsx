"use client";

import PolicyAdminEditor from "../PolicyAdminEditor";

export default function TermsOfServiceAdmin() {
  return (
    <PolicyAdminEditor
      pageTitle="Terms of Service Admin"
      contentLabel="Terms of Service Content"
      policyKey="terms_of_service"
      policyTitle="Terms of Service"
      fileName="collabglam_terms_of_service_final.docx"
    />
  );
}