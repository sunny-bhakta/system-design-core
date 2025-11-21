/**
 * Capacity Estimation
 * Demonstrates how to estimate system capacity requirements
 */

class CapacityEstimator {
  /**
   * Estimate traffic capacity
   */
  static estimateTraffic(dailyActiveUsers, requestsPerUserPerDay, peakMultiplier = 2) {
    const totalRequestsPerDay = dailyActiveUsers * requestsPerUserPerDay;
    const peakRequestsPerDay = totalRequestsPerDay * peakMultiplier;
    const peakQPS = peakRequestsPerDay / (24 * 3600);
    
    return {
      dailyActiveUsers,
      requestsPerUserPerDay,
      totalRequestsPerDay,
      peakRequestsPerDay,
      peakQPS: Math.ceil(peakQPS),
      averageQPS: Math.ceil(totalRequestsPerDay / (24 * 3600))
    };
  }

  /**
   * Estimate storage capacity
   */
  static estimateStorage(numUsers, dataPerUserMB, retentionYears, replicationFactor = 3) {
    const totalStorageGB = (numUsers * dataPerUserMB) / 1024;
    const storageWithRetention = totalStorageGB * retentionYears;
    const storageWithReplication = storageWithRetention * replicationFactor;
    
    return {
      numUsers,
      dataPerUserMB,
      totalStorageGB: totalStorageGB.toFixed(2),
      retentionYears,
      storageWithRetentionGB: storageWithRetention.toFixed(2),
      replicationFactor,
      totalStorageWithReplicationGB: storageWithReplication.toFixed(2),
      totalStorageWithReplicationTB: (storageWithReplication / 1024).toFixed(2)
    };
  }

  /**
   * Estimate bandwidth
   */
  static estimateBandwidth(requestsPerSecond, avgResponseSizeKB) {
    const bandwidthMBps = (requestsPerSecond * avgResponseSizeKB) / 1024;
    const bandwidthGbps = bandwidthMBps / 1024;
    
    return {
      requestsPerSecond,
      avgResponseSizeKB,
      bandwidthMBps: bandwidthMBps.toFixed(2),
      bandwidthGbps: bandwidthGbps.toFixed(4),
      bandwidthPerDayGB: (bandwidthMBps * 86400 / 1024).toFixed(2)
    };
  }

  /**
   * Estimate cache requirements
   */
  static estimateCache(requestsPerSecond, cacheHitRate, avgObjectSizeKB, ttlSeconds = 3600) {
    const cacheRequestsPerSecond = requestsPerSecond * cacheHitRate;
    const objectsInCache = cacheRequestsPerSecond * ttlSeconds;
    const cacheSizeGB = (objectsInCache * avgObjectSizeKB) / (1024 * 1024);
    
    return {
      requestsPerSecond,
      cacheHitRate: (cacheHitRate * 100).toFixed(2) + '%',
      avgObjectSizeKB,
      ttlSeconds,
      objectsInCache: Math.ceil(objectsInCache),
      cacheSizeGB: cacheSizeGB.toFixed(2),
      cacheSizeMB: (cacheSizeGB * 1024).toFixed(2)
    };
  }

  /**
   * Estimate database connections
   */
  static estimateDatabaseConnections(peakQPS, avgQueryTimeMs, connectionPoolSize = 10) {
    const concurrentQueries = (peakQPS * avgQueryTimeMs) / 1000;
    const requiredConnections = Math.ceil(concurrentQueries);
    const recommendedPoolSize = Math.max(requiredConnections * 1.5, connectionPoolSize);
    
    return {
      peakQPS,
      avgQueryTimeMs,
      concurrentQueries: concurrentQueries.toFixed(2),
      requiredConnections,
      recommendedPoolSize: Math.ceil(recommendedPoolSize)
    };
  }

  /**
   * Comprehensive capacity estimation
   */
  static comprehensiveEstimation(config) {
    const traffic = this.estimateTraffic(
      config.dailyActiveUsers,
      config.requestsPerUserPerDay,
      config.peakMultiplier
    );
    
    const storage = this.estimateStorage(
      config.numUsers,
      config.dataPerUserMB,
      config.retentionYears,
      config.replicationFactor
    );
    
    const bandwidth = this.estimateBandwidth(
      traffic.peakQPS,
      config.avgResponseSizeKB
    );
    
    const cache = this.estimateCache(
      traffic.peakQPS,
      config.cacheHitRate,
      config.avgObjectSizeKB,
      config.cacheTTLSeconds
    );
    
    const database = this.estimateDatabaseConnections(
      traffic.peakQPS,
      config.avgQueryTimeMs,
      config.connectionPoolSize
    );
    
    return {
      traffic,
      storage,
      bandwidth,
      cache,
      database,
      summary: {
        peakQPS: traffic.peakQPS,
        totalStorageTB: storage.totalStorageWithReplicationTB,
        bandwidthGbps: bandwidth.bandwidthGbps,
        cacheSizeGB: cache.cacheSizeGB,
        dbConnections: database.recommendedPoolSize
      }
    };
  }
}

// Example usage
const config = {
  dailyActiveUsers: 1000000,
  requestsPerUserPerDay: 10,
  peakMultiplier: 2,
  numUsers: 1000000,
  dataPerUserMB: 1,
  retentionYears: 5,
  replicationFactor: 3,
  avgResponseSizeKB: 50,
  cacheHitRate: 0.8,
  avgObjectSizeKB: 10,
  cacheTTLSeconds: 3600,
  avgQueryTimeMs: 50,
  connectionPoolSize: 10
};

console.log('=== Capacity Estimation ===\n');
const estimation = CapacityEstimator.comprehensiveEstimation(config);
console.log(JSON.stringify(estimation, null, 2));

module.exports = CapacityEstimator;

