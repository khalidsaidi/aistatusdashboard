/**
 * Jest Polyfills for Next.js 15 and Node.js Compatibility
 * CRITICAL: This must be loaded BEFORE any Next.js modules
 * Aggressive polyfills for CI/CD environments
 */

// IMMEDIATE POLYFILL EXECUTION - No delays or conditions
(function () {
  'use strict';

  console.log('🔧 Loading aggressive Jest polyfills...');

  // Ensure globalThis exists first
  if (typeof globalThis === 'undefined') {
    if (typeof global !== 'undefined') {
      global.globalThis = global;
    } else if (typeof window !== 'undefined') {
      window.globalThis = window;
    } else if (typeof self !== 'undefined') {
      self.globalThis = self;
    }
  }

  // CRITICAL: Define Request IMMEDIATELY
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
        mode: this.mode,
      });
    }
  };

  // CRITICAL: Define Response IMMEDIATELY
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
        url: this.url,
      });
    }
  };

  // CRITICAL: Headers polyfill
  const HeadersPolyfill = class Headers extends Map {
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

  // AGGRESSIVE: Force polyfills into ALL contexts IMMEDIATELY
  const contexts = [global, globalThis];
  if (typeof window !== 'undefined') contexts.push(window);
  if (typeof self !== 'undefined') contexts.push(self);

  contexts.forEach((ctx) => {
    if (ctx) {
      // Force override even if they exist
      ctx.Request = RequestPolyfill;
      ctx.Response = ResponsePolyfill;
      ctx.Headers = HeadersPolyfill;

      // Real fetch - use whatwg-fetch
      if (!ctx.fetch) {
        require('whatwg-fetch');
        ctx.fetch = globalThis.fetch;
      }

      // Mock URL
      if (!ctx.URL && typeof require !== 'undefined') {
        try {
          ctx.URL = require('url').URL;
          ctx.URLSearchParams = require('url').URLSearchParams;
        } catch (e) {
          // Fallback
          ctx.URL = class URL {
            constructor(url) {
              this.href = url;
            }
          };
        }
      }

      // Mock AbortController
      ctx.AbortController =
        ctx.AbortController ||
        class AbortController {
          constructor() {
            this.signal = {
              aborted: false,
              addEventListener: () => {},
              removeEventListener: () => {},
            };
          }
          abort() {
            this.signal.aborted = true;
          }
        };

      // Mock performance
      ctx.performance = ctx.performance || {
        now: () => Date.now(),
      };

      // Mock crypto
      ctx.crypto = ctx.crypto || {
        randomUUID: () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        },
        getRandomValues: (arr) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
          }
          return arr;
        },
      };
    }
  });

  console.log('✅ Aggressive Jest polyfills loaded');
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}
