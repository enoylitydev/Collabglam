"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  Component,
  ErrorInfo,
  ReactNode,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import Select, { GroupBase, OptionsOrGroups } from "react-select";
import { toast } from "sonner";

/* ------------------------------ UI imports ------------------------------ */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

/* ----------------------------- Icon imports ----------------------------- */
import {
  Plus,
  Trash2,
  ChevronLeft,
  Download,
  Edit3,
  X,
  Mail,
  Globe,
  AlertCircle,
  Loader2,
  Users,
  TrendingUp,
  Monitor,
  PieChart,
  RefreshCw,
  Camera,
  Star,
  MapPin,
  Calendar,
  Eye,
  Heart,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

/* ----------------------------- Lib utilities ---------------------------- */
import { cn } from "@/lib/utils";
import { get, post } from "@/lib/api";

/* --------------------------------------------------------------------------
 * CONSTANTS
 * ----------------------------------------------------------------------- */
const API_ENDPOINTS = {
  MEDIA_KIT_GET: "/media-kit/influencer",
  MEDIA_KIT_UPDATE: "/media-kit/update",
  COUNTRIES_GET_ALL: "/country/getall",
  AUDIENCE_RANGES_GET_ALL: "/audienceRange/getall",
} as const;

const VALIDATION_RULES = {
  MIN_FOLLOWERS: 0,
  MAX_FOLLOWERS: Number.MAX_SAFE_INTEGER,
  MIN_ENGAGEMENT_RATE: 0,
  MAX_ENGAGEMENT_RATE: 100,
  MAX_BIO_LENGTH: 1000,
  MAX_NAME_LENGTH: 100,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

const COLORS = {
  PRIMARY_GRADIENT: "from-[#FFBF00] to-[#FFDB58]",
  PRIMARY_HOVER: "from-[#E6AC00] to-[#E6C247]",
  SUCCESS: "#10B981",
  ERROR: "#EF4444",
} as const;

/* --------------------------------------------------------------------------
 * TYPES
 * ----------------------------------------------------------------------- */
export interface AudienceBifurcation {
  malePercentage: number;
  femalePercentage: number;
}

/** Country slice after normalisation (UI‑side) */
export interface CountrySlice {
  _id: string; // maps to countryId in back‑end
  name: string;
  percentage: number;
}

/** Age slice after normalisation (UI‑side) */
export interface AgeSlice {
  _id: string; // maps to audienceRangeId in back‑end
  range: string;
  percentage: number;
}

export interface MediaKit {
  influencerId: string;
  name: string;
  profileImage: string;
  bio: string;
  followers: number;
  engagementRate: number;
  platformName: string;
  categories: string[];
  audienceBifurcation: AudienceBifurcation;
  topCountries: CountrySlice[];
  ageBreakdown: AgeSlice[];
  interests: string[];
  gallery: string[];
  rateCard?: string;
  notes?: string;
  mediaKitPdf?: string;
  email?: string;
  website?: string;
}

export interface ValidationError {
  field: keyof MediaKit;
  message: string;
}

export interface Country {
  _id: string;
  countryName: string;
  callingCode: string;
  countryCode: string;
  flag: string;
}

export interface CountryOption {
  value: string;
  label: string;
  country: Country;
}

export interface AgeOption {
  value: string;
  label: string;
  _id: string;
}

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface EditingState {
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  validationErrors: ValidationError[];
}

/* --------------------------------------------------------------------------
 * UTILS
 * ----------------------------------------------------------------------- */
const isValidEmail = (email: string) =>
  VALIDATION_RULES.EMAIL_REGEX.test(email.trim());

const isValidUrl = (url: string) => {
  try {
    new URL(url.startsWith("http") ? url : `https://${url}`);
    return true;
  } catch {
    return false;
  }
};

/** Map raw country slice (from API) into UI shape */
const mapCountrySlice = (raw: any): CountrySlice => ({
  _id: raw.countryId ?? raw._id ?? "",
  name: raw.name ?? raw.label ?? "",
  percentage: Number(raw.percentage) || 0,
});

/** Map raw age slice (from API) into UI shape */
const mapAgeSlice = (raw: any): AgeSlice => ({
  _id: raw.audienceRangeId ?? raw._id ?? "",
  range: raw.range ?? raw.range ?? "",
  percentage: Number(raw.percentage) || 0,
});

const normalizeMediaKit = (raw: any): MediaKit => ({
  influencerId: raw.influencerId ?? raw.id ?? "",
  name: raw.name ?? "Unknown",
  profileImage: raw.profileImage
    ? `${process.env.NEXT_PUBLIC_CDN ?? ""}${raw.profileImage}`
    : "https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop",
  bio: raw.bio ?? "",
  followers: Number(raw.followers) || 0,
  engagementRate: Number(raw.engagementRate) || 0,
  platformName: raw.platformName ?? raw.platform ?? "",
  categories: raw.categories,
  audienceBifurcation:
    raw.audienceBifurcation ?? { malePercentage: 0, femalePercentage: 0 },
  topCountries: Array.isArray(raw.topCountries)
    ? raw.topCountries.map(mapCountrySlice)
    : [],
  ageBreakdown: Array.isArray(raw.ageBreakdown)
    ? raw.ageBreakdown.map(mapAgeSlice)
    : [],
  interests: Array.isArray(raw.interests) ? raw.interests : [],
  gallery: Array.isArray(raw.gallery) ? raw.gallery : [],
  rateCard: raw.rateCard ?? "",
  notes: raw.notes ?? "",
  mediaKitPdf: raw.mediaKitPdf ?? raw.pdfUrl ?? undefined,
  email: raw.email,
  website: raw.website,
});

const validateMediaKit = (data: MediaKit): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!data.name.trim())
    errors.push({ field: "name", message: "Name is required" });
  if (data.name.length > VALIDATION_RULES.MAX_NAME_LENGTH)
    errors.push({
      field: "name",
      message: `Name must be less than ${VALIDATION_RULES.MAX_NAME_LENGTH} characters`,
    });
  if (!data.bio.trim())
    errors.push({ field: "bio", message: "Bio is required" });
  if (data.bio.length > VALIDATION_RULES.MAX_BIO_LENGTH)
    errors.push({
      field: "bio",
      message: `Bio must be less than ${VALIDATION_RULES.MAX_BIO_LENGTH} characters`,
    });
  if (!data.platformName.trim())
    errors.push({ field: "platformName", message: "Platform name is required" });
  if (data.followers < VALIDATION_RULES.MIN_FOLLOWERS)
    errors.push({ field: "followers", message: "Followers must be 0 or greater" });
  if (
    data.engagementRate < VALIDATION_RULES.MIN_ENGAGEMENT_RATE ||
    data.engagementRate > VALIDATION_RULES.MAX_ENGAGEMENT_RATE
  )
    errors.push({
      field: "engagementRate",
      message: `Engagement rate must be between ${VALIDATION_RULES.MIN_ENGAGEMENT_RATE}% and ${VALIDATION_RULES.MAX_ENGAGEMENT_RATE}%`,
    });
  if (data.email && !isValidEmail(data.email))
    errors.push({ field: "email", message: "Please enter a valid email address" });
  if (data.website && !isValidUrl(data.website))
    errors.push({ field: "website", message: "Please enter a valid website URL" });
  return errors;
};

