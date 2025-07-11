import { LogLevel, LogData } from './types';

export function log(level: LogLevel, message: string, data?: Record<string, any>): void {
  const logData: LogData = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };
  // Log data processed
}
