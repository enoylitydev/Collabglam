import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from "next/link";

const Header: React.FC = () => {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Features', href: '#features' },
    { label: 'Success Stories', href: '#success-stories' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'About Us', href: '/about-us' },
    { label: 'Contact Us', href: '/contact-us' },
  ];

  const navigate = (path: string) => {
    setIsMobileMenuOpen(false);
    router.push(path);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 font-lexend ${isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
        }`}
    >
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">

          <Link href="/" className="flex items-center space-x-2">
            <img
              src="./logo.png"
              alt="Collabglam Logo"
              width={50}
              height={50}
              className="rounded-lg"
            />
            <span className="ml-3 text-2xl font-bold">CollabGlam</span>
          </Link>

          {/* Logo */}
          {/* <div className="flex items-center space-x-2">
            <img
              src="./logo.png"
              alt="Collabglam Logo"
              width={50}
              height={50}
              className="rounded-lg"
            />
            <span className="text-xl font-bold text-gray-900">CollabGlam</span>
          </div> */}

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                className="
    font-medium text-gray-700
    transition-colors duration-200
    hover:text-transparent
    hover:bg-gradient-to-r
    hover:from-[#FFA135]
    hover:to-[#FF7236]
    hover:bg-clip-text
  "
              >
                {link.label}
              </a>

            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center space-x-4">
            <button
              onClick={() => navigate('/login')}
              className="
    px-6 py-2
    bg-gradient-to-r from-[#FFA135] to-[#FF7236]
    text-white font-medium rounded-lg
    transition-all transform
    hover:bg-gradient-to-r
    hover:from-[#FFA236] hover:to-[#FF7456]
    hover:shadow-lg
    hover:scale-105
    cursor-pointer
  "
            >
              <strong>Get Started</strong>
            </button>


          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(open => !open)}
            className="lg:hidden p-2 text-gray-700"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t shadow-lg">
          <div className="px-4 py-6 space-y-4">
            {navLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                className="block py-2 font-medium hover:text-transparent
    hover:bg-gradient-to-r
    hover:from-[#FFA135]
    hover:to-[#FF7236]
    hover:bg-clip-text transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white font-medium rounded-lg hover:bg-[#c21f4f] transition"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;