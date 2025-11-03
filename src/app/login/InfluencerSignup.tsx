import { useEffect, useMemo, useState, useCallback } from 'react';
import { Sparkles, Instagram, Youtube, Globe, CheckCircle2 } from 'lucide-react';
import { FloatingLabelInput } from '@/components/common/FloatingLabelInput';
import { Button } from './Button';
import { ProgressIndicator } from './ProgressIndicator';
import Select, { GroupBase, MultiValue, SingleValue } from 'react-select';
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

// Reusable react-select theme configured to Tailwind amber accents
const rsTheme = (theme: any) => ({
  ...theme,
  colors: {
    ...theme.colors,
    primary: '#f59e0b',
    primary25: '#fef3c7',
    primary50: '#fde68a',
    neutral20: '#d1d5db',
    neutral30: '#f59e0b',
  },
});

// Reusable react-select styles (mobile-first, accessible focus)
const rsStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: 44,
    borderWidth: 2,
    borderColor: state.isFocused ? '#f59e0b' : '#d1d5db',
    boxShadow: 'none',
    ':hover': { borderColor: '#f59e0b' },
    backgroundColor: '#F9FAFB', // gray-50
  }),
  multiValue: (base: any) => ({ ...base, backgroundColor: '#FEF3C7' }), // amber-100
  multiValueLabel: (base: any) => ({ ...base, color: '#92400e' }), // amber-800
  multiValueRemove: (base: any) => ({
    ...base,
    color: '#f59e0b',
    ':hover': { backgroundColor: '#FDE68A', color: '#92400e' },
  }),
  menu: (base: any) => ({ ...base, zIndex: 40 }),
} as const;

// =========================
// Component
// =========================

