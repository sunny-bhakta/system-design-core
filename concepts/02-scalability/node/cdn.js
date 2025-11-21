/**
 * CDN (Content Delivery Network) Implementation
 * Demonstrates edge caching, geographic distribution, and content optimization
 */

/**
 * Edge Location
 */
class EdgeLocation {
  constructor(name, location, config = {}) {
    this.name = name;
    this.location = location; // { lat, lon, city, country }
    this.cache = new Map();
    this.cacheSize = 0;
    this.maxCacheSize = config.maxCacheSize || 1000; // MB
    this.hitCount = 0;
    this.missCount = 0;
    this.requests = 0;
    this.origin = config.origin || null;
  }

  /**
   * Get content from cache or origin
   */
  async getContent(key) {
    this.requests++;

    // Check cache
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      this.hitCount++;
      return {
        content: cached.content,
        source: 'cache',
        edge: this.name,
        cached: true
      };
    }

    // Cache miss - fetch from origin
    this.missCount++;
    const content = await this.fetchFromOrigin(key);
    
    if (content) {
      this.cacheContent(key, content);
    }

    return {
      content,
      source: 'origin',
      edge: this.name,
      cached: false
    };
  }

  /**
   * Fetch from origin
   */
  async fetchFromOrigin(key) {
    if (!this.origin) {
      return null;
    }

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate origin response
    return {
      key,
      data: `Content for ${key}`,
      size: 1024, // bytes
      contentType: 'text/html',
      timestamp: Date.now()
    };
  }

  /**
   * Cache content
   */
  cacheContent(key, content, ttl = 3600000) {
    // Check cache size
    if (this.cacheSize >= this.maxCacheSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      content,
      expiresAt: Date.now() + ttl,
      lastAccessed: Date.now(),
      size: content.size || 0
    });

    this.cacheSize += content.size || 0;
  }

  /**
   * Evict least recently used
   */
  evictLRU() {
    let lruKey = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      const entry = this.cache.get(lruKey);
      this.cacheSize -= entry.size;
      this.cache.delete(lruKey);
    }
  }

  /**
   * Invalidate cache
   */
  invalidate(key) {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      this.cacheSize -= entry.size;
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Purge all cache
   */
  purge() {
    this.cache.clear();
    this.cacheSize = 0;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      name: this.name,
      location: this.location,
      requests: this.requests,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: this.requests > 0
        ? ((this.hitCount / this.requests) * 100).toFixed(2) + '%'
        : '0%',
      cacheSize: this.cacheSize,
      cacheEntries: this.cache.size
    };
  }
}

/**
 * CDN Network
 */
class CDNNetwork {
  constructor(origin) {
    this.origin = origin;
    this.edgeLocations = [];
    this.routingStrategy = 'nearest'; // 'nearest', 'round-robin', 'least-load'
  }

  /**
   * Add edge location
   */
  addEdgeLocation(edgeLocation) {
    edgeLocation.origin = this.origin;
    this.edgeLocations.push(edgeLocation);
    return edgeLocation;
  }

  /**
   * Get content from nearest edge
   */
  async getContent(key, userLocation) {
    const edge = this.selectEdgeLocation(userLocation);
    
    if (!edge) {
      // Fallback to origin
      return await this.getFromOrigin(key);
    }

    return await edge.getContent(key);
  }

  /**
   * Select edge location
   */
  selectEdgeLocation(userLocation) {
    if (this.edgeLocations.length === 0) {
      return null;
    }

    switch (this.routingStrategy) {
      case 'nearest':
        return this.findNearestEdge(userLocation);
      case 'round-robin':
        return this.edgeLocations[Math.floor(Math.random() * this.edgeLocations.length)];
      case 'least-load':
        return this.findLeastLoadedEdge();
      default:
        return this.edgeLocations[0];
    }
  }

  /**
   * Find nearest edge location
   */
  findNearestEdge(userLocation) {
    let nearest = null;
    let minDistance = Infinity;

    for (const edge of this.edgeLocations) {
      const distance = this.calculateDistance(userLocation, edge.location);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = edge;
      }
    }

