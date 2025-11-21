/**
 * URL Shortener (TinyURL, bit.ly)
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * This service converts long URLs into short, shareable links.
 * 
 * CAPACITY ESTIMATION:
 * - Write requests: 100M URLs/day = ~1,160 URLs/second
 * - Read requests: 100:1 read/write ratio = 10B reads/day = ~116K reads/second
 * - Peak traffic: 2x average = ~232K reads/second
 * - Storage: 100M URLs * 500 bytes = 50GB/year
 * - Analytics: 10B clicks * 100 bytes = 1TB/year
 * - Total storage: ~1.05TB/year
 * 
 * ARCHITECTURE:
 * Client → Load Balancer → App Servers → Cache (Redis) → Database (SQL/NoSQL)
 * 
 * SCALING STRATEGIES:
 * 1. Database Sharding: Shard by user_id or hash of code
 * 2. Read Replicas: Master for writes, replicas for reads
 * 3. CDN: Cache redirects at edge locations
 * 4. Caching: Cache top 20% of URLs (80/20 rule)
 * 
 * DESIGN A service that converts long URLs into short, shareable links
 */

/**
 * URL Shortener Service
 * 
 * This class implements the core URL shortening functionality with:
 * - Base62 encoding for auto-generated short codes
 * - Custom short URL support with validation
 * - URL expiration (time-based and date-based)
 * - Analytics tracking (clicks, referrers, countries, devices)
 * - User account management
 * - Distributed support via sharding
 */
class URLShortener {
  /**
   * Constructor
   * 
   * @param {Object} config - Configuration options
   * @param {string} config.baseUrl - Base URL for short links (e.g., 'https://short.ly')
   * 
   * DATA STRUCTURES:
   * - urlDatabase: Map<code, urlData> - Stores auto-generated short URLs
   * - customUrls: Map<code, urlData> - Stores custom short URLs (separate for faster lookup)
   * - analytics: Map<code, analyticsData> - Stores click analytics per URL
   * - userDatabase: Map<userId, userData> - Stores user information (for future use)
   * 
   * STORAGE CONSIDERATIONS:
   * - In production, these Maps would be replaced with:
   *   * SQL/NoSQL database for persistence
   *   * Redis cache for hot URLs (top 20%)
   *   * Separate analytics database for click tracking
   */
  constructor(config = {}) {
    // Base URL for generating short links
    // Example: 'https://short.ly' → 'https://short.ly/abc123'
    this.baseUrl = config.baseUrl || 'https://short.ly';
    
    /**
     * BASE62 ENCODING CHARACTER SET
     * ==============================
     * Uses 62 characters: 0-9 (10), a-z (26), A-Z (26)
     * This allows for URL-safe encoding without special characters
     * 
     * CAPACITY CALCULATION:
     * - 6 characters: 62^6 = 56.8 billion URLs
     * - 7 characters: 62^7 = 3.5 trillion URLs
     * - 8 characters: 62^8 = 218 trillion URLs
     * 
     * TRADE-OFF:
     * - Shorter codes (6 chars): Better UX, limited capacity
     * - Longer codes (8 chars): More capacity, worse UX
     */
    this.charSet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    this.base = this.charSet.length; // 62
    
    /**
     * IN-MEMORY STORAGE (Production would use database)
     * ==================================================
     * 
     * urlDatabase: Stores auto-generated short URLs
     * - Key: short code (e.g., 'abc123')
     * - Value: { longURL, userId, createdAt, expiresAt, clickCount }
     * 
     * customUrls: Stores custom short URLs (separate for performance)
     * - Key: custom code (e.g., 'github')
     * - Value: { longURL, userId, createdAt, expiresAt, clickCount }
     * - Separation allows faster lookup and validation
     * 
     * analytics: Stores click analytics
     * - Key: short code
     * - Value: { clicks, referrers, countries, devices, timestamps }
     * - In production: Would use time-series database or separate analytics DB
     * 
     * userDatabase: Stores user information
     * - Key: userId
     * - Value: User metadata (for future features)
     */
    this.urlDatabase = new Map(); // code -> urlData
    this.userDatabase = new Map(); // userId -> userData
    this.analytics = new Map(); // code -> analyticsData
    this.customUrls = new Map(); // customCode -> urlData
  }

