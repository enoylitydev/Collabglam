import React from 'react';
import { ArrowRight, CheckCircle, DollarSign, Globe, Link, PlayCircle, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

const Hero = () => {
  const router = useRouter();

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-50 font-lexend">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0">
        {/* Purple blob */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full opacity-20 blur-3xl"></div>
        {/* Pink blob */}
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-gradient-to-br from-pink-400 to-[#ef2f5b] opacity-15 rounded-full blur-2xl"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Grow Your Brand,
              <br />
              <span className="text-gray-900">
                Elevate Your Influence:
              </span>
              <br />
              <span className="text-gray-900">
                CollabGlam is the Brand & Influencer Collaboration
              </span>
              <br />
              <span className="text-gray-900">
                Platform
              </span>
              <br />
            </h1>

            <div
              className="
        group
        inline-flex
        items-center
        p-6 mb-4
        rounded-2xl
        shadow-md
        transform transition-all
        bg-gradient-to-r from-[#FF8C00] via-[#FF5E7E] to-[#D12E53]
        hover:scale-105 hover:shadow-lg
        cursor-pointer
      "
              onClick={() => router.push('/login')}
            >
              <PlayCircle className="h-8 w-8 text-white mr-4 group-hover:animate-pulse" />
              <div className="flex flex-col">
                <p className="text-white font-bold text-lg">
                  We want to promote our Tech Gadget in the US
                </p>
                <p className="text-white/90 text-sm">
                  Need YouTube influencers with 10k–100k subscribers
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-white ml-4 transform transition-transform group-hover:translate-x-1" />
            </div>

            <p className="text-lg text-gray-600 mb-8 max-w-xl leading-relaxed">
              Turn every campaign into tangible revenue with CollabGlam’s smart brand-influencer collaboration dashboard. Join thousands of brands and creators maximizing earnings through targeted partnerships.
            </p>

            <button
              className="
    group inline-flex items-center px-8 py-4
    bg-gradient-to-r from-[#FFA135] to-[#FF7236]
    text-white font-semibold rounded-lg text-lg
    transition-all duration-200 transform
    hover:bg-gradient-to-r hover:from-[#FF8C1A] hover:to-[#FF5C1E]
    hover:shadow-lg hover:scale-105
    cursor-pointer
  "
              onClick={() => router.push('/login')}
            >
              Sign Up
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>

          </div>

          {/* Right Content - Device Mockups */}
          <div className="relative">
            {/* Desktop Monitor */}
            <div className="relative z-20">
              <div className="bg-gray-800 rounded-t-2xl p-2 shadow-2xl">
                <div className="bg-gray-900 rounded-t-xl p-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  {/* Video Container */}
                  <div className="relative bg-gray-700 rounded-lg overflow-hidden aspect-video">
                    <video
                      src="/ai-hero-clip.mp4"
                      className="absolute inset-0 w-full h-full object-cover"
                      autoPlay
                      muted
                      loop
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-300 h-8 w-full rounded-b-2xl"></div>
              <div className="bg-gray-400 h-16 w-32 mx-auto rounded-b-lg"></div>
            </div>

            {/* Laptop */}
            <div className="absolute -bottom-8 -left-8 z-10">
              <div className="bg-gray-800 rounded-t-xl p-2 shadow-xl transform rotate-12">
                <div className="bg-gray-900 rounded-t-lg p-3">
                  <div className="bg-gray-700 rounded-md p-3 h-32 w-48">
                    <div className="grid grid-cols-3 gap-2 h-full">
                      <div className="bg-[#ef2f5b] rounded opacity-80"></div>
                      <div className="bg-purple-500 rounded opacity-80"></div>
                      <div className="bg-blue-500 rounded opacity-80"></div>
                      <div className="bg-green-500 rounded opacity-80"></div>
                      <div className="bg-yellow-500 rounded opacity-80"></div>
                      <div className="bg-pink-500 rounded opacity-80"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-300 h-4 w-full rounded-b-xl transform rotate-12"></div>
            </div>
          </div>

        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pt-16 mt-16 mb-16 border-t border-gray-200">

          {/* Active Creators */}
          <div className="bg-white p-6 rounded-2xl shadow-md text-center transform transition-all hover:scale-105">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] rounded-full mb-4 mx-auto">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="text-4xl lg:text-5xl font-bold text-gray-900 mb-2">
              TOP
            </div>
            <div className="text-gray-600 font-medium">Active Creators</div>
          </div>

          {/* Revenue Generated */}
          <div className="bg-white p-6 rounded-2xl shadow-md text-center transform transition-all hover:scale-105">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] rounded-full mb-4 mx-auto">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div className="text-4xl lg:text-5xl font-bold text-gray-900 mb-2">
              BIG
            </div>
            <div className="text-gray-600 font-medium">Revenue Generated</div>
          </div>

          {/* Countries */}
          <div className="bg-white p-6 rounded-2xl shadow-md text-center transform transition-all hover:scale-105">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] rounded-full mb-4 mx-auto">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div className="text-4xl lg:text-5xl font-bold text-gray-900 mb-2">
              160+
            </div>
            <div className="text-gray-600 font-medium">Countries</div>
          </div>

          {/* Deal Closed */}
          <div className="bg-white p-6 rounded-2xl shadow-md text-center transform transition-all hover:scale-105">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] rounded-full mb-4 mx-auto">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="text-4xl lg:text-5xl font-bold text-gray-900 mb-2">
              99.9%
            </div>
            <div className="text-gray-600 font-medium">Deal Closed</div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;