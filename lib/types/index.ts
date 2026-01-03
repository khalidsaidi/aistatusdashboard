export type ProviderStatus = 'operational' | 'degraded' | 'down' | 'unknown';

export interface Provider {
    id: string;
    name: string;
    category: string;
    statusUrl: string;
    statusPageUrl: string;
    format?: string;
    timeout?: number;
    enabled?: boolean;
    priority?: number;
    fallbackUrls?: string[];
}

export interface StatusResult {
    id: string;
    name: string;
    status: ProviderStatus;
    responseTime: number;
    lastChecked: string;
    error?: string;
    statusPageUrl?: string;
    details?: string;
}

export interface StatusHistoryRecord extends StatusResult {
    checkedAt: string;
}

export interface Comment {
    id: string;
    author: string;
    content: string;
    provider?: string | null;
    createdAt: string;
    approved: boolean;
    likes?: number;
    message?: string;
    type?: string;
    status?: string;
    replies?: Comment[];
}