  /**
   * Generate short code using Base62 encoding
   * 
   * ALGORITHM: Base62 Encoding
   * ===========================
   * Converts a numeric ID into a base-62 string representation.
   * 
   * PROCESS:
   * 1. Take the numeric ID
   * 2. Repeatedly divide by 62 and use remainder as index into charSet
   * 3. Build code from right to left (least significant digit first)
   * 
   * EXAMPLE:
   * - ID: 1000
   * - 1000 % 62 = 32 → 'W'
   * - 16 % 62 = 16 → 'g'
   * - Result: 'gW' (reversed: 'Wg')
   * 
   * ID GENERATION STRATEGIES:
   * 1. Auto-increment: Simple but requires coordination (database sequence)
   * 2. UUID: Unique but longer codes (not suitable for short URLs)
   * 3. Distributed ID: Snowflake ID or similar (recommended for scale)
   * 4. Hash-based: MD5/SHA256 (risk of collisions, requires collision handling)
   * 
   * @param {number} id - Numeric ID to encode
   * @returns {string} Base62-encoded short code
   * 
   * PERFORMANCE: O(log_62(n)) - Very efficient, typically 6-8 iterations
   */
  generateShortCode(id) {
    let code = '';
    let num = id;
    
    // Convert number to base-62
    // Process: repeatedly divide by 62, use remainder as character index
    while (num > 0) {
      // Get remainder (0-61) and map to character
      code = this.charSet[num % this.base] + code;
      // Integer division by 62
      num = Math.floor(num / this.base);
    }
    
    // Handle edge case: ID is 0
    return code || '0';
  }

  /**
   * Validate custom code
   * 
   * CUSTOM CODE VALIDATION RULES:
   * ==============================
   * 1. Length: 3-20 characters
   *    - Too short (< 3): Risk of collisions, hard to remember
   *    - Too long (> 20): Defeats purpose of URL shortening
   * 
   * 2. Characters: Alphanumeric and hyphens only
   *    - URL-safe characters
   *    - No special characters that need encoding
   *    - Regex: /^[a-zA-Z0-9-]+$/
   * 
   * 3. Reserved codes: Cannot use system-reserved codes
   *    - Prevents conflicts with system routes (api, admin, www, etc.)
   *    - Protects against security issues
   * 
   * SECURITY CONSIDERATIONS:
   * - Prevents injection attacks via custom codes
   * - Blocks reserved system paths
   * - Ensures URL safety
   * 
   * @param {string} customCode - Custom code to validate
   * @throws {Error} If validation fails
   * @returns {boolean} True if valid
   */
  validateCustomCode(customCode) {
    // Length validation: 3-20 characters
    // Trade-off: Shorter = more collisions, longer = defeats purpose
    if (customCode.length < 3 || customCode.length > 20) {
      throw new Error('Custom code must be between 3 and 20 characters');
    }

    // Character validation: Only alphanumeric and hyphens
    // URL-safe characters that don't require encoding
    if (!/^[a-zA-Z0-9-]+$/.test(customCode)) {
      throw new Error('Custom code can only contain alphanumeric characters and hyphens');
    }

    // Reserved codes check: Prevent conflicts with system routes
    // In production, this list would be configurable and more extensive
    const reservedCodes = ['api', 'admin', 'www', 'mail', 'ftp', 'about', 'help', 'terms', 'privacy'];
    if (reservedCodes.includes(customCode.toLowerCase())) {
      throw new Error('Custom code is reserved and cannot be used');
    }

    return true;
  }