const buildCountryOptions = (countries: Country[]): CountryOption[] =>
  countries.map((c) => ({
    value: c._id,
    label: `${c.flag} ${c.countryName}`,
    country: c,
  }));

const filterByCountryName = (option: { data: CountryOption }, raw: string) => {
  const input = raw.toLowerCase().trim();
  const { country } = option.data;
  return (
    country.countryName.toLowerCase().includes(input) ||
    country.countryCode.toLowerCase().includes(input) ||
    country.callingCode.includes(input.replace(/^\+/, ""))
  );
};

const formatNumber = (num: number) => new Intl.NumberFormat().format(num);

/* --------------------------------------------------------------------------
 * HOOKS
 * ----------------------------------------------------------------------- */

// 1. Select‑options hook
const useSelectOptions = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [ageRanges, setAgeRanges] = useState<AgeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setIsLoading(true);
        const [countriesRes, agesRes] = await Promise.allSettled([
          get<Country[]>(API_ENDPOINTS.COUNTRIES_GET_ALL),
          get<{ _id: string; range: string; audienceId: string }[]>(
            API_ENDPOINTS.AUDIENCE_RANGES_GET_ALL
          ),
        ]);
        if (countriesRes.status === "fulfilled") setCountries(countriesRes.value);
        if (agesRes.status === "fulfilled")
          setAgeRanges(
            agesRes.value.map((r) => ({
              value: r._id,
              label: r.range,
              _id: r._id,
            }))
          );
      } catch (err: any) {
        setError(err?.message ?? "Failed to load dropdown options");
      } finally {
        setIsLoading(false);
      }
    };
    fetchOptions();
  }, []);

  return {
    countryOptions: useMemo(() => buildCountryOptions(countries), [countries]),
    ageOptions: useMemo(() => ageRanges, [ageRanges]),
    isLoading,
    error,
  } as const;
};

