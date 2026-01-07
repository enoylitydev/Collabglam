// InfluencerTourModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, ChevronRight } from "lucide-react";

type Media =
  | { type: "video"; src: string; poster?: string }
  | { type: "gif"; src: string };

type Step = {
  title: string;
  description: string;
  media: Media;
};

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
          media: { type: "video", src: "/influencer/step_1.mp4", poster: "/step_1-poster.jpg" },
        },
        {
          title: "Find New Collaborations",
          description:
            "Discover brand campaigns that match your content style, audience, and availability.",
          media: { type: "video", src: "/influencer/step_2.mp4", poster: "/step_2-poster.jpg" },
        },
        {
          title: "Apply or Respond to Brand Invites",
          description:
            "Apply to open campaigns or respond to direct brand invites with a single click.",
          media: { type: "video", src: "/influencer/step_3.mp4", poster: "/step_3-poster.jpg" },
        },
        {
          title: "Review & Accept the Contract",
          description:
            "Check deliverables, timelines, usage rights, and payment terms before committing.",
          media: { type: "video", src: "/influencer/step_4.mp4", poster: "/step_4-poster.jpg" },
        },
        {
          title: "Sign & Confirm Participation",
          description:
            "Sign the contract digitally to confirm your participation and start the campaign.",
          media: { type: "video", src: "/influencer/step_5.mp4", poster: "/step_5-poster.jpg" },
        }
      ],
    [stepsProp]
  );

  const [active, setActive] = useState(startAt);

  useEffect(() => {
    if (!open) return;
    setActive(startAt);
  }, [open, startAt]);

  // lock scroll behind modal
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const step = steps[active];
  const isFirst = active === 0;
  const isLast = active === steps.length - 1;

  const goPrev = () => setActive((v) => Math.max(0, v - 1));
  const goNext = () => {
    if (isLast) onClose();
    else setActive((v) => Math.min(steps.length - 1, v + 1));
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* modal */}
      <div
        className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-2 bg-white border-b border-gray-100">
          <h3 className="text-2xl font-bold text-gray-900">
            Step {active + 1}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-8 w-8 text-gray-600" />
          </button>
        </div>

        {/* media block */}
        <div className="relative overflow-hidden bg-[radial-gradient(104.07%_104.07%_at_50%_0%,_#FFBF00_23.71%,_#FFF_97.6%)]">
          <div className="mx-auto w-full max-w-4xl px-8 pt-16">
            <div className="relative w-full overflow-hidden rounded-2xl bg-white/60 backdrop-blur-sm border-[8px] border-white/2 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)]">
              <div className="relative w-full aspect-video overflow-hidden">
                {step.media.type === "video" ? (
                  <video
                    className="absolute inset-0 h-full w-full object-cover scale-[1.01] -translate-x-[0.2%]"
                    src={step.media.src}
                    poster={step.media.poster}
                    autoPlay
                    muted
                    playsInline
                    loop
                  />
                ) : (
                  <img
                    src={step.media.src}
                    alt={step.title}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* content + footer */}
        <div className="relative z-10 -mt-10 bg-white shadow-[0_-18px_30px_-20px_rgba(0,0,0,0.35)]">
          <div className="px-8 pt-8 pb-6">
            <h2 className="text-4xl font-bold text-gray-900 leading-tight">
              {step.title}
            </h2>
            <p className="mt-3 text-lg text-gray-600 leading-[140%]">
              {step.description}
            </p>
          </div>

          <div className="px-8 pb-8 flex items-center justify-between">
            <div />
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={goPrev}
                  className="w-32 px-8 py-3 rounded-md text-base font-semibold transition-colors inline-flex items-center justify-center text-black hover:bg-[#ededed] cursor-pointer"
                >
                  Previous
                </button>
              )}

              <button
                onClick={goNext}
                className="w-32 px-8 py-3 rounded-md text-base font-semibold bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-black hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLast ? "Done" : "Next"}
                {!isLast && <ChevronRight className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
