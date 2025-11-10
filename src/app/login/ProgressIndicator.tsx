import { Check } from 'lucide-react';

interface Step {
  number: number;
  label: string;
  completed: boolean;
  active: boolean;
}

interface ProgressIndicatorProps {
  steps: Step[];
  variant?: 'brand' | 'influencer';
}

export function ProgressIndicator({ steps, variant = 'brand' }: ProgressIndicatorProps) {
  const activeColor = variant === 'brand'
    ? 'bg-gradient-to-r from-orange-500 to-pink-500'
    : 'bg-gradient-to-r from-yellow-400 to-amber-500';

  const completedColor = variant === 'brand' ? 'bg-orange-400' : 'bg-yellow-400';

  return (
    <div className="w-full py-6">
      {/* Center the whole track and keep it compact */}
      <div className="relative mx-auto px-2 w-fit">
        <div className="flex items-center justify-center">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    font-semibold text-sm transition-all duration-300
                    ${step.completed
                      ? `${completedColor} text-white scale-110`
                      : step.active
                        ? `${activeColor} text-white scale-110 shadow-lg`
                        : 'bg-gray-200 text-gray-500'
                    }
                  `}
                >
                  {step.completed ? <Check className="w-5 h-5" /> : step.number}
                </div>
                <span
                  className={`
                    mt-2 text-xs font-medium transition-colors duration-200
                    ${step.active ? 'text-gray-900' : 'text-gray-500'}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="w-24 sm:w-32 h-1 mx-3 relative top-[-12px]">
                  <div className="h-full bg-gray-200 rounded-full">
                    <div
                      className={`
                        h-full rounded-full transition-all duration-500
                        ${step.completed ? completedColor : 'bg-transparent'}
                      `}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
