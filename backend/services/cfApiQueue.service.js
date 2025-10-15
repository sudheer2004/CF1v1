const axios = require('axios');

const CF_API_URL = process.env.CODEFORCES_API_URL || 'https://codeforces.com/api';

class CodeforcesAPIQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastRequestTime = 0;
    this.minInterval = 1000; // 1 second between requests
    this.cache = new Map(); // Cache with TTL
    this.cacheTTL = 10000; // 10 seconds cache
  }

  /**
   * Add request to queue
   */
  async request(endpoint, params = {}, priority = 0, useCache = true) {
    // Check cache first (only if useCache is true)
    if (useCache) {
      const cacheKey = this.getCacheKey(endpoint, params);
      const cached = this.getFromCache(cacheKey);
      
      if (cached) {
        console.log(`✅ Cache hit: ${endpoint}`);
        return cached;
      }
    } else {
      console.log(`🔄 Cache bypass: ${endpoint}`);
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        endpoint,
        params,
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
        useCache, // Pass through to know whether to cache result
      });

      // Sort by priority (higher first)
      this.queue.sort((a, b) => b.priority - a.priority);

      this.processQueue();
    });
  }

  /**
   * Process queue
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Rate limiting
      if (timeSinceLastRequest < this.minInterval) {
        await this.sleep(this.minInterval - timeSinceLastRequest);
      }

      const request = this.queue.shift();

      try {
        console.log(`🔄 CF API Request: ${request.endpoint} ${JSON.stringify(request.params)}`);
        
        const response = await axios.get(`${CF_API_URL}/${request.endpoint}`, {
          params: request.params,
          timeout: 10000,
        });

        this.lastRequestTime = Date.now();

        if (response.data.status !== 'OK') {
          request.reject(new Error(response.data.comment || 'CF API error'));
        } else {
          // Cache result only if useCache is true
          if (request.useCache) {
            const cacheKey = this.getCacheKey(request.endpoint, request.params);
            this.setCache(cacheKey, response.data.result);
          }
          
          request.resolve(response.data.result);
        }
      } catch (error) {
        this.lastRequestTime = Date.now();
        console.error(`❌ CF API Error: ${request.endpoint}`, error.message);
        request.reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Fetch user submissions (queued) - NO CACHE for live polling
   */
  async fetchUserSubmissions(cfHandle, count = 50, useCache = false) {
    return this.request('user.status', {
      handle: cfHandle,
      from: 1,
      count,
    }, 0, useCache); // Default: no cache for submissions
  }

  /**
   * Fetch contest standings - NO CACHE for live polling
   * @param {number} contestId - The contest ID
   * @param {Array<string>} handles - Array of CF handles
   * @param {boolean} useCache - Whether to use cache (default: false for polling)
   */
  async fetchContestStandings(contestId, handles, useCache = false) {
    // Ensure handles is an array
    if (!Array.isArray(handles)) {
      throw new Error('handles must be an array');
    }

    if (handles.length === 0) {
      throw new Error('handles array cannot be empty');
    }

    return this.request('contest.standings', {
      contestId,
      handles: handles.join(';'),
      from: 1,
      count: handles.length,
    }, 0, useCache); // Default: no cache for standings
  }

  /**
   * Cache helpers
   */
  getCacheKey(endpoint, params) {
    return `${endpoint}:${JSON.stringify(params)}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache for specific endpoint/params
   */
  clearCache(endpoint, params) {
    const cacheKey = this.getCacheKey(endpoint, params);
    this.cache.delete(cacheKey);
    console.log(`🗑️  Cache cleared: ${cacheKey}`);
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.cache.clear();
    console.log(`🗑️  All cache cleared`);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear old cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
const cfApiQueue = new CodeforcesAPIQueue();

// Clear expired cache every 30 seconds
setInterval(() => {
  cfApiQueue.clearExpiredCache();
}, 30000);

module.exports = cfApiQueue;