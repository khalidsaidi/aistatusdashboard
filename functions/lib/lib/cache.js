"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCache = exports.getCached = void 0;
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute
function getCached(key) {
    const item = cache.get(key);
    if (item && Date.now() - item.timestamp < CACHE_TTL) {
        return item.data;
    }
    // Clean up expired entry
    if (item) {
        cache.delete(key);
    }
    return null;
}
exports.getCached = getCached;
function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}
exports.setCache = setCache;
//# sourceMappingURL=cache.js.map