    return nearest;
  }

  /**
   * Calculate distance between two locations
   */
  calculateDistance(loc1, loc2) {
    // Simplified distance calculation (Haversine would be more accurate)
    const latDiff = loc1.lat - loc2.lat;
    const lonDiff = loc1.lon - loc2.lon;
    return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
  }

  /**
   * Find least loaded edge
   */
  findLeastLoadedEdge() {
    return this.edgeLocations.reduce((least, current) => {
      const leastLoad = least.requests - least.hitCount;
      const currentLoad = current.requests - current.hitCount;
      return currentLoad < leastLoad ? current : least;
    });
  }

  /**
   * Get from origin
   */
  async getFromOrigin(key) {
    // Simulate origin fetch
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      content: { key, data: `Origin content for ${key}` },
      source: 'origin',
      cached: false
    };
  }

  /**
   * Invalidate cache across all edges
   */
  invalidateCache(key) {
    let invalidated = 0;
    for (const edge of this.edgeLocations) {
      if (edge.invalidate(key)) {
        invalidated++;
      }
    }
    return invalidated;
  }

  /**
   * Purge all caches
   */
  purgeAll() {
    for (const edge of this.edgeLocations) {
      edge.purge();
    }
  }

  /**
   * Get network statistics
   */
  getStats() {
    return {
      totalEdges: this.edgeLocations.length,
      totalRequests: this.edgeLocations.reduce((sum, e) => sum + e.requests, 0),
      totalHits: this.edgeLocations.reduce((sum, e) => sum + e.hitCount, 0),
      totalMisses: this.edgeLocations.reduce((sum, e) => sum + e.missCount, 0),
      overallHitRate: this.edgeLocations.reduce((sum, e) => sum + e.requests, 0) > 0
        ? ((this.edgeLocations.reduce((sum, e) => sum + e.hitCount, 0) / 
            this.edgeLocations.reduce((sum, e) => sum + e.requests, 0)) * 100).toFixed(2) + '%'
        : '0%',
      edges: this.edgeLocations.map(e => e.getStats())
    };
  }
}

/**
 * Content Optimizer
 */
class ContentOptimizer {
  constructor() {
    this.optimizations = new Map();
  }

  /**
   * Optimize image
   */
  optimizeImage(imageData, format = 'webp', quality = 80) {
    // Simulate image optimization
    const optimized = {
      originalSize: imageData.length,
      optimizedSize: Math.round(imageData.length * (quality / 100)),
      format,
      quality,
      saved: imageData.length - Math.round(imageData.length * (quality / 100))
    };

    return optimized;
  }

  /**
   * Minify CSS
   */
  minifyCSS(css) {
    // Simulate CSS minification
    return {
      originalSize: css.length,
      minifiedSize: Math.round(css.length * 0.7),
      saved: Math.round(css.length * 0.3)
    };
  }

  /**
   * Minify JavaScript
   */
  minifyJS(js) {
    // Simulate JS minification
    return {
      originalSize: js.length,
      minifiedSize: Math.round(js.length * 0.6),
      saved: Math.round(js.length * 0.4)
    };
  }

  /**
   * Compress content
   */
  compress(content, algorithm = 'gzip') {
    // Simulate compression
    return {
      originalSize: content.length,
      compressedSize: Math.round(content.length * 0.3),
      algorithm,
      ratio: (content.length / Math.round(content.length * 0.3)).toFixed(2)
    };
  }
}

/**
 * CDN with Optimization
 */
class OptimizedCDN extends CDNNetwork {
  constructor(origin) {
    super(origin);
    this.optimizer = new ContentOptimizer();
    this.optimizationEnabled = true;
  }

  /**
   * Get optimized content
   */
  async getOptimizedContent(key, userLocation, options = {}) {
    const result = await this.getContent(key, userLocation);

    if (this.optimizationEnabled && result.content) {
      // Apply optimizations based on content type
      if (options.optimizeImage) {
        result.optimization = this.optimizer.optimizeImage(
          result.content.data,
          options.imageFormat,
          options.imageQuality
        );
      }

      if (options.minifyCSS) {
        result.optimization = this.optimizer.minifyCSS(result.content.data);
      }

      if (options.minifyJS) {
        result.optimization = this.optimizer.minifyJS(result.content.data);
      }

      if (options.compress) {
        result.compression = this.optimizer.compress(result.content.data);
      }
    }

    return result;
  }
}

/**
 * CDN Cache Strategy
 */
