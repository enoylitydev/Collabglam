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
          title: "Enter Dashboard",
          description:
            "Get familiar with your workspace, view your campaigns, influencers, budget, and notifications all in one place.",
          media: { type: "video", src: "/step-1.mp4", poster: "/step-1-poster.jpg" },
        },
        {
          title: "Create Your First Campaign",
          description:
            "Set your campaign objective, deliverables, budget, and timelines to begin the collaboration process.",
          media: {
            type: "gif",
            src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop",
          },
        },
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
        <div className="relative overflow-hidden bg-[radial-gradient(104.07%_104.07%_at_50%_0%,_#FF8C00_23.71%,_#FFF_97.6%)]">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 md:px-8 pt-15">
            <div className="relative w-full overflow-hidden rounded-2xl bg-white/60 backdrop-blur-sm border-[5px] border-white/2 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)]">
              <div className="relative w-full">
                {step.media.type === "video" ? (
                  <video
                    className="h-full w-full object-contain"
                    src={step.media.src}
                    poster={step.media.poster}
                    autoPlay
                    muted
                    playsInline
                    loop={false}                 // important: allow "ended"
                    onEnded={goNext}             // auto-advance after video completes
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
          {/* content */}
          <div className="px-8 pt-8 pb-6">
            <h2 className="text-4xl font-bold text-gray-900 leading-tight">
              {step.title}
            </h2>
            <p className="mt-3 text-lg text-gray-600 leading-[140%]">
              {step.description}
            </p>
          </div>

          {/* footer */}
          <div className="px-8 pb-8 flex items-center justify-between">
            <div />

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={goPrev}
                  className={[
                    "w-32 px-8 py-3 rounded-md text-base font-semibold transition-colors inline-flex items-center justify-center text-black hover:bg-[#ededed] cursor-pointer",
                  ].join(" ")}
                >
                  Previous
                </button>
              )}

              <button
                onClick={goNext}
                className="w-32 px-8 py-3 rounded-md text-base font-semibold bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 cursor-pointer"
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