// 2. Media‑kit hook
const useMediaKit = (influencerId: string) => {
  const [mediaKit, setMediaKit] = useState<MediaKit | null>(null);
  const [draft, setDraft] = useState<MediaKit | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    error: null,
  });
  const [editingState, setEditingState] = useState<EditingState>({
    isEditing: false,
    hasUnsavedChanges: false,
    validationErrors: [],
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchMediaKit = useCallback(async () => {
    if (!influencerId) {
      setLoadingState({ isLoading: false, error: "No influencer selected" });
      return;
    }
    try {
      setLoadingState({ isLoading: true, error: null });
      const res = await post(API_ENDPOINTS.MEDIA_KIT_GET, { influencerId });
      setMediaKit(normalizeMediaKit(res));
      setLoadingState({ isLoading: false, error: null });
    } catch (err: any) {
      const msg =
        err?.status === 404
          ? "No media kit found. Click edit to create one."
          : err?.message ?? "Unable to load media kit";
      setLoadingState({ isLoading: false, error: msg });
      if (err?.status === 404) toast.info(msg);
      else toast.error(msg);
    }
  }, [influencerId]);

  const startEditing = useCallback(() => {
    if (!mediaKit) return;
    setDraft(JSON.parse(JSON.stringify(mediaKit)));
    setEditingState({ isEditing: true, hasUnsavedChanges: false, validationErrors: [] });
  }, [mediaKit]);

  const cancelEditing = useCallback(() => {
    setDraft(null);
    setEditingState({ isEditing: false, hasUnsavedChanges: false, validationErrors: [] });
  }, []);

  const updateDraft = useCallback(
    (field: keyof MediaKit, value: any) => {
      if (!draft) return;
      let processed = value;
      if (field === "categories" || field === "interests")
        processed = typeof value === "string"
          ? value
            .split(",")
            .map((i: string) => i.trim())
            .filter(Boolean)
          : value;
      if (field === "followers" || field === "engagementRate") processed = Number(value) || 0;
      const updated = { ...draft, [field]: processed } as MediaKit;
      setDraft(updated);
      const hasChanges = JSON.stringify(updated) !== JSON.stringify(mediaKit);
      setEditingState((prev) => ({
        ...prev,
        hasUnsavedChanges: hasChanges,
        validationErrors: prev.validationErrors.filter((e) => e.field !== field),
      }));
    },
    [draft, mediaKit]
  );

  /** Convert UI slices ➜ API payload */
  const toCountryPayload = (s: CountrySlice) => ({
    countryId: s._id,
    percentage: s.percentage,
  });
  const toAgePayload = (s: AgeSlice) => ({
    audienceRangeId: s._id,
    percentage: s.percentage,
  });

  const saveMediaKit = useCallback(async () => {
    if (!draft || !influencerId) return;
    const vErrors = validateMediaKit(draft);
    if (vErrors.length) {
      setEditingState((p) => ({ ...p, validationErrors: vErrors }));
      toast.error("Please fix validation errors before saving");
      return;
    }
    setIsSaving(true);
    const payload = {
      ...draft,
      influencerId,
      topCountries: draft.topCountries.map(toCountryPayload),
      ageBreakdown: draft.ageBreakdown.map(toAgePayload),
    };
    try {
      const res = await post(API_ENDPOINTS.MEDIA_KIT_UPDATE, payload);
      setMediaKit(normalizeMediaKit(res));
      setDraft(null);
      setEditingState({ isEditing: false, hasUnsavedChanges: false, validationErrors: [] });
      toast.success("Media kit saved successfully!");
    } catch (err: any) {
      const msg = err?.message ?? "Failed to save media kit";
      if (err?.errors) setEditingState((p) => ({ ...p, validationErrors: err.errors }));
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }, [draft, influencerId]);

  useEffect(() => {
    fetchMediaKit();
  }, [fetchMediaKit]);

  return {
    mediaKit,
    draft,
    loadingState: { ...loadingState, isLoading: loadingState.isLoading || isSaving },
    editingState,
    fetchMediaKit,
    startEditing,
    cancelEditing,
    updateDraft,
    saveMediaKit,
    displayData: editingState.isEditing && draft ? draft : mediaKit,
    canSave:
      editingState.isEditing &&
      editingState.hasUnsavedChanges &&
      !isSaving &&
      !editingState.validationErrors.length,
  } as const;
};

/* --------------------------------------------------------------------------
 * COMPONENTS
 * ----------------------------------------------------------------------- */

// 1. ProfileImageUpload Component
interface ProfileImageUploadProps {
  currentImage: string;
  name: string;
  onImageChange: (imageUrl: string) => void;
  isEditing: boolean;
}

const ProfileImageUpload: React.FC<ProfileImageUploadProps> = ({
  currentImage,
  name,
  onImageChange,
  isEditing,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      // Create a temporary URL for preview
      const imageUrl = URL.createObjectURL(file);
      onImageChange(imageUrl);
      toast.success('Profile image updated successfully!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative group">
      <Avatar className="w-32 h-32 border-4 border-white shadow-xl ring-2 ring-gray-100">
        <AvatarImage src={currentImage} alt={name} className="object-cover" />
        <AvatarFallback className="text-2xl font-semibold bg-gradient-to-br from-gray-100 to-gray-200">
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {isEditing && (
        <>
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-full transition-all duration-200 flex items-center justify-center">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 hover:bg-white text-gray-800 shadow-lg"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </>
      )}
    </div>
  );
};

// 2. DemographicEditor – compatible with both slice types
interface DemographicEditorProps<T> {
  slices: T[];
  options: OptionsOrGroups<{ value: string; label: string }, GroupBase<never>>;
  onChange: (slices: T[]) => void;
  title: string;
  filterOption?: (option: any, input: string) => boolean;
  placeholder?: string;
  maxSlices?: number;
}

function DemographicEditor<T extends { _id: string; percentage: number } & (
  | { name: string }
  | { range: string }
)>(
  {
    slices,
    options,
    onChange,
    title,
    filterOption,
    placeholder = "Select...",
    maxSlices = 10,
  }: DemographicEditorProps<T>
) {

  const updateSlice = (index: number, updated: T) => {
    const arr = [...slices];
    arr[index] = updated;
    onChange(arr);
  };
  const addSlice = () => {
    if (slices.length >= maxSlices) return;
    onChange([
      ...slices,
      { _id: "", percentage: 0, ...(title === "Countries" ? { name: "" } : { range: "" }) } as T,
    ]);
  };
  const removeSlice = (idx: number) => onChange(slices.filter((_, i) => i !== idx));
  const total = slices.reduce((s, p) => s + p.percentage, 0);
  const isOver = total > 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {slices.length > 0 && (
            <div className="flex items-center gap-2">
              <Progress
                value={Math.min(total, 100)}
                className="w-20 h-2"
              />
              <span
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded-full",
                  isOver
                    ? "bg-red-100 text-red-700"
                    : total === 100
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                )}
              >
                {total}%
              </span>
            </div>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addSlice}
          disabled={slices.length >= maxSlices}
          className="gap-2 hover:bg-gray-50 border-dashed"
        >
          <Plus className="h-4 w-4" /> Add {title.slice(0, -1)}
        </Button>
      </div>

      {slices.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PieChart className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm mb-2">No {title.toLowerCase()} added yet</p>
          <p className="text-gray-400 text-xs">Click "Add {title.slice(0, -1)}" to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {slices.map((slice, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-4 items-center p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow"
            >
              <div className="col-span-7">
                <Select
                  options={options}
                  value={(options as any[]).find((o) => o.value === slice._id) ?? null}
                  onChange={(opt: any) =>
                    updateSlice(index, {
                      ...slice,
                      _id: opt?.value ?? "",
                      ...(title === "Countries"
                        ? { name: opt?.label ?? "" }
                        : { range: opt?.label ?? "" }),
                    })
                  }
                  placeholder={placeholder}
                  filterOption={filterOption}
                  isClearable
                  isSearchable
                  styles={{
                    control: (base: any, state: any) => ({
                      ...base,
                      minHeight: "40px",
                      borderColor: state.isFocused ? "#FFBF00" : "#E5E7EB",
                      boxShadow: state.isFocused ? "0 0 0 1px #FFBF00" : "none",
                      "&:hover": {
                        borderColor: "#FFBF00",
                      },
                    }),
                    option: (base: any, state: any) => ({
                      ...base,
                      backgroundColor: state.isSelected
                        ? "#FFBF00"
                        : state.isFocused
                          ? "#FEF3C7"
                          : "white",
                      color: state.isSelected ? "#1F2937" : "#374151",
                    }),
                  }}
                />
              </div>
              <div className="col-span-3">
                <div className="relative">
                  <Input
                    type="number"
                    value={slice.percentage}
                    onChange={(e) =>
                      updateSlice(index, {
                        ...slice,
                        percentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      })
                    }
                    min={0}
                    max={100}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    %
                  </span>
                </div>
              </div>
              <div className="col-span-2 flex justify-end">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeSlice(index)}
                  className="h-9 w-9 text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOver && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            Total percentage exceeds 100%. Please adjust the values to ensure accuracy.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// 3. EditableField
interface EditableFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "textarea" | "email" | "url";
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  rows?: number;
  className?: string;
  icon?: React.ReactNode;
}

const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  onChange,
  type = "text",
  error,
  placeholder,
  required = false,
  disabled = false,
  maxLength,
  rows = 4,
  className,
  icon,
}) => {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const common = {
    id,
    className: cn(
      "w-full transition-all duration-200",
      error && "border-red-300 focus-visible:ring-red-500",
      disabled && "opacity-50 cursor-not-allowed",
      "focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:border-yellow-500"
    ),
    value: value || "",
    onChange: (e: any) => onChange(e.target.value),
    placeholder,
    disabled,
    maxLength,
    "aria-invalid": !!error,
    "aria-describedby": error ? `${id}-error` : undefined,
    "aria-required": required,
  } as const;

  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-700 flex items-center gap-2"
      >
        {icon}
        {label}
        {required && <span className="text-red-500" aria-label="required">*</span>}
        {maxLength && (
          <span className="text-xs text-gray-500 ml-auto font-normal">
            {String(value).length}/{maxLength}
          </span>
        )}
      </label>
      {type === "textarea" ? (
        <Textarea
          rows={rows}
          {...(common as any)}
          className={cn(common.className, "resize-none")}
        />
      ) : (
        <Input type={type} {...(common as any)} />
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="text-sm text-red-600 flex items-center gap-1"
          role="alert"
        >
          <AlertCircle className="h-3 w-3 flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  );
};

// 4. ErrorBoundary
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("MediaKit ErrorBoundary:", error, info);
  }
  handleRetry = () => this.setState({ hasError: false, error: undefined });
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Something went wrong
                </h2>
                <p className="text-sm text-gray-600">
                  We encountered an unexpected error while loading the media kit.
                </p>
              </div>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Error Details
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 bg-red-50 p-3 rounded-lg overflow-auto max-h-32">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={this.handleRetry}
                  className={`bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} text-gray-800 hover:${COLORS.PRIMARY_HOVER} gap-2`}
                >
                  <RefreshCw className="h-4 w-4" /> Try Again
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

// 5. LoadingSkeleton
const Skeleton = ({ className = "" }: { className?: string }) => (
  <div
    className={`animate-pulse rounded-md bg-gray-200/80 dark:bg-gray-700/60 ${className}`}
  />
);

/* 2. Loading skeleton page */
const LoadingSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Hero card */}
      <div className="overflow-hidden rounded-xl bg-white shadow dark:bg-gray-900">
        {/* banner strip */}
        <Skeleton className="h-24 w-full rounded-none" />
        <div className="-mt-6 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-end">
            <Skeleton className="h-32 w-32 rounded-full" />
            <div className="flex-1 space-y-4 pt-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  </div>
);

// 6. StatCard
interface StatCardProps {
  label: string;
  value: string | number;
  gradient?: boolean;
  className?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  gradient = false,
  className,
  icon,
  trend,
}) => (
  <Card
    className={cn(
      "bg-white relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1",
      gradient && "border-0",
      className
    )}
  >
    <CardContent className="p-6">
      <div
        className={cn(
          "rounded-lg p-4 text-center",
          gradient && `bg-gradient-to-br ${COLORS.PRIMARY_GRADIENT}`
        )}
      >
        {icon && (
          <div className="flex justify-center mb-3">
            <div className={cn(
              "p-2 rounded-full",
              gradient ? "bg-white/20" : "bg-gray-100"
            )}>
              {icon}
            </div>
          </div>
        )}
        <div className={cn(
          "text-2xl font-bold mb-2",
          gradient ? "text-gray-800" : "text-gray-900"
        )}>
          {value}
        </div>
        <div className={cn(
          "text-sm font-medium",
          gradient ? "text-gray-700" : "text-gray-600"
        )}>
          {label}
        </div>
        {trend && (
          <div className={cn(
            "flex items-center justify-center gap-1 mt-2 text-xs",
            trend.isPositive ? "text-green-600" : "text-red-600"
          )}>
            <TrendingUp className={cn(
              "h-3 w-3",
              !trend.isPositive && "rotate-180"
            )} />
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

/* --------------------------------------------------------------------------
 * MAIN PAGE COMPONENT
 * ----------------------------------------------------------------------- */

const InfluencerMediaKitComponent: React.FC = () => {
  const router = useRouter();
  const influencerId =
    typeof window !== "undefined" ? localStorage.getItem("influencerId") ?? "" : "";

  const {
    mediaKit,
    draft,
    loadingState,
    editingState,
    fetchMediaKit,
    startEditing,
    cancelEditing,
    updateDraft,
    saveMediaKit,
    displayData,
    canSave,
  } = useMediaKit(influencerId);

  const { countryOptions, ageOptions } = useSelectOptions();

  const getError = (field: keyof MediaKit) =>
    editingState.validationErrors.find((e) => e.field === field)?.message;

  /* ────────────────────────────────────────────────────────────────────── */

  if (loadingState.isLoading) return <LoadingSkeleton />;

  if (loadingState.error && !displayData)
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Media Kit</h2>
              <p className="text-sm text-gray-600">{loadingState.error}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />Go Back
              </Button>
              <Button
                onClick={fetchMediaKit}
                className={`bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} text-gray-800 hover:${COLORS.PRIMARY_HOVER}`}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );

  if (!displayData)
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center space-y-6">
            <div className={`w-20 h-20 bg-gradient-to-br ${COLORS.PRIMARY_GRADIENT} rounded-full flex items-center justify-center mx-auto shadow-lg`}>
              <Edit3 className="h-10 w-10 text-gray-800" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Create Your Media Kit</h2>
              <p className="text-sm text-gray-600">
                No media kit found. Create a professional media kit to showcase your influence and connect with brands.
              </p>
            </div>
            <Button
              onClick={startEditing}
              size="lg"
              className={`bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} text-gray-800 hover:${COLORS.PRIMARY_HOVER} gap-2 shadow-lg`}
            >
              <Edit3 className="h-5 w-5" />Create Media Kit
            </Button>
          </CardContent>
        </Card>
      </div>
    );

  const {
    name,
    profileImage,
    bio,
    followers,
    engagementRate,
    platformName,
    categories,
    audienceBifurcation,
    topCountries,
    ageBreakdown,
    interests,
    gallery,
    rateCard,
    notes,
    mediaKitPdf,
    email,
    website,
  } = displayData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="gap-2 hover:bg-gray-100"
          >
            <ChevronLeft className="h-4 w-4" />Back to Dashboard
          </Button>
          <div className="flex items-center gap-3">
            {editingState.hasUnsavedChanges && (
              <div className="flex items-center gap-2 text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                Unsaved changes
              </div>
            )}
            {!editingState.isEditing ? (
              <Button
                onClick={startEditing}
                size="lg"
                className={`bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} text-gray-800 hover:${COLORS.PRIMARY_HOVER} gap-2 shadow-lg`}
              >
                <Edit3 className="h-4 w-4" />Edit Media Kit
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button
                  onClick={saveMediaKit}
                  disabled={!canSave}
                  size="lg"
                  className="bg-green-600 text-white hover:bg-green-700 gap-2 shadow-lg disabled:opacity-50"
                >
                  {loadingState.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {loadingState.isLoading ? "Saving..." : "Save Changes"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={loadingState.isLoading}
                      size="lg"
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {editingState.hasUnsavedChanges
                          ? "You have unsaved changes that will be lost. Are you sure you want to discard them?"
                          : "Are you sure you want to cancel editing?"}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Editing</AlertDialogCancel>
                      <AlertDialogAction onClick={cancelEditing} className="bg-red-600 hover:bg-red-700">
                        Discard Changes
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </header>

        {/* Validation Errors */}
        {editingState.validationErrors.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              <div className="font-medium mb-2">Please fix the following errors:</div>
              <ul className="ml-4 list-disc space-y-1">
                {editingState.validationErrors.map((e) => (
                  <li key={e.field} className="text-sm">{e.message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Hero Section */}
        <Card className="overflow-hidden shadow-xl border-0 bg-white">
          <CardContent className="p-0">
            <div className={`bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} h-32 relative`}>
              <div className="absolute inset-0 bg-black/10" />
            </div>
            <div className="p-8 -mt-8">
              <div className="flex flex-col lg:flex-row items-start lg:items-end gap-8">
                <ProfileImageUpload
                  currentImage={profileImage}
                  name={name}
                  onImageChange={(url) => updateDraft("profileImage", url)}
                  isEditing={editingState.isEditing}
                />
                <div className="flex-1 space-y-6 w-full pt-4">
                  {editingState.isEditing ? (
                    <div className="space-y-4">
                      <EditableField
                        label="Full Name"
                        value={draft?.name || ""}
                        onChange={(v) => updateDraft("name", v)}
                        error={getError("name")!}
                        required
                        maxLength={VALIDATION_RULES.MAX_NAME_LENGTH}
                        icon={<Users className="h-4 w-4" />}
                      />
                      <EditableField
                        label="Bio & Description"
                        value={draft?.bio || ""}
                        onChange={(v) => updateDraft("bio", v)}
                        type="textarea"
                        error={getError("bio")!}
                        required
                        maxLength={VALIDATION_RULES.MAX_BIO_LENGTH}
                        rows={4}
                        placeholder="Tell your story, describe your content style, and what makes you unique..."
                      />
                      <EditableField
                        label="Content Categories"
                        value={draft?.categories?.join(", ") || ""}
                        onChange={(v) => updateDraft("categories", v)}
                        placeholder="Fashion, Lifestyle, Travel, Food, Tech..."
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h1 className="text-4xl font-bold text-gray-900">{name}</h1>
                      <p className="text-lg text-gray-600 leading-relaxed whitespace-pre-line">{bio}</p>
                      <div className="flex flex-wrap gap-2">
                        {categories.map((c) => (
                          <Badge
                            key={c}
                            variant="secondary"
                            className="bg-gradient-to-r from-[#FFBF00]/20 to-[#FFDB58]/20 text-gray-800 px-3 py-1 text-sm rounded-full"
                          >
                            {c}
                          </Badge>

                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {editingState.isEditing ? (
            <>
              <Card className="p-6 bg-white">
                <EditableField
                  label="Followers Count"
                  type="number"
                  value={draft?.followers || 0}
                  onChange={(v) => updateDraft("followers", v)}
                  error={getError("followers")!}
                  required
                  icon={<Users className="h-4 w-4" />}
                />
              </Card>
              <Card className="p-6 bg-white">
                <EditableField
                  label="Engagement Rate (%)"
                  type="number"
                  value={draft?.engagementRate || 0}
                  onChange={(v) => updateDraft("engagementRate", v)}
                  error={getError("engagementRate")!}
                  required
                  icon={<TrendingUp className="h-4 w-4" />}
                />
              </Card>
              <Card className="p-6 bg-white">
                <EditableField
                  label="Platform"
                  value={draft?.platformName || ""}
                  onChange={(v) => updateDraft("platformName", v)}
                  error={getError("platformName")!}
                  required
                  icon={<Monitor className="h-4 w-4" />}
                />
              </Card>
              <StatCard
                label="Gender Split"
                value={`${audienceBifurcation.malePercentage}% / ${audienceBifurcation.femalePercentage}%`}
                gradient
                icon={<PieChart className="h-5 w-5 text-gray-800" />}
              />
            </>
          ) : (
            <>
              <StatCard
                label="Total Followers"
                value={formatNumber(followers)}
                gradient
                icon={<Users className="h-6 w-6 text-gray-800" />}
              />
              <StatCard
                label="Engagement Rate"
                value={`${engagementRate.toFixed(2)}%`}
                gradient
                icon={<Heart className="h-6 w-6 text-gray-800" />}
              />
              <StatCard
                label="Platform"
                value={platformName}
                gradient
                icon={<Monitor className="h-6 w-6 text-gray-800" />}
              />
              <StatCard
                label="Audience Split"
                value={`${audienceBifurcation.malePercentage}% / ${audienceBifurcation.femalePercentage}%`}
                gradient
                icon={<PieChart className="h-6 w-6 text-gray-800" />}
              />
            </>
          )}
        </div>

        {/* Demographics Section */}
        {(ageBreakdown.length || editingState.isEditing || topCountries.length) && (
          <div className="grid lg:grid-cols-2 gap-8">
            {(ageBreakdown.length || editingState.isEditing) && (
              <Card className="shadow-lg border-0 bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Age Demographics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingState.isEditing ? (
                    <DemographicEditor<AgeSlice>
                      slices={draft?.ageBreakdown || []}
                      options={ageOptions}
                      onChange={(s) => updateDraft("ageBreakdown", s)}
                      title="Age Ranges"
                      placeholder="Select age range..."
                    />
                  ) : (
                    <div className="space-y-3">
                      {ageBreakdown.map((a) => (
                        <div key={a._id} className={`flex items-center justify-between p-3 bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} text-gray-800 rounded-lg`}>
                          <span className="font-medium text-gray-900">{a.range}</span>
                          <div className="flex items-center gap-3">
                            <Progress value={a.percentage} className="w-20 h-2" />
                            <span className="text-sm font-semibold text-gray-700 min-w-[3rem]">
                              {a.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {(topCountries.length || editingState.isEditing) && (
              <Card className="shadow-lg border-0 bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <MapPin className="h-5 w-5 text-green-600" />
                    Geographic Reach
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingState.isEditing ? (
                    <DemographicEditor<CountrySlice>
                      slices={draft?.topCountries || []}
                      options={countryOptions}
                      onChange={(s) => updateDraft("topCountries", s)}
                      title="Countries"
                      filterOption={filterByCountryName}
                      placeholder="Search countries..."
                    />
                  ) : (
                    <div className="space-y-3">
                      {topCountries.map((c) => (
                        <div key={c._id} className={`flex items-center justify-between p-3 bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} text-gray-800 rounded-lg`}>
                          <span className="font-medium text-gray-900">{c.name}</span>
                          <div className="flex items-center gap-3">
                            <Progress value={c.percentage} className="w-20 h-2" />
                            <span className="text-sm font-semibold text-gray-700 min-w-[3rem]">
                              {c.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Interests Section */}
        {(interests.length || editingState.isEditing) && (
          <Card className="shadow-lg border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Star className="h-5 w-5 text-purple-600" />
                Audience Interests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editingState.isEditing ? (
                <EditableField
                  label="Audience Interests"
                  value={draft?.interests?.join(", ") || ""}
                  onChange={(v) => updateDraft("interests", v)}
                  placeholder="Technology, Fashion, Travel, Food, Fitness..."
                />
              ) : (
                <div className="flex flex-wrap gap-3">
                  {interests.map((i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="px-4 py-2 text-sm font-medium border-purple-200 text-purple-700 hover:bg-purple-50"
                    >
                      {i}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Rate Card Section */}
        {(rateCard || editingState.isEditing) && (
          <Card className="shadow-lg border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Rate Card & Pricing
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editingState.isEditing ? (
                <EditableField
                  label="Rate Card Details"
                  type="textarea"
                  value={draft?.rateCard || ""}
                  onChange={(v) => updateDraft("rateCard", v)}
                  rows={6}
                  placeholder="Post: $500&#10;Story: $200&#10;Reel: $800&#10;Campaign: $2000&#10;&#10;Package deals available for multiple posts..."
                />
              ) : (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-medium">
                    {rateCard}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Additional Notes */}
        {(notes || editingState.isEditing) && (
          <Card className="shadow-lg border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editingState.isEditing ? (
                <EditableField
                  label="Additional Notes"
                  type="textarea"
                  value={draft?.notes || ""}
                  onChange={(v) => updateDraft("notes", v)}
                  rows={5}
                  placeholder="Special requirements, collaboration preferences, brand exclusions, etc..."
                />
              ) : (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                    {notes}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Gallery Section */}
        {gallery.length > 0 && (
          <Card className="shadow-lg border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Eye className="h-5 w-5 text-indigo-600" />
                Featured Content Gallery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {gallery.map((url, i) => (
                  <div
                    key={i}
                    className="relative group overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <img
                      src={url}
                      alt={`Gallery ${i + 1}`}
                      className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-4 left-4 right-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-sm font-medium">Content #{i + 1}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact & Actions Section */}
        <Card className="shadow-xl border-0 bg-gradient-to-r from-white to-gray-50">
          <CardContent className="p-8">
            {editingState.isEditing ? (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="grid sm:grid-cols-2 gap-6">
                  <EditableField
                    label="Email Address"
                    type="email"
                    value={draft?.email || ""}
                    onChange={(v) => updateDraft("email", v)}
                    error={getError("email")!}
                    placeholder="your.email@example.com"
                    icon={<Mail className="h-4 w-4" />}
                  />
                  <EditableField
                    label="Website URL"
                    type="url"
                    value={draft?.website || ""}
                    onChange={(v) => updateDraft("website", v)}
                    error={getError("website")!}
                    placeholder="https://yourwebsite.com"
                    icon={<Globe className="h-4 w-4" />}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex flex-wrap items-center gap-4">
                  {email && (
                    <Button
                      asChild
                      size="lg"
                      className={`bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} text-gray-800 hover:${COLORS.PRIMARY_HOVER} gap-2 shadow-lg`}
                    >
                      <a href={`mailto:${email}`}>
                        <Mail className="h-4 w-4" />Get In Touch
                      </a>
                    </Button>
                  )}
                  {mediaKitPdf && (
                    <Button asChild variant="outline" size="lg" className="gap-2 shadow-sm">
                      <a href={mediaKitPdf} target="_blank" rel="noopener">
                        <Download className="h-4 w-4" />Download PDF
                      </a>
                    </Button>
                  )}
                </div>
                {website && (
                  <Button
                    asChild
                    variant="ghost"
                    size="lg"
                    className="text-gray-600 hover:text-gray-800 gap-2"
                  >
                    <a
                      href={website.startsWith("http") ? website : `https://${website}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <ExternalLink className="h-4 w-4" />Visit Website
                    </a>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------------------
 * PAGE EXPORT
 * ----------------------------------------------------------------------- */

export default function Page() {
  return (
    <ErrorBoundary>
      <InfluencerMediaKitComponent />
    </ErrorBoundary>
  );
}