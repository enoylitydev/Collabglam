"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronRight } from "lucide-react";

export type Media =
  | { type: "video"; src: string; poster?: string }
  | { type: "gif"; src: string };

export type Step = {
  title: string;
  description: string;
  media: Media;
};

type Theme = {
  mediaBgClass: string; // background behind media
  nextBtnClass: string; // next button styling
  nextIconClass?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  steps: Step[];
  startAt?: number;
  theme: Theme;
};

function useLockBodyScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

export default function TourModalBase({
  open,
  onClose,
  steps,
  startAt = 0,
  theme,
}: Props) {
  const [active, setActive] = useState(startAt);
  const [mediaReady, setMediaReady] = useState(false);

  // keep preloader elements alive (avoid GC canceling fetch in some browsers)
  const videoPreloadersRef = useRef<HTMLVideoElement[]>([]);
  const imgPreloadersRef = useRef<HTMLImageElement[]>([]);

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    setActive(startAt);
  }, [open, startAt]);

  // reset loader when step changes
  useEffect(() => {
    if (!open) return;
    setMediaReady(false);
  }, [open, active]);

  const step = steps[active];
  const isFirst = active === 0;
  const isLast = active === steps.length - 1;

  const goPrev = () => setActive((v) => Math.max(0, v - 1));
  const goNext = () => {
    if (isLast) onClose();
    else setActive((v) => Math.min(steps.length - 1, v + 1));
  };

  // Preload current/next/prev media (video + poster)
  useEffect(() => {
    if (!open) return;

    // cleanup old preloaders
    for (const v of videoPreloadersRef.current) {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {}
    }
    videoPreloadersRef.current = [];
    imgPreloadersRef.current = [];

    const indexesToPreload = [active, active + 1, active - 1].filter(
      (i) => i >= 0 && i < steps.length
    );

    for (const idx of indexesToPreload) {
      const s = steps[idx];
      if (s.media.type === "video") {
        // preload poster
        if (s.media.poster) {
          const img = new window.Image();
          img.src = s.media.poster;
          imgPreloadersRef.current.push(img);
        }

        // preload video
        const v = document.createElement("video");
        v.preload = "auto";
        v.muted = true;
        v.playsInline = true;
        v.src = s.media.src;
        v.load();
        videoPreloadersRef.current.push(v);
      } else {
        const img = new window.Image();
        img.src = s.media.src;
        imgPreloadersRef.current.push(img);
      }
    }

    return () => {
      for (const v of videoPreloadersRef.current) {
        try {
          v.pause();
          v.removeAttribute("src");
          v.load();
        } catch {}
      }
      videoPreloadersRef.current = [];
      imgPreloadersRef.current = [];
    };
  }, [open, active, steps]);

  if (!open) return null;
  if (!step) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* modal */}
      <div
        className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-2 bg-white border-b border-gray-100">
          <h3 className="text-2xl font-bold text-gray-900">
            Step {active + 1} <span className="text-gray-400">/ {steps.length}</span>
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
        <div className={`relative overflow-hidden ${theme.mediaBgClass}`}>
          <div className="mx-auto w-full max-w-4xl px-8 pt-16">
            <div className="relative w-full overflow-hidden rounded-tl-2xl rounded-tr-2xl rounded-bl-none rounded-br-none bg-white/60 backdrop-blur-sm border-[8px] border-white/2 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)]">
              <div className="relative w-full aspect-video overflow-hidden">
                {step.media.type === "video" ? (
                  <>
                    <video
                      key={step.media.src}
                      className="absolute inset-0 h-full w-full object-cover scale-[1.01] -translate-x-[0.2%]"
                      src={step.media.src}
                      poster={step.media.poster}
                      autoPlay
                      muted
                      playsInline
                      loop
                      preload="auto"
                      onLoadedData={() => setMediaReady(true)}
                      onCanPlay={() => setMediaReady(true)}
                    />

                    {!mediaReady && (
                      <div className="absolute inset-0 animate-pulse bg-white/40" />
                    )}
                  </>
                ) : (
                  <img
                    key={step.media.src}
                    src={step.media.src}
                    alt={step.title}
                    className="h-full w-full object-contain"
                    loading="eager"
                    onLoad={() => setMediaReady(true)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* content + footer */}
        <div className="relative z-10 -mt-2 bg-white shadow-[0_-18px_30px_-20px_rgba(0,0,0,0.35)]">
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
                className={`w-32 px-8 py-3 rounded-md text-base font-semibold transition-opacity inline-flex items-center justify-center gap-2 cursor-pointer ${theme.nextBtnClass}`}
              >
                {isLast ? "Done" : "Next"}
                {!isLast && (
                  <ChevronRight className={`h-5 w-5 ${theme.nextIconClass ?? ""}`} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
