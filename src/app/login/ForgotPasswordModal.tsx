import { useState } from 'react';
import { X, Mail, Lock, CheckCircle2 } from 'lucide-react';
import { FloatingLabelInput } from '@/components/common/FloatingLabelInput';
import { Button } from './Button';
import type { Role } from './types';
import { post } from '@/lib/api';

interface ForgotPasswordModalProps {
  role: Role; // 'brand' | 'influencer'
  onClose: () => void;
}

type Step = 'email' | 'otp' | 'reset';

const API = {
  brand: {
    sendOtp: '/brand/resetotp',
    verifyOtp: '/brand/resetVerify',
    resetPassword: '/brand/updatePassword',
  },
  influencer: {
    // ✅ IMPORTANT: use reset endpoints (not signup /sendOtp)
    sendOtp: '/influencer/resetotp',
    verifyOtp: '/influencer/resetVerify',
    resetPassword: '/influencer/updatePassword',
  },
} as const;

const emailLooksValid = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function ForgotPasswordModal({ role, onClose }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });

  const normalizedEmail = formData.email.trim().toLowerCase();

  const goToEmailStep = () => {
    setStep('email');
    setError('');
    setResetToken(null);
    setFormData((p) => ({ ...p, otp: '', newPassword: '', confirmPassword: '' }));
  };

  const sendOTP = async () => {
    if (!normalizedEmail) {
      setError('Please enter your email');
      return;
    }
    if (!emailLooksValid(normalizedEmail)) {
      setError('Please enter a valid email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const endpoint = API[role].sendOtp;
      await post(endpoint, { email: normalizedEmail });
      setStep('otp');
    } catch (err: any) {
      // ✅ if backend returns 404 "Influencer/Brand does not exist..."
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
    if (formData.otp.length !== 6) {
      setError('OTP must be 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const endpoint = API[role].verifyOtp;
      const res = await post(endpoint, { email: normalizedEmail, otp: formData.otp });

      const token =
        res?.resetToken ??
        res?.data?.resetToken ??
        (typeof res === 'object' && 'resetToken' in res ? (res as any).resetToken : null);

      if (!token) throw new Error('Verification succeeded but no resetToken returned.');
      setResetToken(token);
      setStep('reset');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!formData.newPassword || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!resetToken) {
      setError('Verification expired. Please verify OTP again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const endpoint = API[role].resetPassword;
      await post(endpoint, {
        resetToken,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 space-y-6 animate-slideUp">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-gray-900">Reset Password</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 'email' && (
          <div className="space-y-5">
            <div className="text-center">
              <div
                className={`w-16 h-16 rounded-2xl mx-auto ${
                  role === 'brand'
                    ? 'bg-gradient-to-br from-orange-400 to-pink-500'
                    : 'bg-gradient-to-br from-yellow-400 to-amber-500'
                } flex items-center justify-center shadow-lg mb-4`}
              >
                <Mail className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-600">Enter your email and we'll send you a verification code</p>
            </div>

            <FloatingLabelInput
              id="forgot-email"
              label="Email address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Button onClick={sendOTP} loading={loading} variant={role}>
              Send Verification Code
            </Button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-5">
            <div
              className={`text-center p-4 rounded-lg border ${
                role === 'brand' ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <CheckCircle2
                className={`w-8 h-8 mx-auto mb-2 ${
                  role === 'brand' ? 'text-orange-600' : 'text-yellow-600'
                }`}
              />
              <p className="text-sm text-gray-700">
                We sent a code to <strong>{normalizedEmail}</strong>
              </p>
              <p className="text-xs text-gray-500 mt-1">If you don't see it, check spam or resend</p>
            </div>

            <FloatingLabelInput
              id="forgot-otp"
              label="Enter 6-Digit Code"
              type="text"
              maxLength={6}
              value={formData.otp}
              onChange={(e) =>
                setFormData({ ...formData, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })
              }
              required
            />

            <Button onClick={verifyOTP} loading={loading} variant={role}>
              Verify Code
            </Button>

            <div className="flex justify-between text-sm">
              <button onClick={goToEmailStep} className="text-gray-600 hover:text-gray-900">
                Change email
              </button>
              <button
                onClick={sendOTP}
                className={`font-medium ${
                  role === 'brand'
                    ? 'text-orange-600 hover:text-orange-700'
                    : 'text-yellow-600 hover:text-yellow-700'
                }`}
              >
                Resend code
              </button>
            </div>
          </div>
        )}

        {step === 'reset' && (
          <div className="space-y-5">
            <div className="text-center">
              <div
                className={`w-16 h-16 rounded-2xl mx-auto ${
                  role === 'brand'
                    ? 'bg-gradient-to-br from-orange-400 to-pink-500'
                    : 'bg-gradient-to-br from-yellow-400 to-amber-500'
                } flex items-center justify-center shadow-lg mb-4`}
              >
                <Lock className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-600">Create a new password for your account</p>
            </div>

            <FloatingLabelInput
              id="new-password"
              label="New Password"
              type="password"
              placeholder="≥8 chars, 1 number, 1 letter"
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              required
            />

            <FloatingLabelInput
              id="confirm-new-password"
              label="Confirm New Password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
            />

            <Button onClick={resetPassword} loading={loading} variant={role}>
              Reset Password
            </Button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
}
