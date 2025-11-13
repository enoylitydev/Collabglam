'use client';

import { useState } from 'react';
import { FloatingLabelInput } from '@/components/common/FloatingLabelInput';
import { Button } from './Button';
import type { Role } from './types';
import { post } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface LoginFormProps {
  role: Role;
  onForgotPassword: () => void;
  onSuccess: () => void;
}

type BrandLoginResponse = {
  token: string;
  brandId: string;
  subscriptionPlanName?: string;
  subscription?: {
    planId?: string;
    planName?: string;
    role?: string;
    status?: string;
    expiresAt?: string;
  };
};

type InfluencerLoginResponse = {
  token: string;
  influencerId: string;
  categoryId: string;
  subscriptionPlanName?: string;
  subscription?: {
    planId?: string;
    planName?: string;
    startedAt?: string;
    expiresAt?: string;
  };
};

export function LoginForm({ role, onForgotPassword, onSuccess }: LoginFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (role === 'brand') {
        const data = await post<BrandLoginResponse>('/brand/login', {
          email: formData.email,
          password: formData.password,
        });

        console.log('Brand login response:', data);

        // Use role-scoped token storage
        localStorage.setItem('token', data.token);
        localStorage.setItem('brandId', data.brandId);
        localStorage.setItem('userType', 'brand');
        localStorage.setItem('userEmail', formData.email);

        // 🔹 Brand plan info
        const brandPlanName =
          data.subscriptionPlanName ??
          data.subscription?.planName ??
          'free';

        const brandPlanId = data.subscription?.planId ?? '';

        console.log('Saving BRAND subscription:', { brandPlanName, brandPlanId });

        localStorage.setItem('brandPlanName', brandPlanName);
        if (brandPlanId) {
          localStorage.setItem('brandPlanId', brandPlanId);
        }

        onSuccess();
        router.replace('/brand/dashboard');
      } else {
        const data = await post<InfluencerLoginResponse>('/influencer/login', {
          email: formData.email,
          password: formData.password,
        });

        console.log('Influencer login response:', data);

        // Use role-scoped token storage
        localStorage.setItem('token', data.token);
        localStorage.setItem('influencerId', data.influencerId);
        localStorage.setItem('categoryId', data.categoryId);
        localStorage.setItem('userType', 'influencer');
        localStorage.setItem('userEmail', formData.email);

        // 🔹 Influencer plan info
        const influencerPlanName =
          data.subscriptionPlanName ??
          data.subscription?.planName ??
          'free';

        const influencerPlanId = data.subscription?.planId ?? '';

        console.log('Saving INFLUENCER subscription:', {
          influencerPlanName,
          influencerPlanId,
        });

        localStorage.setItem('influencerPlanName', influencerPlanName);
        if (influencerPlanId) {
          localStorage.setItem('influencerPlanId', influencerPlanId);
        }

        onSuccess();
        router.replace('/influencer/dashboard');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.response?.data?.message || err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center">
            <img src="./logo.png" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>
        <p className="text-gray-600">
          Sign in to your {role === 'brand' ? 'brand' : 'influencer'} account
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <FloatingLabelInput
        id="login-email"
        label="Email address"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />

      <FloatingLabelInput
        id="login-password"
        label="Password"
        type={showPassword ? 'text' : 'password'}
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        required
      />

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center space-x-2 cursor-pointer group select-none">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
            className={`rounded border-gray-300 ${
              role === 'brand'
                ? 'text-orange-600 focus:ring-orange-500'
                : 'text-yellow-600 focus:ring-yellow-500'
            }`}
          />
          <span className="text-gray-600 group-hover:text-gray-900">
            Show password
          </span>
        </label>

        <button
          type="button"
          onClick={onForgotPassword}
          className={`font-semibold ${
            role === 'brand'
              ? 'text-orange-600 hover:text-orange-700'
              : 'text-yellow-600 hover:text-yellow-700'
          }`}
        >
          Forgot password?
        </button>
      </div>

      <Button type="submit" loading={loading} variant={role}>
        Sign In
      </Button>
    </form>
  );
}
