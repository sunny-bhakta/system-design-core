/**
 * URL Shortener (TinyURL, bit.ly)
 * Design a service that converts long URLs into short, shareable links
 */

/**
 * URL Shortener Service
 */
class URLShortener {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://short.ly';
    this.charSet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    this.base = this.charSet.length; // 62
    this.urlDatabase = new Map();
    this.userDatabase = new Map();
    this.analytics = new Map();
    this.customUrls = new Map();
  }

  /**
   * Generate short code using base62 encoding
   */
  generateShortCode(id) {
    let code = '';
    let num = id;
    
    while (num > 0) {
      code = this.charSet[num % this.base] + code;
      num = Math.floor(num / this.base);
    }
    
    return code || '0';
  }

  /**
   * Shorten URL
   */
  async shortenURL(longURL, userId = null, customCode = null) {
    // Validate URL
    if (!this.isValidURL(longURL)) {
      throw new Error('Invalid URL');
    }

    // Check if custom code provided
    if (customCode) {
      if (this.customUrls.has(customCode)) {
        throw new Error('Custom code already exists');
      }
      this.customUrls.set(customCode, longURL);
      return {
        shortURL: `${this.baseUrl}/${customCode}`,
        longURL,
        code: customCode
      };
    }

    // Generate unique ID
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const code = this.generateShortCode(id);

    // Check for collision (unlikely but possible)
    if (this.urlDatabase.has(code)) {
      return await this.shortenURL(longURL, userId); // Retry
    }

    // Store mapping
    this.urlDatabase.set(code, {
      longURL,
      userId,
      createdAt: Date.now(),
      expiresAt: null,
      clickCount: 0
    });

    // Initialize analytics
    this.analytics.set(code, {
      clicks: 0,
      referrers: new Map(),
      countries: new Map(),
      devices: new Map(),
      timestamps: []
    });

    return {
      shortURL: `${this.baseUrl}/${code}`,
      longURL,
      code
    };
  }

  /**
   * Expand short URL
   */
  async expandURL(shortCode) {
    // Check custom URLs first
    if (this.customUrls.has(shortCode)) {
      const longURL = this.customUrls.get(shortCode);
      this.recordClick(shortCode, { referrer: 'direct' });
      return longURL;
    }

    const urlData = this.urlDatabase.get(shortCode);
    if (!urlData) {
      throw new Error('Short URL not found');
    }

    // Check expiration
    if (urlData.expiresAt && Date.now() > urlData.expiresAt) {
      this.urlDatabase.delete(shortCode);
      throw new Error('Short URL has expired');
    }

    // Record click
    this.recordClick(shortCode, { referrer: 'direct' });

    return urlData.longURL;
  }

  /**
   * Record click analytics
   */
  recordClick(code, metadata = {}) {
    const urlData = this.urlDatabase.get(code);
    if (urlData) {
      urlData.clickCount++;
    }

    const analytics = this.analytics.get(code);
    if (analytics) {
      analytics.clicks++;
      analytics.timestamps.push(Date.now());

      if (metadata.referrer) {
        const count = analytics.referrers.get(metadata.referrer) || 0;
        analytics.referrers.set(metadata.referrer, count + 1);
      }

      if (metadata.country) {
        const count = analytics.countries.get(metadata.country) || 0;
        analytics.countries.set(metadata.country, count + 1);
      }

      if (metadata.device) {
        const count = analytics.devices.get(metadata.device) || 0;
        analytics.devices.set(metadata.device, count + 1);
      }
    }
  }

  /**
   * Get analytics for short URL
   */
  getAnalytics(code) {
    const urlData = this.urlDatabase.get(code);
    const analytics = this.analytics.get(code);

    if (!urlData || !analytics) {
      return null;
    }

    return {
      code,
      longURL: urlData.longURL,
      totalClicks: analytics.clicks,
      createdAt: new Date(urlData.createdAt).toISOString(),
      referrers: Object.fromEntries(analytics.referrers),
      countries: Object.fromEntries(analytics.countries),
      devices: Object.fromEntries(analytics.devices),
      clickHistory: analytics.timestamps.slice(-100) // Last 100 clicks
    };
  }

  /**
   * Set expiration for URL
   */
  setExpiration(code, ttl) {
    const urlData = this.urlDatabase.get(code);
    if (!urlData) {
      throw new Error('Short URL not found');
    }

    urlData.expiresAt = Date.now() + ttl;
    return true;
  }

  /**
   * Delete short URL
   */
  deleteURL(code) {
    const deleted = this.urlDatabase.delete(code);
    this.analytics.delete(code);
    this.customUrls.delete(code);
    return deleted;
  }

  /**
   * Validate URL
   */
  isValidURL(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get user's URLs
   */
  getUserURLs(userId) {
    const userURLs = [];
    for (const [code, data] of this.urlDatabase.entries()) {
      if (data.userId === userId) {
        userURLs.push({
          code,
          shortURL: `${this.baseUrl}/${code}`,
          longURL: data.longURL,
          clicks: data.clickCount,
          createdAt: new Date(data.createdAt).toISOString()
        });
      }
    }
    return userURLs;
  }
}

/**
 * Distributed URL Shortener (with sharding)
 */
class DistributedURLShortener extends URLShortener {
  constructor(config) {
    super(config);
    this.shards = config.shards || [];
    this.shardCount = this.shards.length;
  }

  /**
   * Get shard for code
   */
  getShard(code) {
    if (this.shardCount === 0) {
      return null;
    }
    const hash = this.hashCode(code);
    return this.shards[hash % this.shardCount];
  }

  /**
   * Hash code
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Expand with sharding
   */
  async expandURL(shortCode) {
    const shard = this.getShard(shortCode);
    if (shard) {
      return await shard.expandURL(shortCode);
    }
    return await super.expandURL(shortCode);
  }
}

// Example usage
async function demonstrateURLShortener() {
  console.log('=== URL Shortener ===\n');

  const shortener = new URLShortener({ baseUrl: 'https://short.ly' });

  // Shorten URLs
  console.log('=== Shortening URLs ===\n');
  const result1 = await shortener.shortenURL('https://www.example.com/very/long/url/with/many/segments');
  console.log('Shortened URL:', result1);

  const result2 = await shortener.shortenURL('https://www.google.com', 'user123');
  console.log('Shortened URL (with user):', result2);

  const result3 = await shortener.shortenURL('https://www.github.com', null, 'github');
  console.log('Custom Short URL:', result3);

  // Expand URLs
  console.log('\n=== Expanding URLs ===\n');
  const longURL1 = await shortener.expandURL(result1.code);
  console.log(`Expanded ${result1.code}:`, longURL1);

  // Analytics
  console.log('\n=== Analytics ===\n');
  shortener.recordClick(result1.code, { referrer: 'twitter', country: 'US', device: 'mobile' });
  shortener.recordClick(result1.code, { referrer: 'facebook', country: 'UK', device: 'desktop' });
  
  const analytics = shortener.getAnalytics(result1.code);
  console.log('Analytics:', analytics);

  // User URLs
  console.log('\n=== User URLs ===\n');
  const userURLs = shortener.getUserURLs('user123');
  console.log('User URLs:', userURLs);
}

if (require.main === module) {
  demonstrateURLShortener();
}

module.exports = {
  URLShortener,
  DistributedURLShortener
};

