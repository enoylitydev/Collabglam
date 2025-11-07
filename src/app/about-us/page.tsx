'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Play, Users, TrendingUp, ArrowRight } from 'lucide-react';
import Footer from '@/components/common/Footer';

export default function AboutPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // ---- Gradient helpers (yours) ----
  const GRADIENT_SOLID =
    'bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white';
  const GRADIENT_HOVER =
    'text-gray-800 hover:bg-gradient-to-r hover:from-[#FFA135] hover:to-[#FF7236] hover:text-white';
  const btnClasses = (primary = false) => (primary ? GRADIENT_SOLID : GRADIENT_HOVER);

  // Always-on gradient + hover polish for the About box (NO ring/outline)
  const ABOUT_BOX =
    'bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white ' +
    'inline-block rounded-2xl px-8 py-5 shadow ' +
    'transition-all duration-300 transform ' +
    'hover:shadow-2xl hover:scale-[1.03] hover:saturate-125 ' +
    'outline-none focus:ring-0 focus-visible:ring-0';

  useEffect(() => {
    // Consider any role token as logged-in
    const token =
      localStorage.getItem('brand_token') ||
      localStorage.getItem('influencer_token') ||
      localStorage.getItem('admin_token') ||
      localStorage.getItem('token'); // legacy fallback
    const clientId = localStorage.getItem('clientId');
    setIsLoggedIn(!!token && !!clientId);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      {/* Site Header */}
      <Header />

      {/* Spacer (only needed if Header is sticky/fixed) */}
      <div className="h-16 md:h-20" aria-hidden />

      {/* Top header row — centered on the line; gradient always visible + hover; no red line */}
      <header className="px-4 pt-8 pb-6 bg-white border-b border-gray-100">
        <div className="container mx-auto text-center">
          <div className={ABOUT_BOX}>
            <h1 className="text-4xl font-extrabold leading-tight">About CollabGlam</h1>
            <p className="mt-1 text-base/6 opacity-95">
              Easiest way to connect brand and influencer
            </p>
          </div>
        </div>
      </header>

      {/* Mission & Vision */}
      <section className="flex-grow container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-semibold text-gray-900 mb-4">
              Our Mission
            </h2>
            <p className="text-gray-600 leading-relaxed">
              To connect brand and influencer seamlessly—helping influencers find the perfect brands and
              brands find the perfect influencers for reviews, unboxing, and promotions. Our goal is to help both grow.
            </p>
          </div>
          <div>
            <h2 className="text-3xl font-semibold text-gray-900 mb-4">
              Our Vision
            </h2>
            <p className="text-gray-600 leading-relaxed">
              A platform where every brand finds its perfect influencer, and every influencer has the tools
              to turn passion into purpose.
            </p>
          </div>
        </div>

        {/* Values */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">Our Core Values</h3>
          <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { Icon: Play, title: 'Creativity', desc: 'Bold ideas and innovative campaigns that spark real impact.' },
              { Icon: Users, title: 'Collaboration', desc: 'Working hand-in-hand with influencers and brands for shared success.' },
              { Icon: TrendingUp, title: 'Excellence', desc: 'Setting industry standards through top-tier service and insights.' },
            ].map(({ Icon, title, desc }) => (
              <Card
                key={title}
                className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 rounded-lg bg-white shadow-lg p-6 space-y-4 cursor-pointer"
              >
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                    <Icon className="h-8 w-8 text-[#FF7236]" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Link href={isLoggedIn ? '/dashboard' : '/login'}>
            <Button
              className={`px-8 py-4 text-lg rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black ${btnClasses(true)}`}
            >
              Get Started Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
