import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImagePlus, Eye, EyeOff, UploadCloud, Loader2 } from 'lucide-react';
import { FloatingLabelInput } from '@/components/common/FloatingLabelInput';
import { Button } from './Button';
import { ProgressIndicator } from './ProgressIndicator';
import type { Country } from './types';
import { get, post } from '@/lib/api';

type Step = 'email' | 'otp' | 'details';

type MetaCategory = { _id: string; id?: number; name: string };
type MetaBusinessType = { _id: string; name: string };

const companySizes = ['1-10', '11-50', '51-200', '200+'];

const MAX_LOGO_MB = 3;
const ACCEPT_LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export function BrandSignup({ onSuccess }: { onSuccess: () => void }) {
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
    categoryId: '',          // now stores ObjectId of Category
    website: '',
    instagramHandle: '',
    companySize: '',
    businessTypeId: '',      // now stores ObjectId of BusinessType
    referralCode: '',
    agreedToTerms: false,
    officialRep: false,
    logoUrl: ''
  });

  // ————————————————————————————————————————————————
  // Data fetch
  useEffect(() => {
    (async () => {
      try {
        const countriesData = await get<Country[]>('/country/getall');
        setCountries(countriesData || []);
      } catch {
        setCountries([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setMetaLoading(true);
      try {
        // Prefer single endpoint from brandController.getMetaOptions
        const meta = await get<{ categories: MetaCategory[]; businessTypes: MetaBusinessType[] }>('/brand/metaOptions');
        if (meta?.categories?.length) setCategories(meta.categories);
        if (meta?.businessTypes?.length) setBusinessTypes(meta.businessTypes);
      } catch {
        // Graceful fallback to individual endpoints if present
        try {
          const [cats, btypes] = await Promise.all([
            get<MetaCategory[]>('/category/categories'),
            get<{ items: MetaBusinessType[] }>('business/getAll')
          ]);
          setCategories(cats || []);
          setBusinessTypes(btypes?.items || []);
        } catch {
          setCategories([]);
          setBusinessTypes([]);
        }
      } finally {
        setMetaLoading(false);
      }
    })();
  }, []);

  // ————————————————————————————————————————————————
  // Helpers
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

  // ————————————————————————————————————————————————
  // Actions
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
      // Expect backend to return { url: string }
      const res = await post('/brand/uploadLogo', fd);
      const url = res?.url || res?.data?.url || '';
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
    if (
      !formData.name || !formData.password || !formData.phone ||
      !formData.countryId || !formData.callingCodeId || !formData.categoryId
    ) {
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
        // optional: send BusinessType ObjectId if chosen
        businessType: formData.businessTypeId || undefined,
        referralCode: formData.referralCode || undefined,
        logoUrl: uploadedUrl || formData.logoUrl || undefined,
        // backend-required checkbox
        isVerifiedRepresentative: formData.officialRep
      });

      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  // ————————————————————————————————————————————————
  // UI State
  const steps = useMemo(() => ([
    { number: 1, label: 'Email',   completed: step !== 'email',     active: step === 'email' },
    { number: 2, label: 'Verify',  completed: step === 'details',   active: step === 'otp' },
    { number: 3, label: 'Details', completed: false,                active: step === 'details' }
  ]), [step]);

  const onPickLogo = (file?: File | null) => {
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  // ————————————————————————————————————————————————
  // Render
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

          <button
            onClick={() => setStep('email')}
            className="w-full text-sm text-gray-600 hover:text-gray-900"
          >
            Change email address
          </button>
        </div>
      )}

      {/* ————————————————— Step 3: Details ————————————————— */}
      {step === 'details' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Brand header card with optional logo upload */}
          <div className="grid sm:grid-cols-[96px,1fr] gap-4 p-4 border-2 border-gray-100 rounded-2xl bg-white">
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
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

            <div className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <FloatingLabelInput
                  id="brand-name"
                  label="Brand Name"
                  type="text"
                  autoComplete="organization"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />

                <FloatingLabelInput
                  id="brand-email-display"
                  label="Email"
                  type="email"
                  value={formData.email}
                  disabled
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <select
                  value={formData.callingCodeId}
                  onChange={(e) => setFormData({ ...formData, callingCodeId: e.target.value })}
                  className="px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none disabled:opacity-60"
                  required
                  disabled={loading || logoUploading}
                >
                  <option value="">Code</option>
                  {countries.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.flag} {c.callingCode}
                    </option>
                  ))}
                </select>

                <div className="sm:col-span-2">
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

              <select
                value={formData.countryId}
                onChange={(e) => setFormData({ ...formData, countryId: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none disabled:opacity-60"
                required
                disabled={loading || logoUploading}
              >
                <option value="">Select Country</option>
                {countries.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.flag} {c.countryName}
                  </option>
                ))}
              </select>

              {/* Category (from DB) */}
              <div className="relative">
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none disabled:opacity-60"
                  required
                  disabled={metaLoading || loading || logoUploading}
                >
                  <option value="">{metaLoading ? 'Loading categories…' : 'Brand Category / Industry'}</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {metaLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </span>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
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

              <div className="grid sm:grid-cols-2 gap-4">
                <select
                  value={formData.companySize}
                  onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                  className="px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none disabled:opacity-60"
                  disabled={loading || logoUploading}
                >
                  <option value="">Company Size (Optional)</option>
                  {companySizes.map((size) => (
                    <option key={size} value={size}>{size} {size.includes('+') ? '' : 'employees'}</option>
                  ))}
                </select>

                {/* Business Type (from DB) */}
                <div className="relative">
                  <select
                    value={formData.businessTypeId}
                    onChange={(e) => setFormData({ ...formData, businessTypeId: e.target.value })}
                    className="px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none disabled:opacity-60"
                    disabled={metaLoading || loading || logoUploading}
                  >
                    <option value="">{metaLoading ? 'Loading business types…' : 'Business Type (Optional)'}</option>
                    {businessTypes.map((t) => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                  {metaLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </span>
                  )}
                </div>
              </div>

              <FloatingLabelInput
                id="brand-referral"
                label="Referral Code (Optional)"
                type="text"
                autoComplete="one-time-code"
                value={formData.referralCode}
                onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
              />

              <div className="grid sm:grid-cols-2 gap-4">
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
                    onClick={() => setPasswordVisible(v => !v)}
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
                    onClick={() => setConfirmPasswordVisible(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={confirmPasswordVisible ? 'Hide password' : 'Show password'}
                  >
                    {confirmPasswordVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Verification + Terms */}
              <div className="grid gap-3">
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
                    <a href="#" className="font-semibold text-orange-600 hover:text-orange-700">Terms of Service</a>
                    {' '}and{' '}
                    <a href="#" className="font-semibold text-orange-600 hover:text-orange-700">Privacy Policy</a>.
                  </span>
                </label>
              </div>

              <Button
                onClick={completeSignup}
                loading={loading || logoUploading}
                variant="brand"
                disabled={metaLoading}
              >
                {metaLoading ? 'Loading options…' : 'Create Brand Account'}
              </Button>
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
      `}</style>
    </div>
  );
}
