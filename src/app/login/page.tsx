"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, TrendingUp, Users, CheckCircle2, Award } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { BrandSignup } from './BrandSignup';
import InfluencerSignup from './InfluencerSignup';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import type { Role } from './types';
import type { Tab } from './types';

function Login() {
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [role, setRole] = useState<Role>('brand');
  const [mounted, setMounted] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [signupStep, setSignupStep] = useState<number>(1);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignupSuccess = () => {
    setShowSuccessMessage(true);
    setTimeout(() => {
      setShowSuccessMessage(false);
      setActiveTab('login');
    }, 3000);
  };

  const handleLoginSuccess = () => {
    console.log('Login successful! Redirecting to dashboard...');
  };


  const gradientClasses = role === 'brand'
    ? 'from-orange-50 via-orange-100/50 to-white'
    : 'from-amber-50 via-yellow-100/50 to-white';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${gradientClasses} transition-all duration-500`}>
      <header className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-md shadow-sm py-4 px-6 z-40 border-b border-gray-200">
        <div className="flex items-center max-w-7xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500`}>
             <img src='./logo.png' />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              CollabGlam
            </span>
          </div>
        </div>
      </header>

      {showSuccessMessage && (
        <div className="fixed top-24 inset-x-0 z-50 flex justify-center px-4 animate-slideDown">
          <div className={`max-w-md w-full p-4 rounded-xl shadow-2xl border-2 ${
            role === 'brand'
              ? 'bg-orange-50 border-orange-500'
              : 'bg-yellow-50 border-yellow-500'
          }`}>
            <div className="flex items-center space-x-3">
              <CheckCircle2 className={`w-6 h-6 flex-shrink-0 ${
                role === 'brand' ? 'text-orange-600' : 'text-yellow-600'
              }`} />
              <div>
                <p className="font-semibold text-gray-900">Account created successfully!</p>
                <p className="text-sm text-gray-600">You can now sign in to your account</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
            <div className={`transform transition-all duration-700 delay-200 ${
              mounted ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'
            }`}>
              <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-6 border border-gray-100">
                <div className="flex justify-center space-x-2 p-1 bg-gray-100 rounded-full">
                  {(['login', 'signup'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2.5 px-6 rounded-full font-semibold text-sm transition-all duration-300 ${
                        activeTab === tab
                          ? role === 'brand'
                            ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg'
                            : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 shadow-lg'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {tab === 'login' ? 'Login' : 'Sign Up'}
                    </button>
                  ))}
                </div>

                <div className="min-h-[400px]">
                  {activeTab === 'login' ? (
                    <LoginForm
                      role={role}
                      onForgotPassword={() => setShowForgotPassword(true)}
                      onSuccess={handleLoginSuccess}
                    />
                  ) : role === 'brand' ? (
                    <BrandSignup onSuccess={handleSignupSuccess} onStepChange={(n) => setSignupStep(n)} />
                  ) : (
                    <InfluencerSignup onSuccess={handleSignupSuccess} onStepChange={(n) => setSignupStep(n)} />
                  )}
                </div>

                {!(activeTab === 'signup' && signupStep > 1) && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-gray-500">or</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setRole(role === 'brand' ? 'influencer' : 'brand')}
                      className="w-full flex items-center justify-center space-x-2 py-3 px-4 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200 group"
                    >
                      <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                      <span className="text-gray-700 font-medium">
                        Continue as {role === 'brand' ? 'Influencer' : 'Brand'}
                      </span>
                    </button>
                  </>
                )}
              </div>

              <p className="text-center text-sm text-gray-500 mt-6">
                By continuing, you agree to our{' '}
                <a href="#" className={`font-semibold ${
                  role === 'brand' ? 'text-orange-600 hover:text-orange-700' : 'text-yellow-600 hover:text-yellow-700'
                }`}>
                  Terms of Service
                </a>
                {' '}and{' '}
                <a href="#" className={`font-semibold ${
                  role === 'brand' ? 'text-orange-600 hover:text-orange-700' : 'text-yellow-600 hover:text-yellow-700'
                }`}>
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </div>

      {showForgotPassword && (
        <ForgotPasswordModal
          role={role}
          onClose={() => setShowForgotPassword(false)}
        />
      )}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default Login;
