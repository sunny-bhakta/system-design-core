/**
 * Database Scaling Implementation
 * Demonstrates read replicas, write scaling, partitioning, and connection pooling
 */

/**
 * Database Connection
 */
class DatabaseConnection {
  constructor(id, type = 'primary') {
    this.id = id;
    this.type = type; // 'primary', 'replica', 'shard'
    this.healthy = true;
    this.load = 0;
    this.queries = 0;
    this.errors = 0;
  }

  async execute(query, params = []) {
    this.queries++;
    this.load++;

    try {
      // Simulate query execution
      await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
      
      this.load--;
      return { success: true, data: [] };
    } catch (error) {
      this.errors++;
      this.load--;
      throw error;
    }
  }

  async healthCheck() {
    // Simulate health check
    await new Promise(resolve => setTimeout(resolve, 5));
    return this.healthy;
  }

  getStats() {
    return {
      id: this.id,
      type: this.type,
      healthy: this.healthy,
      load: this.load,
      queries: this.queries,
      errors: this.errors
    };
  }
}

/**
 * Read Replica Manager
 */
class ReadReplicaManager {
  constructor(primary, replicas = []) {
    this.primary = primary;
    this.replicas = replicas;
    this.replicaIndex = 0;
    this.replicationLag = new Map();
  }

  /**
   * Get read connection (round-robin)
   */
  getReadConnection() {
    if (this.replicas.length === 0) {
      return this.primary;
    }

    // Round-robin selection
    const replica = this.replicas[this.replicaIndex % this.replicas.length];
    this.replicaIndex++;
    return replica;
  }

  /**
   * Get write connection (always primary)
   */
  getWriteConnection() {
    return this.primary;
  }

  /**
   * Execute read query
   */
  async read(query, params = []) {
    const connection = this.getReadConnection();
    return await connection.execute(query, params);
  }

  /**
   * Execute write query
   */
  async write(query, params = []) {
    const connection = this.getWriteConnection();
    return await connection.execute(query, params);
  }

  /**
   * Add replica
   */
  addReplica(replica) {
    this.replicas.push(replica);
  }

  /**
   * Remove replica
   */
  removeReplica(replicaId) {
    const index = this.replicas.findIndex(r => r.id === replicaId);
    if (index > -1) {
      this.replicas.splice(index, 1);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      primary: this.primary.getStats(),
      replicas: this.replicas.map(r => r.getStats()),
      totalReplicas: this.replicas.length
    };
  }
}

/**
 * Database Sharding
 */
class DatabaseSharding {
  constructor(shards = []) {
    this.shards = shards;
    this.shardKey = 'id'; // Default shard key
  }

  /**
   * Get shard for key
   */
  getShard(key) {
    if (this.shards.length === 0) {
      throw new Error('No shards available');
    }

    const hash = this.hashKey(key);
    return this.shards[hash % this.shards.length];
  }

