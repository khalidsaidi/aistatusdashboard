'use client';

import { useState, useEffect } from 'react';

interface ClientTimestampProps {
  format?: 'date' | 'time' | 'datetime';
  date?: Date;
  className?: string;
}

export default function ClientTimestamp({
  format = 'datetime',
  date,
  className = '',
}: ClientTimestampProps) {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);

    if (!date) {
      // Update current time every second if no specific date provided
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [date]);

  // Always call formatDate function to avoid conditional logic after hooks
  const targetDate = date || currentTime;

  const formatDate = (useUtc: boolean) => {
    const locale = useUtc ? 'en-US' : undefined;
    const options = useUtc ? { timeZone: 'UTC' } : undefined;

    switch (format) {
      case 'date':
        return targetDate.toLocaleDateString(locale, options);
      case 'time':
        return targetDate.toLocaleTimeString(locale, options);
      case 'datetime':
      default:
        return targetDate.toLocaleString(locale, options);
    }
  };

  const fallback = date ? formatDate(true) : 'Loading...';

  // Use conditional rendering instead of early return
  return <span className={className}>{mounted ? formatDate(false) : fallback}</span>;
}