  /**
   * Shorten URL
   * 
   * CORE FUNCTIONALITY:
   * ===================
   * Converts a long URL into a short, shareable link.
   * 
   * SUPPORTS:
   * - Auto-generated short codes (Base62 encoding)
   * - Custom short codes (user-specified)
   * - URL expiration (time-based or date-based)
   * - User association (for analytics and management)
   * 
   * PROCESS FLOW:
   * 1. Validate input URL
   * 2. Calculate expiration timestamp (if provided)
   * 3. Handle custom code OR generate auto code
   * 4. Store URL mapping
   * 5. Initialize analytics tracking
   * 6. Return short URL
   * 
   * EXPIRATION HANDLING:
   * - expiresIn: Time-to-live in milliseconds (e.g., 86400000 = 1 day)
   * - expiresAt: Specific expiration date (ISO 8601 format)
   * - If neither provided: URL is permanent
   * 
   * CUSTOM CODE HANDLING:
   * - Validates custom code format
   * - Checks for uniqueness (including expired URLs)
   * - Allows reuse of expired custom codes
   * - Stores separately for faster lookup
   * 
   * COLLISION HANDLING:
   * - Auto-generated codes: Retry on collision (extremely rare)
   * - Custom codes: Reject if exists (user must choose different)
   * 
   * @param {string} longURL - The long URL to shorten
   * @param {string|null} userId - Optional user ID for account management
   * @param {string|null} customCode - Optional custom short code
   * @param {number|null} expiresIn - Optional expiration time in milliseconds
   * @param {Date|null} expiresAt - Optional expiration date (alternative to expiresIn)
   * @returns {Promise<Object>} Short URL information
   * 
   * PERFORMANCE:
   * - O(1) for custom code lookup
   * - O(1) for storage (Map operations)
   * - In production: Database write would be async
   * 
   * SCALABILITY:
   * - Can be sharded by userId or hash of code
   * - Custom codes can be pre-validated and cached
   * - Expiration can be handled by background jobs
   */
  async shortenURL(longURL, userId = null, customCode = null, expiresIn = null, expiresAt = null) {
    /**
     * STEP 1: URL VALIDATION
     * ======================
     * Validates that the input is a proper URL format.
     * In production, would also check:
     * - Malicious URL detection
     * - Blacklisted domains
     * - URL length limits
     */
    if (!this.isValidURL(longURL)) {
      throw new Error('Invalid URL');
    }

    /**
     * STEP 2: EXPIRATION CALCULATION
     * ==============================
     * Supports two expiration methods:
     * 
     * 1. expiresAt (Date object or ISO string):
     *    - More intuitive for users
     *    - Allows scheduling expiration for specific dates
     *    - Example: Campaign ends on Dec 31, 2024
     * 
     * 2. expiresIn (milliseconds):
     *    - Simpler for relative time
     *    - Example: Link expires in 1 hour
     * 
     * TRADE-OFF:
     * - Date-based: More intuitive, requires date parsing
     * - Time-based: Simpler calculation, less intuitive
     */
    let expirationTimestamp = null;
    if (expiresAt) {
      expirationTimestamp = new Date(expiresAt).getTime();
      // Validation: Expiration must be in the future
      if (isNaN(expirationTimestamp) || expirationTimestamp <= Date.now()) {
        throw new Error('Expiration date must be in the future');
      }
    } else if (expiresIn) {
      // Validation: TTL must be positive
      if (expiresIn <= 0) {
        throw new Error('Expiration time must be positive');
      }
      expirationTimestamp = Date.now() + expiresIn;
    }
    // If neither provided, expirationTimestamp remains null (permanent URL)

    /**
     * STEP 3: CUSTOM CODE HANDLING
     * =============================
     * If custom code provided, handle separately from auto-generated codes.
     * 
     * BENEFITS OF SEPARATE STORAGE:
     * - Faster lookup (no need to check both databases)
     * - Easier validation and management
     * - Can apply different rules (e.g., premium feature)
     * 
     * REUSE LOGIC:
     * - Expired custom URLs can be reused
     * - Prevents code exhaustion
     * - Allows users to reclaim their custom codes
     */
    if (customCode) {
      // Validate custom code format and rules
      this.validateCustomCode(customCode);

      // Check if custom code already exists
      if (this.customUrls.has(customCode)) {
        const existing = this.customUrls.get(customCode);
        // Allow reuse if expired
        if (existing.expiresAt && Date.now() > existing.expiresAt) {
          // Expired custom URL, can be reused
          // Clean up old analytics
          this.customUrls.delete(customCode);
          this.analytics.delete(customCode);
        } else {
          throw new Error('Custom code already exists');
        }
      }

      // Also check regular database (in case of collision with auto-generated)
      if (this.urlDatabase.has(customCode)) {
        const existing = this.urlDatabase.get(customCode);
        if (existing.expiresAt && Date.now() > existing.expiresAt) {
          // Expired URL, can be reused
          this.urlDatabase.delete(customCode);
          this.analytics.delete(customCode);
        } else {
          throw new Error('Custom code already exists');
        }
      }

      /**
       * STORE CUSTOM URL
       * ================
       * Store in separate Map for performance.
       * In production, would use database with unique constraint on code.
       */
      this.customUrls.set(customCode, {
        longURL,
        userId,
        createdAt: Date.now(),
        expiresAt: expirationTimestamp,
        clickCount: 0
      });

      /**
       * INITIALIZE ANALYTICS
       * ====================
       * Create analytics entry for tracking clicks.
       * In production, analytics would be stored separately:
       * - Time-series database for click events
       * - Aggregated stats in cache for fast access
       * - Background jobs for processing analytics
       */
      this.analytics.set(customCode, {
        clicks: 0,
        referrers: new Map(), // referrer -> count
        countries: new Map(), // country code -> count
        devices: new Map(),   // device type -> count
        timestamps: []        // Click timestamps (for time-series analysis)
      });

      return {
        shortURL: `${this.baseUrl}/${customCode}`,
        longURL,
        code: customCode,
        expiresAt: expirationTimestamp ? new Date(expirationTimestamp).toISOString() : null,
        isCustom: true
      };
    }

    /**
     * STEP 4: AUTO-GENERATED CODE
     * ============================
     * Generate short code using Base62 encoding.
     * 
     * ID GENERATION:
     * - Uses timestamp + random for uniqueness
     * - In production: Would use distributed ID generator (Snowflake, etc.)
     * - Ensures uniqueness across multiple servers
     */
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const code = this.generateShortCode(id);

    /**
     * COLLISION DETECTION
     * ====================
     * Check if generated code already exists.
     * 
     * PROBABILITY:
     * - With 6 characters: 62^6 = 56.8 billion possible codes
     * - Collision probability is extremely low
     * - If collision occurs, retry with new ID
     * 
     * IN PRODUCTION:
     * - Database unique constraint would handle this
     * - Retry logic would be more sophisticated
     */
    if (this.urlDatabase.has(code) || this.customUrls.has(code)) {
      // Retry with new ID (recursive call)
      return await this.shortenURL(longURL, userId, null, expiresIn, expiresAt);
    }

    /**
     * STORE URL MAPPING
     * =================
     * Store in urlDatabase Map.
     * 
     * DATA STRUCTURE:
     * {
     *   longURL: string,
     *   userId: string|null,
     *   createdAt: number (timestamp),
     *   expiresAt: number|null (timestamp),
     *   clickCount: number
     * }
     * 
     * IN PRODUCTION:
     * - Would use database with indexes on:
     *   * code (PRIMARY KEY, UNIQUE)
     *   * user_id (for user's URLs query)
     *   * expires_at (for cleanup jobs)
     */
    this.urlDatabase.set(code, {
      longURL,
      userId,
      createdAt: Date.now(),
      expiresAt: expirationTimestamp,
      clickCount: 0
    });

    /**
     * INITIALIZE ANALYTICS
     * ====================
     * Create analytics tracking entry.
     * 
     * ANALYTICS DATA STRUCTURE:
     * {
     *   clicks: number,
     *   referrers: Map<referrer, count>,
     *   countries: Map<countryCode, count>,
     *   devices: Map<deviceType, count>,
     *   timestamps: Array<timestamp>
     * }
     * 
     * STORAGE OPTIMIZATION:
     * - In production, would use time-series database
     * - Keep only recent timestamps in memory
     * - Aggregate old data for storage efficiency
     */
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
      code,
      expiresAt: expirationTimestamp ? new Date(expirationTimestamp).toISOString() : null,
      isCustom: false
    };
  }

  /**
   * Expand short URL
   * 
   * CORE FUNCTIONALITY:
   * ===================
   * Retrieves the original long URL from a short code.
   * 
   * PROCESS FLOW:
   * 1. Check custom URLs first (faster lookup)
   * 2. Check regular URLs
   * 3. Validate expiration
   * 4. Record click analytics
   * 5. Return long URL
   * 
   * PERFORMANCE OPTIMIZATION:
   * - Custom URLs checked first (separate Map, faster)
   * - In production: Would check cache (Redis) first
   * - Cache hit rate: ~80% (80/20 rule - top 20% URLs get 80% of traffic)
   * 
   * EXPIRATION HANDLING:
   * - Check expiration timestamp
   * - If expired: Delete and return error
   * - Automatic cleanup on access
   * 
   * CACHING STRATEGY:
   * - Hot URLs: Cache in Redis (1 hour TTL)
   * - Cache size: ~20% of daily reads = 400M URLs
   * - Storage: 400M * 500 bytes = 200GB cache
   * 
   * @param {string} shortCode - The short code to expand
   * @returns {Promise<string>} The original long URL
   * @throws {Error} If URL not found or expired
   * 
   * LATENCY TARGET: < 100ms (including cache lookup)
   */
  async expandURL(shortCode) {
    /**
     * STEP 1: CHECK CUSTOM URLS
     * ========================
     * Custom URLs stored separately for faster lookup.
     * In production, would check cache first.
     */
    if (this.customUrls.has(shortCode)) {
      const customUrlData = this.customUrls.get(shortCode);
      
      /**
       * EXPIRATION CHECK
       * ================
       * Validate that URL hasn't expired.
       * If expired, delete and return error.
       */
      if (customUrlData.expiresAt && Date.now() > customUrlData.expiresAt) {
        // Cleanup expired URL
        this.customUrls.delete(shortCode);
        this.analytics.delete(shortCode);
        throw new Error('Short URL has expired');
      }

      /**
       * RECORD CLICK
       * ============
       * Track analytics for this click.
       * In production, this would be:
       * - Async operation (don't block redirect)
       * - Batched for efficiency
       * - Stored in time-series database
       */
      this.recordClick(shortCode, { referrer: 'direct' });
      return customUrlData.longURL;
    }

    /**
     * STEP 2: CHECK REGULAR URLS
     * ===========================
     * Check auto-generated URLs.
     */
    const urlData = this.urlDatabase.get(shortCode);
    if (!urlData) {
      throw new Error('Short URL not found');
    }

    /**
     * EXPIRATION CHECK
     * ================
     * Same expiration logic as custom URLs.
     */
    if (urlData.expiresAt && Date.now() > urlData.expiresAt) {
      // Cleanup expired URL
      this.urlDatabase.delete(shortCode);
      this.analytics.delete(shortCode);
      throw new Error('Short URL has expired');
    }

    /**
     * RECORD CLICK
     * ============
     * Track analytics before returning URL.
     */
    this.recordClick(shortCode, { referrer: 'direct' });

    return urlData.longURL;
  }

  /**
   * Record click analytics
   * 
   * ANALYTICS TRACKING:
   * ===================
   * Tracks detailed analytics for each URL click.
   * 
   * METRICS COLLECTED:
   * - Total clicks
   * - Referrers (where click came from)
   * - Countries (geographic distribution)
   * - Devices (mobile, desktop, tablet)
   * - Timestamps (for time-series analysis)
   * 
   * STORAGE CONSIDERATIONS:
   * - In production: Would use time-series database
   * - Keep only recent timestamps in memory
   * - Aggregate old data for efficiency
   * - Storage: 10B clicks/day * 100 bytes = 1TB/year
   * 
   * PERFORMANCE:
   * - Should be async/non-blocking
   * - Batch writes for efficiency
   * - Use message queue for high throughput
   * 
   * ANALYTICS ARCHITECTURE:
   * - Real-time: Track clicks as they happen
   * - Batch processing: Aggregate analytics in background
   * - Time-series DB: Store click events with timestamps
   * - Aggregation: Pre-compute daily/weekly/monthly stats
   * 
   * @param {string} code - The short code
   * @param {Object} metadata - Click metadata
   * @param {string} metadata.referrer - Referrer source (e.g., 'twitter', 'facebook')
   * @param {string} metadata.country - Country code (e.g., 'US', 'UK')
   * @param {string} metadata.device - Device type (e.g., 'mobile', 'desktop')
   */
  recordClick(code, metadata = {}) {
    /**
     * UPDATE CLICK COUNT
     * ==================
     * Increment total click count for URL.
     * Check both regular and custom URL databases.
     * In production, would use atomic increment in database.
     */
    const urlData = this.urlDatabase.get(code) || this.customUrls.get(code);
    if (urlData) {
      urlData.clickCount++;
    }

    /**
     * UPDATE ANALYTICS
     * ================
     * Update detailed analytics metrics.
     */
    const analytics = this.analytics.get(code);
    if (analytics) {
      // Increment total clicks
      analytics.clicks++;
      
      // Store timestamp (for time-series analysis)
      // In production, would limit to recent timestamps
      analytics.timestamps.push(Date.now());
      
      // Keep only last 100 timestamps in memory
      // In production, would use time-series database
      if (analytics.timestamps.length > 100) {
        analytics.timestamps.shift();
      }

      /**
       * REFERRER TRACKING
       * =================
       * Track where clicks are coming from.
       * Useful for marketing attribution.
       */
      if (metadata.referrer) {
        const count = analytics.referrers.get(metadata.referrer) || 0;
        analytics.referrers.set(metadata.referrer, count + 1);
      }

      /**
       * GEOGRAPHIC TRACKING
       * ===================
       * Track geographic distribution of clicks.
       * Useful for CDN optimization and marketing.
       */
      if (metadata.country) {
        const count = analytics.countries.get(metadata.country) || 0;
        analytics.countries.set(metadata.country, count + 1);
      }

      /**
       * DEVICE TRACKING
       * ===============
       * Track device types (mobile, desktop, tablet).
       * Useful for UX optimization.
       */
      if (metadata.device) {
        const count = analytics.devices.get(metadata.device) || 0;
        analytics.devices.set(metadata.device, count + 1);
      }
    }
  }

  /**
   * Get analytics for short URL
   * 
   * ANALYTICS DATA:
   * ===============
   * Returns comprehensive analytics for a short URL.
   * 
   * METRICS INCLUDED:
   * - Total clicks
   * - Referrer breakdown
   * - Country distribution
   * - Device distribution
   * - Click history (recent timestamps)
   * 
   * USE CASES:
   * - Marketing campaign analysis
   * - Geographic targeting
   * - Device optimization
   * - Traffic source analysis
   * 
   * IN PRODUCTION:
   * - Would query time-series database
   * - Pre-aggregated stats for fast access
   * - Real-time updates for recent clicks
   * - Historical data for trends
   * 
   * @param {string} code - The short code
   * @returns {Object|null} Analytics data or null if not found
   */
  getAnalytics(code) {
    // Check both regular and custom URLs
    const urlData = this.urlDatabase.get(code) || this.customUrls.get(code);
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
   * 
   * EXPIRATION MANAGEMENT:
   * ======================
   * Allows setting or updating expiration after URL creation.
   * 
   * SUPPORTS:
   * - Time-to-live (TTL) in milliseconds
   * - Specific expiration date
   * - Works for both regular and custom URLs
   * 
   * USE CASES:
   * - Extend expiration for popular URLs
   * - Set expiration for previously permanent URLs
   * - Update expiration dates for campaigns
   * 
   * @param {string} code - The short code
   * @param {number|null} ttl - Time to live in milliseconds (optional)
   * @param {Date|null} expiresAt - Expiration date (optional, alternative to ttl)
   * @returns {Object} Expiration information
   * @throws {Error} If URL not found or invalid expiration
   */
  setExpiration(code, ttl = null, expiresAt = null) {
    /**
     * CHECK CUSTOM URLS FIRST
     * =======================
     * Custom URLs stored separately, check first.
     */
    if (this.customUrls.has(code)) {
      const customUrlData = this.customUrls.get(code);
      
      // Calculate expiration timestamp
      if (expiresAt) {
        const expirationTimestamp = new Date(expiresAt).getTime();
        if (isNaN(expirationTimestamp) || expirationTimestamp <= Date.now()) {
          throw new Error('Expiration date must be in the future');
        }
        customUrlData.expiresAt = expirationTimestamp;
      } else if (ttl) {
        if (ttl <= 0) {
          throw new Error('TTL must be positive');
        }
        customUrlData.expiresAt = Date.now() + ttl;
      } else {
        throw new Error('Either ttl or expiresAt must be provided');
      }

      return {
        code,
        expiresAt: new Date(customUrlData.expiresAt).toISOString(),
        isCustom: true
      };
    }

    /**
     * CHECK REGULAR URLS
     * ==================
     */
    const urlData = this.urlDatabase.get(code);
    if (!urlData) {
      throw new Error('Short URL not found');
    }

    // Calculate expiration timestamp (same logic as custom URLs)
    if (expiresAt) {
      const expirationTimestamp = new Date(expiresAt).getTime();
      if (isNaN(expirationTimestamp) || expirationTimestamp <= Date.now()) {
        throw new Error('Expiration date must be in the future');
      }
      urlData.expiresAt = expirationTimestamp;
    } else if (ttl) {
      if (ttl <= 0) {
        throw new Error('TTL must be positive');
      }
      urlData.expiresAt = Date.now() + ttl;
    } else {
      throw new Error('Either ttl or expiresAt must be provided');
    }

    return {
      code,
      expiresAt: new Date(urlData.expiresAt).toISOString(),
      isCustom: false
    };
  }

  /**
   * Remove expiration (make URL permanent)
   * 
   * FUNCTIONALITY:
   * =============
   * Removes expiration from a URL, making it permanent.
   * 
   * USE CASES:
   * - Convert temporary URL to permanent
   * - Remove expiration for important links
   * 
   * @param {string} code - The short code
   * @returns {Object} Updated expiration info
   * @throws {Error} If URL not found
   */
  removeExpiration(code) {
    // Check custom URLs first
    if (this.customUrls.has(code)) {
      const customUrlData = this.customUrls.get(code);
      customUrlData.expiresAt = null;
      return { code, expiresAt: null, isCustom: true };
    }

    const urlData = this.urlDatabase.get(code);
    if (!urlData) {
      throw new Error('Short URL not found');
    }

    urlData.expiresAt = null;
    return { code, expiresAt: null, isCustom: false };
  }

  /**
   * Get expiration info for URL
   * 
   * RETURNS:
   * =======
   * Detailed expiration information including:
   * - Expiration date/time
   * - Whether URL is expired
   * - Time remaining (milliseconds and human-readable)
   * - Whether URL is custom
   * 
   * @param {string} code - The short code
   * @returns {Object} Expiration information
   * @throws {Error} If URL not found
   */
  getExpirationInfo(code) {
    // Check custom URLs first
    if (this.customUrls.has(code)) {
      const customUrlData = this.customUrls.get(code);
      if (!customUrlData.expiresAt) {
        return { code, expiresAt: null, isExpired: false, isCustom: true };
      }
      const isExpired = Date.now() > customUrlData.expiresAt;
      const timeRemaining = isExpired ? 0 : customUrlData.expiresAt - Date.now();
      return {
        code,
        expiresAt: new Date(customUrlData.expiresAt).toISOString(),
        isExpired,
        timeRemaining,
        timeRemainingFormatted: this.formatTimeRemaining(timeRemaining),
        isCustom: true
      };
    }

    const urlData = this.urlDatabase.get(code);
    if (!urlData) {
      throw new Error('Short URL not found');
    }

    if (!urlData.expiresAt) {
      return { code, expiresAt: null, isExpired: false, isCustom: false };
    }

    const isExpired = Date.now() > urlData.expiresAt;
    const timeRemaining = isExpired ? 0 : urlData.expiresAt - Date.now();
    return {
      code,
      expiresAt: new Date(urlData.expiresAt).toISOString(),
      isExpired,
      timeRemaining,
      timeRemainingFormatted: this.formatTimeRemaining(timeRemaining),
      isCustom: false
    };
  }

  /**
   * Format time remaining in human-readable format
   * 
   * CONVERTS milliseconds to human-readable format:
   * - Days, hours, minutes, or seconds
   * 
   * @param {number} ms - Time in milliseconds
   * @returns {string} Human-readable time remaining
   */
  formatTimeRemaining(ms) {
    if (ms <= 0) return 'Expired';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day(s)`;
    if (hours > 0) return `${hours} hour(s)`;
    if (minutes > 0) return `${minutes} minute(s)`;
    return `${seconds} second(s)`;
  }

  /**
   * Cleanup expired URLs
   * 
   * CLEANUP PROCESS:
   * ================
   * Removes all expired URLs from storage.
   * 
   * IN PRODUCTION:
   * - Would run as background job (cron/scheduler)
   * - Batch processing for efficiency
   * - Can preserve analytics even after URL deletion
   * - Would use database queries with expiration index
   * 
   * PERFORMANCE:
   * - O(n) where n = number of URLs
   * - In production: Would use indexed query (O(log n))
   * - Should run periodically (e.g., every hour)
   * 
   * @returns {Object} Cleanup statistics
   */
  cleanupExpiredURLs() {
    let cleaned = 0;

    /**
     * CLEANUP CUSTOM URLS
     * ===================
     * Remove expired custom URLs.
     */
    for (const [code, data] of this.customUrls.entries()) {
      if (data.expiresAt && Date.now() > data.expiresAt) {
        this.customUrls.delete(code);
        // Optionally preserve analytics
        // this.analytics.delete(code);
        cleaned++;
      }
    }

    /**
     * CLEANUP REGULAR URLS
     * ====================
     * Remove expired regular URLs.
     */
    for (const [code, data] of this.urlDatabase.entries()) {
      if (data.expiresAt && Date.now() > data.expiresAt) {
        this.urlDatabase.delete(code);
        // Optionally preserve analytics
        // this.analytics.delete(code);
        cleaned++;
      }
    }

    return { cleaned, timestamp: new Date().toISOString() };
  }

  /**
   * Delete short URL
   * 
   * FUNCTIONALITY:
   * =============
   * Permanently deletes a short URL and its analytics.
   * 
   * IN PRODUCTION:
   * - Would soft-delete (mark as deleted, keep for recovery)
   * - Preserve analytics for historical data
   * - Require user authentication/authorization
   * 
   * @param {string} code - The short code to delete
   * @returns {boolean} True if deleted, false if not found
   */
  deleteURL(code) {
    // Delete from both databases (in case of collision)
    const deletedFromRegular = this.urlDatabase.delete(code);
    const deletedFromCustom = this.customUrls.delete(code);
    const deleted = deletedFromRegular || deletedFromCustom;
    
    // Delete analytics (or optionally preserve for historical data)
    this.analytics.delete(code);
    
    return deleted;
  }

  /**
   * Validate URL
   * 
   * URL VALIDATION:
   * ===============
   * Validates that a string is a proper URL format.
   * 
   * IN PRODUCTION, WOULD ALSO CHECK:
   * - Malicious URL detection (phishing, malware)
   * - Blacklisted domains
   * - URL length limits
   * - Protocol restrictions (only http/https)
   * 
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid URL
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
   * 
   * FUNCTIONALITY:
   * =============
   * Returns all URLs created by a specific user.
   * 
   * RETURNS:
   * - Both regular and custom URLs
   * - Includes expiration status
   * - Sorted by creation date (newest first)
   * 
   * IN PRODUCTION:
   * - Would use database query with user_id index
   * - Pagination for large result sets
   * - Filtering and sorting options
   * 
   * @param {string} userId - User ID
   * @returns {Array<Object>} List of user's URLs
   */
  getUserURLs(userId) {
    const userURLs = [];
    
    /**
     * GET REGULAR URLS
     * ================
     * Iterate through regular URLs.
     * In production: Would use indexed database query.
     */
    for (const [code, data] of this.urlDatabase.entries()) {
      if (data.userId === userId) {
        const isExpired = data.expiresAt && Date.now() > data.expiresAt;
        userURLs.push({
          code,
          shortURL: `${this.baseUrl}/${code}`,
          longURL: data.longURL,
          clicks: data.clickCount,
          createdAt: new Date(data.createdAt).toISOString(),
          expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
          isExpired,
          isCustom: false
        });
      }
    }

    /**
     * GET CUSTOM URLS
     * ===============
     * Iterate through custom URLs.
     */
    for (const [code, data] of this.customUrls.entries()) {
      if (data.userId === userId) {
        const isExpired = data.expiresAt && Date.now() > data.expiresAt;
        userURLs.push({
          code,
          shortURL: `${this.baseUrl}/${code}`,
          longURL: data.longURL,
          clicks: data.clickCount,
          createdAt: new Date(data.createdAt).toISOString(),
          expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
          isExpired,
          isCustom: true
        });
      }
    }

    // Sort by creation date (newest first)
    return userURLs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

/**
 * Distributed URL Shortener (with sharding)
 * 
 * SCALING STRATEGY:
 * =================
 * Extends base URLShortener with sharding support for horizontal scaling.
 * 
 * SHARDING APPROACH:
 * - Consistent hashing for distribution
 * - Each shard handles subset of URLs
 * - Allows scaling to billions of URLs
 * 
 * CONSISTENT HASHING:
 * - Distributes URLs evenly across shards
 * - Minimal data movement on shard addition/removal
 * - Uses hash of code to determine shard
 * 
 * USE CASE:
 * - When single server can't handle load
 * - Need to distribute across multiple databases
 * - Geographic distribution
 */
class DistributedURLShortener extends URLShortener {
  /**
   * Constructor
   * 
   * @param {Object} config - Configuration
   * @param {Array<URLShortener>} config.shards - Array of shard instances
   */
  constructor(config) {
    super(config);
    this.shards = config.shards || [];
    this.shardCount = this.shards.length;
  }

  /**
   * Get shard for code
   * 
   * SHARDING ALGORITHM:
   * ===================
   * Uses consistent hashing to determine which shard handles a code.
   * 
   * PROCESS:
   * 1. Hash the code
   * 2. Modulo by number of shards
   * 3. Return corresponding shard
   * 
   * BENEFITS:
   * - Even distribution
   * - Deterministic (same code → same shard)
   * - Easy to add/remove shards
   * 
   * @param {string} code - The short code
   * @returns {URLShortener|null} The shard instance or null
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
   * 
   * HASH FUNCTION:
   * ==============
   * Simple hash function for sharding.
   * 
   * IN PRODUCTION:
   * - Would use more robust hash (MD5, SHA-256)
   * - Consistent hashing with virtual nodes
   * - Better distribution across shards
   * 
   * @param {string} str - String to hash
   * @returns {number} Hash value
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
   * 
   * SHARDED LOOKUP:
   * ===============
   * Routes expand request to appropriate shard.
   * 
   * PROCESS:
   * 1. Determine shard from code
   * 2. Query shard for URL
   * 3. Fallback to parent if shard not available
   * 
   * @param {string} shortCode - The short code
   * @returns {Promise<string>} The original long URL
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

  // Custom short URL
  const result3 = await shortener.shortenURL('https://www.github.com', 'user123', 'github');
  console.log('Custom Short URL:', result3);

  // URL with expiration (expires in 1 hour)
  const result4 = await shortener.shortenURL(
    'https://www.example.com/temporary',
    'user123',
    null,
    60 * 60 * 1000 // 1 hour in milliseconds
  );
  console.log('URL with expiration (1 hour):', result4);

  // Custom URL with expiration (expires in 1 day)
  const result5 = await shortener.shortenURL(
    'https://www.example.com/promo',
    'user123',
    'promo2024',
    24 * 60 * 60 * 1000 // 1 day in milliseconds
  );
  console.log('Custom URL with expiration:', result5);

  // Custom URL with expiration date
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
  const result6 = await shortener.shortenURL(
    'https://www.example.com/event',
    'user123',
    'event2024',
    null,
    futureDate
  );
  console.log('Custom URL with expiration date:', result6);

  // Expand URLs
  console.log('\n=== Expanding URLs ===\n');
  const longURL1 = await shortener.expandURL(result1.code);
  console.log(`Expanded ${result1.code}:`, longURL1);

  const longURL3 = await shortener.expandURL('github');
  console.log(`Expanded custom code 'github':`, longURL3);

  // Get expiration info
  console.log('\n=== Expiration Info ===\n');
  const expInfo1 = shortener.getExpirationInfo(result4.code);
  console.log('Expiration info (1 hour):', expInfo1);

  const expInfo2 = shortener.getExpirationInfo('promo2024');
  console.log('Expiration info (custom, 1 day):', expInfo2);

  // Set expiration after creation
  console.log('\n=== Setting Expiration ===\n');
  const expResult = shortener.setExpiration(result2.code, 2 * 60 * 60 * 1000); // 2 hours
  console.log('Set expiration:', expResult);

  // Remove expiration
  console.log('\n=== Removing Expiration ===\n');
  const removeResult = shortener.removeExpiration(result2.code);
  console.log('Removed expiration:', removeResult);

  // Analytics
  console.log('\n=== Analytics ===\n');
  shortener.recordClick(result1.code, { referrer: 'twitter', country: 'US', device: 'mobile' });
  shortener.recordClick(result1.code, { referrer: 'facebook', country: 'UK', device: 'desktop' });
  
  const analytics = shortener.getAnalytics(result1.code);
  console.log('Analytics:', analytics);

  // User URLs
  console.log('\n=== User URLs ===\n');
  const userURLs = shortener.getUserURLs('user123');
  console.log('User URLs:', userURLs.map(u => ({
    code: u.code,
    shortURL: u.shortURL,
    isCustom: u.isCustom,
    expiresAt: u.expiresAt,
    isExpired: u.isExpired
  })));

  // Cleanup expired URLs
  console.log('\n=== Cleanup Expired URLs ===\n');
  // Simulate expiration by setting a past date
  shortener.setExpiration(result4.code, null, new Date(Date.now() - 1000));
  const cleanupResult = shortener.cleanupExpiredURLs();
  console.log('Cleanup result:', cleanupResult);

  // Try to expand expired URL (should fail)
  console.log('\n=== Testing Expired URL ===\n');
  try {
    await shortener.expandURL(result4.code);
  } catch (error) {
    console.log('Expected error for expired URL:', error.message);
  }
}

// Run demonstration if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || 
                     process.argv[1]?.endsWith('url-shortener.js');

if (isMainModule) {
  demonstrateURLShortener();
}

export {
  URLShortener,
  DistributedURLShortener
};
