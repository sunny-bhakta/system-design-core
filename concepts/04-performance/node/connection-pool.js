/**
 * Connection Pooling Implementation
 * Demonstrates database connection pooling
 */

class ConnectionPool {
  constructor(config) {
    this.minSize = config.minSize || 2;
    this.maxSize = config.maxSize || 10;
    this.idleTimeout = config.idleTimeout || 30000; // 30 seconds
    this.maxLifetime = config.maxLifetime || 3600000; // 1 hour
    
    this.pool = [];
    this.active = new Set();
    this.waiting = [];
    this.stats = {
      created: 0,
      acquired: 0,
      released: 0,
      destroyed: 0,
      timeout: 0
    };
    
    // Initialize minimum connections
    this.initialize();
    
    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Initialize pool with minimum connections
   */
  async initialize() {
    for (let i = 0; i < this.minSize; i++) {
      await this.createConnection();
    }
  }

  /**
   * Create a new connection
   */
  async createConnection() {
    const connection = {
      id: `conn-${Date.now()}-${Math.random()}`,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      inUse: false
    };
    
    // Simulate connection creation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.pool.push(connection);
    this.stats.created++;
    
    return connection;
  }

  /**
   * Acquire connection from pool
   */
  async acquire(timeout = 5000) {
    return new Promise(async (resolve, reject) => {
      const startTime = Date.now();
      
      const tryAcquire = async () => {
        // Find idle connection
        let connection = this.pool.find(conn => !conn.inUse);
        
        // Create new connection if pool not full
        if (!connection && this.pool.length < this.maxSize) {
          connection = await this.createConnection();
        }
        
        if (connection) {
          connection.inUse = true;
          connection.lastUsed = Date.now();
          this.active.add(connection.id);
          this.stats.acquired++;
          
          resolve(connection);
        } else if (Date.now() - startTime < timeout) {
          // Wait and retry
          this.waiting.push({ resolve, reject, startTime, timeout });
        } else {
          this.stats.timeout++;
          reject(new Error('Connection acquisition timeout'));
        }
      };
      
      await tryAcquire();
    });
  }

  /**
   * Release connection back to pool
   */
  release(connection) {
    if (!this.pool.includes(connection)) {
      return;
    }
    
    connection.inUse = false;
    connection.lastUsed = Date.now();
    this.active.delete(connection.id);
    this.stats.released++;
    
    // Notify waiting requests
    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift();
      this.acquire(waiter.timeout)
        .then(waiter.resolve)
        .catch(waiter.reject);
    }
  }

  /**
   * Destroy connection
   */
  destroy(connection) {
    const index = this.pool.indexOf(connection);
    if (index > -1) {
      this.pool.splice(index, 1);
      this.active.delete(connection.id);
      this.stats.destroyed++;
    }
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, 10000); // Every 10 seconds
  }

  /**
   * Cleanup idle and expired connections
   */
  cleanup() {
    const now = Date.now();
    const toDestroy = [];
    
    for (const connection of this.pool) {
      if (connection.inUse) continue;
      
      const idleTime = now - connection.lastUsed;
      const lifetime = now - connection.createdAt;
      
      // Destroy if idle too long (but keep minimum)
      if (idleTime > this.idleTimeout && this.pool.length > this.minSize) {
        toDestroy.push(connection);
      }
      
      // Destroy if lifetime exceeded
      if (lifetime > this.maxLifetime) {
        toDestroy.push(connection);
      }
    }
    
    toDestroy.forEach(conn => this.destroy(conn));
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      activeConnections: this.active.size,
      idleConnections: this.pool.length - this.active.size,
      waitingRequests: this.waiting.length,
      minSize: this.minSize,
      maxSize: this.maxSize
    };
  }

  /**
   * Close all connections
   */
  async close() {
    // Wait for active connections
    while (this.active.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Destroy all connections
    this.pool.forEach(conn => this.destroy(conn));
    this.pool = [];
  }
}

// Example usage
async function demonstrateConnectionPool() {
  console.log('=== Connection Pooling Demonstration ===\n');

  const pool = new ConnectionPool({
    minSize: 2,
    maxSize: 5,
    idleTimeout: 10000,
    maxLifetime: 60000
  });

  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 200));

  console.log('Initial stats:', pool.getStats());

  // Acquire connections
  const conn1 = await pool.acquire();
  const conn2 = await pool.acquire();
  console.log('\nAcquired 2 connections');
  console.log('Stats:', pool.getStats());

  // Release one
  pool.release(conn1);
  console.log('\nReleased 1 connection');
  console.log('Stats:', pool.getStats());

  // Acquire more (should create new)
  const conn3 = await pool.acquire();
  const conn4 = await pool.acquire();
  const conn5 = await pool.acquire();
  console.log('\nAcquired 3 more connections (pool at max)');
  console.log('Stats:', pool.getStats());

  // Release all
  pool.release(conn2);
  pool.release(conn3);
  pool.release(conn4);
  pool.release(conn5);
  console.log('\nReleased all connections');
  console.log('Stats:', pool.getStats());

  // Wait for cleanup
  console.log('\nWaiting for cleanup...');
  await new Promise(resolve => setTimeout(resolve, 12000));
  console.log('Stats after cleanup:', pool.getStats());
}

if (require.main === module) {
  demonstrateConnectionPool();
}

module.exports = ConnectionPool;

