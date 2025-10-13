import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Building2 } from 'lucide-react';
import { FloatingLabelInput } from '@/components/common/FloatingLabelInput';
import { Button } from './Button';
import { ProgressIndicator } from './ProgressIndicator';
import type { Country } from './types';
import { get, post } from '@/lib/api';

type Step = 'email' | 'otp' | 'details';

const categories = [
  'Beauty', 'Fashion', 'Tech', 'Food & Beverage', 'Fitness & Wellness',
  'Travel & Hospitality', 'Education', 'Finance', 'Gaming', 'Lifestyle'
];
const companySizes = ['1-10', '11-50', '51-200', '201-500', '500+'];
const businessTypes = ['Direct-to-Consumer', 'Agency', 'Marketplace', 'SaaS', 'E-commerce', 'Other'];

export function BrandSignup({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<Step>('email');
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    name: '',
    password: '',
    confirmPassword: '',
    phone: '',
    countryId: '',
    callingCodeId: '',
    category: '',
    website: '',
    instagramHandle: '',
    companySize: '',
    businessType: '',
    referralCode: '',
    agreedToTerms: false
  });

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

  const sendOTP = async () => {
    if (!formData.email) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // same as old AuthPage.tsx
      await post('/brand/requestOtp', { email: formData.email });
      setStep('otp');
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
      await post('/brand/verifyOtp', { email: formData.email, otp: formData.otp });
      setStep('details');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const completeSignup = async () => {
    if (!formData.name || !formData.password || !formData.phone ||
        !formData.countryId || !formData.callingCodeId || !formData.category) {
      setError('Please fill in all required fields');
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

    setLoading(true);
    setError('');
    try {
      // payload matches old AuthPage.tsx
      await post('/brand/register', {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        password: formData.password,
        countryId: formData.countryId,
        callingId: formData.callingCodeId,
        // optional extras (backend can ignore if not used)
        category: formData.category,
        website: formData.website || undefined,
        instagramHandle: formData.instagramHandle || undefined,
        companySize: formData.companySize || undefined,
        businessType: formData.businessType || undefined,
        referralCode: formData.referralCode || undefined
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const steps = useMemo(() => ([
    { number: 1, label: 'Email',   completed: step !== 'email',     active: step === 'email' },
    { number: 2, label: 'Verify',  completed: step === 'details',   active: step === 'otp' },
    { number: 3, label: 'Details', completed: false,                active: step === 'details' }
  ]), [step]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center ">
            <img src='./logo.png' />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-gray-900">Brand Signup</h2>
        <p className="text-gray-600">Join CollabGlam and connect with creators</p>
      </div>

      <ProgressIndicator steps={steps} variant="brand" />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {step === 'email' && (
        <div className="space-y-5 animate-fadeIn">
          <FloatingLabelInput
            id="brand-email"
            label="Work Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <p className="text-sm text-gray-500">
            We'll send a verification code to this email
          </p>
          <Button onClick={sendOTP} loading={loading} variant="brand">
            Send Verification Code
          </Button>
        </div>
      )}

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

      {step === 'details' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="grid sm:grid-cols-2 gap-4">
            <FloatingLabelInput
              id="brand-name"
              label="Brand Name"
              type="text"
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
              className="px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none"
              required
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
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <select
            value={formData.countryId}
            onChange={(e) => setFormData({ ...formData, countryId: e.target.value })}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none"
            required
          >
            <option value="">Select Country</option>
            {countries.map((c) => (
              <option key={c._id} value={c._id}>
                {c.flag} {c.countryName}
              </option>
            ))}
          </select>

          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none"
            required
          >
            <option value="">Brand Category / Industry</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <div className="grid sm:grid-cols-2 gap-4">
            <FloatingLabelInput
              id="brand-website"
              label="Website (Optional)"
              type="url"
              placeholder="https://example.com"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />

            <FloatingLabelInput
              id="brand-instagram"
              label="Instagram Handle (Optional)"
              type="text"
              placeholder="@brandname"
              value={formData.instagramHandle}
              onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <select
              value={formData.companySize}
              onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
              className="px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none"
            >
              <option value="">Company Size (Optional)</option>
              {companySizes.map((size) => (
                <option key={size} value={size}>{size} employees</option>
              ))}
            </select>

            <select
              value={formData.businessType}
              onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
              className="px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none"
            >
              <option value="">Business Type (Optional)</option>
              {businessTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <FloatingLabelInput
            id="brand-referral"
            label="Referral Code (Optional)"
            type="text"
            value={formData.referralCode}
            onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <FloatingLabelInput
              id="brand-password"
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />

            <FloatingLabelInput
              id="brand-confirm-password"
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
            />
          </div>

          <label className="flex items-start space-x-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={formData.agreedToTerms}
              onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
              className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              required
            />
            <span className="text-sm text-gray-600 group-hover:text-gray-900">
              I confirm that I'm an official representative of this brand and agree to the{' '}
              <a href="#" className="font-semibold text-orange-600 hover:text-orange-700">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="font-semibold text-orange-600 hover:text-orange-700">Privacy Policy</a>
            </span>
          </label>

          <Button onClick={completeSignup} loading={loading} variant="brand">
            Create Brand Account
          </Button>
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
