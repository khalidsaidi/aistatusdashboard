interface SkeletonProps {
  className?: string;
}

export function SkeletonLine({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-4 ${className}`} />
  );
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20" />
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonStatus({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        </div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16" />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
    </div>
  );
}

export function SkeletonComment({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/5" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3, className = '' }: SkeletonProps & { count?: number }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStatus key={i} />
      ))}
    </div>
  );
} 