'use client';

import { useState, useEffect } from 'react';

interface ClientTimestampProps {
  format?: 'date' | 'time' | 'datetime';
  date?: Date;
  className?: string;
  timeZone?: 'local' | 'utc';
}

export default function ClientTimestamp({
  format = 'datetime',
  date,
  className = '',
  timeZone = 'local',
}: ClientTimestampProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (date) return undefined;

    // Update current time every second if no specific date provided
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [date]);

  // Always call formatDate function to avoid conditional logic after hooks
  const targetDate = date || currentTime;

  const formatDate = () => {
    const useUtc = timeZone === 'utc';
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

  return (
    <span className={className} suppressHydrationWarning>
      {formatDate()}
    </span>
  );
}
