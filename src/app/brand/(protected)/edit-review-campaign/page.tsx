"use client";

import React, { Suspense } from "react";
import CampaignFormPage from "./AddEdit";

export default function EditReviewCampaign() {
  return (
    <div>
      <Suspense fallback={<div>Loading Campaign</div>}>
        <CampaignFormPage />
      </Suspense>
    </div>
  );
}