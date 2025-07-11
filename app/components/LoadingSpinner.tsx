interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'blue' | 'gray' | 'white';
  text?: string;
  className?: string;
}

export default function LoadingSpinner({
  size = 'md',
  color = 'blue',
  text,
  className = '',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  const colorClasses = {
    blue: 'text-blue-600',
    gray: 'text-gray-600',
    white: 'text-white',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center gap-2">
        <div className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}>
          <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        {text && <p className={`text-sm ${colorClasses[color]} animate-pulse`}>{text}</p>}
      </div>
    </div>
  );
}
