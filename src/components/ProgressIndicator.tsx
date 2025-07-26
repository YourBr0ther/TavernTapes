import React from 'react';

interface ProgressIndicatorProps {
  progress?: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  indeterminate?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'circular' | 'linear';
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress = 0,
  label,
  showPercentage = true,
  indeterminate = false,
  size = 'medium',
  variant = 'linear'
}) => {
  const sizeClasses = {
    small: variant === 'circular' ? 'w-6 h-6' : 'h-2',
    medium: variant === 'circular' ? 'w-8 h-8' : 'h-3',
    large: variant === 'circular' ? 'w-12 h-12' : 'h-4'
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };

  if (variant === 'circular') {
    const circumference = 2 * Math.PI * 45; // radius = 45
    const strokeDasharray = circumference;
    const strokeDashoffset = indeterminate ? 0 : circumference - (progress / 100) * circumference;

    return (
      <div className="flex flex-col items-center space-y-2">
        <div className={`relative ${sizeClasses[size]}`}>
          <svg
            className="transform -rotate-90 w-full h-full"
            viewBox="0 0 100 100"
          >
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="#374151"
              strokeWidth="8"
              fill="transparent"
            />
            
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="#FFD700"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={indeterminate ? 'animate-spin' : 'transition-all duration-300 ease-in-out'}
              style={indeterminate ? {
                strokeDasharray: '70 200',
                animation: 'circular-progress 2s linear infinite'
              } : undefined}
            />
          </svg>
          
          {/* Percentage text */}
          {!indeterminate && showPercentage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`font-bold text-[#FFD700] ${textSizeClasses[size]}`}>
                {Math.round(progress)}%
              </span>
            </div>
          )}
        </div>
        
        {label && (
          <p className={`text-gray-300 text-center ${textSizeClasses[size]}`}>
            {label}
          </p>
        )}
      </div>
    );
  }

  // Linear progress bar
  return (
    <div className="w-full space-y-2">
      {label && (
        <div className="flex justify-between items-center">
          <p className={`text-gray-300 ${textSizeClasses[size]}`}>
            {label}
          </p>
          {!indeterminate && showPercentage && (
            <span className={`text-[#FFD700] font-medium ${textSizeClasses[size]}`}>
              {Math.round(progress)}%
            </span>
          )}
        </div>
      )}
      
      <div className={`w-full bg-gray-600 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`bg-gradient-to-r from-[#3A1078] to-[#FFD700] rounded-full transition-all duration-300 ease-out ${sizeClasses[size]} ${
            indeterminate 
              ? 'animate-pulse w-full' 
              : ''
          }`}
          style={{
            width: indeterminate ? '100%' : `${progress}%`,
            ...(indeterminate ? {
              animation: 'linear-progress 2s linear infinite'
            } : {})
          }}
        />
      </div>
    </div>
  );
};

// Note: Custom animations should be added to global CSS file instead
// @keyframes circular-progress {
//   0% { stroke-dasharray: 1 200; stroke-dashoffset: 0; }
//   50% { stroke-dasharray: 89 200; stroke-dashoffset: -35; }
//   100% { stroke-dasharray: 89 200; stroke-dashoffset: -124; }
// }
// @keyframes linear-progress {
//   0% { transform: translateX(-100%); }
//   100% { transform: translateX(100%); }
// }

export default ProgressIndicator;