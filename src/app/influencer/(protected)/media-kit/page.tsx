"use client";
import React, { useState, useCallback, useEffect } from "react";
import {
  ChevronLeft,
  Edit3,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Star,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProfileSection } from "./ProfileSection";
import { StatsGrid } from "./StatsGrid";
import { ContactSection } from "./ContactSection";
import { MediaKit, ValidationError } from "./mediakit";
import { API_ENDPOINTS, VALIDATION_RULES, COLORS } from "./index";
import { post } from "@/lib/api";
import { isValidEmail, isValidUrl } from "@/lib/utils";
import Swal from "sweetalert2";

type AnyObj = Record<string, any>;
const n = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function normalizeMediaKit(input: AnyObj, fallbackInfluencerId = ""): MediaKit {
  return {
    influencerId: input?.influencerId ?? fallbackInfluencerId,
    name: input?.name ?? "",
    profileImage: input?.profileImage ?? "",
    bio: input?.bio ?? "",
    followers: n(input?.followers, 0),
    engagementRate: n(input?.engagementRate, 0),
    platformName: input?.platformName ?? "",
    categories: Array.isArray(input?.categories) ? input.categories : [],
    audienceBifurcation:
      input?.audienceBifurcation && typeof input.audienceBifurcation === "object"
        ? {
            malePercentage: n(input.audienceBifurcation.malePercentage, 0),
            femalePercentage: n(input.audienceBifurcation.femalePercentage, 0),
          }
        : { malePercentage: 0, femalePercentage: 0 },
    topCountries: Array.isArray(input?.topCountries) ? input.topCountries : [],
    ageBreakdown: Array.isArray(input?.ageBreakdown) ? input.ageBreakdown : [],
    interests: Array.isArray(input?.interests) ? input.interests : [],
    gallery: Array.isArray(input?.gallery) ? input.gallery : [],
    rateCard: input?.rateCard ?? "",
    notes: input?.notes ?? "",
    email: input?.email ?? "",
    website: input?.website ?? "",
    mediaKitPdf: input?.mediaKitPdf,
  };
}

const LoadingSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-4 sm:p-6">
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-xl p-4 shadow-sm">
        <div className="h-10 w-24 bg-gray-200 rounded-md animate-pulse" />
        <div className="h-10 w-32 bg-gray-200 rounded-md animate-pulse" />
      </div>

      <div className="bg-white rounded-2xl shadow-lg">
        <div className="h-32 sm:h-40 bg-gray-200 rounded-t-2xl animate-pulse" />
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-8">
            <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gray-200 rounded-full animate-pulse mx-auto sm:mx-0" />
            <div className="flex-1 space-y-4">
              <div className="h-10 sm:h-12 bg-gray-200 rounded animate-pulse w-3/4 sm:w-2/3 mx-auto sm:mx-0" />
              <div className="h-20 sm:h-24 bg-gray-200 rounded animate-pulse" />
              <div className="flex gap-2 justify-center sm:justify-start">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-20 bg-gray-200 rounded-full animate-pulse"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 sm:h-32 bg-white rounded-lg shadow-lg animate-pulse" />
        ))}
      </div>
    </div>
  </div>
);

