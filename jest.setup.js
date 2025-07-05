require('@testing-library/jest-dom');

// Polyfill setImmediate for Firebase/Node.js compatibility
global.setImmediate = global.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));

// Polyfill AbortSignal.timeout for Node.js compatibility
if (!AbortSignal.timeout) {
  AbortSignal.timeout = function(delay) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), delay);
    return controller.signal;
  };
}

// Mock fetch globally for all tests
global.fetch = jest.fn();

// Mock window.matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
})); 

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock console methods to reduce test noise
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    return <img {...props} />
  },
}));

// Mock Next.js Link component
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }) => {
    return <a href={href} {...props}>{children}</a>
  },
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock window and navigator for jsdom
Object.defineProperty(window, 'navigator', {
  writable: true,
  value: {
    userAgent: 'test',
    language: 'en-US',
    languages: ['en-US'],
    platform: 'test',
    clipboard: {
      writeText: jest.fn(),
      readText: jest.fn(),
    },
  },
});

// Ensure document.documentElement exists
if (!document.documentElement) {
  document.documentElement = document.createElement('html');
}

// Set up environment variables for tests
process.env.NODE_ENV = 'test'; 