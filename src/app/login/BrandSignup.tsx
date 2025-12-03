import { useEffect, useMemo, useState } from 'react';
import Select, { type SingleValue, type StylesConfig } from 'react-select';
import { CheckCircle2, ImagePlus, Eye, EyeOff } from 'lucide-react';
import { FloatingLabelInput } from '@/components/common/FloatingLabelInput';
import { Button } from './Button';
import { ProgressIndicator } from './ProgressIndicator';
import type { Country } from './types';
import { get, post } from '@/lib/api';
import { useRouter } from 'next/navigation';

// ————————————————— Types

type Step = 'email' | 'otp' | 'details';

type MetaCategory = { _id: string; id?: number; name: string };
type MetaBusinessType = { _id?: string; name: string };

type Option = { value: string; label: string };

// ⬇️ ADD brandAliasEmail here
type BrandLoginResponse = {
  token: string;
  brandId: string;
  brandAliasEmail?: string;
  subscriptionPlanName?: string;
  subscription?: {
    planId?: string;
    planName?: string;
    role?: string;
    status?: string;
    expiresAt?: string;
  };
};

const companySizes = ['1-10', '11-50', '51-200', '200+'];

const MAX_LOGO_MB = 3;
const ACCEPT_LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const BRAND_ALIAS_DOMAIN = 'mail.collabglam.com';

/** Normalize helpers to survive different API shapes */
function unwrap<T = any>(x: any): T {
  return (x && typeof x === 'object' && 'data' in x ? (x as any).data : x) as T;
}
function toArray<T = any>(v: any): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === 'object') {
    if (Array.isArray((v as any).data)) return (v as any).data as T[];
    if (Array.isArray((v as any).items)) return (v as any).items as T[];
    if (Array.isArray((v as any).docs)) return (v as any).docs as T[];
  }
  return [];
}

