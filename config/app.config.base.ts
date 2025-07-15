export interface Provider {
  id: string;
  name: string;
  url: string;
  statusPageUrl: string;
}

export interface AppConfig {
  // Environment
  environment: {
    name: 'development' | 'production';
    nodeEnv: string;
    siteUrl: string;
    apiBaseUrl: string;
  };

  // API Configuration
  api: {
    basePath: string;
    endpoints: {
      subscriptions: string;
      webhooks: string;
      incidents: string;
      subscribePush: string;
      subscribe: string;
    };
  };

  // Firebase Configuration
  firebase: {
    projectId: string;
    functions: {
      region: string;
    };
    messaging: {
      vapidKey: string;
      serverKey?: string;
    };
    config: {
      apiKey: string;
      authDomain: string;
      storageBucket: string;
      messagingSenderId: string;
      appId: string;
    };
  };

  // Email Configuration
  email: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
    };
    defaults: {
      from: string;
      replyTo: string;
    };
  };

  // Provider Configuration
  providers: Provider[];

  // Rate Limiting
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };

  // Monitoring
  monitoring: {
    enableRealTime: boolean;
    enableNotifications: boolean;
    enableEmailSending: boolean;
  };
}

// Shared provider configurations (same for both environments)
export const SHARED_PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    url: 'https://status.openai.com/api/v2/status.json',
    statusPageUrl: 'https://status.openai.com',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    url: 'https://status.anthropic.com/api/v2/summary.json',
    statusPageUrl: 'https://status.anthropic.com',
  },
  {
    id: 'huggingface',
    name: 'HuggingFace',
    url: 'https://status.huggingface.co/api/v2/summary.json',
    statusPageUrl: 'https://status.huggingface.co',
  },
  {
    id: 'google-ai',
    name: 'Google AI',
    url: 'https://status.cloud.google.com/api/v2/summary.json',
    statusPageUrl: 'https://status.cloud.google.com',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    url: 'https://status.cohere.com/api/v2/summary.json',
    statusPageUrl: 'https://status.cohere.com',
  },
  {
    id: 'replicate',
    name: 'Replicate',
    url: 'https://www.replicatestatus.com/api/v2/summary.json',
    statusPageUrl: 'https://www.replicatestatus.com',
  },
  {
    id: 'groq',
    name: 'Groq',
    url: 'https://groqstatus.com/api/v2/summary.json',
    statusPageUrl: 'https://groqstatus.com',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://status.deepseek.com/api/v2/summary.json',
    statusPageUrl: 'https://status.deepseek.com',
  },
  {
    id: 'meta',
    name: 'Meta AI',
    url: 'https://ai.meta.com/api/v2/summary.json',
    statusPageUrl: 'https://ai.meta.com',
  },
  {
    id: 'xai',
    name: 'xAI',
    url: 'https://x.ai/api/v2/summary.json',
    statusPageUrl: 'https://x.ai',
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    url: 'https://status.perplexity.ai/api/v2/summary.json',
    statusPageUrl: 'https://status.perplexity.ai',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    url: 'https://mistral.ai/api/v2/summary.json',
    statusPageUrl: 'https://mistral.ai',
  },
  {
    id: 'aws',
    name: 'AWS AI Services',
    url: 'https://status.aws.amazon.com/api/v2/summary.json',
    statusPageUrl: 'https://status.aws.amazon.com',
  },
  {
    id: 'azure',
    name: 'Azure AI Services',
    url: 'https://status.azure.com/api/v2/summary.json',
    statusPageUrl: 'https://status.azure.com',
  },
];

// Shared API endpoints (same for both environments)
export const SHARED_API_ENDPOINTS = {
  subscriptions: '/api/subscriptions',
  webhooks: '/api/webhooks',
  incidents: '/api/incidents',
  subscribePush: '/subscribePush',
  subscribe: '/subscribe',
};

// Shared rate limiting (same for both environments)
export const SHARED_RATE_LIMIT = {
  maxRequests: 100,
  windowMs: 60000,
}; 