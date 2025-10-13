import { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'brand' | 'influencer' | 'outline';
  loading?: boolean;
}

export function Button({
  children,
  variant = 'brand',
  loading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses = `
    relative w-full py-3 px-6 rounded-lg font-semibold text-base
    transition-all duration-200 transform
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-95
  `;

  const variantClasses = {
    brand: `
      bg-gradient-to-r from-[#FFA135] to-[#FF7236]
      text-white shadow-lg shadow-orange-200
      hover:shadow-xl hover:shadow-orange-300
      hover:scale-105
    `,
    influencer: `
      bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]
      text-gray-800 shadow-lg shadow-yellow-200
      hover:shadow-xl hover:shadow-yellow-300
      hover:scale-105
    `,
    outline: `
      border-2 border-gray-300 bg-white text-gray-700
      hover:bg-gray-50 hover:border-gray-400
    `
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {loading && (
        <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin" />
      )}
      <span className={loading ? 'opacity-0' : ''}>{children}</span>
    </button>
  );
}
