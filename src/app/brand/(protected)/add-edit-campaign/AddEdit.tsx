"use client";

import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.css";
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
import type { FilterOptionOption, GroupBase } from "react-select";

// ── types ───────────────────────────────────────────────────

type GenderOption = "Male" | "Female" | "All";
const GENDER_OPTIONS: GenderOption[] = ["Male", "Female", "All"];

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
  categoryId: number; // category _id
  categoryName: string; // category name
}

interface CampaignEditPayload {
  productOrServiceName: string;
  description: string;
  images: string[];
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
  timeline: { startDate: string; endDate: string };
  creativeBriefText: string;
  additionalNotes: string;
}

// ── helpers ─────────────────────────────────────────────────

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

const DRAFT_KEY = "campaignDraft";

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
  const [ageRange, setAgeRange] = useState<{ min: number | ""; max: number | "" }>({ min: "", max: "" });
  const [selectedGender, setSelectedGender] = useState<GenderOption | "">("");

  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<CountryOption[]>([]);

  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<SubcategoryOption[]>([]);

  const [selectedGoal, setSelectedGoal] = useState<string>("");
  const [budget, setBudget] = useState<number | "">("");
  const [timeline, setTimeline] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [creativeBriefText, setCreativeBriefText] = useState("");
  const [creativeBriefFiles, setCreativeBriefFiles] = useState<File[]>([]);
  const [useFileUploadForBrief, setUseFileUploadForBrief] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRequiredHints, setShowRequiredHints] = useState(false);
  const ageOrderError =
    ageRange.min !== "" &&
    ageRange.max !== "" &&
    Number(ageRange.min) >= Number(ageRange.max);
  const dateOrderError =
    !!(timeline.start && timeline.end && new Date(timeline.start) >= new Date(timeline.end));

  const [draftLoaded, setDraftLoaded] = useState(false);

  // preview modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // ── memoised options ─────────────────────────────────────
  const countryOptions = useMemo<CountryOption[]>(() => buildCountryOptions(countries), [countries]);

  const categoryGroups = useMemo<GroupBase<SubcategoryOption>[]>(
    () =>
      categories.map((cat) => ({
        label: cat.name,
        options: (cat.subcategories || []).map((sc) => ({
          value: sc.subcategoryId,
          label: sc.name,
          categoryId: cat.id,      // ✅ numeric Category.id
          categoryName: cat.name,
        })),
      })),
    [categories]
  );

  const allSubcategoryOptions: SubcategoryOption[] = useMemo(
    () => categoryGroups.flatMap((g) => g.options || []),
    [categoryGroups]
  );

  // Group selected subs by category for a nice preview list
  const groupedSubcats = useMemo(() => {
    const m = new Map<string, string[]>();
    selectedSubcategories.forEach((s) => {
      const arr = m.get(s.categoryName) || [];
      arr.push(s.label);
      m.set(s.categoryName, arr);
    });
    return Array.from(m.entries()); // [ [categoryName, [sub1, sub2]], ... ]
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
    multiValue: (base: any) => ({ ...base, backgroundColor: "#FFF7ED", borderRadius: "0.375rem" }),
    multiValueLabel: (base: any) => ({ ...base, color: "#C2410C", fontWeight: "500" }),
    multiValueRemove: (base: any) => ({
      ...base,
      color: "#C2410C",
      "&:hover": { backgroundColor: "#FFEDD5", color: "#9A3412" },
    }),
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
    if (!isEditMode || !campaignId || countries.length === 0) return;
    setIsLoading(true);

    get<CampaignEditPayload>(`/campaign/id?id=${campaignId}`)
      .then((data) => {
        setProductName(data.productOrServiceName);
        setDescription(data.description);
        setAdditionalNotes(data.additionalNotes);
        setCreativeBriefText(data.creativeBriefText);
        setExistingImages(data.images || []);
        setAgeRange({ min: data.targetAudience.age.MinAge, max: data.targetAudience.age.MaxAge });
        setSelectedGender(serverGenderToUI(data.targetAudience.gender));

        // locations
        const locIds = data.targetAudience.locations.map((l) => l.countryId);
        const locOptions = countryOptions.filter((o) => locIds.includes(o.value));
        setSelectedCountries(locOptions);

        setSelectedGoal(data.goal);
        setBudget(data.budget);
        setTimeline({
          start: data.timeline.startDate.split("T")[0],
          end: data.timeline.endDate.split("T")[0],
        });

        // prefill subcategories if present in payload
        if (Array.isArray(data.categories) && data.categories.length && allSubcategoryOptions.length) {
          const desired = new Set(data.categories.map((c) => c.subcategoryId));
          setSelectedSubcategories(allSubcategoryOptions.filter((o) => desired.has(o.value)));
        }
      })
      .catch((err) => console.error("Failed to load campaign for editing", err))
      .finally(() => setIsLoading(false));
  }, [isEditMode, campaignId, countries, countryOptions, allSubcategoryOptions]);

  // ── auto-load draft (only when creating) ─────────────────
  useEffect(() => {
    if (isEditMode || draftLoaded) return;
    if (!countries.length || !categories.length) return;

    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);

      setProductName(draft.productName || "");
      setDescription(draft.description || "");
      setExistingImages(Array.isArray(draft.existingImages) ? draft.existingImages : []);
      setAgeRange(draft.ageRange || { min: "", max: "" });
      setSelectedGender(draft.selectedGender || "");

      if (Array.isArray(draft.selectedCountries)) {
        const wanted = new Set(draft.selectedCountries.map((x: CountryOption) => x.value));
        setSelectedCountries(countryOptions.filter((o) => wanted.has(o.value)));
      }

      if (Array.isArray(draft.selectedSubcategories)) {
        const wanted = new Set(draft.selectedSubcategories.map((x: SubcategoryOption) => x.value));
        setSelectedSubcategories(allSubcategoryOptions.filter((o) => wanted.has(o.value)));
      }

      setSelectedGoal(draft.selectedGoal || "");
      setBudget(draft.budget ?? "");
      setTimeline(draft.timeline || { start: "", end: "" });
      setCreativeBriefText(draft.creativeBriefText || "");
      setUseFileUploadForBrief(Boolean(draft.useFileUploadForBrief));
      setAdditionalNotes(draft.additionalNotes || "");

      setDraftLoaded(true);
      toast({ icon: "info", title: "Draft Loaded", text: "We restored your saved draft." });
    } catch {
      // ignore bad JSON
    }
  }, [isEditMode, draftLoaded, countries.length, categories.length, countryOptions, allSubcategoryOptions]);

  // ── toast helper ─────────────────────────────────────────
  const toast = (opts: { icon: "success" | "error" | "warning" | "info"; title: string; text?: string }) =>
    Swal.fire({
      ...opts,
      showConfirmButton: false,
      timer: 1200,
      timerProgressBar: true,
      background: "white",
      customClass: {
        icon: `
          bg-gradient-to-r from-[#FFA135] to-[#FF7236]
          bg-clip-text text-transparent
        `,
        popup: "rounded-lg border border-gray-200",
      },
    });

  // ── handlers & reset ─────────────────────────────────────
  const handleProductImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setProductImages(Array.from(e.target.files));
  };
  const handleCreativeBriefFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setCreativeBriefFiles(Array.from(e.target.files));
  };
  const removeProductImage = (idx: number) => {
    setProductImages(productImages.filter((_, i) => i !== idx));
  };
  const removeExistingImage = (idx: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== idx));
  };
  const resetForm = () => {
    setProductName("");
    setDescription("");
    setExistingImages([]);
    setProductImages([]);
    setAgeRange({ min: "", max: "" });
    setSelectedGender("");
    setSelectedCountries([]);
    setSelectedSubcategories([]);
    setSelectedGoal("");
    setBudget("");
    setTimeline({ start: "", end: "" });
    setCreativeBriefText("");
    setCreativeBriefFiles([]);
    setUseFileUploadForBrief(false);
    setAdditionalNotes("");
  };

  // small helpers for preview
  const fmtMoney = (n: number | "") =>
    n === "" ? "—" : `$${Number(n).toLocaleString()}`;
  const fileSizeKB = (b: number) => `${(b / 1024).toFixed(1)} KB`;

  // ── Save Draft & Preview ─────────────────────────────────
  const handleSaveDraft = () => {
    try {
      const draft = {
        productName,
        description,
        existingImages,
        ageRange,
        selectedGender,
        selectedCountries,
        selectedSubcategories,
        selectedGoal,
        budget,
        timeline,
        creativeBriefText,
        useFileUploadForBrief,
        additionalNotes,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      toast({ icon: "success", title: "Draft Saved", text: "You can continue later." });
    } catch {
      toast({ icon: "error", title: "Could not save draft" });
    }
  };

  const handlePreview = () => {
    setIsPreviewOpen(true);
  };

  // ── submit ───────────────────────────────────────────────
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setShowRequiredHints(false);

    if (
      !productName.trim() ||
      !description.trim() ||
      ageRange.min === "" ||
      ageRange.max === "" ||
      !selectedGender ||
      selectedCountries.length === 0 ||
      selectedSubcategories.length === 0 ||
      !selectedGoal ||
      budget === "" ||
      !timeline.start ||
      !timeline.end ||
      (!creativeBriefText.trim() && !useFileUploadForBrief)
    ) {
      setShowRequiredHints(true);
      setIsPreviewOpen(false);
      return; // no popup; show only inline hints
    }
    if (Number(ageRange.min) >= Number(ageRange.max)) {
      setIsPreviewOpen(false);
      return toast({ icon: "error", title: "Invalid Age Range", text: "Min Age must be less than Max Age." });
    }
    if (timeline.start && timeline.end && new Date(timeline.start) >= new Date(timeline.end)) {
      setIsPreviewOpen(false);
      return toast({ icon: "error", title: "Invalid Dates", text: "Start Date must be before End Date." });
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
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
            categoryId: s.categoryId,   // number ✅
            subcategoryId: s.value
          }))
        )
      );
      formData.append("additionalNotes", additionalNotes.trim());
      formData.append("brandId", localStorage.getItem("brandId") || "");
      formData.append("goal", selectedGoal);
      formData.append("budget", String(budget));
      formData.append("timeline", JSON.stringify({ startDate: timeline.start, endDate: timeline.end }));

      productImages.forEach((f) => formData.append("image", f));
      if (useFileUploadForBrief) {
        creativeBriefFiles.forEach((f) => formData.append("creativeBrief", f));
      } else {
        formData.append("creativeBriefText", creativeBriefText.trim());
      }

      if (isEditMode && campaignId) {
        await post(`/campaign/update?id=${campaignId}`, formData);
        toast({ icon: "success", title: "Campaign Updated" });
      } else {
        await post("/campaign/create", formData);
        toast({ icon: "success", title: "Campaign Created" });
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch { }
      }

      setIsPreviewOpen(false);
      router.push("/brand/created-campaign");
      resetForm();
    } catch (err: any) {
      setIsPreviewOpen(false);
      toast({ icon: "error", title: "Error", text: err?.response?.data?.message || "Please try again." });
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
              {isEditMode ? "Update your campaign details below" : "Fill in the details to launch your campaign"}
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
                    label="Product / Service Name"
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
                  <Label htmlFor="description" className="text-sm font-medium text-gray-700 mb-2 block">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    rows={5}
                    placeholder="Provide a detailed description of your product or service..."
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
                  <Label htmlFor="productImages" className="text-sm font-medium text-gray-700 mb-3 block">
                    Product Images
                  </Label>

                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-orange-400 transition-colors duration-200 bg-gray-50/50">
                    <div className="text-center">
                      <HiOutlineUpload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <label htmlFor="productImages" className="cursor-pointer">
                        <span className="text-orange-600 font-medium hover:text-orange-700">Upload images</span>
                        <span className="text-gray-600"> or drag and drop</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB</p>
                      <Input id="productImages" type="file" accept="image/*" multiple onChange={handleProductImages} className="hidden" />
                    </div>
                  </div>

                  {(existingImages.length > 0 || productImages.length > 0) && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {existingImages.map((url, idx) => (
                        <div key={`existing-${idx}`} className="relative group">
                          <img src={url} alt={`Existing ${idx + 1}`} className="h-32 w-full object-cover rounded-lg border-2 border-gray-200 shadow-sm" />
                          <button type="button" onClick={() => removeExistingImage(idx)} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600">
                            <HiOutlineX className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">Existing</div>
                        </div>
                      ))}
                      {productImages.map((file, idx) => (
                        <div key={`new-${idx}`} className="relative group">
                          <img src={URL.createObjectURL(file)} alt={file.name} className="h-32 w-full object-cover rounded-lg border-2 border-orange-200 shadow-sm" />
                          <button type="button" onClick={() => removeProductImage(idx)} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600">
                            <HiOutlineX className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">New</div>
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
                      onChange={(e) => setAgeRange({ ...ageRange, min: e.target.value === "" ? "" : +e.target.value })}
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
                      onChange={(e) => setAgeRange({ ...ageRange, max: e.target.value === "" ? "" : +e.target.value })}
                      required
                    />
                    {showRequiredHints && ageRange.max === "" && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                    {ageOrderError && (
                      <p className="text-xs text-red-600">Min Age must be less than Max Age.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Gender</Label>
                  <select
                    value={selectedGender}
                    onChange={(e) => setSelectedGender(e.target.value as GenderOption)}
                    required
                    className="block w-full h-12 rounded-lg border border-gray-300 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors duration-200"
                  >
                    <option value="" disabled>
                      Select gender
                    </option>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  {showRequiredHints && !selectedGender && (
                    <p className="text-xs text-red-600">This field is required</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Target Locations</Label>
                  <ReactSelect
                    isMulti
                    closeMenuOnSelect={false}
                    blurInputOnSelect={false}
                    options={countryOptions}
                    styles={selectStyles as any}
                    value={selectedCountries}
                    onChange={(v) => setSelectedCountries(v as CountryOption[])}
                    placeholder="Select countries..."
                    filterOption={filterByCountryName}
                  />
                  {showRequiredHints && selectedCountries.length === 0 && (
                    <p className="text-xs text-red-600">This field is required</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Categories & Subcategories</Label>
                  <ReactSelect
                    isMulti
                    closeMenuOnSelect={false}
                    blurInputOnSelect={false}
                    options={categoryGroups as unknown as GroupBase<SubcategoryOption>[]}
                    styles={selectStyles as any}
                    value={selectedSubcategories}
                    onChange={(v) => setSelectedSubcategories(v as SubcategoryOption[])}
                    placeholder="Search & choose subcategories..."
                    noOptionsMessage={() => "No matching subcategories"}
                  />
                  {showRequiredHints && selectedSubcategories.length === 0 && (
                    <p className="text-xs text-red-600">This field is required</p>
                  )}
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
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Campaign Goal</Label>
                    <select
                      value={selectedGoal}
                      onChange={(e) => setSelectedGoal(e.target.value)}
                      required
                      className="block w-full h-12 rounded-lg border border-gray-300 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors duration-200"
                    >
                      <option value="" disabled>
                        Select a goal
                      </option>
                      {["Brand Awareness", "Sales", "Engagement"].map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    {showRequiredHints && !selectedGoal && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Budget (USD)</Label>
                    <div className="relative">
                      <HiOutlineCurrencyDollar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <input
                        type="number"
                        min={0}
                        placeholder="e.g. 5000"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value === "" ? "" : +e.target.value)}
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
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Start Date</Label>
                    <div className="relative">
                      <HiOutlineCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <input
                        type="date"
                        value={timeline.start}
                        onChange={(e) => setTimeline({ ...timeline, start: e.target.value })}
                        className="w-full h-12 rounded-lg border border-gray-300 pl-12 pr-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors duration-200"
                        required
                      />
                    </div>
                    {/* Show date order error only below End Date */}
                    {showRequiredHints && !timeline.start && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">End Date</Label>
                    <div className="relative">
                      <HiOutlineCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <input
                        type="date"
                        value={timeline.end}
                        onChange={(e) => setTimeline({ ...timeline, end: e.target.value })}
                        className="w-full h-12 rounded-lg border border-gray-300 pl-12 pr-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors duration-200"
                        required
                      />
                    </div>
                    {dateOrderError && (
                      <p className="text-xs text-red-600">End Date must be after Start Date.</p>
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
                    className={!useFileUploadForBrief ? "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-90" : ""}
                  >
                    <HiOutlinePlus className="mr-2 h-5 w-5" /> Write Brief
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant={useFileUploadForBrief ? "default" : "outline"}
                    onClick={() => setUseFileUploadForBrief(true)}
                    className={useFileUploadForBrief ? "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-90" : ""}
                  >
                    <HiOutlinePhotograph className="mr-2 h-5 w-5" /> Upload Files
                  </Button>
                </div>

                {useFileUploadForBrief ? (
                  <div>
                    <Label htmlFor="creativeBriefFiles" className="text-sm font-medium text-gray-700 mb-3 block">
                      Upload Creative Brief Documents
                    </Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-orange-400 transition-colors duration-200 bg-gray-50/50">
                      <div className="text-center">
                        <HiOutlineUpload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                        <label htmlFor="creativeBriefFiles" className="cursor-pointer">
                          <span className="text-orange-600 font-medium hover:text-orange-700">Upload documents</span>
                          <span className="text-gray-600"> or drag and drop</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX up to 10MB</p>
                        <Input id="creativeBriefFiles" type="file" accept=".pdf,.doc,.docx" multiple onChange={handleCreativeBriefFiles} className="hidden" />
                      </div>
                    </div>
                    {creativeBriefFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {creativeBriefFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <HiOutlineCheckCircle className="h-5 w-5 text-orange-600" />
                              <span className="text-sm font-medium text-gray-700">{file.name}</span>
                            </div>
                            <span className="text-xs text-gray-500">{fileSizeKB(file.size)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor="briefText" className="text-sm font-medium text-gray-700 mb-2 block">
                      Creative Brief
                    </Label>
                    <Textarea
                      id="briefText"
                      rows={6}
                      placeholder="Outline your creative vision, key messaging, tone, style preferences..."
                      value={creativeBriefText}
                      onChange={(e) => setCreativeBriefText(e.target.value)}
                      className="resize-none focus:ring-2 focus:ring-orange-500/20"
                      required
                    />
                    {showRequiredHints && !useFileUploadForBrief && !creativeBriefText.trim() && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="additionalNotes" className="text-sm font-medium text-gray-700 mb-2 block">
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
            <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting} size="lg">
              Back
            </Button>
            <Button variant="outline" onClick={resetForm} disabled={isSubmitting} size="lg">
              Reset
            </Button>
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSubmitting} size="lg">
              Save Draft
            </Button>
            <Button variant="outline" onClick={handlePreview} disabled={isSubmitting} size="lg">
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
              ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:scale-105 hover:shadow-xl active:scale-95"}
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
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Product / Service</h3>
              <div className="grid gap-3">
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <div className="text-gray-900">{productName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Description</div>
                  <div className="text-gray-900 whitespace-pre-wrap">{description || "—"}</div>
                </div>
                {(existingImages.length > 0 || productImages.length > 0) && (
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Images</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {existingImages.map((url, i) => (
                        <img key={`ex-${i}`} src={url} alt={`existing-${i}`} className="h-24 w-full object-cover rounded border" />
                      ))}
                      {productImages.map((file, i) => (
                        <img key={`new-${i}`} src={URL.createObjectURL(file)} alt={file.name} className="h-24 w-full object-cover rounded border" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            {/* Target Audience */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Target Audience</h3>
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
                    {selectedCountries.length
                      ? selectedCountries.map((c) => (
                        <Badge key={c.value} variant="outline" className="bg-orange-50 text-orange-700">
                          {c.country.flag} {c.country.countryName}
                        </Badge>
                      ))
                      : <span className="text-gray-500">—</span>}
                  </div>
                </div>
              </div>
            </section>

            {/* Categories */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Categories</h3>
              {groupedSubcats.length ? (
                <div className="space-y-2">
                  {groupedSubcats.map(([catName, subs]) => (
                    <div key={catName}>
                      <div className="text-xs text-gray-500 mb-1">{catName}</div>
                      <div className="flex flex-wrap gap-2">
                        {subs.map((s, i) => (
                          <Badge key={`${catName}-${i}`} variant="outline" className="bg-orange-50 text-orange-700">
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
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Campaign Details</h3>
              <div className="grid sm:grid-cols-2 gap-3">
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
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Creative Brief & Notes</h3>
              {useFileUploadForBrief ? (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Files</div>
                  {creativeBriefFiles.length ? (
                    <div className="space-y-1">
                      {creativeBriefFiles.map((f, i) => (
                        <div key={i} className="text-gray-800 text-sm flex items-center justify-between rounded border px-3 py-2 bg-orange-50">
                          <span className="truncate">{f.name}</span>
                          <span className="text-gray-500 text-xs">{fileSizeKB(f.size)}</span>
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
                  <div className="text-gray-900 whitespace-pre-wrap">{creativeBriefText || "—"}</div>
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
              {isSubmitting ? "Submitting..." : isEditMode ? "Confirm Update" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