  /**
   * Hash key to determine shard
   */
  hashKey(key) {
    let hash = 0;
    const keyStr = String(key);
    for (let i = 0; i < keyStr.length; i++) {
      const char = keyStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Execute query on appropriate shard
   */
  async execute(query, params = {}, shardKey = null) {
    if (shardKey === null) {
      // Broadcast to all shards
      const results = await Promise.all(
        this.shards.map(shard => shard.execute(query, params))
      );
      return results.flat();
    }

    const shard = this.getShard(shardKey);
    return await shard.execute(query, params);
  }

  /**
   * Add shard
   */
  addShard(shard) {
    this.shards.push(shard);
  }

  /**
   * Remove shard
   */
  removeShard(shardId) {
    const index = this.shards.findIndex(s => s.id === shardId);
    if (index > -1) {
      this.shards.splice(index, 1);
    }
  }

  /**
   * Get shard statistics
   */
  getStats() {
    return {
      totalShards: this.shards.length,
      shards: this.shards.map(s => s.getStats())
    };
  }
}

/**
 * Connection Pool Manager
 */
class ConnectionPoolManager {
  constructor(config) {
    this.pools = new Map();
    this.maxConnectionsPerPool = config.maxConnectionsPerPool || 10;
    this.minConnectionsPerPool = config.minConnectionsPerPool || 2;
  }

  /**
   * Create pool for database
   */
  createPool(databaseId, connections) {
    const pool = {
      id: databaseId,
      connections: connections || [],
      available: [],
      inUse: new Set(),
      maxSize: this.maxConnectionsPerPool,
      minSize: this.minConnectionsPerPool
    };

    // Initialize available connections
    pool.available = [...pool.connections];

    this.pools.set(databaseId, pool);
    return pool;
  }

  /**
   * Get connection from pool
   */
  async acquire(databaseId) {
    const pool = this.pools.get(databaseId);
    if (!pool) {
      throw new Error(`Pool for database ${databaseId} not found`);
    }

    // Get available connection
    if (pool.available.length > 0) {
      const connection = pool.available.pop();
      pool.inUse.add(connection.id);
      return connection;
    }

    // Create new connection if under max
    if (pool.connections.length < pool.maxSize) {
      const connection = new DatabaseConnection(
        `${databaseId}_conn_${pool.connections.length}`,
        'pooled'
      );
      pool.connections.push(connection);
      pool.inUse.add(connection.id);
      return connection;
    }

    // Wait for available connection
    return new Promise((resolve) => {
      const checkAvailable = () => {
        if (pool.available.length > 0) {
          const connection = pool.available.pop();
          pool.inUse.add(connection.id);
          resolve(connection);
        } else {
          setTimeout(checkAvailable, 10);
        }
      };
      checkAvailable();
    });
  }

  /**
   * Release connection to pool
   */
  release(databaseId, connection) {
    const pool = this.pools.get(databaseId);
    if (!pool) return;

    pool.inUse.delete(connection.id);
    pool.available.push(connection);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return Array.from(this.pools.entries()).map(([id, pool]) => ({
      databaseId: id,
      totalConnections: pool.connections.length,
      available: pool.available.length,
      inUse: pool.inUse.size,
      utilization: pool.connections.length > 0
        ? ((pool.inUse.size / pool.connections.length) * 100).toFixed(2) + '%'
        : '0%'
    }));
  }
}

/**
 * Database Partitioning
 */
class DatabasePartitioning {
  constructor(partitionStrategy = 'range') {
    this.strategy = partitionStrategy;
    this.partitions = new Map();
  }

  /**
   * Create partition
   */
  createPartition(name, range = null) {
    const partition = {
      name,
      range,
      connection: new DatabaseConnection(`partition_${name}`, 'partition'),
      data: new Map()
    };

    this.partitions.set(name, partition);
    return partition;
  }

  /**
   * Get partition for key
   */
  getPartition(key) {
    switch (this.strategy) {
      case 'range':
        return this.getRangePartition(key);
      case 'hash':
        return this.getHashPartition(key);
      case 'list':
        return this.getListPartition(key);
      default:
        return this.getHashPartition(key);
    }
  }

  /**
   * Range partitioning
   */
  getRangePartition(key) {
    const keyNum = Number(key);
    
    for (const [name, partition] of this.partitions.entries()) {
      if (partition.range) {
        const [min, max] = partition.range;
        if (keyNum >= min && keyNum < max) {
          return partition;
        }
      }
    }

    // Default to first partition
    return Array.from(this.partitions.values())[0];
  }

  /**
   * Hash partitioning
   */
  getHashPartition(key) {
    const hash = this.hashKey(String(key));
    const partitionNames = Array.from(this.partitions.keys());
    const index = hash % partitionNames.length;
    return this.partitions.get(partitionNames[index]);
  }

  /**
   * List partitioning
   */
  getListPartition(key) {
    // Simple list partitioning based on key prefix
    for (const [name, partition] of this.partitions.entries()) {
      if (partition.range && partition.range.includes(key)) {
        return partition;
      }
    }
    return Array.from(this.partitions.values())[0];
  }

  hashKey(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Insert data
   */
  async insert(key, value) {
    const partition = this.getPartition(key);
    partition.data.set(key, value);
    return await partition.connection.execute('INSERT', { key, value });
  }

  /**
   * Query data
   */
  async query(key) {
    const partition = this.getPartition(key);
    const value = partition.data.get(key);
    return await partition.connection.execute('SELECT', { key, value });
  }

  /**
   * Get partition statistics
   */
  getStats() {
    return Array.from(this.partitions.entries()).map(([name, partition]) => ({
      name,
      dataSize: partition.data.size,
      connection: partition.connection.getStats()
    }));
  }
}

/**
 * Database Load Balancer
 */
class DatabaseLoadBalancer {
  constructor(databases, algorithm = 'round-robin') {
    this.databases = databases;
    this.algorithm = algorithm;
    this.currentIndex = 0;
    this.stats = new Map();
    
    databases.forEach(db => {
      this.stats.set(db.id, {
        requests: 0,
        active: 0,
        totalTime: 0
      });
    });
  }

  /**
   * Select database
   */
  selectDatabase() {
    switch (this.algorithm) {
      case 'round-robin':
        const db = this.databases[this.currentIndex % this.databases.length];
        this.currentIndex++;
        return db;

      case 'least-connections':
        return this.databases.reduce((least, current) => {
          const leastStats = this.stats.get(least.id);
          const currentStats = this.stats.get(current.id);
          return leastStats.active < currentStats.active ? least : current;
        });

      case 'weighted':
        // Simple weighted round-robin
        return this.databases[this.currentIndex++ % this.databases.length];

      default:
        return this.databases[0];
    }
  }

  /**
   * Execute query with load balancing
   */
  async execute(query, params = []) {
    const database = this.selectDatabase();
    const stats = this.stats.get(database.id);
    const startTime = Date.now();

    stats.requests++;
    stats.active++;

    try {
      const result = await database.execute(query, params);
      stats.totalTime += Date.now() - startTime;
      return result;
    } catch (error) {
      throw error;
    } finally {
      stats.active--;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return Array.from(this.stats.entries()).map(([id, stats]) => ({
      databaseId: id,
      requests: stats.requests,
      active: stats.active,
      avgTime: stats.requests > 0
        ? Math.round(stats.totalTime / stats.requests)
        : 0
    }));
  }
}

/**
 * Vertical Scaling (Scale Up)
 */
class VerticalScaling {
  constructor(database) {
    this.database = database;
    this.currentResources = {
      cpu: 2,
      memory: 4, // GB
      storage: 100 // GB
    };
  }

  /**
   * Scale up resources
   */
  scaleUp(resources) {
    this.currentResources = {
      ...this.currentResources,
      ...resources
    };
    console.log('Database scaled up:', this.currentResources);
    return this.currentResources;
  }

  /**
   * Scale down resources
   */
  scaleDown(resources) {
    this.currentResources = {
      cpu: Math.max(1, this.currentResources.cpu - (resources.cpu || 0)),
      memory: Math.max(1, this.currentResources.memory - (resources.memory || 0)),
      storage: Math.max(10, this.currentResources.storage - (resources.storage || 0))
    };
    console.log('Database scaled down:', this.currentResources);
    return this.currentResources;
  }

  /**
   * Get current resources
   */
  getResources() {
    return { ...this.currentResources };
  }
}

/**
 * Horizontal Scaling (Scale Out)
 */
class HorizontalScaling {
  constructor() {
    this.databases = [];
  }

  /**
   * Add database node
   */
  addNode(database) {
    this.databases.push(database);
    console.log(`Database node ${database.id} added. Total: ${this.databases.length}`);
    return database;
  }

  /**
   * Remove database node
   */
  removeNode(databaseId) {
    const index = this.databases.findIndex(db => db.id === databaseId);
    if (index > -1) {
      this.databases.splice(index, 1);
      console.log(`Database node ${databaseId} removed. Total: ${this.databases.length}`);
      return true;
    }
    return false;
  }

  /**
   * Get all nodes
   */
  getNodes() {
    return this.databases.map(db => ({
      id: db.id,
      healthy: db.healthy,
      load: db.load
    }));
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalNodes: this.databases.length,
      healthyNodes: this.databases.filter(db => db.healthy).length,
      nodes: this.getNodes()
    };
  }
}

/**
 * Database Scaling Manager
 */
class DatabaseScalingManager {
  constructor() {
    this.readReplicaManager = null;
    this.sharding = null;
    this.connectionPoolManager = new ConnectionPoolManager({
      maxConnectionsPerPool: 10,
      minConnectionsPerPool: 2
    });
    this.partitioning = null;
    this.loadBalancer = null;
  }

  /**
   * Setup read replicas
   */
  setupReadReplicas(primary, replicas) {
    this.readReplicaManager = new ReadReplicaManager(primary, replicas);
    return this.readReplicaManager;
  }

  /**
   * Setup sharding
   */
  setupSharding(shards) {
    this.sharding = new DatabaseSharding(shards);
    return this.sharding;
  }

  /**
   * Setup partitioning
   */
  setupPartitioning(strategy = 'range') {
    this.partitioning = new DatabasePartitioning(strategy);
    return this.partitioning;
  }

  /**
   * Setup load balancing
   */
  setupLoadBalancing(databases, algorithm = 'round-robin') {
    this.loadBalancer = new DatabaseLoadBalancer(databases, algorithm);
    return this.loadBalancer;
  }

  /**
   * Get scaling statistics
   */
  getStats() {
    return {
      readReplicas: this.readReplicaManager?.getStats(),
      sharding: this.sharding?.getStats(),
      partitioning: this.partitioning?.getStats(),
      connectionPools: this.connectionPoolManager.getStats(),
      loadBalancer: this.loadBalancer?.getStats()
    };
  }
}

// Example usage
async function demonstrateDatabaseScaling() {
  console.log('=== Database Scaling ===\n');

  // Read Replicas
  console.log('=== Read Replicas ===\n');
  const primary = new DatabaseConnection('primary', 'primary');
  const replica1 = new DatabaseConnection('replica-1', 'replica');
  const replica2 = new DatabaseConnection('replica-2', 'replica');

  const readReplicaManager = new ReadReplicaManager(primary, [replica1, replica2]);

  // Write to primary
  await readReplicaManager.write('INSERT INTO users VALUES (?, ?)', [1, 'John']);
  console.log('Write executed on primary');

  // Read from replicas
  await readReplicaManager.read('SELECT * FROM users WHERE id = ?', [1]);
  await readReplicaManager.read('SELECT * FROM users WHERE id = ?', [1]);
  console.log('Reads executed on replicas (round-robin)');

  console.log('Read Replica Stats:', readReplicaManager.getStats());

  // Sharding
  console.log('\n=== Database Sharding ===\n');
  const shard1 = new DatabaseConnection('shard-1', 'shard');
  const shard2 = new DatabaseConnection('shard-2', 'shard');
  const shard3 = new DatabaseConnection('shard-3', 'shard');

  const sharding = new DatabaseSharding([shard1, shard2, shard3]);

  // Execute queries on shards
  await sharding.execute('SELECT * FROM users', {}, 'user-123');
  await sharding.execute('SELECT * FROM users', {}, 'user-456');
  console.log('Queries executed on shards');

  console.log('Sharding Stats:', sharding.getStats());

  // Connection Pooling
  console.log('\n=== Connection Pooling ===\n');
  const poolManager = new ConnectionPoolManager({
    maxConnectionsPerPool: 5,
    minConnectionsPerPool: 2
  });

  const connections = [
    new DatabaseConnection('conn-1'),
    new DatabaseConnection('conn-2')
  ];

  poolManager.createPool('db1', connections);

  const conn1 = await poolManager.acquire('db1');
  const conn2 = await poolManager.acquire('db1');
  console.log('Acquired connections from pool');

  poolManager.release('db1', conn1);
  poolManager.release('db1', conn2);

  console.log('Pool Stats:', poolManager.getStats());

  // Partitioning
  console.log('\n=== Database Partitioning ===\n');
  const partitioning = new DatabasePartitioning('range');
  
  partitioning.createPartition('p1', [0, 1000]);
  partitioning.createPartition('p2', [1000, 2000]);
  partitioning.createPartition('p3', [2000, 3000]);

  await partitioning.insert('500', { id: 500, name: 'User 500' });
  await partitioning.insert('1500', { id: 1500, name: 'User 1500' });
  await partitioning.insert('2500', { id: 2500, name: 'User 2500' });

  console.log('Partitioning Stats:', partitioning.getStats());

  // Load Balancing
  console.log('\n=== Database Load Balancing ===\n');
  const db1 = new DatabaseConnection('db1');
  const db2 = new DatabaseConnection('db2');
  const db3 = new DatabaseConnection('db3');

  const loadBalancer = new DatabaseLoadBalancer([db1, db2, db3], 'round-robin');

  for (let i = 0; i < 6; i++) {
    await loadBalancer.execute('SELECT * FROM users', []);
  }

  console.log('Load Balancer Stats:', loadBalancer.getStats());

  // Vertical Scaling
  console.log('\n=== Vertical Scaling ===\n');
  const verticalScaling = new VerticalScaling(primary);
  verticalScaling.scaleUp({ cpu: 4, memory: 8, storage: 200 });
  console.log('Current Resources:', verticalScaling.getResources());

  // Horizontal Scaling
  console.log('\n=== Horizontal Scaling ===\n');
  const horizontalScaling = new HorizontalScaling();
  horizontalScaling.addNode(db1);
  horizontalScaling.addNode(db2);
  horizontalScaling.addNode(db3);
  console.log('Horizontal Scaling Stats:', horizontalScaling.getStats());
}

if (require.main === module) {
  demonstrateDatabaseScaling();
}

module.exports = {
  DatabaseConnection,
  ReadReplicaManager,
  DatabaseSharding,
  ConnectionPoolManager,
  DatabasePartitioning,
  DatabaseLoadBalancer,
  VerticalScaling,
  HorizontalScaling,
  DatabaseScalingManager
};

