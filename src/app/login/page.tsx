/* ===========================
   Login.tsx
   =========================== */
'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { BrandSignup } from './BrandSignup';
import InfluencerSignup from './InfluencerSignup';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import type { Role, Tab } from './types';

export default function Login() {
  const router = useRouter();
  const params = useSearchParams();

  const next = params.get('next') || '';
  const roleParam = (params.get('role') || '').toLowerCase();

  // ✅ infer role from "next" first (strongest signal)
  const forcedRole = useMemo<Role | null>(() => {
    if (next.startsWith('/brand/')) return 'brand';
    if (next.startsWith('/influencer/')) return 'influencer';
    return null;
  }, [next]);

  const initialRole = useMemo<Role>(() => {
    if (forcedRole) return forcedRole;
    if (roleParam === 'influencer') return 'influencer';
    return 'brand';
  }, [forcedRole, roleParam]);

  // ✅ default tab always login
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [role, setRole] = useState<Role>(initialRole);

  const [mounted, setMounted] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [signupStep, setSignupStep] = useState<number>(1);

  const [isPending, startTransition] = useTransition();
  const [panelKey, setPanelKey] = useState(0);

  useEffect(() => setMounted(true), []);
  useEffect(() => setPanelKey((k) => k + 1), [activeTab, role]);

  // ✅ if opened with query, enforce role + login tab
  useEffect(() => {
    startTransition(() => {
      setRole(initialRole);
      setActiveTab('login');
      setSignupStep(1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRole]);

  const roleLocked = Boolean(forcedRole); // if next forces role, don’t allow switching

  const showHero = activeTab === 'login';
  const gradientClasses =
    role === 'brand'
      ? 'from-orange-50 via-orange-100/50 to-white'
      : 'from-amber-50 via-yellow-100/50 to-white';

  const heroQuote = role === 'brand' ? '“Every brand starts somewhere”' : '“Every creator starts somewhere”';
  const isDeepSignupStep = activeTab === 'signup' && signupStep > 1;

  const [toast, setToast] = useState<null | { title: string; message: string; role: Role }>(null);

  const showToast = (title: string, message: string, toastRole: Role) => {
    setToast({ title, message, role: toastRole });
    setTimeout(() => setToast(null), 3000);
  };

  const switchTab = (tab: Tab) => {
    startTransition(() => {
      setActiveTab(tab);
      setSignupStep(1);
    });
  };

  const handleHeaderRoleSwitch = () => {
    if (roleLocked) return; // ✅ do not allow if checkout forced role
    startTransition(() => {
      setRole((r) => (r === 'brand' ? 'influencer' : 'brand'));
      setActiveTab('login');
      setSignupStep(1);
    });
  };

  const handleSignupSuccess = () => {
    showToast('Account created successfully!', 'You can now sign in to your account', role);
    setTimeout(() => {
      startTransition(() => {
        setActiveTab('login');
        setSignupStep(1);
      });
    }, 1500);
  };

  // ✅ IMPORTANT: after login, go to next if present
  const handleLoginSuccess = () => {
    if (next) {
      router.replace(next);
      return;
    }
    router.replace(role === 'brand' ? '/brand/dashboard' : '/influencer/dashboard');
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${gradientClasses} transition-all duration-500`}>
      {/* Header */}
      <header className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-md shadow-sm py-4 px-4 sm:px-6 z-40 border-b border-gray-200">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center">
              <img src="./logo.png" alt="CollabGlam" className="h-10 w-10" />
            </div>
            <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              CollabGlam
            </span>
          </div>

          {/* Role switch hidden during deep signup OR role locked by next */}
          {!isDeepSignupStep && !roleLocked && (
            <button
              type="button"
              onClick={handleHeaderRoleSwitch}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 cursor-pointer active:scale-[0.98]"
              disabled={isPending}
            >
              {role === 'brand' ? 'Join as Creator' : 'Join as Brand'}
            </button>
          )}
        </div>
      </header>

      {toast && (
        <div className="fixed top-24 inset-x-0 z-50 flex justify-center px-4 animate-slideDown">
          <div
            className={`max-w-md w-full p-4 rounded-xl shadow-2xl border-2 ${
              toast.role === 'brand' ? 'bg-orange-50 border-orange-500' : 'bg-yellow-50 border-yellow-500'
            }`}
          >
            <div className="flex items-center space-x-3">
              <CheckCircle2
                className={`w-6 h-6 flex-shrink-0 ${toast.role === 'brand' ? 'text-orange-600' : 'text-yellow-600'}`}
              />
              <div>
                <p className="font-semibold text-gray-900">{toast.title}</p>
                <p className="text-sm text-gray-600">{toast.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="pt-24 px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-20rem)] flex">
        <div className="max-w-6xl mx-auto w-full flex">
          <div
            className={`w-full flex transform transition-all duration-700 delay-200 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
            }`}
          >
            {/* Card */}
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden w-full flex-1 min-h-full">
              <div className={`grid h-full ${showHero ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
                {/* HERO ONLY ON LOGIN */}
                {showHero && (
                  <>
                    {/* Mobile Hero */}
                    <div className="relative lg:hidden">
                      <img
                        src="/brand.jpeg"
                        alt="Brand Hero"
                        className={`absolute inset-0 h-56 w-full object-cover transition-opacity duration-500 ${
                          role === 'brand' ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <img
                        src="/inf.jpeg"
                        alt="Influencer Hero"
                        className={`absolute inset-0 h-56 w-full object-cover transition-opacity duration-500 ${
                          role === 'influencer' ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <div className="relative h-56">
                        <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-black/10 to-transparent" />
                        <p className="absolute bottom-5 left-5 right-5 text-white text-lg font-semibold">
                          {heroQuote}
                        </p>
                      </div>
                    </div>

                    {/* Desktop Hero */}
                    <div className="relative hidden lg:block h-full min-h-[calc(100vh-6rem)]">
                      <img
                        src="/brand.jpeg"
                        alt="Brand Hero"
                        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                          role === 'brand' ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <img
                        src="/inf.jpeg"
                        alt="Influencer Hero"
                        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                          role === 'influencer' ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-tr from-black/45 via-black/10 to-transparent" />
                      <div className="absolute bottom-10 left-10 right-10">
                        <p className="text-white text-2xl font-semibold leading-snug">{heroQuote}</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Form panel */}
                <div className="p-6 sm:p-10 lg:p-12 h-full flex flex-col justify-center">
                  {/* Tabs */}
                  <div className="w-full max-w-md mx-auto mb-6">
                    <div className="rounded-full bg-gray-100 p-1 overflow-hidden">
                      <div className="relative flex h-11 w-full items-center">
                        <div
                          className={[
                            'pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-full will-change-transform',
                            'transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]',
                            role === 'brand'
                              ? 'bg-gradient-to-r from-orange-500 to-pink-500 shadow-md'
                              : 'bg-gradient-to-r from-yellow-400 to-amber-500 shadow-md',
                            activeTab === 'signup' ? 'translate-x-full' : 'translate-x-0',
                          ].join(' ')}
                        />

                        {(['login', 'signup'] as const).map((tab) => {
                          const isActive = activeTab === tab;
                          return (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => switchTab(tab)}
                              disabled={isPending}
                              className={[
                                'relative z-10 flex-1 h-full rounded-full select-none',
                                'text-sm font-semibold',
                                'transition-colors duration-200',
                                'active:scale-[0.98] transition-transform',
                                isActive
                                  ? role === 'brand'
                                    ? 'text-white'
                                    : 'text-gray-900'
                                  : 'text-gray-600 hover:text-gray-900',
                              ].join(' ')}
                            >
                              {tab === 'login' ? 'Login' : 'Sign Up'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div key={panelKey} className="animate-fadeUp">
                    <div className="max-h-full">
                      {activeTab === 'login' ? (
                        <LoginForm
                          role={role}
                          onForgotPassword={() => setShowForgotPassword(true)}
                          onSuccess={handleLoginSuccess} // ✅ redirect to next/dashboard
                        />
                      ) : role === 'brand' ? (
                        <BrandSignup onSuccess={handleSignupSuccess} onStepChange={(n) => setSignupStep(n)} />
                      ) : (
                        <InfluencerSignup onSuccess={handleSignupSuccess} onStepChange={(n) => setSignupStep(n)} />
                      )}
                    </div>
                  </div>

                  <p className="mt-6 text-center text-sm text-gray-500">
                    By continuing, you agree to our{' '}
                    <a
                      href="/terms"
                      target="_blank"
                      className={`font-semibold ${
                        role === 'brand' ? 'text-orange-600 hover:text-orange-700' : 'text-yellow-600 hover:text-yellow-700'
                      }`}
                    >
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      className={`font-semibold ${
                        role === 'brand' ? 'text-orange-600 hover:text-orange-700' : 'text-yellow-600 hover:text-yellow-700'
                      }`}
                    >
                      Privacy Policy
                    </a>
                  </p>
                </div>
              </div>
            </div>
            {/* /card */}
          </div>
        </div>
      </main>

      {showForgotPassword && (
        <ForgotPasswordModal
          role={role}
          onClose={() => setShowForgotPassword(false)}
          onSuccess={() => {
            showToast('Password reset successful!', 'You can now log in with your new password', role);
            startTransition(() => setActiveTab('login'));
          }}
        />
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeUp { animation: fadeUp 0.25s ease-out; }
      `}</style>
    </div>
  );
}