const ErrorDisplay: React.FC<{
  error: string;
  onRetry: () => void;
  onBack: () => void;
}> = ({ error, onRetry, onBack }) => (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex items-center justify-center p-4 sm:p-6">
    <Card className="max-w-md w-full shadow-2xl border-0">
      <CardContent className="p-6 sm:p-8 text-center space-y-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
            Unable to Load Media Kit
          </h2>
          <p className="text-gray-600 text-sm sm:text-base">{error}</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Go Back
          </Button>
          <Button
            onClick={onRetry}
            className={`bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} text-gray-800 hover:from-[#E6AC00] hover:to-[#E6C247] gap-2`}
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

const CreateMediaKitPrompt: React.FC<{ onStartEditing: () => void }> = ({
  onStartEditing,
}) => (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex items-center justify-center p-4 sm:p-6">
    <Card className="max-w-md w-full shadow-2xl border-0">
      <CardContent className="p-6 sm:p-8 text-center space-y-6">
        <div
          className={`w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br ${COLORS.PRIMARY_GRADIENT} rounded-full flex items-center justify-center mx-auto shadow-lg`}
        >
          <Edit3 className="h-10 w-10 sm:h-12 sm:w-12 text-gray-800" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
            Create Your Media Kit
          </h2>
          <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
            Build a professional media kit to showcase your influence and
            connect with brands.
          </p>
        </div>
        <Button
          onClick={onStartEditing}
          size="lg"
          className={`bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} text-gray-800 hover:from-[#E6AC00] hover:to-[#E6C247] gap-2 shadow-lg font-semibold px-6 sm:px-8`}
        >
          <Edit3 className="h-5 w-5" />
          Create Media Kit
        </Button>
      </CardContent>
    </Card>
  </div>
);

function Page() {
  const [mediaKit, setMediaKit] = useState<MediaKit | null>(null);
  const [draft, setDraft] = useState<MediaKit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [influencerId, setInfluencerId] = useState<string | null>(null);

  // Load influencerId from localStorage
  useEffect(() => {
    try {
      const id =
        localStorage.getItem("influencerId") ||
        localStorage.getItem("userId") ||
        localStorage.getItem("auth_user_id");
      setInfluencerId(id);
      if (!id) {
        Swal.fire({
          title: "Login required",
          text: "Missing influencer id. Please log in.",
          icon: "warning",
        });
      }
    } catch {
      setInfluencerId(null);
      Swal.fire({
        title: "Error",
        text: "Unable to read local storage.",
        icon: "error",
      });
    }
  }, []);

  const fetchMediaKit = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!influencerId) {
        setError("Missing influencer id. Please log in.");
        return;
      }

      const resp = await post<MediaKit | { data?: AnyObj; mediaKit?: AnyObj }>(
        API_ENDPOINTS.MEDIA_KIT_GET,
        { influencerId }
      );

      const raw = (resp as any)?.data ?? (resp as any)?.mediaKit ?? (resp as AnyObj | null);
      setMediaKit(raw ? normalizeMediaKit(raw, influencerId) : null);
    } catch (err: any) {
      const message =
        err?.status === 404
          ? "No media kit found. Click edit to create one."
          : err?.message ?? "Unable to load media kit";
      setError(message);
      Swal.fire({ title: "Load failed", text: message, icon: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [influencerId]);

  const validateMediaKit = (data: MediaKit): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!data.name.trim()) {
      errors.push({ field: "name", message: "Name is required" });
    }
    if (data.name.length > VALIDATION_RULES.MAX_NAME_LENGTH) {
      errors.push({
        field: "name",
        message: `Name must be less than ${VALIDATION_RULES.MAX_NAME_LENGTH} characters`,
      });
    }
    if (!data.bio.trim()) {
      errors.push({ field: "bio", message: "Bio is required" });
    }
    if (data.bio.length > VALIDATION_RULES.MAX_BIO_LENGTH) {
      errors.push({
        field: "bio",
        message: `Bio must be less than ${VALIDATION_RULES.MAX_BIO_LENGTH} characters`,
      });
    }
    if (!data.platformName.trim()) {
      errors.push({
        field: "platformName",
        message: "Platform name is required",
      });
    }
    if (data.followers < VALIDATION_RULES.MIN_FOLLOWERS) {
      errors.push({
        field: "followers",
        message: "Followers must be 0 or greater",
      });
    }
    if (
      data.engagementRate < VALIDATION_RULES.MIN_ENGAGEMENT_RATE ||
      data.engagementRate > VALIDATION_RULES.MAX_ENGAGEMENT_RATE
    ) {
      errors.push({
        field: "engagementRate",
        message: `Engagement rate must be between ${VALIDATION_RULES.MIN_ENGAGEMENT_RATE}% and ${VALIDATION_RULES.MAX_ENGAGEMENT_RATE}%`,
      });
    }
    if (data.email && !isValidEmail(data.email)) {
      errors.push({
        field: "email",
        message: "Please enter a valid email address",
      });
    }
    if (data.website && !isValidUrl(data.website)) {
      errors.push({
        field: "website",
        message: "Please enter a valid website URL",
      });
    }

    return errors;
  };

  const startEditing = async () => {
    if (!influencerId) {
      await Swal.fire({
        title: "Login required",
        text: "Missing influencer id. Please log in.",
        icon: "warning",
      });
      return;
    }

    if (!mediaKit && !draft) {
      const newMediaKit: MediaKit = normalizeMediaKit({}, influencerId);
      setDraft(newMediaKit);
    } else {
      setDraft(JSON.parse(JSON.stringify(mediaKit)));
    }
    setIsEditing(true);
    setHasUnsavedChanges(false);
    setValidationErrors([]);
  };

  const cancelEditing = async () => {
    if (hasUnsavedChanges) {
      const res = await Swal.fire({
        title: "Discard changes?",
        text: "You have unsaved changes. This action cannot be undone.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Discard",
        cancelButtonText: "Keep editing",
      });
      if (!res.isConfirmed) return;
    }
    setDraft(null);
    setIsEditing(false);
    setHasUnsavedChanges(false);
    setValidationErrors([]);
  };

  const updateDraft = (field: keyof MediaKit, value: any) => {
    if (!draft) return;

    const numericFields: Array<keyof MediaKit> = ["followers", "engagementRate"];
    const nextVal = numericFields.includes(field) ? n(value, 0) : value;

    const updated = { ...draft, [field]: nextVal };
    setDraft(updated);
    setHasUnsavedChanges(JSON.stringify(updated) !== JSON.stringify(mediaKit));
    setValidationErrors((prev) => prev.filter((e) => e.field !== field));
  };

  const saveMediaKit = async () => {
    if (!draft) return;

    if (!influencerId) {
      await Swal.fire({
        title: "Login required",
        text: "Missing influencer id. Please log in.",
        icon: "warning",
      });
      return;
    }

    const errors = validateMediaKit(draft);
    if (errors.length > 0) {
      setValidationErrors(errors);
      await Swal.fire({
        title: "Please fix errors",
        text: "Some fields need your attention.",
        icon: "warning",
      });
      return;
    }

    try {
      setIsSaving(true);

      const payload = { ...draft, influencerId };
      const resp = await post<MediaKit | { data?: AnyObj; mediaKit?: AnyObj }>(
        API_ENDPOINTS.MEDIA_KIT_UPDATE,
        payload
      );

      const raw = (resp as any)?.data ?? (resp as any)?.mediaKit ?? (resp as AnyObj);
      const saved = normalizeMediaKit(raw, influencerId);

      setMediaKit(saved);
      setDraft(null);
      setIsEditing(false);
      setHasUnsavedChanges(false);
      setValidationErrors([]);

      await Swal.fire({
        title: "Saved",
        text: "Media kit saved successfully!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      const message = err?.message ?? "Failed to save media kit";
      await Swal.fire({ title: "Save failed", text: message, icon: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // Warn on tab close if there are unsaved changes
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  // Fetch once we have influencerId
  useEffect(() => {
    if (influencerId !== null) {
      fetchMediaKit();
    }
  }, [fetchMediaKit, influencerId]);

  const displayData = isEditing && draft ? draft : mediaKit;
  const canSave =
    isEditing && hasUnsavedChanges && !isSaving && validationErrors.length === 0;

  if (isLoading) return <LoadingSkeleton />;

  if (error && !displayData) {
    return (
      <ErrorDisplay
        error={error}
        onRetry={fetchMediaKit}
        onBack={() => window.history.back()}
      />
    );
  }

  if (!displayData) {
    return <CreateMediaKitPrompt onStartEditing={startEditing} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="gap-2 hover:bg-gray-100 font-medium w-full sm:w-auto justify-center"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="flex items-center gap-3 justify-center sm:justify-end">
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                Unsaved changes
              </div>
            )}

            {!isEditing ? (
              <Button
                onClick={startEditing}
                size="lg"
                className={`w-full sm:w-auto bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} text-gray-800 hover:from-[#E6AC00] hover:to-[#E6C247] gap-2 shadow-lg font-semibold`}
              >
                <Edit3 className="h-4 w-4" />
                Edit Media Kit
              </Button>
            ) : (
              <div className="flex gap-3 w-full sm:w-auto">
                <Button
                  onClick={saveMediaKit}
                  disabled={!canSave}
                  size="lg"
                  className="flex-1 sm:flex-none bg-green-600 text-white hover:bg-green-700 gap-2 shadow-lg disabled:opacity-50 font-semibold"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  onClick={cancelEditing}
                  variant="outline"
                  disabled={isSaving}
                  size="lg"
                  className="flex-1 sm:flex-none gap-2 font-medium"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              <div className="font-medium mb-2">
                Please fix the following errors:
              </div>
              <ul className="ml-4 list-disc space-y-1">
                {validationErrors.map((error) => (
                  <li key={error.field} className="text-sm">
                    {error.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Profile Section */}
        <ProfileSection
          mediaKit={displayData}
          isEditing={isEditing}
          onImageChange={(url) => updateDraft("profileImage", url)}
          onFieldChange={updateDraft}
          validationErrors={validationErrors.map((e) => e.message)}
        />

        {/* Stats Grid */}
        <StatsGrid
          mediaKit={displayData}
          isEditing={isEditing}
          onFieldChange={updateDraft}
        />

        {/* Demographics & Additional Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Interests */}
          {(displayData.interests.length > 0 || isEditing) && (
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Star className="h-5 w-5 text-purple-600" />
                  Audience Interests
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Audience Interests
                    </label>
                    <input
                      type="text"
                      value={displayData.interests.join(", ")}
                      onChange={(e) =>
                        updateDraft(
                          "interests",
                          e.target.value
                            .split(",")
                            .map((i) => i.trim())
                            .filter(Boolean)
                        )
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                      placeholder="Technology, Fashion, Travel, Food, Fitness..."
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {displayData.interests.map((interest) => (
                      <Badge
                        key={interest}
                        variant="outline"
                        className="px-3 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors"
                      >
                        {interest}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Rate Card */}
          {(displayData.rateCard || isEditing) && (
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Rate Card & Pricing
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Rate Card Details
                    </label>
                    <textarea
                      value={displayData.rateCard || ""}
                      onChange={(e) => updateDraft("rateCard", e.target.value)}
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all resize-none"
                      placeholder={`Post: $500\nStory: $200\nReel: $800\nCampaign: $2000\n\nPackage deals available for multiple posts...`}
                    />
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 rounded-xl">
                    <pre className="whitespace-pre-wrap text-sm sm:text-base text-gray-700 leading-relaxed font-medium">
                      {displayData.rateCard}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Notes Section */}
        {(displayData.notes || isEditing) && (
          <Card className="shadow-lg border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={displayData.notes || ""}
                    onChange={(e) => updateDraft("notes", e.target.value)}
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all resize-none"
                    placeholder="Special requirements, collaboration preferences, brand exclusions, etc..."
                  />
                </div>
              ) : (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 sm:p-6 rounded-xl">
                  <pre className="whitespace-pre-wrap text-sm sm:text-base text-gray-700 leading-relaxed">
                    {displayData.notes}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contact Section */}
        <ContactSection
          mediaKit={displayData}
          isEditing={isEditing}
          onFieldChange={updateDraft}
        />
      </div>
    </div>
  );
}

export default Page;
