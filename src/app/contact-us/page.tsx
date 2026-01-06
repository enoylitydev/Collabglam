"use client";

import React, { useState } from "react";
import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";
import { FloatingLabelInput } from "@/components/common/FloatingLabelInput";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { post } from "@/lib/api";
import { CheckCircle2, X } from "lucide-react";

type FormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

const TITLE_BOX =
  "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white " +
  "inline-block rounded-2xl px-8 py-5 shadow " +
  "transition-all duration-300 transform " +
  "hover:shadow-2xl hover:scale-[1.03] hover:saturate-125 " +
  "outline-none focus:ring-0 focus-visible:ring-0";

/** ✅ Updated: whole card scales + lifts on hover */
const GradientCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => (
  <div
    className="
      relative group
      transition-transform duration-300 will-change-transform
      sm:hover:scale-[1.02] sm:hover:-translate-y-0.5
    "
  >
    <div
      className="
        p-[2px] rounded-2xl bg-gradient-to-r from-[#FFA135] to-[#FF7236]
        transition-shadow duration-300
        sm:group-hover:shadow-2xl
      "
    >
      <div
        className={`
          rounded-2xl bg-white p-6 shadow
          transition-shadow duration-300
          sm:group-hover:shadow-xl
          ${className}
        `}
      >
        {children}
      </div>
    </div>
  </div>
);

export default function ContactUs() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** ✅ New: banner success message shown ABOVE cards */
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  /** Existing popup */
  const [successOpen, setSuccessOpen] = useState(false);

  const handleFieldChange =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = e.target;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessBanner(null);
    setSuccessOpen(false);

    try {
      await post<{ message: string }>("/contact/send", form);

      // ✅ Clear + obvious success feedback (banner + popup)
      setSuccessBanner("Thanks for reaching out. Our team will get back to you soon.");
      setSuccessOpen(true);

      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.error || "Something went wrong. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      {/* ✅ POPUP: More noticeable + animated */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent
          className="
            bg-white rounded-2xl border-0 p-0 shadow-2xl sm:max-w-md
            data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
          "
        >
          <div className="rounded-2xl bg-white p-6">
            <div className="rounded-2xl bg-gradient-to-r from-[#FFA135] to-[#FF7236] p-[2px]">
              <div className="rounded-[14px] bg-white p-6 text-center">
                <div
                  className="
                    mx-auto mb-3 flex h-12 w-12 items-center justify-center
                    rounded-full bg-gradient-to-r from-[#FFA135]/15 to-[#FF7236]/15
                  "
                >
                  <CheckCircle2 className="h-7 w-7 text-[#FF7236]" />
                </div>

                <DialogHeader>
                  <DialogTitle className="text-xl">Message sent</DialogTitle>
                  <DialogDescription className="mt-1">
                    We’ve received your request. Our team will get back to you soon.
                  </DialogDescription>
                </DialogHeader>

                <Button
                  type="button"
                  onClick={() => setSuccessOpen(false)}
                  className="
                    mt-5 w-full rounded-md font-medium text-white
                    bg-gradient-to-r from-[#FFA135] to-[#FF7236]
                    transition-all duration-200 hover:opacity-90 active:opacity-95
                    focus:outline-none focus:ring-0 focus-visible:ring-0
                  "
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Header />

      <div className="h-16 md:h-24" aria-hidden />

      <section className="bg-white text-center px-6 pt-2 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className={TITLE_BOX}>
            <h1 className="text-3xl font-bold leading-tight">Contact Us</h1>
            <p className="mt-1 text-base/6 opacity-95">
              We’d love to hear from you—drop us a line below.
            </p>
          </div>
        </div>
      </section>

      <main className="flex-1 overflow-auto px-6 py-12">
        <div className="max-w-3xl mx-auto space-y-6">
        
          {/* ✅ Form Card (now hover-scales) */}
          <GradientCard>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <FloatingLabelInput
                id="name"
                name="name"
                type="text"
                label="Name"
                value={form.name}
                onChange={handleFieldChange("name")}
                disabled={loading}
                required
              />

              <FloatingLabelInput
                id="email"
                name="email"
                type="email"
                label="Email"
                value={form.email}
                onChange={handleFieldChange("email")}
                disabled={loading}
                required
              />

              <FloatingLabelInput
                id="subject"
                name="subject"
                type="text"
                label="Subject"
                value={form.subject}
                onChange={handleFieldChange("subject")}
                disabled={loading}
                required
              />

              <div className="space-y-1">
                <label htmlFor="message" className="block">
                  Message
                </label>
                <div
                  className="
                    rounded-md p-[2px] transition-colors
                    bg-transparent
                    focus-within:bg-gradient-to-r focus-within:from-[#FFA135] focus-within:to-[#FF7236]
                  "
                >
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    placeholder=" "
                    value={form.message}
                    onChange={handleFieldChange("message")}
                    disabled={loading}
                    className="
                      block w-full rounded-md bg-white px-3 py-2 text-black
                      border-2 border-gray-200
                      focus:border-transparent focus:outline-none focus:ring-0
                      transition
                    "
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="
                  px-6 py-2 rounded-md font-medium text-white
                  bg-gradient-to-r from-[#FFA135] to-[#FF7236]
                  transition-all duration-200 hover:opacity-90 active:opacity-95
                  focus:outline-none focus:ring-0 focus-visible:ring-0
                  disabled:opacity-50
                "
              >
                {loading ? "Sending…" : "Send Message"}
              </Button>
            </form>
          </GradientCard>

          {/* ✅ Details Card (now hover-scales) */}
          <GradientCard>
            <div className="inline-block rounded-full px-4 py-1 text-sm font-semibold text-white bg-gradient-to-r from-[#FFA135] to-[#FF7236] mb-4">
              Get in Touch
            </div>

            <p className="mb-2">
              <strong>Email:</strong>{" "}
              <a href="mailto:care@collabglam.com" className="hover:underline">
                support@collabglam.com
              </a>
            </p>
            <p className="mb-2">
              <strong>Phone:</strong> +1 (904) 219-4648
            </p>
            <p>
              <strong>Address: </strong>
              8825 PERIMETER PARK BLVD STE 501
              <br />
              JACKSONVILLE, FL 32216-1123
              <br />
              USA
            </p>
          </GradientCard>
        </div>
      </main>

      <Footer />
    </div>
  );
}
