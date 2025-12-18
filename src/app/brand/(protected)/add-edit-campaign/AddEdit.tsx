"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { get, post } from "@/lib/api";

import {
  HiOutlineCalendar,
  HiOutlineCurrencyDollar,
  HiOutlinePlus,
  HiOutlinePhotograph,
  HiOutlineX,
  HiOutlineUpload,
  HiOutlineCheckCircle,
} from "react-icons/hi";
import { toast } from "@/components/common/toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FloatingLabelInput } from "@/components/common/FloatingLabelInput";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const ReactSelect = dynamic(() => import("react-select"), { ssr: false });
import type { FilterOptionOption } from "react-select";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.css";

// ── types ───────────────────────────────────────────────────

type GenderOption = "Male" | "Female" | "All";

interface Country {
  _id: string;
  countryName: string;
  callingCode: string;
  countryCode: string;
  flag: string;
}

interface CountryOption {
  value: string; // _id
  label: string; // "🇺🇸 United States"
  country: Country;
}

interface CategoryDTO {
  _id: string;
  id: number;
  name: string;
  subcategories: { subcategoryId: string; name: string }[];
}

interface CategoriesResponse {
  count: number;
  categories: CategoryDTO[];
}

interface SubcategoryOption {
  value: string; // subcategoryId
  label: string; // subcategory name
  categoryId: number; // category.id (numeric)
  categoryName: string; // category name
}

// generic simple option for ReactSelect
type SimpleOption = { value: string; label: string };

// ── helpers ─────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
const makeFileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;
const MAX_COUNTRIES = 5;

const fileUrl = (v?: string) => {
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/file/")) return `${API_BASE}${v}`;
  return `${API_BASE}/file/${encodeURIComponent(v)}`;
};

const buildCountryOptions = (countries: Country[]): CountryOption[] =>
  countries.map((c) => ({
    value: c._id,
    label: `${c.flag} ${c.countryName}`,
    country: c,
  }));

const filterByCountryName = (
  option: FilterOptionOption<unknown>,
  rawInput: string
) => {
  const input = rawInput.toLowerCase().trim();
  const data = option.data as CountryOption | undefined;
  if (!data || !data.country) return false;
  const country = data.country;
  return (
    country.countryName.toLowerCase().includes(input) ||
    country.countryCode.toLowerCase().includes(input) ||
    country.callingCode.replace(/^\+/, "").includes(input.replace(/^\+/, ""))
  );
};

// Server ↔ UI gender mapping (server: 0=Female,1=Male,2=All)
const serverGenderToUI = (g: 0 | 1 | 2): GenderOption =>
  g === 1 ? "Male" : g === 0 ? "Female" : "All";
const uiGenderToServer = (g: GenderOption | ""): 0 | 1 | 2 =>
  g === "Male" ? 1 : g === "Female" ? 0 : 2;

// ReactSelect option lists for Gender, Goals & Campaign Type
const GENDER_SELECT_OPTIONS: SimpleOption[] = ["Male", "Female", "All"].map(
  (g) => ({
    value: g,
    label: g,
  })
);

const GOAL_OPTIONS: SimpleOption[] = ["Brand Awareness", "Sales", "Engagement"].map(
  (g) => ({ value: g, label: g })
);

const CAMPAIGN_TYPE_OPTIONS: SimpleOption[] = [
  "Product Promo",
  "Brand Awareness",
  "Review / Unboxing",
  "Launch",
  "Giveaway",
  "Offer Promo",
  "Event / Visit",
  "UGC Only",
  "Testimonial",
  "Affiliate",
  "App / Website Traffic",
  "Reel Promo",
  "Story Promo",
  "Post Promo",
  "Other",
].map((t) => ({ value: t, label: t }));

// ── main component ─────────────────────────────────────────

