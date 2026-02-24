"use client";

import React, { useMemo } from "react";
import TourModalBase, { Step } from "./TourModalBase";

type Props = {
  open: boolean;
  onClose: () => void;
  steps?: Step[];
  startAt?: number;
};

export default function BrandTourModal({
  open,
  onClose,
  steps: stepsProp,
  startAt = 0,
}: Props) {
  const steps = useMemo<Step[]>(
    () =>
      stepsProp ?? [
        {
          title: "Explore Your Dashboard",
          description:
            "Get a quick snapshot of your campaigns, influencer activity, budget status, and notifications.",
          media: { type: "video", src: "/brand/step_1.mp4", poster: "/brand/posters/step_1.jpg" },
        },
        {
          title: "Create Your First Campaign",
          description:
            "Define your campaign goal, content requirements, budget, and timeline in one place.",
          media: { type: "video", src: "/brand/step_2.mp4", poster: "/brand/posters/step_2.jpg" },
        },
        {
          title: "Browse & Shortlist Influencers",
          description:
            "Discover creators using filters like category, audience, reach, and engagement to build your shortlist.",
          media: { type: "video", src: "/brand/step_3.mp4", poster: "/brand/posters/step_3.jpg" },
        },
        {
          title: "Invite Influencers via Campaign",
          description:
            "Send campaign invites directly from your campaign to selected influencers.",
          media: { type: "video", src: "/brand/step_4.mp4", poster: "/brand/posters/step_4.jpg" },
        },
        {
          title: "Send Campaign Contract",
          description:
            "Share deliverables, timelines, payment structure, and brand guidelines in a single agreement.",
          media: { type: "video", src: "/brand/step_5.mp4", poster: "/brand/posters/step_5.jpg" },
        },
        {
          title: "Influencer Reviews & Accepts",
          description:
            "The influencer reviews the campaign terms and accepts the collaboration.",
          media: { type: "video", src: "/brand/step_6.mp4", poster: "/brand/posters/step_6.jpg" },
        },
        {
          title: "Brand Reviews & Confirms",
          description:
            "Review influencer acceptance and sign to officially activate the campaign.",
          media: { type: "video", src: "/brand/step_7.mp4", poster: "/brand/posters/step_7.jpg" },
        },
        {
          title: "Define Milestones & Payments",
          description:
            "Set milestone stages and link them to payments for structured execution and payouts.",
          media: { type: "video", src: "/brand/step_8.mp4", poster: "/brand/posters/step_8.jpg" },
        },
      ],
    [stepsProp]
  );

  return (
    <TourModalBase
      open={open}
      onClose={onClose}
      steps={steps}
      startAt={startAt}
      theme={{
        mediaBgClass:
          "bg-[radial-gradient(104.07%_104.07%_at_50%_0%,_#FF8C00_23.71%,_#FFF_97.6%)]",
        nextBtnClass:
          "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-90",
      }}
    />
  );
}
