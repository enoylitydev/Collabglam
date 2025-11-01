// ContractSidebar.tsx
import React from "react";
import { HiX, HiDocumentText } from "react-icons/hi";

interface ContractSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;    // small, upper label
  subtitle?: string; // big line (we'll show influencer name here)
}

export function ContractSidebar({
  isOpen,
  onClose,
  children,
  title = "Initiate Contract",
  subtitle = "New Agreement",
}: ContractSidebarProps) {
  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[720px] md:w-[860px] lg:w-[960px] bg-white shadow-2xl transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="relative h-36 overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(135deg, #FFA135 0%, #FF7236 100%)`,
              clipPath: "polygon(0 0, 100% 0, 100% 65%, 0 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, #FFA135 0%, #FF7236 100%)`,
              clipPath: "polygon(0 0, 100% 0, 100% 78%, 0 92%)",
            }}
          />

          <div className="relative z-10 p-6 text-white flex items-start justify-between h-full">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mt-1 shadow-sm">
                <HiDocumentText className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-[11px] tracking-wide font-semibold uppercase/relaxed opacity-95 mb-1">
                  {title}
                </div>
                {/* Big line — put Influencer name here */}
                <div className="text-2xl font-extrabold leading-tight">{subtitle}</div>
              </div>
            </div>

            <button
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center transition-all duration-150 hover:scale-110"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              <HiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="h-[calc(100%-9rem)] overflow-y-auto">
          <div className="p-6 space-y-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function SidebarSection({
  title,
  children,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-100 shadow-sm p-5 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FFA135] to-[#FF7236] flex items-center justify-center text-white">
            {icon}
          </div>
        )}
        <div className="font-semibold text-gray-800">{title}</div>
      </div>
      {children}
    </div>
  );
}

export function SidebarActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-end gap-3 shadow-lg">
      {children}
    </div>
  );
}
