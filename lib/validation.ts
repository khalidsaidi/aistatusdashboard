// Input validation and sanitization utilities

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: any;
}

// Email validation
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  let sanitized = email.trim().toLowerCase();

  if (!sanitized) {
    errors.push('Email is required');
    return { isValid: false, errors };
  }

  if (sanitized.length > 254) {
    errors.push('Email is too long (maximum 254 characters)');
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(sanitized)) {
    errors.push('Please enter a valid email address');
  }

  // Check for common typos
  const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  const domain = sanitized.split('@')[1];
  if (domain) {
    const suggestions = commonDomains.filter(d => 
      Math.abs(d.length - domain.length) <= 2 && 
      d !== domain &&
      levenshteinDistance(d, domain) <= 2
    );
    if (suggestions.length > 0) {
      errors.push(`Did you mean: ${sanitized.split('@')[0]}@${suggestions[0]}?`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

// URL validation
export function validateUrl(url: string): ValidationResult {
  const errors: string[] = [];
  let sanitized = url.trim();

  if (!sanitized) {
    errors.push('URL is required');
    return { isValid: false, errors };
  }

  // Add protocol if missing
  if (!sanitized.match(/^https?:\/\//)) {
    sanitized = 'https://' + sanitized;
  }

  try {
    const urlObj = new URL(sanitized);
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      errors.push('Only HTTP and HTTPS URLs are allowed');
    }

    // Check for suspicious patterns
    if (urlObj.hostname.includes('..') || urlObj.hostname.startsWith('.') || urlObj.hostname.endsWith('.')) {
      errors.push('Invalid hostname format');
    }

    // Length check
    if (sanitized.length > 2048) {
      errors.push('URL is too long (maximum 2048 characters)');
    }

  } catch (e) {
    errors.push('Please enter a valid URL');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

// Text content validation and sanitization
export function validateText(text: string, options: {
  minLength?: number;
  maxLength?: number;
  allowHtml?: boolean;
  required?: boolean;
} = {}): ValidationResult {
  const { minLength = 0, maxLength = 1000, allowHtml = false, required = false } = options;
  const errors: string[] = [];
  
  let sanitized = text.trim();

  if (required && !sanitized) {
    errors.push('This field is required');
    return { isValid: false, errors };
  }

  if (sanitized.length < minLength) {
    errors.push(`Minimum length is ${minLength} characters`);
  }

  if (sanitized.length > maxLength) {
    errors.push(`Maximum length is ${maxLength} characters`);
  }

  // HTML sanitization
  if (!allowHtml) {
    sanitized = sanitized
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+\s*=/i, // event handlers
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitized)) {
      errors.push('Content contains potentially unsafe elements');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

// Provider ID validation
export function validateProviderId(id: string): ValidationResult {
  const errors: string[] = [];
  const sanitized = id.trim().toLowerCase();

  if (!sanitized) {
    errors.push('Provider ID is required');
    return { isValid: false, errors };
  }

  // Valid provider IDs (from your system)
  const validProviders = [
    'openai', 'anthropic', 'huggingface', 'google-ai', 'cohere', 
    'replicate', 'groq', 'deepseek', 'meta', 'xai', 'perplexity', 
    'claude', 'mistral', 'aws', 'azure'
  ];

  if (!validProviders.includes(sanitized)) {
    errors.push('Invalid provider ID');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

// Comment type validation
export function validateCommentType(type: string): ValidationResult {
  const errors: string[] = [];
  const sanitized = type.trim().toLowerCase();

  const validTypes = ['general', 'provider', 'feedback', 'issue'];

  if (!validTypes.includes(sanitized)) {
    errors.push('Invalid comment type');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

// Rate limiting validation
export function validateRateLimit(identifier: string, action: string): ValidationResult {
  const errors: string[] = [];
  
  // Simple in-memory rate limiting (in production, use Redis or similar)
  const rateLimits: { [key: string]: { count: number; resetTime: number } } = {};
  const key = `${identifier}:${action}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = action === 'comment' ? 5 : action === 'email' ? 3 : 10;

  if (!rateLimits[key] || now > rateLimits[key].resetTime) {
    rateLimits[key] = { count: 1, resetTime: now + windowMs };
  } else {
    rateLimits[key].count++;
  }

  if (rateLimits[key].count > maxRequests) {
    const resetIn = Math.ceil((rateLimits[key].resetTime - now) / 1000);
    errors.push(`Rate limit exceeded. Try again in ${resetIn} seconds.`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Comprehensive form validation
export function validateCommentForm(data: {
  author: string;
  content: string;
  email?: string;
  provider?: string;
}): ValidationResult {
  const errors: string[] = [];
  const sanitized: any = {};

  // Validate author
  const authorResult = validateText(data.author, { 
    minLength: 2, 
    maxLength: 50, 
    required: true 
  });
  if (!authorResult.isValid) {
    errors.push(...authorResult.errors.map(e => `Author: ${e}`));
  } else {
    sanitized.author = authorResult.sanitized;
  }

  // Validate content
  const contentResult = validateText(data.content, { 
    minLength: 10, 
    maxLength: 1000, 
    required: true 
  });
  if (!contentResult.isValid) {
    errors.push(...contentResult.errors.map(e => `Comment: ${e}`));
  } else {
    sanitized.content = contentResult.sanitized;
  }

  // Validate email (optional)
  if (data.email) {
    const emailResult = validateEmail(data.email);
    if (!emailResult.isValid) {
      errors.push(...emailResult.errors.map(e => `Email: ${e}`));
    } else {
      sanitized.email = emailResult.sanitized;
    }
  }

  // Validate provider (optional)
  if (data.provider) {
    const providerResult = validateProviderId(data.provider);
    if (!providerResult.isValid) {
      errors.push(...providerResult.errors.map(e => `Provider: ${e}`));
    } else {
      sanitized.provider = providerResult.sanitized;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

// Utility function for string similarity
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// XSS prevention
export function sanitizeForDisplay(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// SQL injection prevention (for any future SQL queries)
export function sanitizeForQuery(input: string): string {
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
} 