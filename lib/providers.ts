import { Provider } from './types';

export const PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    statusUrl: 'https://status.openai.com/api/v2/status.json',
    statusPageUrl: 'https://status.openai.com'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    statusUrl: 'https://status.anthropic.com/api/v2/summary.json',
    statusPageUrl: 'https://status.anthropic.com'
  },
  {
    id: 'huggingface',
    name: 'HuggingFace',
    statusUrl: 'https://status.huggingface.co/api/v2/summary.json',
    statusPageUrl: 'https://status.huggingface.co'
  },
  {
    id: 'google-ai',
    name: 'Google AI',
    statusUrl: 'https://status.cloud.google.com/incidents.json',
    statusPageUrl: 'https://status.cloud.google.com'
  },
  {
    id: 'cohere',
    name: 'Cohere',
    statusUrl: 'https://status.cohere.com/api/v2/status.json',
    statusPageUrl: 'https://status.cohere.com'
  },
  {
    id: 'replicate',
    name: 'Replicate',
    statusUrl: 'https://www.replicatestatus.com/api/v2/status.json',
    statusPageUrl: 'https://www.replicatestatus.com'
  },
  {
    id: 'groq',
    name: 'Groq',
    statusUrl: 'https://groqstatus.com/api/v2/status.json',
    statusPageUrl: 'https://groqstatus.com'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    statusUrl: 'https://status.deepseek.com/api/v2/status.json',
    statusPageUrl: 'https://status.deepseek.com'
  },
  // Additional AI Providers - now using alternative detection
  {
    id: 'meta',
    name: 'Meta AI',
    statusUrl: 'https://ai.meta.com', // Will use alternative detection
    statusPageUrl: 'https://ai.meta.com'
  },
  {
    id: 'xai',
    name: 'xAI',
    statusUrl: 'https://x.ai', // Will use alternative detection
    statusPageUrl: 'https://x.ai'
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    statusUrl: 'https://status.perplexity.ai', // Will use HTML parsing + alternative detection
    statusPageUrl: 'https://status.perplexity.ai'
  },
  {
    id: 'claude',
    name: 'Claude',
    statusUrl: 'https://status.anthropic.com/api/v2/summary.json',
    statusPageUrl: 'https://status.anthropic.com'
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    statusUrl: 'https://mistral.ai', // Will use alternative detection
    statusPageUrl: 'https://mistral.ai'
  },
  {
    id: 'aws',
    name: 'AWS AI Services',
    statusUrl: 'https://status.aws.amazon.com/rss/all.rss',
    statusPageUrl: 'https://status.aws.amazon.com'
  },
  {
    id: 'azure',
    name: 'Azure AI Services',
    statusUrl: 'https://azurestatuscdn.azureedge.net/en-us/status/feed',
    statusPageUrl: 'https://status.azure.com'
  }
]; 