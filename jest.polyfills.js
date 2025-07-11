/**
 * Jest Polyfills for Next.js 15 and Node.js Compatibility
 * Provides Web API mocks for testing environment
 */

// CRITICAL FIX: Comprehensive Request polyfill for CI environment
const RequestPolyfill = class Request {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init.method || 'GET';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.body = init.body;
    this.credentials = init.credentials || 'same-origin';
    this.cache = init.cache || 'default';
    this.redirect = init.redirect || 'follow';
    this.referrer = init.referrer || '';
    this.mode = init.mode || 'cors';
  }

  clone() {
    return new RequestPolyfill(this.url, {
      method: this.method,
      headers: Object.fromEntries(this.headers),
      body: this.body,
      credentials: this.credentials,
      cache: this.cache,
      redirect: this.redirect,
      referrer: this.referrer,
      mode: this.mode
    });
  }
};

// Apply polyfills to all global contexts
if (typeof global.Request === 'undefined') {
  global.Request = RequestPolyfill;
}
if (typeof globalThis.Request === 'undefined') {
  globalThis.Request = RequestPolyfill;
}
if (typeof window !== 'undefined' && typeof window.Request === 'undefined') {
  window.Request = RequestPolyfill;
}

// CRITICAL FIX: Comprehensive Response polyfill for CI environment
const ResponsePolyfill = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.ok = this.status >= 200 && this.status < 300;
    this.redirected = init.redirected || false;
    this.type = init.type || 'default';
    this.url = init.url || '';
  }

  async json() {
    try {
      return JSON.parse(this.body);
    } catch {
      throw new Error('Failed to parse response as JSON');
    }
  }

  async text() {
    return String(this.body || '');
  }

  async arrayBuffer() {
    return new ArrayBuffer(0);
  }

  async blob() {
    return new Blob([this.body || '']);
  }

  clone() {
    return new ResponsePolyfill(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: Object.fromEntries(this.headers),
      redirected: this.redirected,
      type: this.type,
      url: this.url
    });
  }
};

// Apply polyfills to all global contexts
if (typeof global.Response === 'undefined') {
  global.Response = ResponsePolyfill;
}
if (typeof globalThis.Response === 'undefined') {
  globalThis.Response = ResponsePolyfill;
}
if (typeof window !== 'undefined' && typeof window.Response === 'undefined') {
  window.Response = ResponsePolyfill;
}

// Mock Headers if not available
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers extends Map {
    constructor(init) {
      super();
      if (init) {
        if (Array.isArray(init)) {
          init.forEach(([key, value]) => this.set(key, value));
        } else if (typeof init === 'object') {
          Object.entries(init).forEach(([key, value]) => this.set(key, value));
        }
      }
    }

    append(name, value) {
      const existing = this.get(name);
      this.set(name, existing ? `${existing}, ${value}` : value);
    }

    delete(name) {
      super.delete(name.toLowerCase());
    }

    get(name) {
      return super.get(name.toLowerCase());
    }

    has(name) {
      return super.has(name.toLowerCase());
    }

    set(name, value) {
      super.set(name.toLowerCase(), value);
    }
  };
}

// Mock fetch if not available (though we use node-fetch)
if (typeof global.fetch === 'undefined') {
  global.fetch = async (url, options = {}) => {
    return new Response(JSON.stringify({ mock: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
}

// Mock URL if not available
if (typeof global.URL === 'undefined') {
  global.URL = require('url').URL;
}

// Mock URLSearchParams if not available
if (typeof global.URLSearchParams === 'undefined') {
  global.URLSearchParams = require('url').URLSearchParams;
}

// Mock AbortController if not available
if (typeof global.AbortController === 'undefined') {
  global.AbortController = class AbortController {
    constructor() {
      this.signal = {
        aborted: false,
        addEventListener: () => {},
        removeEventListener: () => {}
      };
    }

    abort() {
      this.signal.aborted = true;
    }
  };
}

// Mock performance if not available
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: () => Date.now()
  };
}

// Mock crypto for testing
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  };
} 