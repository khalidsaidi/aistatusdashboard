"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDERS = void 0;
exports.PROVIDERS = [
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
    }
];
//# sourceMappingURL=providers.js.map