export default function InfluencerSignup({ onSuccess }: { onSuccess: () => void }) {
  const router = useRouter();
  // Start at BASIC for a natural flow
  const [step, setStep] = useState<Step>('basic');
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [languages, setLanguages] = useState<Language[]>([]);
  const [langLoading, setLangLoading] = useState(false);
  const [langError, setLangError] = useState('');

  // Max allowed DOB: 2013 or earlier
  const maxDob = '2013-12-31';

  // OTP state
  const [resendIn, setResendIn] = useState<number>(0);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

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
    phone: '',
    dateOfBirth: '',
    countryId: '',
    city: '',
    callingCodeId: '',
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

  const callingCodeOptions: Option[] = useMemo(
    () =>
      countries
        .map((c) => ({ value: c._id, label: c.callingCode, meta: { flag: c.flag } }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [countries]
  );

  const formatOptionLabelCountry = useCallback((opt: Option) => (
    <div className="flex items-center gap-2">
      <span className="text-lg leading-none">{opt.meta?.flag ?? '🏳️'}</span>
      <span>{opt.label}</span>
    </div>
  ), []);

  const formatOptionLabelCalling = useCallback((opt: Option) => (
    <div className="flex items-center gap-2">
      <span className="text-lg leading-none">{opt.meta?.flag ?? '🏳️'}</span>
      <span>{opt.label}</span>
    </div>
  ), []);

  // ===== Step 1 — Basic + Email (auto-send OTP on continue)
  const completeBasicDetails = () => {
    if (!formData.fullName || !formData.email || !formData.phone || !formData.dateOfBirth || !formData.countryId || !formData.callingCodeId || !formData.gender) {
      setError('Please fill in all required fields');
      return;
    }
    // DOB must be 2013-12-31 or earlier
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(formData.dateOfBirth)) {
      setError('Please enter a valid date of birth');
      return;
    }
    const cutoff = '2013-12-31';
    // compare ISO strings (YYYY-MM-DD) lexicographically
    if (formData.dateOfBirth > cutoff) {
      setError('Date of birth must be on or before 2013');
      return;
    }
    // Enforce 10-digit mobile without country code
    const phoneDigits = (formData.phone || '').replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number (exclude country code).');
      return;
    }
    // Persist normalized digits
    setFormData((prev) => ({ ...prev, phone: phoneDigits }));
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
      setError('Please enter the OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await post('/influencer/verify-otp', { email: formData.email, role: 'Influencer', otp: formData.otp });
      setOtpVerified(true);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setStep('basic');
    setOtpSent(false);
    setOtpVerified(false);
    setResendIn(0);
    setFormData((prev) => ({ ...prev, otp: '' }));
  };

  const proceedToPlatform = () => {
    if (!otpVerified) {
      setError('Please verify your email first');
      return;
    }
    if (!formData.password || !formData.confirmPassword) {
      setError('Please enter your password');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!formData.agreedToTerms) {
      setError('Please agree to the Terms & Privacy Policy');
      return;
    }
    setError('');
    setStep('platform');
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
      // call your backend proxy (keeps API key server-side)
      const result = await post('/modash/resolve-profile', {
        platform: provider, // 'instagram' | 'tiktok' | 'youtube'
        username: handle,
      });

      // Expecting { data, providerRaw, preview }
      const normalized = (result as any)?.data ?? (result as any)?.normalized;
      if (!normalized) throw new Error('No profile found for that username');

      setProvider(provider, { payload: (result as any).providerRaw ?? normalized, preview: (result as any).preview ?? null, error: '' });
    } catch (err: any) {
      setProvider(provider, {
        payload: null,
        preview: null,
        error: err?.response?.data?.message || err?.message || 'Failed to fetch profile',
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
        phone: (formData.phone || '').replace(/\D/g, ''),
        countryId: formData.countryId,
        callingId: formData.callingCodeId,
        // NEW: pass basics & languages
        city: formData.city,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,        // "YYYY-MM-DD"
        selectedLanguages: formData.selectedLanguages, // Language _ids
        // Platforms + preferred
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
      // If auto-login fails, fall back to existing success handling
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header area */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center ring-1 ring-gray-200 overflow-hidden">
              <img src='./logo.png' alt="Logo" loading="lazy" className="w-full h-full object-contain" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">Influencer Signup</h1>
              <p className="hidden sm:block text-xs text-gray-500">Grow with brand collaborations tailored to you</p>
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
          <div className="text-center space-y-2 mb-4">
            <p className="text-sm text-gray-600">
              {step === 'basic' && 'Let’s get to know you 💫'}
              {step === 'verify' && 'Secure your account 🔐'}
              {step === 'platform' && 'Where do you shine online? ✨'}
              {step === 'quick' && 'Optional: A few quick questions to personalize your experience'}
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          {/* STEP 1 — BASIC + EMAIL (react-select everywhere) */}
          {step === 'basic' && (
            <div className="space-y-5 animate-fadeIn">
              <p className="text-sm text-gray-600 text-center">Just a few quick details to start your creator journey</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
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
                </div>

                <div className="sm:col-span-2">
                  <FloatingLabelInput
                    id="inf-email"
                    label="Work Email"
                    type="email"
                    placeholder="We'll verify this next"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="grid sm:grid-cols-3 gap-4 sm:col-span-2">
                  <div className="sm:col-span-1">
                    <Select
                      instanceId="calling-code"
                      options={callingCodeOptions}
                      value={findOption(callingCodeOptions, formData.callingCodeId)}
                      onChange={(opt: SingleValue<Option>) => setFormData((p) => ({ ...p, callingCodeId: opt?.value || '' }))}
                      placeholder="Code"
                      styles={rsStyles as any}
                      theme={rsTheme}
                      formatOptionLabel={formatOptionLabelCalling}
                    />
                  </div>
                  <div className="sm:col-span-2">
                  <FloatingLabelInput
                    id="inf-phone"
                    label="Mobile Number"
                    type="tel"
                    placeholder="10-digit mobile (no country code)"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    title="Enter 10-digit mobile number (exclude country code)"
                    value={formData.phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, phone: digits });
                    }}
                    required
                    autoComplete="tel"
                  />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 sm:col-span-2">
                  <div className="sm:col-span-1">
                    <FloatingLabelInput
                      id="inf-dob"
                      label="Date of Birth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d{4}-\d{2}-\d{2}$/.test(val) && val > maxDob) {
                          setError('Date of birth must be on or before 2013');
                          (e.currentTarget as HTMLInputElement).setCustomValidity('Date of birth must be on or before 2013');
                          (e.currentTarget as HTMLInputElement).reportValidity?.();
                          return;
                        }
                        (e.currentTarget as HTMLInputElement).setCustomValidity('');
                        setFormData({ ...formData, dateOfBirth: val });
                      }}
                      required
                      autoComplete="bday"
                    />
                    <p className="text-xs text-gray-500 -mt-3">Never shown publicly</p>
                  </div>
                  <div className="sm:col-span-1">
                    <Select
                      instanceId="gender"
                      options={genderOptions}
                      value={findOption(genderOptions, formData.gender)}
                      onChange={(opt: SingleValue<Option>) => setFormData((p) => ({ ...p, gender: opt?.value || '' }))}
                      placeholder="Select gender"
                      styles={rsStyles as any}
                      theme={rsTheme}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 sm:col-span-2">
                  <div className="sm:col-span-1">
                    <Select
                      instanceId="country"
                      options={countryOptions}
                      value={findOption(countryOptions, formData.countryId)}
                      onChange={(opt: SingleValue<Option>) => setFormData((p) => ({ ...p, countryId: opt?.value || '' }))}
                      placeholder="Select Country"
                      styles={rsStyles as any}
                      theme={rsTheme}
                      formatOptionLabel={formatOptionLabelCountry}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <FloatingLabelInput
                      id="inf-city"
                      label="City (Optional)"
                      type="text"
                      placeholder="Where do you create from?"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      autoComplete="address-level2"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Languages you create content in</label>
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
                    placeholder={langLoading ? 'Loading…' : 'Select languages'}
                    isLoading={langLoading}
                  />
                  {langError && <p className="text-xs text-red-600 mt-2" aria-live="polite">{langError}</p>}
                  <p className="text-xs text-gray-500 mt-2">We’ll use this to tailor briefs.</p>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <p className="text-xs text-gray-500 text-center sm:text-left">You can edit this anytime</p>
                <Button onClick={completeBasicDetails} variant="influencer" className="self-center sm:self-auto">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2 — VERIFY */}
          {step === 'verify' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <CheckCircle2 className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm text-gray-700">
                  We’ll send a 6-digit code to <strong>{formData.email}</strong>
                </p>
              </div>

              {!otpVerified && (
                <>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <Button onClick={sendOTP} loading={loading} variant="influencer" className="w-full sm:w-auto px-6">
                      {otpSent ? 'Resend Code' : 'Send Verification Code'}
                    </Button>
                    {otpSent && (
                      <span className="self-center text-sm text-gray-600">
                        {resendIn > 0 ? `Resend in ${resendIn}s` : 'You can resend now'}
                      </span>
                    )}
                  </div>

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

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={verifyOTP} loading={loading} variant="influencer">
                      Verify Code
                    </Button>
                    <button onClick={handleChangeEmail} className="text-sm text-gray-600 hover:text-gray-900 underline">
                      Change email
                    </button>
                  </div>
                </>
              )}

              {otpVerified && (
                <>
                  <p className="text-sm text-gray-600 text-center">Perfect — your email’s verified! Let’s secure your account.</p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FloatingLabelInput
                      id="inf-password"
                      label="Password"
                      type="password"
                      placeholder="≥8 chars, 1 number, 1 letter"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      autoComplete="new-password"
                    />

                    <FloatingLabelInput
                      id="inf-confirm-password"
                      label="Confirm Password"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <label className="flex items-start space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.agreedToTerms}
                      onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                      required
                    />
                    <span className="text-sm text-gray-600 group-hover:text-gray-900">
                      I agree to the <a href="#" className="font-semibold text-yellow-600 hover:text-yellow-700">Terms & Privacy Policy</a>
                    </span>
                  </label>

                  <div className="flex justify-end">
                    <Button onClick={proceedToPlatform} variant="influencer">
                      Continue
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 3 — PLATFORM (multi-select + preferred) */}
          {step === 'platform' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Choose your <strong>preferred</strong> platform and optionally add the others. We’ll verify each with read-only checks.
                </p>
              </div>

              {/* NEW: Multi-select for platforms */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Platforms</label>
                <Select
                  instanceId="platforms"
                  isMulti
                  closeMenuOnSelect={false}
                  options={platformOptions}
                  value={selectedPlatformOptions}
                  onChange={(opts) => onChangePlatforms(opts as Option[])}
                  styles={rsStyles as any}
                  theme={rsTheme}
                  placeholder="Select one or more platforms"
                />
                <p className="text-xs text-gray-500">Add platforms here; cards will appear below.</p>
              </div>

              {/* If none selected, show a friendly nudge */}
              {includedPlatforms.length === 0 && (
                <div className="p-4 border border-amber-200 bg-amber-50 text-amber-900 rounded-lg text-sm">
                  Pick at least one platform to continue. You can still add more later.
                </div>
              )}

              {/* Only render cards for included platforms */}
              {includedPlatforms.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {includedPlatforms.map((p) => {
                    const s = platforms[p];
                    const isPrimary = primaryProvider === p;
                    const label = p === 'instagram' ? 'Instagram' : p === 'youtube' ? 'YouTube' : 'TikTok';

                    return (
                      <div
                        key={p}
                        className={[
                          'p-4 rounded-xl border-2 transition-all bg-white',
                          isPrimary ? 'border-yellow-600 shadow-[0_0_0_3px_rgba(245,158,11,0.15)]' : 'border-gray-200 hover:border-gray-300'
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
                              // Deselect this platform
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
                            // shadcn Checkbox gives boolean | "indeterminate"
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setPrimaryProvider(p);
                              } else if (primaryProvider === p) {
                                setPrimaryProvider('');
                              }
                            }}
                            className="border-gray-300 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                          />
                          <Label htmlFor={`primary-${p}`} className="text-sm text-gray-700 cursor-pointer">
                            Make this my primary account
                          </Label>
                        </div>

                        {/* Handle input */}
                        <FloatingLabelInput
                          id={`handle-${p}`}
                          label={`${label} Handle`}
                          type="text"
                          placeholder="@yourhandle"
                          value={s.handle}
                          onChange={(e) => setProvider(p, { handle: e.target.value, error: '', payload: null, preview: null })}
                          required
                        />

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

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Read-only verification:</strong> We only fetch public stats for matching. We will never post on your behalf.
                </p>
              </div>

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
// (improved: sticky mini-progress on mobile, disabled Next when invalid)
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
  type BudgetRange = '₹5k–10k' | '₹10k–25k' | '₹25k–50k' | '₹50k–1L' | '₹1L+';
  type ApiSubcategory = { subcategoryId: string; name: string };
  type ApiCategory = { _id: string; name: string; subcategories?: ApiSubcategory[] };
  type ApiCategoryResponse = { count?: number; categories?: ApiCategory[] };

  const formatOptions: Option[] = useMemo(
    () => ['Reels/Shorts', 'Stories', 'Static', 'Long-form', 'Tutorials', 'Live', 'Reviews', 'Unboxing'].map((f) => ({ value: f, label: f })),
    []
  );
  const budgetRanges: BudgetRange[] = ['₹5k–10k', '₹10k–25k', '₹25k–50k', '₹50k–1L', '₹1L+'];
  const budgetOptions: Option[] = useMemo(() => budgetRanges.map((b) => ({ value: b, label: b })), []);
  const projectLengthOptions: Option[] = useMemo(
    () => ['One-off (<2 wks)', 'Short (2–8 wks)', 'Long-term (3–6 m)', 'Retainer (6+ m)'].map((p) => ({ value: p, label: p })),
    []
  );
  const capacityOptions: Option[] = useMemo(() => ['Light', 'Normal', 'Heavy'].map((c) => ({ value: c, label: c })), []);

  // moved to react-select (multi) per request
  const collabTypeStrings = ['Paid', 'Product Gifting', 'Ambassador', 'Event'];
  const cadenceStrings = ['Single Deliverable', 'Weekly Series', 'Always-on'];

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
    categoryId: '' as string, // <-- single category
    subcategories: [] as string[], // <-- multiple subcategories
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
    const hasCat = !!answers.categoryId; // single category required
    const hasSubcats = answers.subcategories.length >= 1; // at least one subcategory
    const hasCollab = answers.collabTypes.length >= 1;
    const hasCadence = answers.cadences.length >= 1;
    return hasCat && hasSubcats && hasCollab && hasCadence;
  }, [answers.categoryId, answers.subcategories, answers.collabTypes, answers.cadences]);

  const validStep3 = useMemo(() => {
    if (answers.selectedPrompts.length < 1 || answers.selectedPrompts.length > 3) return false;
    for (const { prompt } of answers.selectedPrompts) {
      const text = answers.promptAnswers[prompt]?.trim() || '';
      if (text.length < 10) return false; // minimal signal
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
      // Persist Quick Questions to backend
      await post('/influencer/onboarding', {
        influencerId, // preferred
        email,        // fallback match if id is missing
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

  const promptGroups: GroupOption[] = useMemo(() => {
    return Object.entries(storyPrompts).map(([group, list]) => ({
      label: group,
      options: list.map((p) => ({ value: p, label: p, meta: { group } })),
    }));
  }, []);

  const selectedPromptOptions: Option[] = useMemo(() => {
    const m = new Map<string, Option>();
    for (const g of promptGroups) for (const o of g.options) m.set(o.value, o);
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
    const selectedPrompts = picked.map((o) => ({ group: o.meta.group, prompt: o.value }));
    // prune promptAnswers for deselected prompts
    setAnswers((prev) => {
      const keepSet = new Set(selectedPrompts.map((p) => p.prompt));
      const nextAnswers: Record<string, string> = {};
      for (const k of Object.keys(prev.promptAnswers)) if (keepSet.has(k)) nextAnswers[k] = prev.promptAnswers[k];
      return { ...prev, selectedPrompts, promptAnswers: nextAnswers };
    });
  };

  // ==== UI ====
  const helperText = 'text-xs text-gray-500';

  // convenience: mapping helpers for select values
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
      <div className="sticky top=[64px] z-10 bg-white/80 backdrop-blur rounded-lg border p-3 sm:hidden">
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

      {/* Skip option (global) */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onComplete()}
          className="text-sm text-gray-600 underline hover:text-gray-800"
        >
          Skip for now
        </button>
      </div>

      {err && <div className="p-3 text-sm rounded-md border border-red-200 bg-red-50 text-red-700" aria-live="polite">{err}</div>}

      {/* ===== SUBSTEP 1 — all react-select */}
      {qStep === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Which formats do you create?</label>
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
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Pick a budget range for each selected format</label>
              <div className="grid md:grid-cols-2 gap-3">
                {answers.formats.map((f) => (
                  <div key={f} className="grid grid-cols-5 gap-3 items-center">
                    <span className="col-span-2 text-sm text-gray-700 truncate" title={f}>
                      {f}
                    </span>
                    <div className="col-span-3">
                      <Select
                        instanceId={`budget-${f}`}
                        options={budgetOptions}
                        value={optionFromId(budgetOptions, answers.budgets[f] || '')}
                        onChange={(opt: SingleValue<Option>) =>
                          setAnswers((prev) => ({ ...prev, budgets: { ...prev.budgets, [f]: (opt?.value as BudgetRange) || ('' as any) } }))
                        }
                        styles={styles}
                        theme={theme}
                        placeholder="Select range"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preferred project length</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Capacity right now</label>
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
            <Button onClick={next} variant="influencer" disabled={!validStep1}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ===== SUBSTEP 2 — Category single, Subcategories multi (react-select) ===== */}
      {qStep === 2 && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Category (single select)</label>
              <div className="flex gap-2">
                <Button variant="outline" className="py-1 px-3 !w-auto" onClick={() => clearAll('categoryId')} disabled={catLoading && !answers.categoryId}>
                  Clear
                </Button>
              </div>
            </div>

            <Select
              // SINGLE SELECT
              isMulti={false}
              closeMenuOnSelect={true}
              options={categoryOptions}
              value={optionFromId(categoryOptions, answers.categoryId)}
              onChange={(opt) =>
                setAnswers((p) => ({
                  ...p,
                  categoryId: (opt as Option | null)?.value || '',
                  subcategories: [], // reset subs when category changes
                }))
              }
              isLoading={catLoading}
              styles={styles}
              theme={theme}
              placeholder={catLoading ? 'Loading…' : 'Select a category'}
            />
            {catError && <p className="text-sm text-red-600 mt-1" aria-live="polite">{catError}</p>}
            {!catError && <p className={helperText}>Pick one category to unlock its subcategories.</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Subcategories (multi-select)</label>
              <div className="flex gap-2">
                <Button variant="outline" className="py-1 px-3 !w-auto" onClick={() => selectAll('subcategories')} disabled={subcategoryOptions.length === 0}>
                  Select All
                </Button>
                <Button variant="outline" className="py-1 px-3 !w-auto" onClick={() => clearAll('subcategories')} disabled={subcategoryOptions.length === 0}>
                  Clear
                </Button>
              </div>
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
            <p className={helperText}>These depend on the category you selected above.</p>
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
                <label className="block text-sm font-medium text-gray-700">Cadence you like</label>
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

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={answers.allowlisting}
              onChange={(e) => setAnswers((prev) => ({ ...prev, allowlisting: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
            />
            <span className="text-sm text-gray-700">Allowlisting / paid boosts ok</span>
          </label>

          <div className="flex justify-between">
            <Button onClick={back} variant="outline">
              Back
            </Button>
            <Button onClick={next} variant="influencer" disabled={!validStep2}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ===== SUBSTEP 3 — Prompts via grouped react-select ===== */}
      {qStep === 3 && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50 text-sm text-yellow-900">
            Pick up to <strong>3</strong> prompts total — max <strong>1 per group</strong> — and answer briefly.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select prompts</label>
            <Select<Option, true, GroupBase<Option>>
              instanceId="prompts"
              isMulti
              closeMenuOnSelect={false}
              options={promptGroups as any}
              value={selectedPromptOptions}
              onChange={(opts) => onChangePrompts(opts as Option[])}
              styles={styles}
              theme={theme}
              placeholder="Choose up to 3 prompts (1 per group)"
            />
          </div>

          {/* Render answer boxes for selected prompts */}
          {answers.selectedPrompts.map(({ group, prompt }) => (
            <div key={prompt} className="space-y-2">
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
              <div className="text-xs text-gray-500 text-right">{(answers.promptAnswers[prompt]?.length ?? 0)}/500</div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">Selected: {answers.selectedPrompts.length} / 3</div>
            <div className="flex gap-2">
              <Button onClick={back} variant="outline">
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                className="py-1 px-3 !w-auto"
                onClick={() => onComplete()}
              >
                Skip for now
              </Button>
              <Button onClick={finish} loading={saving} variant="influencer" disabled={!validStep3}>
                Finish
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
