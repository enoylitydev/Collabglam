"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

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
          media: { type: "video", src: "/tour/step1.mp4" },
        },
        {
          title: "Create Your First Campaign",
          description:
            "Set your campaign objective, deliverables, budget, and timelines to begin the collaboration process.",
          media: { type: "video", src: "/tour/step2.mp4" },
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

  const renderMedia = () => {
    if (step.media.type === "video") {
      return (
        <video
          key={step.media.src} // forces reload when step changes
          className="h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={step.media.poster}
        >
          <source src={step.media.src} type="video/mp4" />
        </video>
      );
    }

    // GIF fallback
    return (
      <img
        src={step.media.src}
        alt={step.title}
        className="h-full w-full object-cover"
      />
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* modal */}
      <div className="relative w-[92%] max-w-5xl rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <h3 className="text-2xl font-bold">Step {active + 1}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <hr className="border-1 color-black" />
        {/* media block */}
        <div className="px-6 pb-6">
          <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-orange-200 to-orange-100 border">
            <div className="h-[280px] md:h-[340px] w-full">
              {renderMedia()}
            </div>
          </div>
        </div>

        {/* content */}
        <div className="px-6 pb-8">
          <h2 className="text-5xl font-extrabold tracking-tight">
            {step.title}
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl">
            {step.description}
          </p>
        </div>

        {/* footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <button
            onClick={() => setActive((v) => Math.max(0, v - 1))}
            disabled={isFirst}
            className={`inline-flex items-center gap-2 text-lg font-semibold ${
              isFirst ? "opacity-40 cursor-not-allowed" : "hover:opacity-80"
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
            Previous
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-8 py-3 rounded-2xl text-lg font-semibold bg-gray-900 text-white hover:opacity-90"
            >
              Skip
            </button>

            <button
              onClick={() => {
                if (isLast) onClose();
                else setActive((v) => Math.min(steps.length - 1, v + 1));
              }}
              className="px-8 py-3 rounded-2xl text-lg font-semibold bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-95 inline-flex items-center gap-2"
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ChevronRight className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
