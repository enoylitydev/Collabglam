/* components/ContractEditorOverlay.tsx */
"use client";
import React, { useEffect, useRef, useState } from "react";
import api, { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { HiX } from "react-icons/hi";
import Swal from "sweetalert2";

const toast = (o:{icon:"success"|"error"|"info";title:string;text?:string}) =>
  Swal.fire({ ...o, showConfirmButton:false, timer:1400, background:"white" });

type Role = "brand" | "influencer";

// ---- helpers -------------------------------------------------------
function setDeep(target: any, path: string, value: any) {
  const parts = path.split(".");
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function coerceForKey(fullKey: string, val: string) {
  const key = fullKey.toLowerCase();
  // phone → keep digits, store as string
  if (key.endsWith("phone")) return String(val).replace(/[^\d+]/g, "");
  // date-ish fields (goLive.start|end) — leave as string; backend can Date() it or ISO parse
  return val;
}
// -------------------------------------------------------------------

export default function ContractEditorOverlay({
  contractId,
  role,
  onClose,
  onAfterSave,
}: {
  contractId: string;
  role: Role;
  onClose: () => void;
  onAfterSave?: () => void;
}) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/contract/preview`, {
          params: { contractId, role, editable: 1 },
        });
        setHtml(data.html || "");
      } catch (e:any) {
        toast({ icon:"error", title:"Error", text:e?.message || "Failed to load contract" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [contractId, role]);

  const collect = () => {
    const root = containerRef.current;
    const result: Record<string, string> = {};
    if (!root) return result;
    root.querySelectorAll<HTMLElement>("[data-key]").forEach(el => {
      const key = el.getAttribute("data-key");
      if (!key) return;
      // Use innerText for contenteditable fields; trim
      result[key] = (el.innerText || "").trim();
    });
    return result;
  };

  const handleSave = async () => {
    try {
      const kv = collect();

      if (role === "influencer") {
        // Build nested purple payload
        const purple: any = {};
        Object.entries(kv).forEach(([k, v]) => {
          if (!k.startsWith("purple.")) return;
          const path = k.slice("purple.".length); // e.g. "profile.phone"
          setDeep(purple, path, coerceForKey(k, v));
        });
        // Also support additionalNotes.influencer, if present in DOM
        if (kv["additionalNotes.influencer"] != null) {
          // This field is saved outside purple tree
          await post("/contract/update-notes", {
            contractId,
            notes: { influencer: kv["additionalNotes.influencer"] }
          });
        }
        await post("/contract/influencerConfirm", { contractId, purple, type: 1 });
        toast({ icon:"success", title:"Saved", text:"Confirmation saved" });
      } else {
        // Build nested yellow updates for brand
        const yellow: any = {};
        Object.entries(kv).forEach(([k, v]) => {
          if (!k.startsWith("yellow.")) return;
          const path = k.slice("yellow.".length); // e.g. "goLive.start"
          setDeep(yellow, path, coerceForKey(k, v));
        });
        // Save brand note if surfaced as additionalNotes.brand
        if (kv["additionalNotes.brand"] != null) {
          await post("/contract/update-notes", {
            contractId,
            notes: { brand: kv["additionalNotes.brand"] }
          });
        }
        await post("/contract/resend", {
          contractId,
          brandId: localStorage.getItem("brandId"),
          yellowUpdates: yellow
        });
        toast({ icon:"success", title:"Saved", text:"Brand updates saved" });
      }

      onAfterSave && onAfterSave();
    } catch (e:any) {
      toast({ icon:"error", title:"Save error", text: e?.message || "Failed to save" });
    }
  };

  const handlePDF = async () => {
    try {
      const res = await api.get(`/contract/preview`, {
        params: { contractId, pdf: 1 },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = `Contract-${contractId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e:any) {
      toast({ icon:"error", title:"PDF error", text:e?.message || "Failed to generate PDF" });
    }
  };

  const handleSign = async () => {
    try {
      const kv = collect();
      const nameKey  = role === "brand" ? "sign.brand.name" : "sign.influencer.name";
      const emailKey = role === "brand" ? "sign.brand.email" : "sign.influencer.email";
      let name = kv[nameKey] || "";
      let email = kv[emailKey] || "";

      await post("/contract/sign", {
        contractId,
        role,
        name: name.trim() || undefined,
        email: email.trim() || undefined
      });

      toast({ icon:"success", title:"Signed", text:"Signature recorded" });
      onAfterSave && onAfterSave();
      onClose();
    } catch (e:any) {
      toast({ icon:"error", title:"Sign error", text: e?.response?.data?.message || e?.message || "Failed to sign" });
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full lg:w-[900px] bg-white shadow-2xl border-l flex flex-col">
        <div className="p-4 flex items-center justify-between border-b">
          <div className="font-semibold">Contract Editor — {role === "brand" ? "Brand" : "Influencer"}</div>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100">
            <HiX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-6 text-gray-500">Loading contract…</div>
          ) : (
            <div
              ref={containerRef}
              className="prose max-w-none px-6 py-5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>

        <div className="p-4 border-t flex items-center gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="outline" onClick={handlePDF}>Generate PDF</Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Save
          </Button>
          <Button onClick={handleSign} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Sign
          </Button>
        </div>
      </div>
    </div>
  );
}