export default function CampaignFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const isEditMode = Boolean(campaignId);

  // ── state ─────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [productImages, setProductImages] = useState<File[]>([]);
  const [ageRange, setAgeRange] = useState<{ min: number | ""; max: number | "" }>({
    min: "",
    max: "",
  });
  const [selectedGender, setSelectedGender] = useState<GenderOption | "">("");

  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<CountryOption[]>([]);

  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubcategories, setSelectedSubcategories] = useState<SubcategoryOption[]>(
    []
  );

  const [selectedGoal, setSelectedGoal] = useState<string>("");
  const [campaignType, setCampaignType] = useState<string>("");
  const [customCampaignType, setCustomCampaignType] = useState<string>("");

  const [budget, setBudget] = useState<number | "">("");
  const [timeline, setTimeline] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  const [creativeBriefText, setCreativeBriefText] = useState("");
  const [creativeBriefFiles, setCreativeBriefFiles] = useState<File[]>([]);
  const [existingBriefFiles, setExistingBriefFiles] = useState<string[]>([]);
  const [useFileUploadForBrief, setUseFileUploadForBrief] = useState(false);

  const [additionalNotes, setAdditionalNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRequiredHints, setShowRequiredHints] = useState(false);

  const ageOrderError =
    ageRange.min !== "" &&
    ageRange.max !== "" &&
    Number(ageRange.min) >= Number(ageRange.max);

  const dateOrderError =
    !!(timeline.start && timeline.end && new Date(timeline.start) > new Date(timeline.end));

  const finalCampaignTypeForUI =
    campaignType === "Other" ? customCampaignType.trim() : campaignType;
  const campaignTypeMissing = !finalCampaignTypeForUI;

  // 🔴 images required – true when no existing or new images
  const imagesMissing = existingImages.length + productImages.length === 0;

  const [draftLoaded, setDraftLoaded] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // 🔹 store current draft _id so backend can update that draft only
  const [draftId, setDraftId] = useState<string | null>(null);

  // preview modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // ── memoised options ─────────────────────────────────────
  const countryOptions = useMemo<CountryOption[]>(
    () => buildCountryOptions(countries),
    [countries]
  );

  // local YYYY-MM-DD for <input type="date">
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  // Single-select category options
  const categorySelectOptions = useMemo<SimpleOption[]>(
    () =>
      categories.map((cat) => ({
        value: String(cat.id),
        label: cat.name,
      })),
    [categories]
  );

  // Multi-select subcategory options for selected category
  const subcategoryOptionsForSelectedCategory = useMemo<SubcategoryOption[]>(() => {
    if (selectedCategoryId == null) return [];
    const cat = categories.find((c) => c.id === selectedCategoryId);
    if (!cat) return [];
    return (cat.subcategories || []).map((sc) => ({
      value: sc.subcategoryId,
      label: sc.name,
      categoryId: cat.id,
      categoryName: cat.name,
    }));
  }, [categories, selectedCategoryId]);

  // Group selected subs by category for preview list
  const groupedSubcats = useMemo(() => {
    const m = new Map<string, string[]>();
    selectedSubcategories.forEach((s) => {
      const arr = m.get(s.categoryName) || [];
      arr.push(s.label);
      m.set(s.categoryName, arr);
    });
    return Array.from(m.entries());
  }, [selectedSubcategories]);

  // react-select styles
  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: 48,
      borderColor: state.isFocused ? "#FFA135" : "#E5E7EB",
      borderWidth: "1px",
      boxShadow: state.isFocused ? "0 0 0 3px rgba(255, 161, 53, 0.1)" : "none",
      "&:hover": { borderColor: "#FFA135" },
      borderRadius: "0.5rem",
      fontSize: "0.95rem",
    }),
    option: (base: any, { isFocused, isSelected }: any) => ({
      ...base,
      backgroundColor: isSelected ? "#FFA135" : isFocused ? "#FFF7ED" : "white",
      color: isSelected ? "white" : "#1F2937",
      cursor: "pointer",
      "&:active": { backgroundColor: "#FF9020" },
    }),
    multiValue: (base: any) => ({
      ...base,
      backgroundColor: "#FFF7ED",
      borderRadius: "0.375rem",
    }),
    multiValueLabel: (base: any) => ({
      ...base,
      color: "#C2410C",
      fontWeight: "500",
    }),
    multiValueRemove: (base: any) => ({
      ...base,
      color: "#C2410C",
      "&:hover": { backgroundColor: "#FFEDD5", color: "#9A3412" },
    }),
  };

  // extend styles to show red error ring when missing required
  const makeSelectStyles = (hasError = false) => ({
    ...selectStyles,
    control: (base: any, state: any) => ({
      ...selectStyles.control(base, state),
      borderColor: hasError ? "#DC2626" : state.isFocused ? "#FFA135" : "#E5E7EB",
      boxShadow: hasError
        ? "0 0 0 3px rgba(220, 38, 38, 0.1)"
        : state.isFocused
          ? "0 0 0 3px rgba(255, 161, 53, 0.1)"
          : "none",
    }),
  });

  // Normalized URLs for existing images (for UI display only)
  const existingImagesNormalized = useMemo(
    () => existingImages.map((v) => fileUrl(v)),
    [existingImages]
  );

  // ── hydrate helper used by edit + draft load ─────────────
  const hydrateFromCampaign = (data: CampaignEditPayload) => {
    // 🔹 keep track of draft (or campaign) _id for future saves
    setDraftId(data._id || null);

    setProductName(data.productOrServiceName || "");
    setDescription(data.description || "");
    setAdditionalNotes(data.additionalNotes || "");
    setCreativeBriefText(data.creativeBriefText || "");
    setExistingImages(Array.isArray(data.images) ? data.images : []);

    // existing brief PDFs from backend
    const briefFiles = Array.isArray(data.creativeBrief) ? data.creativeBrief : [];
    setExistingBriefFiles(briefFiles);
    if (briefFiles.length > 0) {
      setUseFileUploadForBrief(true);
    }

    setAgeRange({
      min: data.targetAudience?.age?.MinAge ?? "",
      max: data.targetAudience?.age?.MaxAge ?? "",
    });
    setSelectedGender(serverGenderToUI(data.targetAudience?.gender ?? 2));

    // locations
    const locIds = (data.targetAudience?.locations || []).map((l) => l.countryId);
    const locOptions = countryOptions.filter((o) => locIds.includes(o.value));
    setSelectedCountries(locOptions);

    setSelectedGoal(data.goal || "");

    // campaign type
    if (data.campaignType) {
      if (CAMPAIGN_TYPE_OPTIONS.some((o) => o.value === data.campaignType)) {
        setCampaignType(data.campaignType);
        setCustomCampaignType("");
      } else {
        setCampaignType("Other");
        setCustomCampaignType(data.campaignType);
      }
    } else {
      setCampaignType("");
      setCustomCampaignType("");
    }

    setBudget(typeof data.budget === "number" ? data.budget : "");

    const sd = data.timeline?.startDate ? data.timeline.startDate.split("T")[0] : "";
    const ed = data.timeline?.endDate ? data.timeline.endDate.split("T")[0] : "";
    setTimeline({ start: sd, end: ed });

    // categories + subcategories (single category, multi subcategories)
    if (Array.isArray(data.categories) && data.categories.length && categories.length) {
      const firstCatId = data.categories[0].categoryId;
      setSelectedCategoryId(firstCatId);

      const cat = categories.find((c) => c.id === firstCatId);
      if (cat) {
        const desiredSubIds = new Set(
          data.categories
            .filter((c) => c.categoryId === firstCatId)
            .map((c) => c.subcategoryId)
        );

        const subs: SubcategoryOption[] = (cat.subcategories || [])
          .filter((sc) => desiredSubIds.has(sc.subcategoryId))
          .map((sc) => ({
            value: sc.subcategoryId,
            label: sc.name,
            categoryId: cat.id,
            categoryName: cat.name,
          }));

        setSelectedSubcategories(subs);
      } else {
        setSelectedSubcategories([]);
      }
    } else {
      setSelectedCategoryId(null);
      setSelectedSubcategories([]);
    }
  };

  // ── fetch reference data ─────────────────────────────────
  useEffect(() => {
    get<Country[]>("/country/getall")
      .then((data) => setCountries(data))
      .catch(() => console.error("Failed to fetch countries"));

    get<CategoriesResponse>("/category/categories")
      .then((res) => setCategories(res?.categories || []))
      .catch(() => console.error("Failed to fetch categories"));
  }, []);

  // ── fetch campaign data if editing ───────────────────────
  useEffect(() => {
    if (!isEditMode || !campaignId) return;
    if (!countries.length || !categories.length) return;

    setIsLoading(true);

    get<CampaignEditPayload>(`/campaign/id?id=${campaignId}`)
      .then((data) => {
        hydrateFromCampaign(data);
      })
      .catch((err) => console.error("Failed to load campaign for editing", err))
      .finally(() => setIsLoading(false));
  }, [isEditMode, campaignId, countries, categories]);

  // ── auto-load draft (only when creating, from backend) ───
  useEffect(() => {
    if (isEditMode || draftLoaded) return;
    if (!countries.length || !categories.length) return;

    const brandId =
      typeof window !== "undefined" ? localStorage.getItem("brandId") || "" : "";

    if (!brandId) return;

    get<CampaignEditPayload>(`/campaign/draft?brandId=${brandId}`)
      .then((draft) => {
        // If backend returns no draft or not a draft, do nothing & NO Swal
        if (!draft || draft.isDraft !== 1) return;

        hydrateFromCampaign(draft);
        setDraftLoaded(true);

        toast({
          icon: "info",
          title: "Draft loaded",
          text: "We restored your last saved campaign draft.",
        });
      })
      .catch((err) => {
        // If 404 (no draft), just ignore; do not show Swal
        console.error("No draft found or failed to load draft", err);
      });
  }, [isEditMode, draftLoaded, countries, categories]);

  // ── handlers & reset ─────────────────────────────────────

  const handleCountriesChange = (value: readonly CountryOption[] | null) => {
    const v = value ? [...value] : [];

    if (v.length <= MAX_COUNTRIES) {
      setSelectedCountries(v as CountryOption[]);
    } else {
      toast({
        icon: "warning",
        title: `Maximum ${MAX_COUNTRIES} countries`,
        text: `You can select up to ${MAX_COUNTRIES} target countries.`,
      });
    }
  };

  const handleProductImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;

    setProductImages((prev) => {
      const existingKeys = new Set(prev.map(makeFileKey));
      const uniqueNew: File[] = [];
      let duplicatesCount = 0;

      for (const f of files) {
        const key = makeFileKey(f);
        if (existingKeys.has(key)) {
          duplicatesCount++;
          continue;
        }
        existingKeys.add(key);
        uniqueNew.push(f);
      }

      if (duplicatesCount > 0) {
        toast({
          icon: "info",
          title: "Duplicate image skipped",
          text:
            duplicatesCount === 1
              ? "One duplicate image was ignored."
              : `${duplicatesCount} duplicate images were ignored.`,
        });
      }

      return [...prev, ...uniqueNew];
    });

    // allow re-selecting the same file again if needed
    e.target.value = "";
  };

  const handleCreativeBriefFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;

    // ✅ append to existing brief files instead of replacing
    setCreativeBriefFiles((prev) => [...prev, ...files]);

    e.target.value = "";
  };

  const removeProductImage = (idx: number) => {
    setProductImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeExistingImage = (idx: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // NEW: remove newly uploaded brief file
  const removeCreativeBriefFile = (idx: number) => {
    setCreativeBriefFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // NEW: remove existing brief from list (e.g. when editing)
  const removeExistingBriefFile = (idx: number) => {
    setExistingBriefFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setProductName("");
    setDescription("");
    setExistingImages([]);
    setProductImages([]);
    setAgeRange({ min: "", max: "" });
    setSelectedGender("");
    setSelectedCountries([]);
    setSelectedCategoryId(null);
    setSelectedSubcategories([]);
    setSelectedGoal("");
    setCampaignType("");
    setCustomCampaignType("");
    setBudget("");
    setTimeline({ start: "", end: "" });
    setCreativeBriefText("");
    setCreativeBriefFiles([]);
    setExistingBriefFiles([]);
    setUseFileUploadForBrief(false);
    setAdditionalNotes("");
    setDraftId(null);
    setDraftLoaded(false);
  };

  // small helpers for preview
  const fmtMoney = (n: number | "") =>
    n === "" ? "—" : `$${Number(n).toLocaleString()}`;
  const fileSizeKB = (b: number) => `${(b / 1024).toFixed(1)} KB`;

  // SweetAlert2 confirm dialogs for Back & Reset
  const handleBackClick = async () => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Leave this page?",
      text: "Any unsaved changes in this campaign form will be lost.",
      showCancelButton: true,
      confirmButtonText: "Leave page",
      cancelButtonText: "Stay",
      confirmButtonColor: "#F97316",
      cancelButtonColor: "#6B7280",
      customClass: {
        popup: "rounded-xl border border-gray-200",
        confirmButton:
          "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white px-4 py-2 rounded-lg",
        cancelButton: "px-4 py-2 rounded-lg",
      },
    });

    if (result.isConfirmed) {
      router.back();
    }
  };

  const handleResetClick = async () => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Reset all fields?",
      text: "This will clear everything you have entered in this campaign form.",
      showCancelButton: true,
      confirmButtonText: "Yes, reset",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#F97316",
      cancelButtonColor: "#6B7280",
      customClass: {
        popup: "rounded-xl border border-gray-200",
        confirmButton:
          "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white px-4 py-2 rounded-lg",
        cancelButton: "px-4 py-2 rounded-lg",
      },
    });

    if (result.isConfirmed) {
      resetForm();
      toast({
        icon: "info",
        title: "Form reset",
        text: "All fields have been cleared.",
      });
    }
  };

  // ── save draft (backend only, using _id logic) ───────────
  const handleSaveDraft = async () => {
    if (isEditMode) {
      toast({
        icon: "info",
        title: "Drafts are for new campaigns",
        text: "This campaign already exists. Use Update to save changes.",
      });
      return;
    }

    const brandId =
      typeof window !== "undefined" ? localStorage.getItem("brandId") || "" : "";

    if (!brandId) {
      toast({
        icon: "error",
        title: "Brand not found",
        text: "Please log in again before saving a draft.",
      });
      return;
    }

    // Backend requires productOrServiceName + goal for drafts
    if (!productName.trim() || !selectedGoal) {
      toast({
        icon: "warning",
        title: "Add title & goal",
        text: "Campaign title and goal are required before saving a draft.",
      });
      return;
    }

    setIsSavingDraft(true);
    try {
      const formData = new FormData();

      // 🔹 send _id if we already have a draft, so backend updates it
      if (draftId) {
        formData.append("_id", draftId);
      }

      formData.append("brandId", brandId);
      formData.append("productOrServiceName", productName.trim());
      formData.append("goal", selectedGoal);

      if (description.trim()) {
        formData.append("description", description.trim());
      }

      // targetAudience (optional fields allowed)
      const ta: any = {
        age: {},
        gender: uiGenderToServer((selectedGender as GenderOption) || "All"),
        locations: [] as string[],
      };

      if (ageRange.min !== "") ta.age.MinAge = ageRange.min;
      if (ageRange.max !== "") ta.age.MaxAge = ageRange.max;
      if (selectedCountries.length) {
        ta.locations = selectedCountries.map((c) => c.value);
      }
      formData.append("targetAudience", JSON.stringify(ta));

      if (selectedSubcategories.length) {
        formData.append(
          "categories",
          JSON.stringify(
            selectedSubcategories.map((s) => ({
              categoryId: s.categoryId,
              subcategoryId: s.value,
            }))
          )
        );
      }

      const finalCampaignTypeDraft =
        campaignType === "Other" ? customCampaignType.trim() : campaignType;
      if (finalCampaignTypeDraft) {
        formData.append("campaignType", finalCampaignTypeDraft);
      }

      if (budget !== "") {
        formData.append("budget", String(budget));
      }

      if (timeline.start || timeline.end) {
        formData.append(
          "timeline",
          JSON.stringify({
            startDate: timeline.start || undefined,
            endDate: timeline.end || undefined,
          })
        );
      }

      if (additionalNotes.trim()) {
        formData.append("additionalNotes", additionalNotes.trim());
      }

      // Images (optional for draft)
      productImages.forEach((f) => formData.append("image", f));

      // Creative brief (optional for drafts)
      if (useFileUploadForBrief) {
        creativeBriefFiles.forEach((f) => formData.append("creativeBrief", f));
      } else if (creativeBriefText.trim()) {
        formData.append("creativeBriefText", creativeBriefText.trim());
      }

      // Backend draft API (saveDraftCampaign)
      const saved = await post<any>("/campaign/save-draft", formData);

      // 🔹 keep the draft _id from backend so next save updates same draft
      const newId = saved?.campaign?._id || saved?._id || draftId || null;
      if (newId) {
        setDraftId(newId);
      }
      setDraftLoaded(true);

      toast({
        icon: "success",
        title: "Draft saved",
        text: "Your campaign draft is stored safely.",
      });
    } catch (err: any) {
      console.error("Failed to save campaign draft", err);
      toast({
        icon: "error",
        title: "Could not save draft",
        text: err?.response?.data?.message || "Please try again.",
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePreview = () => setIsPreviewOpen(true);

  // ── submit (create / update live campaign) ────────────────
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setShowRequiredHints(false);

    const finalCampaignType =
      campaignType === "Other" ? customCampaignType.trim() : campaignType;

    if (
      !productName.trim() ||
      !description.trim() ||
      ageRange.min === "" ||
      ageRange.max === "" ||
      !selectedGender ||
      selectedCountries.length === 0 ||
      !selectedCategoryId ||
      selectedSubcategories.length === 0 ||
      !selectedGoal ||
      !finalCampaignType ||
      budget === "" ||
      !timeline.start ||
      !timeline.end ||
      imagesMissing ||
      (!useFileUploadForBrief && !creativeBriefText.trim()) ||
      (useFileUploadForBrief &&
        creativeBriefFiles.length === 0 &&
        existingBriefFiles.length === 0)
    ) {
      setShowRequiredHints(true);
      setIsPreviewOpen(false);

      toast({
        icon: "warning",
        title: "Please complete all required fields",
        text: "Fields marked with * must be filled before submitting your campaign.",
      });

      return;
    }

    if (Number(ageRange.min) >= Number(ageRange.max)) {
      setIsPreviewOpen(false);
      return toast({
        icon: "error",
        title: "Invalid age range",
        text: "Min Age must be less than Max Age.",
      });
    }

    if (timeline.start && timeline.end && new Date(timeline.start) > new Date(timeline.end)) {
      setIsPreviewOpen(false);
      return toast({
        icon: "error",
        title: "Invalid dates",
        text: "Start Date must be on or before End Date.",
      });
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();

      // 🔹 if this form is based on a loaded draft, send its _id
      if (!isEditMode && draftId) {
        formData.append("_id", draftId);
      }

      formData.append("productOrServiceName", productName.trim());
      formData.append("description", description.trim());
      formData.append(
        "targetAudience",
        JSON.stringify({
          age: { MinAge: ageRange.min, MaxAge: ageRange.max },
          gender: uiGenderToServer(selectedGender),
          locations: selectedCountries.map((c) => c.value),
        })
      );
      formData.append(
        "categories",
        JSON.stringify(
          selectedSubcategories.map((s) => ({
            categoryId: s.categoryId,
            subcategoryId: s.value,
          }))
        )
      );
      formData.append("additionalNotes", additionalNotes.trim());
      formData.append("brandId", localStorage.getItem("brandId") || "");
      formData.append("goal", selectedGoal);
      formData.append("campaignType", finalCampaignType || "");
      formData.append("budget", String(budget));
      formData.append(
        "timeline",
        JSON.stringify({ startDate: timeline.start, endDate: timeline.end })
      );

      productImages.forEach((f) => formData.append("image", f));
      if (useFileUploadForBrief) {
        creativeBriefFiles.forEach((f) => formData.append("creativeBrief", f));
      } else {
        formData.append("creativeBriefText", creativeBriefText.trim());
      }

      if (isEditMode && campaignId) {
        await post(`/campaign/update?id=${campaignId}`, formData);
        toast({
          icon: "success",
          title: "Campaign updated",
          text: "Your changes have been saved successfully.",
        });
      } else {
        await post("/campaign/create", formData);
        toast({
          icon: "success",
          title: "Campaign created",
          text: "Your campaign is live and ready to go.",
        });
      }

      setIsPreviewOpen(false);
      router.push("/brand/created-campaign");
      resetForm();
    } catch (err: any) {
      setIsPreviewOpen(false);
      toast({
        icon: "error",
        title: "Error",
        text: err?.response?.data?.message || "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent mb-4"></div>
          <p className="text-gray-600">Loading campaign data...</p>
        </div>
      </div>
    );
  }

  // ── JSX ───────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
          <div className="mb-8">
            <h1 className="text-4xl font-semibold text-black mb-2">
              {isEditMode ? "Edit Campaign" : "Create New Campaign"}
            </h1>
            <p className="text-gray-600 text-lg">
              {isEditMode
                ? "Update your campaign details below"
                : "Fill in the details to launch your campaign"}
            </p>
          </div>

          <div className="space-y-6">
            {/* Product / Service Info */}
            <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white">
              <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <div className="h-8 w-1 bg-gradient-to-b from-[#FFA135] to-[#FF7236] rounded-full"></div>
                  Product / Service Info
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6 bg-white">
                <div className="space-y-1">
                  <FloatingLabelInput
                    id="productName"
                    label="Campaign Title"
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    required
                  />
                  {showRequiredHints && !productName.trim() && (
                    <p className="text-xs text-red-600">This field is required</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="description"
                    className="text-sm font-medium text-gray-700 mb-2 block"
                  >
                    Description <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    rows={5}
                    placeholder="Provide a detailed description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="resize-none focus:ring-2 focus:ring-orange-500/20"
                    required
                  />
                  {showRequiredHints && !description.trim() && (
                    <p className="text-xs text-red-600">This field is required</p>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor="productImages"
                    className="text-sm font-medium text-gray-700 mb-3 block"
                  >
                    Product Images <span className="text-red-500">*</span>
                  </Label>

                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-orange-400 transition-colors duration-200 bg-gray-50/50">
                    <div className="text-center">
                      <HiOutlineUpload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <label htmlFor="productImages" className="cursor-pointer">
                        <span className="text-orange-600 font-medium hover:text-orange-700">
                          Upload images
                        </span>
                        <span className="text-gray-600"> or drag and drop</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        PNG, JPG, GIF up to 10MB
                      </p>
                      <Input
                        id="productImages"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleProductImages}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {showRequiredHints && imagesMissing && (
                    <p className="text-xs text-red-600 mt-2">
                      At least one product image is required
                    </p>
                  )}

                  {(existingImages.length > 0 || productImages.length > 0) && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {existingImagesNormalized.map((url, idx) => (
                        <div key={`existing-${idx}`} className="relative group">
                          <img
                            src={url}
                            alt={`Existing ${idx + 1}`}
                            className="h-32 w-full object-cover rounded-lg border-2 border-gray-200 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeExistingImage(idx)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                          >
                            <HiOutlineX className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                            Existing
                          </div>
                        </div>
                      ))}
                      {productImages.map((file, idx) => (
                        <div key={`new-${idx}`} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="h-32 w-full object-cover rounded-lg border-2 border-orange-200 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeProductImage(idx)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                          >
                            <HiOutlineX className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                            New
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Target Audience */}
            <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white">
              <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <div className="h-8 w-1 bg-gradient-to-b from-[#FFA135] to-[#FF7236] rounded-full"></div>
                  Target Audience
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6 bg-white">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <FloatingLabelInput
                      id="ageMin"
                      label="Minimum Age"
                      type="number"
                      value={ageRange.min}
                      onChange={(e) =>
                        setAgeRange({
                          ...ageRange,
                          min: e.target.value === "" ? "" : +e.target.value,
                        })
                      }
                      required
                    />
                    {showRequiredHints && ageRange.min === "" && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <FloatingLabelInput
                      id="ageMax"
                      label="Maximum Age"
                      type="number"
                      value={ageRange.max}
                      onChange={(e) =>
                        setAgeRange({
                          ...ageRange,
                          max: e.target.value === "" ? "" : +e.target.value,
                        })
                      }
                      required
                    />
                    {showRequiredHints && ageRange.max === "" && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                    {ageOrderError && (
                      <p className="text-xs text-red-600">
                        Min Age must be less than Max Age.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Gender <span className="text-red-500">*</span>
                  </Label>
                  <ReactSelect
                    options={GENDER_SELECT_OPTIONS}
                    styles={makeSelectStyles(showRequiredHints && !selectedGender) as any}
                    value={
                      selectedGender
                        ? GENDER_SELECT_OPTIONS.find((o) => o.value === selectedGender)
                        : null
                    }
                    onChange={(opt) =>
                      setSelectedGender(
                        ((opt as SimpleOption | null)?.value as GenderOption) || ""
                      )
                    }
                    placeholder="Select gender..."
                    isClearable
                    closeMenuOnSelect
                    blurInputOnSelect={false}
                  />
                  {showRequiredHints && !selectedGender && (
                    <p className="text-xs text-red-600">This field is required</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Target Locations <span className="text-red-500">*</span>
                  </Label>
                  <ReactSelect
                    isMulti
                    closeMenuOnSelect={false}
                    blurInputOnSelect={false}
                    options={countryOptions}
                    styles={selectStyles as any}
                    value={selectedCountries}
                    onChange={(v, _meta) =>
                      handleCountriesChange(v as readonly CountryOption[] | null)
                    }
                    placeholder="Select countries..."
                    filterOption={filterByCountryName}
                  />
                  {showRequiredHints && selectedCountries.length === 0 && (
                    <p className="text-xs text-red-600">This field is required</p>
                  )}
                </div>

                {/* Category & Subcategories */}
                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Category */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Category <span className="text-red-500">*</span>
                    </Label>
                    <ReactSelect
                      options={categorySelectOptions}
                      styles={makeSelectStyles(
                        showRequiredHints && !selectedCategoryId
                      ) as any}
                      value={
                        selectedCategoryId
                          ? categorySelectOptions.find(
                            (o) => o.value === String(selectedCategoryId)
                          ) || null
                          : null
                      }
                      onChange={(opt) => {
                        const val = (opt as SimpleOption | null)?.value;
                        const id = val ? Number(val) : null;
                        setSelectedCategoryId(id);
                        setSelectedSubcategories([]);
                      }}
                      placeholder="Select category..."
                      isClearable
                      closeMenuOnSelect
                      blurInputOnSelect={false}
                    />
                    {showRequiredHints && !selectedCategoryId && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>

                  {/* Subcategories */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Subcategories <span className="text-red-500">*</span>
                    </Label>
                    <ReactSelect
                      isMulti
                      closeMenuOnSelect={false}
                      blurInputOnSelect={false}
                      options={subcategoryOptionsForSelectedCategory}
                      styles={makeSelectStyles(
                        showRequiredHints &&
                        !!selectedCategoryId &&
                        selectedSubcategories.length === 0
                      ) as any}
                      value={selectedSubcategories}
                      onChange={(v) => setSelectedSubcategories(v as SubcategoryOption[])}
                      placeholder={
                        selectedCategoryId
                          ? "Select subcategories..."
                          : "Select a category first"
                      }
                      isDisabled={!selectedCategoryId}
                      noOptionsMessage={() =>
                        selectedCategoryId
                          ? "No matching subcategories"
                          : "Select a category first"
                      }
                    />
                    {showRequiredHints &&
                      selectedCategoryId &&
                      selectedSubcategories.length === 0 && (
                        <p className="text-xs text-red-600">This field is required</p>
                      )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Campaign Details */}
            <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white">
              <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <div className="h-8 w-1 bg-gradient-to-b from-[#FFA135] to-[#FF7236] rounded-full"></div>
                  Campaign Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6 bg-white">
                {/* Campaign Type */}
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Campaign Type <span className="text-red-500">*</span>
                  </Label>
                  <ReactSelect
                    options={CAMPAIGN_TYPE_OPTIONS}
                    styles={makeSelectStyles(showRequiredHints && campaignTypeMissing) as any}
                    value={
                      campaignType
                        ? CAMPAIGN_TYPE_OPTIONS.find((o) => o.value === campaignType)
                        : null
                    }
                    onChange={(opt) => {
                      const val = (opt as SimpleOption | null)?.value || "";
                      setCampaignType(val);
                      if (val !== "Other") setCustomCampaignType("");
                    }}
                    placeholder="Select campaign type..."
                    isClearable
                    closeMenuOnSelect
                    blurInputOnSelect={false}
                  />
                  {campaignType === "Other" && (
                    <div className="mt-3">
                      <Input
                        type="text"
                        placeholder="Enter campaign type"
                        value={customCampaignType}
                        onChange={(e) => setCustomCampaignType(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  )}
                  {showRequiredHints && campaignTypeMissing && (
                    <p className="text-xs text-red-600">This field is required</p>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Campaign Goal <span className="text-red-500">*</span>
                    </Label>
                    <ReactSelect
                      options={GOAL_OPTIONS}
                      styles={makeSelectStyles(showRequiredHints && !selectedGoal) as any}
                      value={
                        selectedGoal
                          ? GOAL_OPTIONS.find((o) => o.value === selectedGoal)
                          : null
                      }
                      onChange={(opt) =>
                        setSelectedGoal(((opt as SimpleOption | null)?.value) || "")
                      }
                      placeholder="Select a goal..."
                      isClearable
                      closeMenuOnSelect
                      blurInputOnSelect={false}
                    />
                    {showRequiredHints && !selectedGoal && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Budget (USD) <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <HiOutlineCurrencyDollar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <input
                        type="number"
                        min={0}
                        placeholder="e.g. 5000"
                        value={budget}
                        onChange={(e) =>
                          setBudget(e.target.value === "" ? "" : +e.target.value)
                        }
                        className="w-full h-12 rounded-lg border border-gray-300 pl-12 pr-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors duration-200"
                        required
                      />
                    </div>
                    {showRequiredHints && budget === "" && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Start Date <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <HiOutlineCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <input
                        type="date"
                        value={timeline.start}
                        onChange={(e) =>
                          setTimeline({ ...timeline, start: e.target.value })
                        }
                        min={todayStr}
                        max={timeline.end || undefined}
                        className="w-full h-12 rounded-lg border border-gray-300 pl-12 pr-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors duration-200"
                        required
                      />
                    </div>
                    {showRequiredHints && !timeline.start && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      End Date <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <HiOutlineCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <input
                        type="date"
                        value={timeline.end}
                        onChange={(e) =>
                          setTimeline({ ...timeline, end: e.target.value })
                        }
                        min={timeline.start || undefined}
                        className="w-full h-12 rounded-lg border border-gray-300 pl-12 pr-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors duration-200"
                        required
                      />
                    </div>
                    {dateOrderError && (
                      <p className="text-xs text-red-600">
                        End Date must be on or after Start Date.
                      </p>
                    )}
                    {showRequiredHints && !timeline.end && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Creative Brief & Notes */}
            <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white">
              <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <div className="h-8 w-1 bg-gradient-to-b from-[#FFA135] to-[#FF7236] rounded-full"></div>
                  Creative Brief & Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6 bg-white">
                <div className="flex gap-3">
                  <Button
                    type="button"
                    size="lg"
                    variant={useFileUploadForBrief ? "outline" : "default"}
                    onClick={() => setUseFileUploadForBrief(false)}
                    className={
                      !useFileUploadForBrief
                        ? "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-90"
                        : ""
                    }
                  >
                    <HiOutlinePlus className="mr-2 h-5 w-5" /> Write Brief
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant={useFileUploadForBrief ? "default" : "outline"}
                    onClick={() => setUseFileUploadForBrief(true)}
                    className={
                      useFileUploadForBrief
                        ? "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-90"
                        : ""
                    }
                  >
                    <HiOutlinePhotograph className="mr-2 h-5 w-5" /> Upload Files
                  </Button>
                </div>

                {useFileUploadForBrief ? (
                  <div>
                    <Label
                      htmlFor="creativeBriefFiles"
                      className="text-sm font-medium text-gray-700 mb-3 block"
                    >
                      Upload Creative Brief Documents{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-orange-400 transition-colors duration-200 bg-gray-50/50">
                      <div className="text-center">
                        <HiOutlineUpload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                        <label htmlFor="creativeBriefFiles" className="cursor-pointer">
                          <span className="text-orange-600 font-medium hover:text-orange-700">
                            Upload documents
                          </span>
                          <span className="text-gray-600"> or drag and drop</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          PDF, DOC, DOCX up to 10MB
                        </p>
                        <Input
                          id="creativeBriefFiles"
                          type="file"
                          accept=".pdf,.doc,.docx"
                          multiple
                          onChange={handleCreativeBriefFiles}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {existingBriefFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {existingBriefFiles.map((filename, idx) => (
                          <div
                            key={`existing-brief-${idx}`}
                            className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                          >
                            <a
                              href={fileUrl(filename)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 flex-1 min-w-0 hover:bg-orange-100 rounded-md px-2 py-1 -mx-2 -my-1"
                            >
                              <HiOutlineCheckCircle className="h-5 w-5 text-orange-600" />
                              <span className="text-sm font-medium text-gray-700 truncate">
                                {filename}
                              </span>
                            </a>
                            <button
                              type="button"
                              onClick={() => removeExistingBriefFile(idx)}
                              className="ml-3 text-red-500 hover:text-red-700"
                              aria-label="Remove document"
                            >
                              <HiOutlineX className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {creativeBriefFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {creativeBriefFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <HiOutlineCheckCircle className="h-5 w-5 text-orange-600" />
                              <span className="text-sm font-medium text-gray-700 truncate">
                                {file.name}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 mr-3">
                              {fileSizeKB(file.size)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeCreativeBriefFile(idx)}
                              className="text-red-500 hover:text-red-700"
                              aria-label="Remove document"
                            >
                              <HiOutlineX className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* required hint for upload mode */}
                    {showRequiredHints &&
                      useFileUploadForBrief &&
                      creativeBriefFiles.length === 0 &&
                      existingBriefFiles.length === 0 && (
                        <p className="text-xs text-red-600 mt-2">
                          At least one creative brief document is required
                        </p>
                      )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label
                      htmlFor="briefText"
                      className="text-sm font-medium text-gray-700 mb-2 block"
                    >
                      Creative Brief <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="briefText"
                      rows={6}
                      placeholder="Outline your creative vision, key messaging, tone, style..."
                      value={creativeBriefText}
                      onChange={(e) => setCreativeBriefText(e.target.value)}
                      className="resize-none focus:ring-2 focus:ring-orange-500/20"
                      required
                    />
                    {showRequiredHints &&
                      !useFileUploadForBrief &&
                      !creativeBriefText.trim() && (
                        <p className="text-xs text-red-600">This field is required</p>
                      )}
                  </div>
                )}

                <div>
                  <Label
                    htmlFor="additionalNotes"
                    className="text-sm font-medium text-gray-700 mb-2 block"
                  >
                    Additional Notes
                  </Label>
                  <Textarea
                    id="additionalNotes"
                    rows={4}
                    placeholder="Any extra comments, requirements, or special instructions..."
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    className="resize-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[var(--brand-sidebar-w)] border-t border-gray-200 bg-white/95 backdrop-blur-lg shadow-2xl z-30 transition-[left] duration-300 ease-in-out">
        <div
          className="mx-auto max-w-5xl flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 px-4 sm:px-6 lg:px-8 py-4"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        >
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={handleBackClick}
              disabled={isSubmitting}
              size="lg"
            >
              Back
            </Button>
            <Button
              variant="outline"
              onClick={handleResetClick}
              disabled={isSubmitting}
              size="lg"
            >
              Reset
            </Button>

            {!isEditMode && (
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isSubmitting || isSavingDraft}
                size="lg"
              >
                {isSavingDraft ? "Saving..." : "Save Draft"}
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={isSubmitting}
              size="lg"
            >
              Preview
            </Button>
          </div>

          <button
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className={`
              inline-flex items-center justify-center
              bg-gradient-to-r from-[#FFA135] to-[#FF7236]
              text-white font-semibold text-base
              px-8 py-3 rounded-lg shadow-lg
              transition-all duration-200
              ${isSubmitting
                ? "opacity-50 cursor-not-allowed"
                : "hover:scale-105 hover:shadow-xl active:scale-95"
              }
            `}
          >
            {isSubmitting ? (
              <>
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                Submitting...
              </>
            ) : isEditMode ? (
              "Update Campaign"
            ) : (
              "Create Campaign"
            )}
          </button>
        </div>
      </div>

      {/* ───────────────── Preview Modal ───────────────── */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="min-w-3xl max-h-[80vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {isEditMode ? "Preview Changes" : "Preview Campaign"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 ">
            {/* Product / Service */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Product / Service
              </h3>
              <div className="grid gap-3">
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <div className="text-gray-900">{productName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Description</div>
                  <div className="text-gray-900 whitespace-pre-wrap">
                    {description || "—"}
                  </div>
                </div>
                {(existingImages.length > 0 || productImages.length > 0) && (
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Images</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {existingImagesNormalized.map((url, i) => (
                        <img
                          key={`ex-${i}`}
                          src={url}
                          alt={`existing-${i}`}
                          className="h-24 w-full object-cover rounded border"
                        />
                      ))}
                      {productImages.map((file, i) => (
                        <img
                          key={`new-${i}`}
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="h-24 w-full object-cover rounded border"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            {/* Target Audience */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Target Audience
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500">Age</div>
                  <div className="text-gray-900">
                    {ageRange.min || "—"}–{ageRange.max || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Gender</div>
                  <div className="text-gray-900">{selectedGender || "—"}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs text-gray-500 mb-1">Locations</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCountries.length ? (
                      selectedCountries.map((c) => (
                        <Badge
                          key={c.value}
                          variant="outline"
                          className="bg-orange-50 text-orange-700"
                        >
                          {c.country.flag} {c.country.countryName}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Categories */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Categories
              </h3>
              {groupedSubcats.length ? (
                <div className="space-y-2">
                  {groupedSubcats.map(([catName, subs]) => (
                    <div key={catName}>
                      <div className="text-xs text-gray-500 mb-1">
                        {catName}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {subs.map((s, i) => (
                          <Badge
                            key={`${catName}-${i}`}
                            variant="outline"
                            className="bg-orange-50 text-orange-700"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500">—</div>
              )}
            </section>

            <Separator />

            {/* Campaign Details */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Campaign Details
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500">Type</div>
                  <div className="text-gray-900">
                    {finalCampaignTypeForUI || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Goal</div>
                  <div className="text-gray-900">{selectedGoal || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Budget</div>
                  <div className="text-gray-900">{fmtMoney(budget)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Start</div>
                  <div className="text-gray-900">{timeline.start || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">End</div>
                  <div className="text-gray-900">{timeline.end || "—"}</div>
                </div>
              </div>
            </section>

            <Separator />

            {/* Brief & Notes */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Creative Brief & Notes
              </h3>
              {useFileUploadForBrief ? (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Files</div>
                  {existingBriefFiles.length || creativeBriefFiles.length ? (
                    <div className="space-y-1">
                      {existingBriefFiles.map((filename, i) => (
                        <div
                          key={`prev-file-${i}`}
                          className="text-gray-800 text-sm flex items-center justify-between rounded border px-3 py-2 bg-orange-50"
                        >
                          <span className="truncate">{filename}</span>
                          <span className="text-gray-500 text-xs">Existing</span>
                        </div>
                      ))}
                      {creativeBriefFiles.map((f, i) => (
                        <div
                          key={`new-file-${i}`}
                          className="text-gray-800 text-sm flex items-center justify-between rounded border px-3 py-2 bg-orange-50"
                        >
                          <span className="truncate">{f.name}</span>
                          <span className="text-gray-500 text-xs">
                            {fileSizeKB(f.size)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500">No files attached.</div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Brief Text</div>
                  <div className="text-gray-900 whitespace-pre-wrap">
                    {creativeBriefText || "—"}
                  </div>
                </div>
              )}
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-1">Additional Notes</div>
                <div className="text-gray-900 whitespace-pre-wrap">
                  {additionalNotes || "—"}
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Keep Editing
            </Button>
            <Button
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white"
            >
              {isSubmitting
                ? "Submitting..."
                : isEditMode
                  ? "Confirm Update"
                  : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── API payload interface ──────────────────────────────────

interface CampaignEditPayload {
  _id?: string;
  isDraft?: number;

  productOrServiceName: string;
  description: string;
  images: string[];
  creativeBrief?: string[];
  targetAudience: {
    age: { MinAge: number; MaxAge: number };
    gender: 0 | 1 | 2;
    locations: { countryId: string; countryName: string; _id: string }[];
  };
  categories?: {
    categoryId: number;
    categoryName: string;
    subcategoryId: string;
    subcategoryName: string;
  }[];
  goal: string;
  budget: number;
  timeline: { startDate?: string; endDate?: string };
  creativeBriefText: string;
  additionalNotes: string;
  campaignType?: string;
}
