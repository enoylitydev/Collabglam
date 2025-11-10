import { useEffect, useMemo, useState, useCallback } from 'react';
import { Sparkles, Instagram, Youtube, Globe, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { FloatingLabelInput } from '@/components/common/FloatingLabelInput';
import { Button } from './Button';
import { ProgressIndicator } from './ProgressIndicator';
import Select, { GroupBase, MultiValue, SingleValue } from 'react-select';
import { rsStyles, rsTheme } from '../styles/reactSelectStyles'
import type { Country } from './types';
import { get, post } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// =========================
// Types
// =========================

type Step = 'basic' | 'verify' | 'platform' | 'quick';
type Provider = 'instagram' | 'youtube' | 'tiktok';

type ProviderPreview = {
  fullname?: string;
  username?: string;
  followers?: number;
  picture?: string;
  url?: string;
};

type ProviderState = {
  include: boolean;
  handle: string;
  loading: boolean;
  error: string;
  payload: any | null; // normalized providerRaw from backend
  preview: ProviderPreview | null;
};

type ApiCategory = {
  _id: string;
  id?: number;
  name: string;
  subcategories?: { subcategoryId: string; name: string }[];
};

type Option = { value: string; label: string; meta?: any };
type Language = { _id: string; code: string; name: string };

type GroupOption = { label: string; options: Option[] };

const genders = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

// flip to true if you want to allow proceeding without Modash payload
const ALLOW_SELF_REPORT_FALLBACK = false;

// =========================
// Component
// =========================

export default function InfluencerSignup({ onSuccess, onStepChange }: { onSuccess: () => void; onStepChange?: (currentStep: number) => void }) {
  const router = useRouter();
  // Start at BASIC for a natural flow
  const [step, setStep] = useState<Step>('basic');
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Inline required-hint flags per step
  const [showBasicHints, setShowBasicHints] = useState(false);
  const [showVerifyOtpHint, setShowVerifyOtpHint] = useState(false);
  const [showPwdHints, setShowPwdHints] = useState(false);
  const [showPlatformHints, setShowPlatformHints] = useState(false);

  const [languages, setLanguages] = useState<Language[]>([]);
  const [langLoading, setLangLoading] = useState(false);
  const [langError, setLangError] = useState('');

  // Max allowed DOB: 2013 or earlier
  const maxDob = '2013-12-31';

  // OTP state
  const [resendIn, setResendIn] = useState<number>(0);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  // Track influencerId returned from /influencer/register for follow-up onboarding
  const [influencerId, setInfluencerId] = useState<string>('');

  // Multi-platform state
  const [primaryProvider, setPrimaryProvider] = useState<Provider | ''>('');
  const [platforms, setPlatforms] = useState<Record<Provider, ProviderState>>({
    instagram: { include: false, handle: '', loading: false, error: '', payload: null, preview: null },
    youtube: { include: false, handle: '', loading: false, error: '', payload: null, preview: null },
    tiktok: { include: false, handle: '', loading: false, error: '', payload: null, preview: null },
  });

  // Multi-select options for platforms
  const platformOptions: Option[] = useMemo(
    () => [
      { value: 'instagram', label: 'Instagram' },
      { value: 'youtube', label: 'YouTube' },
      { value: 'tiktok', label: 'TikTok' },
    ],
    []
  );

  // Derive selected options from state
  const selectedPlatformOptions: Option[] = useMemo(() => {
    const included = (['instagram', 'youtube', 'tiktok'] as Provider[]).filter((p) => platforms[p].include);
    const set = new Set(included);
    return platformOptions.filter((o) => set.has(o.value as Provider));
  }, [platforms, platformOptions]);

  // When multi-select changes, sync to our per-platform state
  const onChangePlatforms = (opts: readonly Option[] | null) => {
    const picked = new Set((opts ?? []).map((o) => o.value as Provider));
    setPlatforms((prev) => {
      const next = { ...prev };
      (['instagram', 'youtube', 'tiktok'] as Provider[]).forEach((p) => {
        next[p] = { ...prev[p], include: picked.has(p) };
      });
      return next;
    });
    // If current primary is no longer selected, clear it
    if (primaryProvider && !picked.has(primaryProvider)) {
      setPrimaryProvider('');
    }
  };

  // Convenience: list of currently included providers
  const includedPlatforms = useMemo(
    () => (['instagram', 'youtube', 'tiktok'] as Provider[]).filter((p) => platforms[p].include),
    [platforms]
  );

  // Form data for basic + verify
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    otp: '',
    // phone: '',
    // dateOfBirth: '',
    countryId: '',
    // city: '',
    // callingCodeId: '',
    gender: '',
    selectedLanguages: [] as string[],
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  });

  // ====== Effects
  useEffect(() => {
    (async () => {
      try {
        const data = await get<Country[]>('/country/getall');
        setCountries(data || []);
      } catch {
        setCountries([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  useEffect(() => {
    (async () => {
      try {
        setLangLoading(true);
        setLangError('');
        const res = await get<{ total?: number; data?: Language[] } | Language[] | any>('/languages/all');
        const list: Language[] = Array.isArray(res) ? res : (res?.data ?? []);
        setLanguages(list);
      } catch (e: any) {
        setLanguages([]);
        setLangError(e?.response?.data?.message || e?.message || 'Failed to load languages');
      } finally {
        setLangLoading(false);
      }
    })();
  }, []);

  // Inform parent about current step (1..4) for UI decisions
  useEffect(() => {
    const current = step === 'basic' ? 1 : step === 'verify' ? 2 : step === 'platform' ? 3 : 4;
    onStepChange?.(current);
  }, [step, onStepChange]);

  // ====== Options (memoized)
  const genderOptions: Option[] = useMemo(() => genders.map((g) => ({ value: g, label: g })), []);
  const languageOptions: Option[] = useMemo(
    () =>
      languages
        .map((l) => ({ value: l._id, label: l.name, meta: { code: l.code } }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [languages]
  );

  const countryOptions: Option[] = useMemo(
    () =>
      countries
        .map((c) => ({ value: c._id, label: c.countryName, meta: { flag: c.flag } }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [countries]
  );

  const formatOptionLabelCountry = useCallback((opt: Option) => (
    <div className="flex items-center gap-2">
      <span className="text-lg leading-none">{opt.meta?.flag ?? '🏳️'}</span>
      <span>{opt.label}</span>
    </div>
  ), []);

  // ===== Step 1 — Basic + Email (auto-send OTP on continue)
  const completeBasicDetails = () => {
    setShowBasicHints(false);
    if (!formData.fullName || !formData.email || !formData.countryId) {
      setShowBasicHints(true);
      setError('');
      // try scroll to first missing
      const firstMissingId = (
        [
          ['inf-name', !formData.fullName],
          ['inf-email', !formData.email],
          ['gender', !formData.gender],
          ['country', !formData.countryId],
        ] as const
      ).find(([, miss]) => miss)?.[0];
      if (firstMissingId) document.getElementById(firstMissingId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setError('');
    setStep('verify');
    setOtpSent(false);
    setOtpVerified(false);
    setResendIn(0);
    setFormData((prev) => ({ ...prev, otp: '' }));
    sendOTP(); // auto-fire
  };

  // ===== Step 2 — OTP + Password
  const sendOTP = async () => {
    if (!formData.email) {
      setError('Please enter your email');
      return;
    }
    if (resendIn > 0) return;

    setLoading(true);
    setError('');
    try {
      await post('/influencer/request-otp', { email: formData.email, role: 'Influencer' });
      setOtpSent(true);
      setResendIn(30);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!formData.otp) {
      setShowVerifyOtpHint(true);
      setError('Please enter the OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await post('/influencer/verify-otp', { email: formData.email, role: 'Influencer', otp: formData.otp });
      setOtpVerified(true);
      setError('');
      setStep('platform');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  // ===== Multi-platform helpers
  const urlByPlatform = (p: Provider, h: string) => {
    if (p === 'instagram') return `https://instagram.com/${h}`;
    if (p === 'youtube') return `https://www.youtube.com/@${h}`;
    if (p === 'tiktok') return `https://www.tiktok.com/@${h}`;
    return '';
  };

  const buildSelfReportPayload = (provider: Provider, rawHandle: string) => {
    const handle = (rawHandle || '').replace(/^@/, '');
    return {
      profile: {
        username: handle,
        handle: `@${handle}`,
        fullname: formData.fullName,
        url: urlByPlatform(provider, handle),
      },
      accountType: 'self-report',
      isPrivate: false,
      isVerified: false,
      profileSource: 'onboarding',
    };
  };

  const setProvider = (p: Provider, patch: Partial<ProviderState>) =>
    setPlatforms((s) => ({ ...s, [p]: { ...s[p], ...patch } }));

  const resolveProfile = async (provider: Provider) => {
    const s = platforms[provider];
    const handle = s.handle.replace(/^@/, '').trim();
    if (!s.include || handle.length < 2) return; // nothing to do

    setProvider(provider, { loading: true, error: '', payload: null, preview: null });
    try {
      const result = await post('/modash/resolve-profile', {
        platform: provider, // 'instagram' | 'tiktok' | 'youtube'
        username: handle,
      });

      // Expecting { data, providerRaw, preview }
      const normalized = (result as any)?.data ?? (result as any)?.normalized;
      if (!normalized) throw new Error('No profile found for that username');

      setProvider(provider, { payload: (result as any).providerRaw ?? normalized, preview: (result as any).preview ?? null, error: '' });
    } catch (err: any) {
      const rawMsg = err?.response?.data?.message || err?.message || '';
      const isSensitive = /api token|developer section|modash|authorization|bearer|marketer\.modash\.io|modash_api_key/i.test(String(rawMsg));
      const safeMsg = isSensitive ? 'Failed to fetch profile' : (rawMsg || 'Failed to fetch profile');
      setProvider(provider, {
        payload: null,
        preview: null,
        error: safeMsg,
      });
    } finally {
      setProvider(provider, { loading: false });
    }
  };

  // Debounce per-platform on handle/include changes (600ms)
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    (['instagram', 'youtube', 'tiktok'] as Provider[]).forEach((p) => {
      const { include, handle } = platforms[p];
      if (!include) return;
      const clean = handle.replace(/^@/, '').trim();
      if (clean.length < 2) return;
      const t = setTimeout(() => resolveProfile(p), 600);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, [
    platforms.instagram.include, platforms.instagram.handle,
    platforms.youtube.include, platforms.youtube.handle,
    platforms.tiktok.include, platforms.tiktok.handle,
  ]);

  // ===== Registration (requires at least one verified platform unless fallback allowed)
  const finishPlatformStep = async () => {
    setShowPlatformHints(true);
    const included = (['instagram', 'youtube', 'tiktok'] as Provider[]).filter((p) => platforms[p].include);

    if (included.length === 0) {
      setError('Please add at least one platform');
      return;
    }
    if (!primaryProvider || !included.includes(primaryProvider)) {
      setError('Please choose a preferred platform');
      return;
    }

    // Validate each included platform
    for (const p of included) {
      const s = platforms[p];
      const hasHandle = !!s.handle.replace(/^@/, '').trim();
      const hasPayload = !!s.payload;
      if (!hasPayload && !ALLOW_SELF_REPORT_FALLBACK) {
        setError(`Please pick a valid ${p} handle — we couldn’t fetch that profile.`);
        return;
      }
      if (!hasPayload && ALLOW_SELF_REPORT_FALLBACK && !hasHandle) {
        setError(`Please enter a ${p} handle or pick a valid profile.`);
        return;
      }
    }

    // block if any included is still loading
    if (included.some((p) => platforms[p].loading)) return;

    setLoading(true);
    setError('');

    try {
      const platformsPayload = included.map((p) => {
        const s = platforms[p];
        return {
          provider: p,
          data: s.payload || buildSelfReportPayload(p, s.handle),
        };
      });

      const res = await post<any>('/influencer/register', {
        name: formData.fullName,
        email: formData.email,
        password: formData.password,
        countryId: formData.countryId,
        gender: formData.gender,
        selectedLanguages: formData.selectedLanguages, // Language _ids
        platforms: platformsPayload,
        preferredProvider: primaryProvider,
      });

      setInfluencerId(res?.influencerId || '');
      setStep('quick');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  /** Step 4 — Quick */
  const finishAll = async () => {
    try {
      setLoading(true);
      const data = await post<{ token: string; influencerId: string; categoryId: string }>(
        '/influencer/login',
        { email: formData.email, password: formData.password }
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('influencerId', data.influencerId);
        localStorage.setItem('categoryId', data.categoryId);
        localStorage.setItem('userType', 'influencer');
        localStorage.setItem('userEmail', formData.email);
      }
      router.replace('/influencer/dashboard');
    } catch (err: any) {
      console.warn('Auto-login failed after signup:', err?.message || err);
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const steps = useMemo(
    () => [
      { number: 1, label: 'Basic', completed: step !== 'basic', active: step === 'basic' },
      { number: 2, label: 'Verify', completed: !['basic', 'verify'].includes(step), active: step === 'verify' },
      { number: 3, label: 'Platform', completed: step === 'quick', active: step === 'platform' },
      { number: 4, label: 'Quick', completed: false, active: step === 'quick' },
    ],
    [step]
  );

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return <Instagram className="w-5 h-5" />;
      case 'youtube':
        return <Youtube className="w-5 h-5" />;
      case 'tiktok':
        return <Globe className="w-5 h-5" />; // placeholder icon
      default:
        return <Globe className="w-5 h-5" />;
    }
  };

  // Helpers to map ids <-> option objects
  const findOption = (opts: Option[], id: string) => opts.find((o) => o.value === id) || null;
  const findMulti = (opts: Option[], ids: string[]) => opts.filter((o) => ids.includes(o.value));

  // Derived booleans for button disables
  const canSubmitPlatform = includedPlatforms.length > 0 && !includedPlatforms.some((p) => platforms[p].loading);

  // Derived missing flags for inline hints
  const missingBasic = {
    fullName: showBasicHints && !formData.fullName,
    email: showBasicHints && !formData.email,
    countryId: showBasicHints && !formData.countryId,
    gender: showBasicHints && !formData.gender,
  } as const;
  const missingPwd = {
    password: showPwdHints && !formData.password,
    confirmPassword: showPwdHints && !formData.confirmPassword,
    agreedToTerms: showPwdHints && !formData.agreedToTerms,
  } as const;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header area */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 justify-center">
          <div className="flex items-center gap-3 justify-center">
            <div className="w-10 h-10 rounded-xl flex items-center ring-1 ring-gray-200 overflow-hidden">
              <img src='./logo.png' alt="Logo" loading="lazy" className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center justify-center">
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">
                Influencer Signup
              </h1>
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
          <ProgressIndicator steps={steps} variant="influencer" />
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 w-full">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          {/* STEP 1 — BASIC + EMAIL */}
          {step === 'basic' && (
            <div className="space-y-5 animate-fadeIn">

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1">
                  <FloatingLabelInput
                    id="inf-name"
                    label="Full Name"
                    type="text"
                    placeholder="What should brands call you?"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    autoComplete="name"
                  />
                  {missingBasic.fullName && (
                    <p className="text-xs text-red-600">this field is required</p>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <FloatingLabelInput
                    id="inf-email"
                    label="Email"
                    type="email"
                    placeholder="We'll verify this next"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    autoComplete="email"
                  />
                  {missingBasic.email && (
                    <p className="text-xs text-red-600">this field is required</p>
                  )}
                </div>

                <div className="grid sm:grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <div className="relative">
                      <FloatingLabelInput
                        id="inf-password"
                        label="Password"
                        type={passwordVisible ? 'text' : 'password'}
                        placeholder="≥8 chars, 1 number, 1 letter"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        style={{ paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => setPasswordVisible((v) => !v)}
                        className="absolute inset-y-0 right-3 my-auto text-gray-500 hover:text-gray-700"
                        aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                      >
                        {passwordVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {missingPwd.password && (
                      <p className="text-xs text-red-600">this field is required</p>
                    )}
                    {showPwdHints && !!formData.password && formData.password.length < 8 && (
                      <p className="text-xs text-red-600">Password must be at least 8 characters</p>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-1 gap-4 ">
                  <div className="space-y-1">
                    <Select
                      className=""
                      instanceId="gender"
                      inputId="gender"
                      options={genderOptions}
                      value={findOption(genderOptions, formData.gender)}
                      onChange={(opt: SingleValue<Option>) =>
                        setFormData((p) => ({ ...p, gender: opt?.value || '' }))
                      }
                      placeholder="Select Gender(Optional)"
                      styles={rsStyles as any}
                      theme={rsTheme}
                    />
                    {missingBasic.gender && (
                      <p className="text-xs text-red-600">this field is required</p>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1">
                    <Select
                      instanceId="country"
                      inputId="country"
                      options={countryOptions}
                      value={findOption(countryOptions, formData.countryId)}
                      onChange={(opt: SingleValue<Option>) => setFormData((p) => ({ ...p, countryId: opt?.value || '' }))}
                      placeholder="Select Country"
                      styles={rsStyles as any}
                      theme={rsTheme}
                      formatOptionLabel={formatOptionLabelCountry}
                    />
                    {missingBasic.countryId && (
                      <p className="text-xs text-red-600">this field is required</p>
                    )}
                  </div>
                </div>

                <div className=" grid sm:grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <Select
                      instanceId="languages"
                      isMulti
                      closeMenuOnSelect={false}
                      options={languageOptions}
                      value={findMulti(languageOptions, formData.selectedLanguages)} // stores IDs
                      onChange={(opts: MultiValue<Option>) =>
                        setFormData((p) => ({ ...p, selectedLanguages: opts.map((o) => o.value) }))
                      }
                      styles={rsStyles as any}
                      theme={rsTheme}
                      placeholder={langLoading ? 'Loading…' : 'Languages you create content in'}
                      isLoading={langLoading}
                    />
                    {langError && <p className="text-xs text-red-600 mt-2" aria-live="polite">{langError}</p>}
                  </div>

                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <Button onClick={completeBasicDetails} variant="influencer" className="self-center sm:self-auto">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2 — VERIFY */}
          {step === 'verify' && (
            <div className="space-y-5 animate-fadeIn">
              {!otpVerified && (
                <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <CheckCircle2 className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-700">
                    We’ll send a 6-digit code to <strong>{formData.email}</strong>
                  </p>
                </div>
              )}

              {!otpVerified && (
                <>
                  <div className="space-y-1">
                    <FloatingLabelInput
                      id="inf-otp"
                      label="Enter 6-Digit Code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={formData.otp}
                      onChange={(e) => setFormData({ ...formData, otp: e.target.value.replace(/\D/g, '') })}
                      required
                      autoComplete="one-time-code"
                    />
                    {showVerifyOtpHint && !formData.otp && (
                      <p className="text-xs text-red-600">this field is required</p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 cursor-pointer">
                    <Button onClick={verifyOTP} loading={loading} variant="influencer" className="cursor-pointer">
                      Verify Code
                    </Button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-end">
                    <button
                      onClick={sendOTP}
                      disabled={resendIn > 0}
                      className={`text-sm sm:text-base font-medium underline text-gray-500 hover:text-gray-700 transition-colors duration-200 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer`}
                    >
                      {otpSent
                        ? resendIn > 0
                          ? `Resend in ${resendIn}s`
                          : 'Resend Code'
                        : 'Sending Verification Code'}
                    </button>
                  </div>
                </>
              )}

              {otpVerified && (
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-700 mb-2">
                    Your email <strong>{formData.email}</strong> has been verified!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — PLATFORM (multi-select + preferred) */}
          {step === 'platform' && (
            <div className="space-y-6 animate-fadeIn">
              {/* NEW: Multi-select for platforms */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Platforms</label>
                <Select
                  instanceId="platforms"
                  inputId="platforms"
                  isMulti
                  closeMenuOnSelect={false}
                  options={platformOptions}
                  value={selectedPlatformOptions}
                  onChange={(opts) => onChangePlatforms(opts as Option[])}
                  styles={rsStyles as any}
                  theme={rsTheme}
                  placeholder="Select one or more platforms"
                />
                {showPlatformHints && includedPlatforms.length === 0 && (
                  <p className="text-xs text-red-600">this field is required</p>
                )}
                <p className="text-xs text-gray-500">We only fetch public stats for matching & we will never post on your behalf.</p>
              </div>

              {/* Only render cards for included platforms */}
              {includedPlatforms.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
                  {includedPlatforms.map((p) => {
                    const s = platforms[p];
                    const isPrimary = primaryProvider === p;
                    const label = p === 'instagram' ? 'Instagram' : p === 'youtube' ? 'YouTube' : 'TikTok';

                    return (
                      <div
                        key={p}
                        className={[
                          'p-4 rounded-xl border-2 transition-all bg-white mt-6',
                          isPrimary
                            ? 'border-yellow-600 shadow-[0_0_0_3px_rgba(245,158,11,0.15)]'
                            : 'border-gray-200 hover:border-gray-300',
                        ].join(' ')}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getPlatformIcon(p)}
                            <span className="text-sm font-semibold">{label}</span>
                            {isPrimary && (
                              <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">
                                Primary
                              </span>
                            )}
                          </div>

                          {/* Quick remove (syncs with multi-select) */}
                          <button
                            type="button"
                            onClick={() => {
                              setPlatforms((prev) => ({ ...prev, [p]: { ...prev[p], include: false } }));
                              if (primaryProvider === p) setPrimaryProvider('');
                            }}
                            className="text-xs text-gray-600 hover:text-gray-900 underline"
                          >
                            Remove
                          </button>
                        </div>

                        {/* Primary selector — shadcn Checkbox */}
                        <div className="flex items-center gap-2 mb-3">
                          <Checkbox
                            id={`primary-${p}`}
                            checked={isPrimary}
                            onCheckedChange={(checked) => {
                              if (checked) setPrimaryProvider(p);
                              else if (primaryProvider === p) setPrimaryProvider('');
                            }}
                            className="border-gray-300 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                          />
                          <Label htmlFor={`primary-${p}`} className="text-sm text-gray-700 cursor-pointer">
                            Make this my primary account
                          </Label>
                        </div>

                        {/* Handle input */}
                        <div className="space-y-1">
                          <FloatingLabelInput
                            id={`handle-${p}`}
                            label={`${label} Handle`}
                            type="text"
                            placeholder="@yourhandle"
                            value={s.handle}
                            onChange={(e) => setProvider(p, { handle: e.target.value, error: '', payload: null, preview: null })}
                            required
                          />
                          {showPlatformHints && !s.handle.replace(/^@/, '').trim() && (
                            <p className="text-xs text-red-600">this field is required</p>
                          )}
                        </div>

                        {/* Status / errors */}
                        {s.loading && (
                          <div className="mt-2 p-2 text-sm rounded-md border border-gray-200 bg-gray-50">
                            Searching {label}…
                          </div>
                        )}
                        {!!s.error && (
                          <div className="mt-2 p-2 text-sm rounded-md border border-red-200 bg-red-50 text-red-700" aria-live="polite">
                            {s.error}
                          </div>
                        )}

                        {/* Preview */}
                        {s.preview && (
                          <div className="mt-2 flex items-center gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                            {s.preview.picture && (
                              <img
                                src={s.preview.picture}
                                alt="avatar"
                                className="w-10 h-10 rounded-full object-cover"
                                loading="lazy"
                              />
                            )}
                            <div className="text-sm">
                              <div className="font-semibold">
                                {s.preview.fullname || s.preview.username}{' '}
                                {s.preview.username && (
                                  <span className="text-gray-500">@{s.preview.username}</span>
                                )}
                              </div>
                              {typeof s.preview.followers === 'number' && (
                                <div className="text-gray-600">
                                  Followers: {s.preview.followers.toLocaleString()}
                                </div>
                              )}
                              {s.preview.url && (
                                <a
                                  href={s.preview.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-yellow-700 underline"
                                >
                                  View profile
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={finishPlatformStep}
                  loading={loading}
                  variant="influencer"
                  disabled={!canSubmitPlatform}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4 — QUICK */}
          {step === 'quick' && (
            <QuickQuestions
              influencerId={influencerId}
              email={formData.email}
              onComplete={() => finishAll()}
            />
          )}

          <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        `}</style>
        </div>
      </main>
    </div>
  );
}

// ======================================================
// QuickQuestions with ALL selections via react-select
// ======================================================

function QuickQuestions({
  influencerId,
  email,
  onComplete
}: {
  influencerId?: string;
  email?: string;
  onComplete: (answers?: any) => void;
}) {
  type BudgetRange = 'Below $2k' | '$5k–7k' | '$7k–10k' | 'Above $10k';
  type ApiSubcategory = { subcategoryId: string; name: string };
  type ApiCategory = { _id: string; name: string; subcategories?: ApiSubcategory[] };
  type ApiCategoryResponse = { count?: number; categories?: ApiCategory[] };

  const formatOptions: Option[] = useMemo(
    () => ['Reels/Shorts', 'Stories', 'Static', 'Long-form', 'Tutorials', 'Live', 'Reviews', 'Unboxing'].map((f) => ({ value: f, label: f })),
    []
  );
  const budgetRanges: BudgetRange[] = ['Below $2k', '$5k–7k', '$7k–10k', 'Above $10k'];
  const budgetOptions: Option[] = useMemo(() => budgetRanges.map((b) => ({ value: b, label: b })), []);
  const projectLengthOptions: Option[] = useMemo(
    () => ['One-off (<2 wks)', 'Short (2–8 wks)', 'Long-term (3–6 m)', 'Retainer (6+ m)'].map((p) => ({ value: p, label: p })),
    []
  );
  const capacityOptions: Option[] = useMemo(() => ['Light', 'Normal', 'Heavy'].map((c) => ({ value: c, label: c })), []);

  const collabTypeStrings = ['Paid', 'Product Gifting', 'Ambassador', 'Event'];
  const cadenceStrings = ['Single Deliverable', 'Weekly Deliverable', 'Monthly Deliverable', 'Quarterly Deliverable'];

  const [qStep, setQStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // ===== Categories API =====
  const [allCategories, setAllCategories] = useState<ApiCategory[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setCatLoading(true);
        setCatError('');
        const res = await get<ApiCategoryResponse | ApiCategory[] | any>('/category/categories');
        const list: ApiCategory[] = Array.isArray(res) ? res : (res?.categories ?? []);
        setAllCategories(list);
      } catch (e: any) {
        setCatError(e?.response?.data?.message || e?.message || 'Failed to load categories');
        setAllCategories([]);
      } finally {
        setCatLoading(false);
      }
    })();
  }, []);

  const [answers, setAnswers] = useState({
    // STEP 4.1 — Formats/Budget/Working style
    formats: [] as string[],
    budgets: {} as Record<string, BudgetRange>, // key: format
    projectLength: '',
    capacity: '',

    // STEP 4.2 — Category/Subcategories/Collab prefs
    categoryId: '' as string, // single category
    subcategories: [] as string[], // multiple subcategories
    collabTypes: [] as string[],
    allowlisting: false,
    cadences: [] as string[],

    // STEP 4.3 — Creator Story (max 3, max 1 per group)
    selectedPrompts: [] as { group: string; prompt: string }[],
    promptAnswers: {} as Record<string, string>, // key: prompt => answer
  });

  const stepCount = 3;
  const progressPct = (qStep / stepCount) * 100;

  // ===== Derived: options and available subcategories =====
  const categoryOptions: Option[] = useMemo(
    () => allCategories.map((c) => ({ value: c._id, label: c.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [allCategories]
  );

  const selectedCategory: ApiCategory | undefined = useMemo(
    () => allCategories.find((c) => c._id === answers.categoryId),
    [allCategories, answers.categoryId]
  );

  const availableSubcategories = useMemo(() => {
    const subs = selectedCategory?.subcategories ?? [];
    return [...subs].sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedCategory]);

  const subcategoryOptions: Option[] = useMemo(
    () => availableSubcategories.map((s) => ({ value: s.subcategoryId, label: s.name })),
    [availableSubcategories]
  );

  const collabTypeOptions: Option[] = useMemo(() => collabTypeStrings.map((t) => ({ value: t, label: t })), []);
  const cadenceOptions: Option[] = useMemo(() => cadenceStrings.map((t) => ({ value: t, label: t })), []);

  // prune subcategories if their parent category changed or available set shrank
  useEffect(() => {
    if (answers.subcategories.length === 0) return;
    const allowed = new Set(subcategoryOptions.map((s) => s.value));
    setAnswers((prev) => ({
      ...prev,
      subcategories: prev.subcategories.filter((id) => allowed.has(id)),
    }));
  }, [answers.categoryId, subcategoryOptions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // prune budgets when formats change
  useEffect(() => {
    setAnswers((prev) => {
      const keep = new Set(prev.formats);
      const nextBudgets: Record<string, BudgetRange> = {} as any;
      for (const f of Object.keys(prev.budgets)) {
        if (keep.has(f)) nextBudgets[f] = prev.budgets[f];
      }
      return { ...prev, budgets: nextBudgets };
    });
  }, [answers.formats.join('|')]);

  // ===== Validation per substep =====
  const validStep1 = useMemo(() => {
    if (answers.formats.length < 1) return false;
    for (const f of answers.formats) {
      if (!answers.budgets[f]) return false;
    }
    return !!answers.projectLength && !!answers.capacity;
  }, [answers.formats, answers.budgets, answers.projectLength, answers.capacity]);

  const validStep2 = useMemo(() => {
    const hasCat = !!answers.categoryId;
    const hasSubcats = answers.subcategories.length >= 1;
    const hasCollab = answers.collabTypes.length >= 1;
    const hasCadence = answers.cadences.length >= 1;
    return hasCat && hasSubcats && hasCollab && hasCadence;
  }, [answers.categoryId, answers.subcategories, answers.collabTypes, answers.cadences]);

  const validStep3 = useMemo(() => {
    if (answers.selectedPrompts.length < 1 || answers.selectedPrompts.length > 3) return false;
    for (const { prompt } of answers.selectedPrompts) {
      const text = answers.promptAnswers[prompt]?.trim() || '';
      if (text.length < 10) return false;
    }
    return true;
  }, [answers.selectedPrompts, answers.promptAnswers]);

  const next = () => {
    setErr('');
    if (qStep === 1 && !validStep1) return setErr('Please complete formats, budgets, project length, and capacity.');
    if (qStep === 2 && !validStep2) return setErr('Please select a category, at least one subcategory, a collab type, and cadence.');
    if (qStep < 3) setQStep((s) => (s + 1) as 1 | 2 | 3);
  };

  const back = () => setQStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));

  const finish = async () => {
    setErr('');
    if (!validStep3) return setErr('Please pick up to 3 prompts (max 1 per group) and answer each.');
    try {
      setSaving(true);
      await post('/influencer/onboarding', {
        influencerId,
        email,
        ...answers
      });
      onComplete(answers);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to save answers');
    } finally {
      setSaving(false);
    }
  };

  // ===== react-select helpers =====
  const theme = rsTheme;
  const styles = rsStyles as any;

  // Prompts — convert to grouped react-select
  const storyPrompts: Record<string, string[]> = {
    Content: [
      'What’s one thing your content always delivers—no exceptions?',
      'What’s your why—the thing that fuels your creativity?',
      'How do you stay real when the internet loves perfect?',
    ],
    Audience: [
      'What’s one product your audience still thanks you for recommending?',
      'What topic can’t your followers get enough of?',
      'How do you hope your audience feels after every post?',
    ],
    Brand: [
      'What makes a brand an instant yes for you?',
      'What’s been your most unexpected collab—and why did it click?',
      'One thing you won’t compromise on in a partnership?',
    ],
  };

  const promptGroups: GroupBase<Option>[] = useMemo(() => {
    return Object.entries(storyPrompts).map(([group, list]) => ({
      label: group,
      options: list.map((p) => ({ value: p, label: p, meta: { group } })),
    }));
  }, []);

  const selectedPromptOptions: Option[] = useMemo(() => {
    const m = new Map<string, Option>();
    for (const g of promptGroups) for (const o of g.options as Option[]) m.set(o.value, o);
    return answers.selectedPrompts.map((sp) => m.get(sp.prompt)!).filter(Boolean) as Option[];
  }, [answers.selectedPrompts, promptGroups]);

  const onChangePrompts = (opts: readonly Option[] | null) => {
    const arr = Array.from(opts || []);
    // enforce max 3 total and max 1 per group
    const byGroup = new Map<string, Option>();
    const picked: Option[] = [];
    for (const o of arr) {
      const g = o.meta?.group as string;
      if (!byGroup.has(g)) {
        byGroup.set(g, o);
        picked.push(o);
      } else {
        continue;
      }
      if (picked.length >= 3) break;
    }
    const selectedPrompts = picked.map((o) => ({ group: o.meta!.group, prompt: o.value }));
    setAnswers((prev) => {
      const keepSet = new Set(selectedPrompts.map((p) => p.prompt));
      const nextAnswers: Record<string, string> = {};
      for (const k of Object.keys(prev.promptAnswers)) if (keepSet.has(k)) nextAnswers[k] = prev.promptAnswers[k];
      return { ...prev, selectedPrompts, promptAnswers: nextAnswers };
    });
  };

  // convenience helpers
  const helperText = 'text-xs text-gray-500';
  const valueFromIds = (options: Option[], ids: string[]) => options.filter((o) => ids.includes(o.value));
  const idsFromValue = (opts: readonly Option[] | null) => (opts ? Array.from(opts).map((o) => o.value) : []);
  const optionFromId = (options: Option[], id: string) => options.find((o) => o.value === id) ?? null;

  const selectAll = (key: 'subcategories' | 'collabTypes' | 'cadences') => {
    if (key === 'subcategories') return setAnswers((p) => ({ ...p, subcategories: subcategoryOptions.map((s) => s.value) }));
    if (key === 'collabTypes') return setAnswers((p) => ({ ...p, collabTypes: collabTypeOptions.map((o) => o.value) }));
    if (key === 'cadences') return setAnswers((p) => ({ ...p, cadences: cadenceOptions.map((o) => o.value) }));
  };

  const clearAll = (key: 'categoryId' | 'subcategories' | 'collabTypes' | 'cadences') => {
    if (key === 'categoryId') return setAnswers((p) => ({ ...p, categoryId: '', subcategories: [] }));
    setAnswers((prev) => ({ ...prev, [key]: [] as any }));
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Sticky mini-progress (mobile helpful) */}
      <div className="sticky top-[64px] z-10 bg-white/80 backdrop-blur rounded-lg border p-3 sm:hidden">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>
            Step {qStep} of {stepCount}
          </span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-2 bg-yellow-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
          <span>
            Step {qStep} of {stepCount}
          </span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-2 bg-yellow-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {err && <div className="p-3 text-sm rounded-md border border-red-200 bg-red-50 text-red-700" aria-live="polite">{err}</div>}

      {/* ===== SUBSTEP 1 */}
      {qStep === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Which content do you create?</label>
            <Select
              instanceId="formats"
              isMulti
              closeMenuOnSelect={false}
              options={formatOptions}
              value={valueFromIds(formatOptions, answers.formats)}
              onChange={(opts) => setAnswers((p) => ({ ...p, formats: idsFromValue(opts as any) }))}
              styles={styles}
              theme={theme}
              placeholder="Select formats"
            />
            <p className={helperText}>We’ll use this to match you with the right briefs.</p>
          </div>
          {answers.formats.length > 0 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Pick a budget range for each selected format
              </label>

              <div className="grid md:grid-cols-2 gap-4">
                {answers.formats.map((f) => (
                  <div
                    key={f}
                    className="rounded-lg border-gray-200 bg-white duration-200"
                  >
                    <h3 className="block text-sm font-medium text-gray-700 mb-2">{f}</h3>

                    <Select
                      instanceId={`budget-${f}`}
                      options={budgetOptions}
                      value={optionFromId(budgetOptions, answers.budgets[f] || '')}
                      onChange={(opt: SingleValue<Option>) =>
                        setAnswers((prev) => ({
                          ...prev,
                          budgets: {
                            ...prev.budgets,
                            [f]: (opt?.value as BudgetRange) || ('' as any),
                          },
                        }))
                      }
                      styles={styles}
                      theme={theme}
                      placeholder="Select your budget range"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">Preferred project length
                <div className="relative group">
                  <span className="inline-flex items-center justify-center w-5 h-4 text-s font-semibold text-gray-600 border border-gray-400 rounded-full cursor-default">
                    i
                  </span>
                  <div className="absolute left-1 -translate-x-1 mt-2 w-48 text-s text-gray-700 bg-white border border-gray-300 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 p-1 z-10">
                    Project Duration
                  </div>
                </div>
              </label>
              <Select
                instanceId="project-length"
                options={projectLengthOptions}
                value={optionFromId(projectLengthOptions, answers.projectLength)}
                onChange={(opt: SingleValue<Option>) => setAnswers((p) => ({ ...p, projectLength: opt?.value || '' }))}
                styles={styles}
                theme={theme}
                placeholder="Pick one"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                Capacity right now
                <div className="relative group">
                  <span className="inline-flex items-center justify-center w-5 h-4 text-s font-semibold text-gray-600 border border-gray-400 rounded-full cursor-default">
                    i
                  </span>
                  <div className="absolute left-1 -translate-x-1 mt-2 w-48 text-xs text-gray-700 bg-white border border-gray-300 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 p-1 z-10">
                    It represents your Project Occupancy.
                  </div>
                </div>
              </label>

              <Select
                instanceId="capacity"
                options={capacityOptions}
                value={optionFromId(capacityOptions, answers.capacity)}
                onChange={(opt: SingleValue<Option>) => setAnswers((p) => ({ ...p, capacity: opt?.value || '' }))}
                styles={styles}
                theme={theme}
                placeholder="Pick one"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={next} variant="influencer" disabled={!validStep1} className='cursor-pointer'>
              Next
            </Button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onComplete()}
              className="text-sm text-gray-600 underline hover:text-gray-800 cursor-pointer"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* ===== SUBSTEP 2 */}
      {qStep === 2 && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">Category (single select)
                <div className="relative group">
                  <span className="inline-flex items-center justify-center w-5 h-4 text-s font-semibold text-gray-600 border border-gray-400 rounded-full cursor-default">
                    i
                  </span>
                  <div className="absolute left-1 -translate-x-1 mt-2 w-48 text-xs text-gray-700 bg-white border border-gray-300 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 p-1 z-10">
                    Pick one category to unlock its subcategories.
                  </div>
                </div>
              </label>
            </div>

            <Select
              isMulti={false}
              closeMenuOnSelect={true}
              options={categoryOptions}
              value={optionFromId(categoryOptions, answers.categoryId)}
              onChange={(opt) =>
                setAnswers((p) => ({
                  ...p,
                  categoryId: (opt as Option | null)?.value || '',
                  subcategories: [],
                }))
              }
              isLoading={catLoading}
              styles={styles}
              theme={theme}
              placeholder={catLoading ? 'Loading…' : 'Select a category'}
            />
            {catError && <p className="text-sm text-red-600 mt-1" aria-live="polite">{catError}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">Subcategories (multi-select)
                <div className="relative group">
                  <span className="inline-flex items-center justify-center w-5 h-4 text-s font-semibold text-gray-600 border border-gray-400 rounded-full cursor-default">
                    i
                  </span>
                  <div className="absolute left-1 -translate-x-1 mt-2 w-48 text-xs text-gray-700 bg-white border border-gray-300 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 p-1 z-10">
                    These depend on the category you selected above.
                  </div>
                </div>
              </label>
            </div>

            <Select
              isMulti
              closeMenuOnSelect={false}
              options={subcategoryOptions}
              value={valueFromIds(subcategoryOptions, answers.subcategories)}
              onChange={(opts) => setAnswers((p) => ({ ...p, subcategories: idsFromValue(opts as any) }))}
              isDisabled={subcategoryOptions.length === 0}
              styles={styles}
              theme={theme}
              placeholder={subcategoryOptions.length ? 'Select subcategories' : 'Select a category first'}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Collab types</label>
              </div>
              <Select
                isMulti
                closeMenuOnSelect={false}
                options={collabTypeOptions}
                value={valueFromIds(collabTypeOptions, answers.collabTypes)}
                onChange={(opts) => setAnswers((p) => ({ ...p, collabTypes: idsFromValue(opts as any) }))}
                styles={styles}
                theme={theme}
                placeholder={'Select collaboration types'}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Product Delivery</label>
              </div>
              <Select
                isMulti
                closeMenuOnSelect={false}
                options={cadenceOptions}
                value={valueFromIds(cadenceOptions, answers.cadences)}
                onChange={(opts) => setAnswers((p) => ({ ...p, cadences: idsFromValue(opts as any) }))}
                styles={styles}
                theme={theme}
                placeholder={'Select cadence'}
              />
            </div>
          </div>

          <div className="flex justify-between items-center gap-4">
            <Button
              onClick={back}
              variant="outline"
              className="cursor-pointer"
            >
              Back
            </Button>

            <Button
              onClick={next}
              variant="influencer"
              disabled={!validStep2}
              className="cursor-pointer"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ===== SUBSTEP 3 */}
      {qStep === 3 && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50 text-sm text-yellow-900">
            Pick up to <strong>3</strong> prompts total — max <strong>1 per group</strong> — and answer briefly.
          </div>

          <div className="space-y-5">
            {(['Content', 'Audience', 'Brand'] as const).map((grp) => {
              const options = storyPrompts[grp].map((t) => ({ value: t, label: t }));
              const sel = answers.selectedPrompts.find((s) => s.group === grp)?.prompt || '';
              const selectedOption = options.find((o) => o.value === sel) || null;

              return (
                <div key={grp} className="p-4 rounded-xl border-gray-200 bg-white duration-200">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    {grp} Prompt
                  </label>
                  <Select
                    instanceId={`prompt-${grp}`}
                    options={options}
                    value={selectedOption}
                    onChange={(opt: SingleValue<{ value: string; label: string }>) => {
                      const prompt = opt?.value || '';
                      setAnswers((prev) => {
                        const filtered = prev.selectedPrompts.filter((s) => s.group !== grp);
                        if (!prompt) return { ...prev, selectedPrompts: filtered };
                        return { ...prev, selectedPrompts: [...filtered, { group: grp, prompt }] };
                      });
                    }}
                    styles={styles}
                    theme={theme}
                    placeholder={`Choose a ${grp.toLowerCase()} prompt`}
                    isClearable
                  />
                  <p className="mt-2 text-xs text-gray-500">Select only one prompt for this category.</p>
                </div>
              );
            })}
          </div>

          {answers.selectedPrompts.map(({ group, prompt }) => (
            <div key={prompt} className="space-y-2 mt-4">
              <div className="text-sm font-medium text-gray-800">{group}</div>
              <div className="text-sm text-gray-700">{prompt}</div>
              <textarea
                value={answers.promptAnswers[prompt] || ''}
                onChange={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    promptAnswers: { ...prev.promptAnswers, [prompt]: e.target.value.slice(0, 500) },
                  }))
                }
                rows={3}
                placeholder="Your short answer (10–500 chars)"
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:border-yellow-500 focus:outline-none text-sm"
              />
              <div className="text-xs text-gray-500 text-right">
                {(answers.promptAnswers[prompt]?.length ?? 0)}/500
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between mt-6">
            <div className="text-xs text-gray-500">
              Selected: {answers.selectedPrompts.length} / 3
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={back}
                className="text-sm text-gray-600 font-semibold underline hover:text-gray-800 transition-colors duration-200 cursor-pointer"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => onComplete()}
                className="text-sm text-gray-600 font-semibold underline hover:text-gray-800 transition-colors duration-200 cursor-pointer"
              >
                Skip
              </button>
              <Button
                onClick={finish}
                loading={saving}
                variant="influencer"
                disabled={!validStep3}
                className="cursor-pointer"
              >
                Finish
              </Button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