class CDNCacheStrategy {
  constructor() {
    this.strategies = {
      'no-cache': { maxAge: 0 },
      'cache-control': { maxAge: 3600 },
      'immutable': { maxAge: 31536000 }, // 1 year
      'stale-while-revalidate': { maxAge: 3600, staleWhileRevalidate: 86400 }
    };
  }

  /**
   * Get cache headers
   */
  getCacheHeaders(strategy, customMaxAge = null) {
    const config = this.strategies[strategy] || this.strategies['cache-control'];
    const maxAge = customMaxAge || config.maxAge;

    return {
      'Cache-Control': `max-age=${maxAge}${config.staleWhileRevalidate ? `, stale-while-revalidate=${config.staleWhileRevalidate}` : ''}`,
      'ETag': `"${Date.now()}"`,
      'Last-Modified': new Date().toUTCString()
    };
  }

  /**
   * Check if content is fresh
   */
  isFresh(cachedEntry, maxAge) {
    if (!cachedEntry) return false;
    return Date.now() - cachedEntry.lastAccessed < maxAge * 1000;
  }
}

// Example usage
async function demonstrateCDN() {
  console.log('=== CDN (Content Delivery Network) ===\n');

  // Create CDN network
  const cdn = new CDNNetwork({ url: 'https://origin.example.com' });

  // Add edge locations
  console.log('=== Adding Edge Locations ===\n');
  const edge1 = cdn.addEdgeLocation(new EdgeLocation('us-east', {
    lat: 40.7128,
    lon: -74.0060,
    city: 'New York',
    country: 'USA'
  }, { maxCacheSize: 5000 }));

  const edge2 = cdn.addEdgeLocation(new EdgeLocation('eu-west', {
    lat: 51.5074,
    lon: -0.1278,
    city: 'London',
    country: 'UK'
  }, { maxCacheSize: 5000 }));

  const edge3 = cdn.addEdgeLocation(new EdgeLocation('asia-pacific', {
    lat: 35.6762,
    lon: 139.6503,
    city: 'Tokyo',
    country: 'Japan'
  }, { maxCacheSize: 5000 }));

  // Get content from different locations
  console.log('=== Content Delivery ===\n');
  
  // User in New York
  const userNY = { lat: 40.7580, lon: -73.9855 };
  const content1 = await cdn.getContent('page1.html', userNY);
  console.log('Content for NY user:', {
    source: content1.source,
    edge: content1.edge,
    cached: content1.cached
  });

  // User in London
  const userLondon = { lat: 51.5074, lon: -0.1278 };
  const content2 = await cdn.getContent('page1.html', userLondon);
  console.log('Content for London user:', {
    source: content2.source,
    edge: content2.edge,
    cached: content2.cached
  });

  // Second request (should be cached)
  const content3 = await cdn.getContent('page1.html', userNY);
  console.log('Second request (cached):', {
    source: content3.source,
    edge: content3.edge,
    cached: content3.cached
  });

  // CDN Statistics
  console.log('\n=== CDN Statistics ===\n');
  console.log(cdn.getStats());

  // Content Optimization
  console.log('\n=== Content Optimization ===\n');
  const optimizedCDN = new OptimizedCDN({ url: 'https://origin.example.com' });
  optimizedCDN.addEdgeLocation(edge1);

  const optimizedContent = await optimizedCDN.getOptimizedContent(
    'image.jpg',
    userNY,
    {
      optimizeImage: true,
      imageFormat: 'webp',
      imageQuality: 80
    }
  );
  console.log('Optimized Content:', optimizedContent);

  // Cache Strategy
  console.log('\n=== Cache Strategy ===\n');
  const cacheStrategy = new CDNCacheStrategy();
  const headers = cacheStrategy.getCacheHeaders('cache-control', 3600);
  console.log('Cache Headers:', headers);

  // Cache Invalidation
  console.log('\n=== Cache Invalidation ===\n');
  const invalidated = cdn.invalidateCache('page1.html');
  console.log(`Invalidated cache in ${invalidated} edge locations`);
}

if (require.main === module) {
  demonstrateCDN();
}

module.exports = {
  EdgeLocation,
  CDNNetwork,
  ContentOptimizer,
  OptimizedCDN,
  CDNCacheStrategy
};

