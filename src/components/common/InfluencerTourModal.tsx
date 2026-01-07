"use client";

import React, { useMemo } from "react";
import TourModalBase, { Step } from "./TourModalBase";

type Props = {
  open: boolean;
  onClose: () => void;
  steps?: Step[];
  startAt?: number;
};

export default function InfluencerTourModal({
  open,
  onClose,
  steps: stepsProp,
  startAt = 0,
}: Props) {
  const steps = useMemo<Step[]>(
    () =>
      stepsProp ?? [
        {
          title: "Influencer Dashboard",
          description:
            "Get a quick view of your active campaigns, invites, earnings, and profile status—all in one place.",
          media: { type: "video", src: "/influencer/step_1.mp4", poster: "/influencer/posters/step_1.jpg" },
        },
        {
          title: "Find New Collaborations",
          description:
            "Discover brand campaigns that match your content style, audience, and availability.",
          media: { type: "video", src: "/influencer/step_2.mp4", poster: "/influencer/posters/step_2.jpg" },
        },
        {
          title: "Apply or Respond to Brand Invites",
          description:
            "Apply to open campaigns or respond to direct brand invites with a single click.",
          media: { type: "video", src: "/influencer/step_3.mp4", poster: "/influencer/posters/step_3.jpg" },
        },
        {
          title: "Review & Accept the Contract",
          description:
            "Check deliverables, timelines, usage rights, and payment terms before committing.",
          media: { type: "video", src: "/influencer/step_4.mp4", poster: "/influencer/posters/step_4.jpg" },
        },
        {
          title: "Sign & Confirm Participation",
          description:
            "Sign the contract digitally to confirm your participation and start the campaign.",
          media: { type: "video", src: "/influencer/step_5.mp4", poster: "/influencer/posters/step_5.jpg" },
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
          "bg-[radial-gradient(104.07%_104.07%_at_50%_0%,_#FFBF00_23.71%,_#FFF_97.6%)]",
        nextBtnClass:
          "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-black hover:opacity-90",
      }}
    />
  );
}
