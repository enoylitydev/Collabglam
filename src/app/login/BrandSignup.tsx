import { useEffect, useMemo, useState } from 'react';
import Select, { type SingleValue, type StylesConfig } from 'react-select';
import { CheckCircle2, ImagePlus, Eye, EyeOff, UploadCloud, Loader2 } from 'lucide-react';
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

const companySizes = ['1-10', '11-50', '51-200', '200+'];

const MAX_LOGO_MB = 3;
const ACCEPT_LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

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

export function BrandSignup({ onSuccess }: { onSuccess: () => void }) {
  const router = useRouter();
  // NOTE: keep default to 'email' if you want to skip email/otp while testing
  const [step, setStep] = useState<Step>('email');
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<MetaCategory[]>([]);
  const [businessTypes, setBusinessTypes] = useState<MetaBusinessType[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    name: '',
    password: '',
    confirmPassword: '',
    phone: '',
    countryId: '',
    callingCodeId: '',
    categoryId: '', // ObjectId of Category
    website: '',
    instagramHandle: '',
    companySize: '',
    businessType: '', // BusinessType NAME (string)
    referralCode: '',
    agreedToTerms: false,
    officialRep: false,
    logoUrl: ''
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
    setLoading(true);
    setError('');
    try {
      await post('/brand/requestOtp', { email: formData.email, role: 'Brand' });
      setStep('otp');
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

  const uploadLogoIfNeeded = async (): Promise<string> => {
    if (!logoFile) return '';
    if (!ACCEPT_LOGO_MIME.includes(logoFile.type)) {
      setError('Logo must be PNG, JPG, WEBP, or SVG.');
      return '';
    }
    if (logoFile.size > MAX_LOGO_MB * 1024 * 1024) {
      setError(`Logo must be under ${MAX_LOGO_MB}MB.`);
      return '';
    }

    try {
      setLogoUploading(true);
      const fd = new FormData();
      fd.append('file', logoFile);
      fd.append('email', formData.email);
      const res = await post('/brand/uploadLogo', fd);
      const url = (res?.url || res?.data?.url || '') as string;
      return url;
    } catch (e: any) {
      console.warn('Logo upload failed:', e?.message || e);
      return '';
    } finally {
      setLogoUploading(false);
    }
  };

  const completeSignup = async () => {
    // Required checks
    if (!formData.name || !formData.password || !formData.phone || !formData.countryId || !formData.callingCodeId || !formData.categoryId) {
      setError('Please fill in all required fields.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
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
    if (!formData.agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }
    if (!isValidUrl(formData.website)) {
      setError('Please enter a valid website URL, e.g., https://example.com');
      return;
    }

    setLoading(true);
    setError('');

    const instaHandle = extractInstagramHandle(formData.instagramHandle);

    try {
      const uploadedUrl = await uploadLogoIfNeeded();

      await post('/brand/register', {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        password: formData.password,
        countryId: formData.countryId,
        callingId: formData.callingCodeId,
        // required (send Category ObjectId; backend also supports numeric id or name)
        category: formData.categoryId,
        // optionals
        website: formData.website || undefined,
        instagramHandle: instaHandle || undefined,
        companySize: formData.companySize || undefined,
        // IMPORTANT: send businessType NAME (backend stores name directly)
        businessType: formData.businessType || undefined,
        referralCode: formData.referralCode || undefined,
        logoUrl: uploadedUrl || formData.logoUrl || undefined,
        // backend-required checkbox
        isVerifiedRepresentative: formData.officialRep,
      });

      // Auto-login after successful signup
      const login = await post<{ token: string; brandId: string }>(
        '/brand/login',
        { email: formData.email, password: formData.password }
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', login.token);
        localStorage.setItem('brandId', login.brandId);
        localStorage.setItem('userType', 'brand');
        localStorage.setItem('userEmail', formData.email);
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

  // ————————————————— Render
  return (
    <div className="space-y-6">
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

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" aria-live="polite">
          {error}
        </div>
      )}

      {/* ————————————————— Step 1: Email ————————————————— */}
      {step === 'email' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="grid gap-3">
            <div className="grid sm:grid-cols-2 gap-4">
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
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
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

          <Button onClick={verifyOTP} loading={loading} variant="brand">
            Verify Code
          </Button>

          <button onClick={() => setStep('email')} className="w-full text-sm text-gray-600 hover:text-gray-900">
            Change email address
          </button>
        </div>
      )}

      {/* ————————————————— Step 3: Details ————————————————— */}
      {step === 'details' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Symmetrical two-column card */}
          <div className="p-4 md:p-6 lg:p-8 border-2 border-gray-100 rounded-2xl bg-white">
            <div className="grid gap-6 lg:gap-8 lg:grid-cols-[112px,1fr] items-start">
              {/* Logo uploader */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-28 h-28 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Brand logo preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <label className="w-full">
                  <input
                    type="file"
                    accept={ACCEPT_LOGO_MIME.join(',')}
                    className="hidden"
                    onChange={(e) => onPickLogo(e.target.files?.[0] || null)}
                  />
                  <span className="mt-2 inline-flex items-center gap-2 text-xs text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                    <UploadCloud className="w-4 h-4" /> Upload Logo (Optional)
                  </span>
                </label>
                {logoUploading && (
                  <span className="text-[10px] text-gray-500 inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                  </span>
                )}
              </div>

              {/* Form grid */}
              <div className="grid gap-6">
                {/* Top row: brand + email */}
                <div className="grid md:grid-cols-2 gap-4">
                  <FloatingLabelInput
                    id="brand-name"
                    label="Brand Name"
                    type="text"
                    autoComplete="organization"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />

                  <FloatingLabelInput id="brand-email-display" label="Email" type="email" value={formData.email} disabled />
                </div>

                {/* Contact row */}
                <div className="grid md:grid-cols-3 gap-4">
                  <Select
                    instanceId="calling-code"
                    inputId="calling-code"
                    className="rs"
                    classNamePrefix="rs"
                    styles={selectStyles}
                    placeholder="Code"
                    options={callingCodeOptions}
                    value={getOption(callingCodeOptions, formData.callingCodeId)}
                    onChange={(opt: SingleValue<Option>) => setFormData({ ...formData, callingCodeId: opt?.value || '' })}
                    isDisabled={loading || logoUploading}
                    isLoading={!countries.length}
                  />

                  <div className="md:col-span-2">
                    <FloatingLabelInput
                      id="brand-phone"
                      label="Phone Number"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      pattern="[0-9()+\\-\\s]*"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Location + Category */}
                <div className="grid md:grid-cols-2 gap-4">
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
                    isDisabled={loading || logoUploading}
                    isLoading={metaLoading}
                  />

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
                    isDisabled={metaLoading || loading || logoUploading}
                    isLoading={metaLoading}
                  />
                </div>

                {/* Web + Instagram */}
                <div className="grid md:grid-cols-2 gap-4">
                  <FloatingLabelInput
                    id="brand-website"
                    label="Website (Optional)"
                    type="url"
                    placeholder="https://example.com"
                    autoComplete="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />

                  <FloatingLabelInput
                    id="brand-instagram"
                    label="Instagram Handle (Optional)"
                    type="text"
                    placeholder="@brandname or instagram.com/brandname"
                    value={formData.instagramHandle}
                    onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                  />
                </div>

                {/* Company size + Business type */}
                <div className="grid md:grid-cols-2 gap-4">
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
                    isDisabled={loading || logoUploading}
                    isClearable
                  />

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
                    isDisabled={metaLoading || loading || logoUploading}
                    isLoading={metaLoading}
                    isClearable
                  />
                </div>

                {/* Referral */}
                <FloatingLabelInput
                  id="brand-referral"
                  label="Referral Code (Optional)"
                  type="text"
                  autoComplete="one-time-code"
                  value={formData.referralCode}
                  onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
                />

                {/* Passwords with strength */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="relative">
                    <FloatingLabelInput
                      id="brand-password"
                      label="Password"
                      type={passwordVisible ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisible((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                    >
                      {passwordVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  <div className="relative">
                    <FloatingLabelInput
                      id="brand-confirm-password"
                      label="Confirm Password"
                      type={confirmPasswordVisible ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setConfirmPasswordVisible((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={confirmPasswordVisible ? 'Hide password' : 'Show password'}
                    >
                      {confirmPasswordVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Verification + Terms (symmetrical on md+) */}
                <div className="grid md:grid-cols-2 gap-3">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.officialRep}
                      onChange={(e) => setFormData({ ...formData, officialRep: e.target.checked })}
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      required
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      I confirm that I'm an official representative of this brand.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.agreedToTerms}
                      onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      required
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      I agree to the{' '}
                      <a href="#" className="font-semibold text-orange-600 hover:text-orange-700">
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a href="#" className="font-semibold text-orange-600 hover:text-orange-700">
                        Privacy Policy
                      </a>.
                    </span>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Button onClick={completeSignup} loading={loading || logoUploading} variant="brand" disabled={metaLoading}>
                    {metaLoading ? 'Loading options…' : 'Create Brand Account'}
                  </Button>
                  <p className="text-xs text-gray-500">By continuing, you agree to receive transactional emails.</p>
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
