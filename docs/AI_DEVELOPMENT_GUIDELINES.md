# AI Development Guidelines for AI Status Dashboard

## 🎯 Core Principles

This document defines the systematic approach for AI-assisted development to ensure consistency, quality, and maintainability.

## 📁 1. Explicit File Structure

### Project Structure (Next.js App Router)
```
aistatusdashboard/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── components/        # React components
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── lib/                   # Core business logic
│   ├── types.ts          # ALL TypeScript interfaces (SINGLE SOURCE OF TRUTH)
│   ├── config.ts         # Configuration management
│   ├── utils/            # Single-purpose utility functions
│   ├── providers/        # Provider-specific logic
│   └── __tests__/        # Unit tests
├── config/               # JSON configuration files
├── functions/            # Firebase Cloud Functions
├── __tests__/            # Integration and E2E tests
└── docs/                 # Documentation
```

**AI CONSTRAINT**: Always use exact paths. Never assume file locations.

## 🔧 2. Type-First Development

### Rule: Define ALL interfaces in `lib/types.ts` BEFORE implementation

```typescript
// GOOD: Explicit, validated interface
export interface ProviderStatus {
  id: string;           // MUST be non-empty string
  name: string;         // MUST be non-empty string  
  status: 'operational' | 'degraded' | 'down' | 'unknown'; // MUST be one of these
  responseTime: number; // MUST be >= 0
  lastChecked: string;  // MUST be ISO 8601 string
  error?: string;       // Optional error message
}

// BAD: Implicit typing
const status = await fetchStatus(); // What type is this?
```

**AI CONSTRAINT**: Never use `any` type. Always define explicit interfaces.

## 🧪 3. Concrete Test Cases

### Rule: Provide exact mock data and expected outputs

```typescript
// GOOD: Concrete test with exact data
describe('fetchProviderStatus', () => {
  test('should return operational status for OpenAI', async () => {
    const mockResponse = {
      status: { indicator: 'none', description: 'All Systems Operational' }
    };
    
    const result = await fetchProviderStatus(OPENAI_PROVIDER);
    
    expect(result).toEqual({
      id: 'openai',
      name: 'OpenAI',
      status: 'operational',
      responseTime: expect.any(Number),
      lastChecked: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      error: undefined
    });
  });
});

// BAD: Vague test
test('should work', () => {
  expect(something).toBeTruthy(); // What is "something"?
});
```

**AI CONSTRAINT**: Every test MUST have exact expected outputs.

## ⚡ 4. Small, Single-Purpose Functions

### Rule: Each function does ONE thing

```typescript
// GOOD: Single purpose, clear responsibility
export function parseStatusPageResponse(data: StatusPageResponse): ProviderStatus {
  // MUST return one of: 'operational' | 'degraded' | 'down' | 'unknown'
  const indicator = data.status?.indicator || 'unknown';
  
  switch (indicator) {
    case 'none': return 'operational';
    case 'minor': return 'degraded';
    case 'major':
    case 'critical': return 'down';
    default: return 'unknown';
  }
}

export function calculateResponseTime(startTime: number): number {
  // MUST return non-negative number
  const responseTime = Date.now() - startTime;
  return Math.max(0, responseTime);
}

// BAD: Multiple responsibilities
function fetchAndParseAndCache(provider) {
  // Does too many things
}
```

**AI CONSTRAINT**: Functions MUST have single responsibility and clear return types.

## 📝 5. Error Messages as Documentation

### Rule: Descriptive errors that explain what's expected

```typescript
// GOOD: Descriptive error
export function validateProvider(provider: unknown): Provider {
  if (!provider || typeof provider !== 'object') {
    throw new Error(
      'Provider must be an object with { id: string, name: string, statusUrl: string, statusPageUrl: string }'
    );
  }
  
  if (!provider.id || typeof provider.id !== 'string') {
    throw new Error('Provider.id must be a non-empty string');
  }
  
  // ... more validation
  return provider as Provider;
}

// BAD: Vague error
if (!provider) throw new Error('Invalid provider');
```

**AI CONSTRAINT**: All errors MUST explain what was expected and what was received.

## 🏗️ 6. Progressive Checkpoints

### Implementation Order (MUST follow this sequence):

1. **Types** (`lib/types.ts`) - Define all interfaces
2. **Config** (`config/`) - JSON configuration files  
3. **Utilities** (`lib/utils/`) - Single-purpose functions
4. **Providers** (`lib/providers/`) - Provider-specific logic
5. **API** (`app/api/`) - API endpoints
6. **Components** (`app/components/`) - React components
7. **Tests** (`__tests__/`) - Comprehensive test suite