/** Build brand alias email local part from brand name */
function buildBrandAliasLocalPart(name: string): string {
  const raw = name.trim().toLowerCase();
  if (!raw) return '';

  // remove apostrophes etc.
  const withoutQuotes = raw.replace(/['"`’]/g, '');
  // replace non-alphanumeric with nothing (compact)
  const compact = withoutQuotes.replace(/[^a-z0-9]+/g, '');
  // trim leading/trailing dots just in case
  const cleaned = compact.replace(/^\.+|\.+$/g, '');

  return cleaned;
}

export function BrandSignup({ onSuccess, onStepChange }: { onSuccess: () => void; onStepChange?: (currentStep: number) => void }) {
  const router = useRouter();
  // NOTE: default to 'details' currently (for testing). Change to 'email' for full flow.
  const [step, setStep] = useState<Step>('email');
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<MetaCategory[]>([]);
  const [businessTypes, setBusinessTypes] = useState<MetaBusinessType[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState<number>(0);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [showRequiredHints, setShowRequiredHints] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    name: '',
    password: '',
    phone: '',
    countryId: '',
    callingCodeId: '',
    categoryId: '', // ObjectId of Category
    website: '',
    instagramHandle: '',
    companySize: '',
    businessType: '', // BusinessType NAME (string)
    referralCode: '',
    officialRep: false,
  });

  // ————————————————— Data fetch
  useEffect(() => {
    (async () => {
      try {
        const countriesData = unwrap<Country[]>(await get('/country/getall'));
        setCountries(Array.isArray(countriesData) ? countriesData : []);
      } catch {
        setCountries([]);
      }
    })();
  }, []);

  // Notify parent about current step number for conditional UI (e.g., role switch visibility)
  useEffect(() => {
    const current = step === 'email' ? 1 : step === 'otp' ? 2 : 3;
    onStepChange?.(current);
  }, [step, onStepChange]);

  // Resend countdown timer
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  useEffect(() => {
    (async () => {
      setMetaLoading(true);
      try {
        // Preferred: combined meta
        const raw = unwrap<any>(await get('/brand/metaOptions'));
        const cats = toArray<MetaCategory>(raw?.categories);
        const bts = toArray<MetaBusinessType>(raw?.businessTypes).map((x) =>
          typeof x === 'string' ? ({ name: x as any }) : x
        );
        setCategories(cats);
        setBusinessTypes(bts);
      } catch {
        // Fallback: separate endpoints (lenient shapes)
        try {
          const catsResp = unwrap<any>(await get('/category/categories'));
          const btsResp = unwrap<any>(await get('business/getAll'));
          const cats = toArray<MetaCategory>(catsResp);
          const bts = toArray<MetaBusinessType>(btsResp?.items ?? btsResp).map((x) =>
            typeof x === 'string' ? ({ name: x as any }) : x
          );
          setCategories(cats);
          setBusinessTypes(bts);
        } catch {
          setCategories([]);
          setBusinessTypes([]);
        }
      } finally {
        setMetaLoading(false);
      }
    })();
  }, []);

  // ————————————————— Helpers
  const isValidUrl = (val: string) => {
    if (!val) return true; // optional
    try {
      const u = new URL(val.startsWith('http') ? val : `https://${val}`);
      return !!u.host;
    } catch {
      return false;
    }
  };

  /** Returns a clean, lowercase handle (no @, no URL, no slashes) */
  const extractInstagramHandle = (val: string) => {
    if (!val) return '';
    let s = val.trim();
    s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
    s = s.replace(/\?.*$/, '');
    s = s.split('/')[0];
    s = s.replace(/^@/, '').toLowerCase();
    if (!s) return '';
    if (!/^[a-z0-9._]{1,30}$/.test(s)) return '';
    return s;
  };

  const passwordScore = (pwd: string) => {
    if (!pwd) return { score: 0, label: 'Too short', pct: 0 };
    const len = pwd.length;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNum = /[0-9]/.test(pwd);
    const hasSym = /[^A-Za-z0-9]/.test(pwd);
    const commonish = /(password|12345|qwerty|letmein|admin)/i.test(pwd);

    let score = 0;
    if (len >= 8) score += 1;
    if (len >= 12) score += 1;
    if (hasLower && hasUpper) score += 1;
    if (hasNum) score += 1;
    if (hasSym) score += 1;
    if (commonish) score -= 1;

    const clamped = Math.max(0, Math.min(score, 5));
    const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
    const pct = (clamped / 5) * 100;
    return { score: clamped, label: labels[clamped], pct };
  };

  const pwd = passwordScore(formData.password);

  // Brand alias email (uneditable): brand-name@collabglam.com
  const brandAliasEmail = useMemo(() => {
    const localPart = buildBrandAliasLocalPart(formData.name);
    return localPart ? `${localPart}@${BRAND_ALIAS_DOMAIN}` : '';
  }, [formData.name]);

  // ————————————————— Select options (react-select)
  const callingCodeOptions: Option[] = useMemo(
    () => (countries || []).map((c) => ({ value: c._id, label: `${c.flag ?? ''} ${c.callingCode}` })),
    [countries]
  );
  const countryOptions: Option[] = useMemo(
    () => (countries || []).map((c) => ({ value: c._id, label: `${c.flag ?? ''} ${c.countryName}` })),
    [countries]
  );
  const categoryOptions: Option[] = useMemo(
    () => (Array.isArray(categories) ? categories : []).map((cat) => ({ value: cat._id, label: cat.name })),
    [categories]
  );
  const businessTypeOptions: Option[] = useMemo(
    () => (Array.isArray(businessTypes) ? businessTypes : []).map((t) => ({ value: t.name, label: t.name })),
    [businessTypes]
  );
  const companySizeOptions: Option[] = useMemo(
    () => companySizes.map((s) => ({ value: s, label: s.includes('+') ? s : `${s} employees` })),
    []
  );

  const getOption = (options: Option[], value: string) => options.find((o) => o.value === value) ?? null;

  // react-select styles to blend with Tailwind inputs
  const selectStyles: StylesConfig<Option, false> = {
    control: (base, state) => ({
      ...base,
      minHeight: 48,
      borderRadius: 12,
      borderColor: state.isFocused ? '#fb923c' : '#d1d5db', // orange-400 / gray-300
      boxShadow: 'none',
      backgroundColor: state.isDisabled ? '#f9fafb' : '#ffffff', // gray-50 / white
      ':hover': { borderColor: state.isFocused ? '#fb923c' : '#d1d5db' },
    }),
    valueContainer: (base) => ({ ...base, padding: '0 12px' }),
    indicatorsContainer: (base) => ({ ...base, paddingRight: 8 }),
    menu: (base) => ({ ...base, zIndex: 50, borderRadius: 12, overflow: 'hidden' }),
    option: (base) => ({ ...base, cursor: 'pointer' }),
    placeholder: (base) => ({ ...base, color: '#9ca3af' }), // gray-400
  };

  // ————————————————— Actions
  const sendOTP = async () => {
    if (!formData.email) {
      setError('Please enter your work email.');
      return;
    }
    if (resendIn > 0) return;
    setLoading(true);
    setError('');
    try {
      await post('/brand/requestOtp', { email: formData.email, role: 'Brand' });
      setStep('otp');
      setResendIn(30);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!formData.otp) {
      setError('Please enter the OTP.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await post('/brand/verifyOtp', { email: formData.email, otp: formData.otp, role: 'Brand' });
      setStep('details');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const completeSignup = async () => {
    setShowRequiredHints(false);

    if (!formData.name || !formData.password || !formData.phone || !formData.countryId || !formData.callingCodeId || !formData.categoryId) {
      setShowRequiredHints(true);
      const firstMissingId = [
        ['brand-name', !formData.name],
        ['calling-code', !formData.callingCodeId],
        ['brand-phone', !formData.phone],
        ['country', !formData.countryId],
        ['category', !formData.categoryId],
        ['brand-password', !formData.password],
      ].find(([, miss]) => miss)?.[0] as string | undefined;
      if (firstMissingId) document.getElementById(firstMissingId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const phoneDigits = (formData.phone || '').replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number (exclude country code).');
      return;
    }
    if (pwd.score < 2) {
      setError('Please choose a stronger password (at least Fair).');
      return;
    }
    if (!formData.officialRep) {
      setError('Please confirm you are an official representative of this brand.');
      return;
    }
    if (!isValidUrl(formData.website)) {
      setError('Please enter a valid website URL, e.g., https://example.com');
      return;
    }

    if (logoFile) {
      if (!ACCEPT_LOGO_MIME.includes(logoFile.type)) {
        setError('Logo must be PNG, JPG, WEBP, or SVG.');
        return;
      }
      if (logoFile.size > MAX_LOGO_MB * 1024 * 1024) {
        setError(`Logo must be under ${MAX_LOGO_MB}MB.`);
        return;
      }
    }

    setLoading(true);
    setError('');

    const instaHandle = extractInstagramHandle(formData.instagramHandle);

    try {
      const fd = new FormData();

      if (logoFile) {
        fd.append('file', logoFile);
      }

      fd.append('name', formData.name);
      fd.append('phone', phoneDigits);
      fd.append('email', formData.email);
      fd.append('password', formData.password);
      fd.append('countryId', formData.countryId);
      fd.append('callingId', formData.callingCodeId);
      fd.append('categoryId', formData.categoryId);

      if (formData.website) fd.append('website', formData.website);
      if (instaHandle) fd.append('instagramHandle', instaHandle);
      if (formData.companySize) fd.append('companySize', formData.companySize);
      if (formData.businessType) fd.append('businessType', formData.businessType);
      if (formData.referralCode) fd.append('referralCode', formData.referralCode);
      fd.append('isVerifiedRepresentative', formData.officialRep ? 'true' : 'false');

      await post('/brand/register', fd);

      const login = unwrap<BrandLoginResponse>(
        await post('/brand/login', { email: formData.email, password: formData.password })
      );

      if (typeof window !== 'undefined') {
        if (login?.token) localStorage.setItem('token', login.token);
        if (login?.brandId) localStorage.setItem('brandId', login.brandId);
        localStorage.setItem('userType', 'brand');
        localStorage.setItem('userEmail', formData.email);

        // ⬇️ NEW: store brandAliasEmail (prefer backend, fallback to frontend computed)
        const alias = login?.brandAliasEmail ?? brandAliasEmail;
        if (alias) {
          localStorage.setItem('brandAliasEmail', alias);
        }

        const brandPlanName =
          login.subscriptionPlanName ??
          login.subscription?.planName ??
          'free';

        const brandPlanId = login.subscription?.planId ?? '';

        localStorage.setItem('brandPlanName', brandPlanName);
        if (brandPlanId) {
          localStorage.setItem('brandPlanId', brandPlanId);
        }
      }

      router.replace('/brand/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  // ————————————————— UI State
  const steps = useMemo(
    () => [
      { number: 1, label: 'Email', completed: step !== 'email', active: step === 'email' },
      { number: 2, label: 'Verify', completed: step === 'details', active: step === 'otp' },
      { number: 3, label: 'Details', completed: false, active: step === 'details' },
    ],
    [step]
  );

  const onPickLogo = (file?: File | null) => {
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeBusinessTypes = Array.isArray(businessTypes) ? businessTypes : [];

  const missing = {
    name: showRequiredHints && !formData.name,
    countryId: showRequiredHints && !formData.countryId,
    categoryId: showRequiredHints && !formData.categoryId,
    password: showRequiredHints && !formData.password,
    phone: showRequiredHints && !formData.phone,
    callingCodeId: showRequiredHints && !formData.callingCodeId,
  } as const;

  const filteredError =
    error === 'Please fill in all required fields.'
      ? ''
      : error;

  // ————————————————— Render
  return (
    <div className="space-y-6 w-full">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center ">
            <img src="./logo.png" alt="CollabGlam" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-gray-900">Brand Signup</h2>
        <p className="text-gray-600">Join CollabGlam and connect with creators</p>
      </div>

      <ProgressIndicator steps={steps} variant="brand" />

      {filteredError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" aria-live="polite">
          {filteredError}
        </div>
      )}

      {/* ————————————————— Step 1: Email ————————————————— */}
      {step === 'email' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="grid gap-3">
            <div className="grid grid-cols-1 items-end gap-4 mx-4 md:mx-[0%]">
              <FloatingLabelInput
                id="brand-email"
                label="Work Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              <Button onClick={sendOTP} loading={loading} variant="brand">
                Send Verification Code
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ————————————————— Step 2: OTP ————————————————— */}
      {step === 'otp' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
            <CheckCircle2 className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <p className="text-sm text-gray-700">
              We sent a 6-digit code to <strong>{formData.email}</strong>
            </p>
          </div>

          <FloatingLabelInput
            id="brand-otp"
            label="Enter 6-Digit Code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={formData.otp}
            onChange={(e) => setFormData({ ...formData, otp: e.target.value.replace(/\D/g, '') })}
            required
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button onClick={verifyOTP} loading={loading} variant="brand">
              Verify Code
            </Button>

            <button
              type="button"
              onClick={sendOTP}
              disabled={resendIn > 0 || loading}
              className={`sm:ml-auto text-sm underline font-medium transition-colors ${
                resendIn > 0 || loading
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
              aria-live="polite"
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </div>
      )}

      {/* ————————————————— Step 3: Details ————————————————— */}
      {step === 'details' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="p-4 md:p-6 lg:p-8 border-2 border-gray-100 rounded-2xl bg-white">
            <div className="grid gap-6 lg:gap-8 lg:grid-cols-[112px,1fr] items-start">
              {/* Logo uploader */}
              <div className="flex flex-col items-center gap-2">
                <label className="cursor-pointer">
                  <div className="w-28 h-28 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden hover:bg-gray-100 transition-colors">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Brand logo preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlus className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept={ACCEPT_LOGO_MIME.join(',')}
                    className="hidden"
                    onChange={(e) => onPickLogo(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              {/* Form grid */}
              <div className="grid gap-6">
                {/* Row 1: Brand Name + Email */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <FloatingLabelInput
                      id="brand-name"
                      label="Brand Name"
                      type="text"
                      autoComplete="organization"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    {missing.name && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>

                  <FloatingLabelInput
                    id="brand-email-display"
                    label="Email"
                    type="email"
                    value={formData.email}
                    disabled
                  />
                </div>

                {/* Row 2: Brand Alias Email + Website */}
                <div className="grid md:grid-cols-2 gap-4">
                  <FloatingLabelInput
                    id="brand-alias-email"
                    label="Brand Alias Email"
                    type="email"
                    value={brandAliasEmail}
                    disabled
                  />

                  <FloatingLabelInput
                    id="brand-website"
                    label="Website (Optional)"
                    type="url"
                    placeholder="https://example.com"
                    autoComplete="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>

                {/* Row 3: Location + Category */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Select
                      instanceId="country"
                      inputId="country"
                      className="rs"
                      classNamePrefix="rs"
                      styles={selectStyles}
                      placeholder="Select Country"
                      options={countryOptions}
                      value={getOption(countryOptions, formData.countryId)}
                      onChange={(opt: SingleValue<Option>) => setFormData({ ...formData, countryId: opt?.value || '' })}
                      isDisabled={loading}
                      isLoading={metaLoading}
                    />
                    {missing.countryId && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Select
                      instanceId="category"
                      inputId="category"
                      className="rs"
                      classNamePrefix="rs"
                      styles={selectStyles}
                      placeholder={metaLoading ? 'Loading categories…' : 'Brand Category / Industry'}
                      options={categoryOptions}
                      value={getOption(categoryOptions, formData.categoryId)}
                      onChange={(opt: SingleValue<Option>) => setFormData({ ...formData, categoryId: opt?.value || '' })}
                      isDisabled={metaLoading || loading}
                      isLoading={metaLoading}
                    />
                    {missing.categoryId && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>
                </div>

                {/* Row 4: Phone (Calling code + number) */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Select
                      instanceId="calling-code"
                      inputId="calling-code"
                      className="rs"
                      classNamePrefix="rs"
                      styles={selectStyles}
                      placeholder="Calling Code"
                      options={callingCodeOptions}
                      value={getOption(callingCodeOptions, formData.callingCodeId)}
                      onChange={(opt: SingleValue<Option>) => setFormData({ ...formData, callingCodeId: opt?.value || '' })}
                      isDisabled={loading}
                      isLoading={metaLoading}
                    />
                    {missing.callingCodeId && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <FloatingLabelInput
                      id="brand-phone"
                      label="Mobile Number (exclude country code)"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      minLength={10}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                      required
                    />
                    {missing.phone && (
                      <p className="text-xs text-red-600">This field is required</p>
                    )}
                  </div>
                </div>

                {/* Row 5: Instagram + Company size */}
                <div className="grid md:grid-cols-2 gap-4">
                  <FloatingLabelInput
                    id="brand-instagram"
                    label="Instagram Handle (Optional)"
                    type="text"
                    placeholder="@brandname or instagram.com/brandname"
                    value={formData.instagramHandle}
                    onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                  />

                  <Select
                    instanceId="company-size"
                    inputId="company-size"
                    className="rs"
                    classNamePrefix="rs"
                    styles={selectStyles}
                    placeholder="Company Size (Optional)"
                    options={companySizeOptions}
                    value={getOption(companySizeOptions, formData.companySize)}
                    onChange={(opt: SingleValue<Option>) => setFormData({ ...formData, companySize: opt?.value || '' })}
                    isDisabled={loading}
                    isClearable
                  />
                </div>

                {/* Row 6: Business type + Password */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Select
                    instanceId="business-type"
                    inputId="business-type"
                    className="rs"
                    classNamePrefix="rs"
                    styles={selectStyles}
                    placeholder={metaLoading ? 'Loading business types…' : 'Business Type (Optional)'}
                    options={businessTypeOptions}
                    value={getOption(businessTypeOptions, formData.businessType)}
                    onChange={(opt: SingleValue<Option>) => setFormData({ ...formData, businessType: opt?.value || '' })}
                    isDisabled={metaLoading || loading}
                    isLoading={metaLoading}
                    isClearable
                  />

                  <div className="grid gap-2">
                    <div className="relative">
                      <FloatingLabelInput
                        id="brand-password"
                        label="Password"
                        type={passwordVisible ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        style={{ paddingRight: 40 }}
                        required
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
                    {formData.password && (
                      <p className="text-xs text-gray-500">
                        Password strength: <span className="font-medium">{pwd.label}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Verification */}
                <div className="grid gap-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.officialRep}
                      onChange={(e) => setFormData({ ...formData, officialRep: e.target.checked })}
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      required
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      I confirm that I'm an official representative of this brand. By continuing, I agree to receive transactional emails.
                    </span>
                  </label>
                </div>

                <div className="flex flex-col gap-3">
                  <Button onClick={completeSignup} loading={loading} variant="brand" disabled={metaLoading} aria-disabled={metaLoading}>
                    {metaLoading ? 'Loading options…' : 'Create Brand Account'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        /* react-select resets to better match Tailwind inputs */
        .rs__control { font-size: 0.95rem; }
        .rs__placeholder { color: rgb(156 163 175); } /* gray-400 */
        .rs__single-value { color: rgb(17 24 39); } /* gray-900 */
      `}</style>
    </div>
  );
}