**AI CONSTRAINT**: Never skip steps. Each checkpoint MUST be verified before proceeding.

## 🔍 7. Runtime Validation

### Rule: Use Zod schemas for data validation

```typescript
import { z } from 'zod';

// GOOD: Runtime validation
export const ProviderStatusSchema = z.object({
  id: z.string().min(1, 'Provider ID must not be empty'),
  name: z.string().min(1, 'Provider name must not be empty'),
  status: z.enum(['operational', 'degraded', 'down', 'unknown']),
  responseTime: z.number().min(0, 'Response time must be non-negative'),
  lastChecked: z.string().datetime('Must be valid ISO 8601 date'),
  error: z.string().optional()
});

export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;

// Usage
export function validateProviderStatus(data: unknown): ProviderStatus {
  return ProviderStatusSchema.parse(data);
}
```

**AI CONSTRAINT**: All external data MUST be validated with Zod schemas.

## 🧩 8. Self-Testing Components

### Rule: Components validate their own props in development

```typescript
// GOOD: Self-validating component
interface StatusCardProps {
  provider: ProviderStatus;
  onRefresh?: () => void;
}

export function StatusCard({ provider, onRefresh }: StatusCardProps) {
  // Development-only validation
  if (process.env.NODE_ENV === 'development') {
    try {
      ProviderStatusSchema.parse(provider);
    } catch (error) {
      throw new Error(`StatusCard received invalid provider: ${error.message}`);
    }
  }
  
  // Component implementation...
}
```

**AI CONSTRAINT**: All components MUST validate props in development mode.

## 💬 9. AI-Specific Comments

### Rule: Clear notes about expected behavior

```typescript
/**
 * Fetches status for a single provider
 * 
 * AI CONSTRAINTS:
 * - MUST return a ProviderStatus object
 * - MUST handle network timeouts (max 10 seconds)
 * - MUST never throw exceptions (return error in status)
 * - MUST set responseTime to actual measured time
 * 
 * @example
 * const result = await fetchProviderStatus({
 *   id: 'openai',
 *   name: 'OpenAI',
 *   statusUrl: 'https://status.openai.com/api/v2/status.json',
 *   statusPageUrl: 'https://status.openai.com'
 * });
 * // result.status will be 'operational' | 'degraded' | 'down' | 'unknown'
 */
export async function fetchProviderStatus(provider: Provider): Promise<ProviderStatus> {
  // Implementation...
}
```

**AI CONSTRAINT**: All functions MUST have AI-specific comments with constraints and examples.

## ✅ 10. Success Criteria for Each Checkpoint

### Types Checkpoint
- [ ] All interfaces defined in `lib/types.ts`
- [ ] Zod schemas created for validation
- [ ] No `any` types used
- [ ] All types exported properly

### Config Checkpoint  
- [ ] JSON configuration files created
- [ ] Schema validation for config files
- [ ] Environment variable mapping
- [ ] Default values defined

### Utilities Checkpoint
- [ ] Single-purpose functions only
- [ ] Full test coverage
- [ ] Error handling with descriptive messages
- [ ] TypeScript strict mode compliance

### Providers Checkpoint
- [ ] Provider-specific logic isolated
- [ ] Consistent error handling
- [ ] Timeout protection
- [ ] Fallback mechanisms

### API Checkpoint
- [ ] Rate limiting implemented
- [ ] Input validation with Zod
- [ ] Consistent response format
- [ ] Error responses standardized

### Components Checkpoint
- [ ] Props validation in development
- [ ] Responsive design (mobile-friendly)
- [ ] Accessibility compliance
- [ ] Error boundaries

### Tests Checkpoint
- [ ] Unit tests with exact mock data
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical paths
- [ ] Performance benchmarks

## 🚨 AI Development Rules

1. **NEVER** assume file contents - always read files first
2. **NEVER** use `any` type - define explicit interfaces
3. **NEVER** skip validation - use Zod for all external data
4. **NEVER** create large functions - break into single-purpose utilities
5. **NEVER** proceed without tests - each function needs test coverage
6. **ALWAYS** follow the implementation order
7. **ALWAYS** provide concrete examples in comments
8. **ALWAYS** validate at runtime in development
9. **ALWAYS** handle errors gracefully with descriptive messages
10. **ALWAYS** verify each checkpoint before proceeding

## 📊 Quality Metrics

- **Type Safety**: 100% - No `any` types allowed
- **Test Coverage**: 90%+ - All critical paths tested
- **Error Handling**: 100% - All functions handle errors
- **Validation**: 100% - All external data validated
- **Documentation**: 100% - All functions documented with AI constraints

---

**Ready to implement? Follow the checkpoints in order and verify each step!** 🚀 