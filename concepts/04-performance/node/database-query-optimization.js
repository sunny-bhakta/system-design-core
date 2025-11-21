/**
 * Database Query Optimization
 * Demonstrates techniques to optimize database queries for better performance
 */

/**
 * Query Optimizer
 */
class QueryOptimizer {
  constructor() {
    this.indexes = new Map();
    this.queryCache = new Map();
    this.queryStats = new Map();
  }

  /**
   * Create index
   */
  createIndex(name, table, columns) {
    this.indexes.set(`${table}.${name}`, {
      name,
      table,
      columns: Array.isArray(columns) ? columns : [columns],
      type: 'btree'
    });
  }

  /**
   * Optimize query
   */
  optimizeQuery(query) {
    const optimized = { ...query };
    
    // Check for index usage
    const index = this.findApplicableIndex(query);
    if (index) {
      optimized.useIndex = index.name;
      optimized.optimized = true;
    }

    // Check for query cache
    const cacheKey = this.getCacheKey(query);
    if (this.queryCache.has(cacheKey)) {
      optimized.useCache = true;
    }

    // Add LIMIT if missing and not needed
    if (!query.limit && query.select) {
      optimized.limit = 100; // Default limit
    }

    return optimized;
  }

  /**
   * Find applicable index
   */
  findApplicableIndex(query) {
    if (!query.where) return null;

    for (const [key, index] of this.indexes.entries()) {
      if (key.startsWith(`${query.from}.`)) {
        // Check if WHERE clause uses indexed columns
        const whereColumns = Object.keys(query.where);
        if (whereColumns.some(col => index.columns.includes(col))) {
          return index;
        }
      }
    }

    return null;
  }

  /**
   * Get cache key
   */
  getCacheKey(query) {
    return JSON.stringify({
      select: query.select,
      from: query.from,
      where: query.where,
      orderBy: query.orderBy
    });
  }

  /**
   * Cache query result
   */
  cacheQuery(query, result, ttl = 3600000) {
    const key = this.getCacheKey(query);
    this.queryCache.set(key, {
      result,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttl
    });
  }

  /**
   * Get cached result
   */
  getCachedResult(query) {
    const key = this.getCacheKey(query);
    const cached = this.queryCache.get(key);
    
    if (cached && Date.now() < cached.expiresAt) {
      return cached.result;
    }

    if (cached) {
      this.queryCache.delete(key);
    }

    return null;
  }

  /**
   * Record query statistics
   */
  recordQuery(query, duration, usedIndex) {
    const key = `${query.from}_${query.select?.join('_') || 'all'}`;
    const stats = this.queryStats.get(key) || {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      indexUsage: 0
    };

    stats.count++;
    stats.totalDuration += duration;
    stats.avgDuration = stats.totalDuration / stats.count;
    stats.minDuration = Math.min(stats.minDuration, duration);
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    if (usedIndex) {
      stats.indexUsage++;
    }

    this.queryStats.set(key, stats);
  }

  /**
   * Get slow queries
   */
  getSlowQueries(threshold = 1000) {
    const slow = [];
    
    for (const [key, stats] of this.queryStats.entries()) {
      if (stats.avgDuration > threshold) {
        slow.push({
          query: key,
          ...stats
        });
      }
    }

    return slow.sort((a, b) => b.avgDuration - a.avgDuration);
  }
}

/**
 * Query Builder with Optimization
 */
class OptimizedQueryBuilder {
  constructor(optimizer) {
    this.optimizer = optimizer;
    this.query = {};
  }

  select(columns) {
    this.query.select = Array.isArray(columns) ? columns : [columns];
    return this;
  }

  from(table) {
    this.query.from = table;
    return this;
  }

  where(conditions) {
    this.query.where = conditions;
    return this;
  }

  orderBy(column, direction = 'ASC') {
    this.query.orderBy = { column, direction };
    return this;
  }

  limit(count) {
    this.query.limit = count;
    return this;
  }

  /**
   * Build and optimize query
   */
  build() {
    return this.optimizer.optimizeQuery(this.query);
  }

  /**
   * Execute query
   */
  async execute(executeFunction) {
    // Check cache first
    const cached = this.optimizer.getCachedResult(this.query);
    if (cached) {
      return cached;
    }

    // Optimize query
    const optimized = this.build();
    const startTime = Date.now();

    // Execute
    const result = await executeFunction(optimized);
    const duration = Date.now() - startTime;

    // Cache result
    this.optimizer.cacheQuery(this.query, result);

    // Record statistics
    this.optimizer.recordQuery(this.query, duration, optimized.useIndex);

    return result;
  }
}

/**
 * Prepared Statements
 */
class PreparedStatementManager {
  constructor() {
    this.statements = new Map();
  }

  /**
   * Prepare statement
   */
  prepare(name, query, params) {
    this.statements.set(name, {
      query,
      params: params || [],
      executionCount: 0,
      totalTime: 0
    });
  }

  /**
   * Execute prepared statement
   */
  async execute(name, values, executeFunction) {
    const statement = this.statements.get(name);
    if (!statement) {
      throw new Error(`Prepared statement ${name} not found`);
    }

    const startTime = Date.now();
    
    // Replace parameters
    let query = statement.query;
    statement.params.forEach((param, index) => {
      const value = values[index];
      query = query.replace(`:${param}`, this.escapeValue(value));
    });

    const result = await executeFunction(query);
    const duration = Date.now() - startTime;

    statement.executionCount++;
    statement.totalTime += duration;

    return result;
  }

  escapeValue(value) {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    return String(value);
  }

  /**
   * Get statement statistics
   */
  getStats() {
    return Array.from(this.statements.entries()).map(([name, stmt]) => ({
      name,
      executionCount: stmt.executionCount,
      avgTime: stmt.executionCount > 0
        ? Math.round(stmt.totalTime / stmt.executionCount)
        : 0
    }));
  }
}

/**
 * Connection Pooling for Queries
 */
class QueryConnectionPool {
  constructor(config) {
    this.minSize = config.minSize || 2;
    this.maxSize = config.maxSize || 10;
    this.pool = [];
    this.active = new Set();
  }

  async initialize() {
    for (let i = 0; i < this.minSize; i++) {
      await this.createConnection();
    }
  }

  async createConnection() {
    const connection = {
      id: `conn-${Date.now()}-${Math.random()}`,
      createdAt: Date.now()
    };
    
    await new Promise(resolve => setTimeout(resolve, 10));
    this.pool.push(connection);
    return connection;
  }

  async acquire() {
    let connection = this.pool.find(conn => !this.active.has(conn.id));
    
    if (!connection && this.pool.length < this.maxSize) {
      connection = await this.createConnection();
    }
    
    if (connection) {
      this.active.add(connection.id);
      return connection;
    }
    
    // Wait for available connection
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.acquire()), 10);
    });
  }

  release(connection) {
    this.active.delete(connection.id);
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      active: this.active.size,
      idle: this.pool.length - this.active.size
    };
  }
}

/**
 * Query Execution with Optimization
 */
class OptimizedQueryExecutor {
  constructor() {
    this.optimizer = new QueryOptimizer();
    this.preparedStatements = new PreparedStatementManager();
    this.connectionPool = new QueryConnectionPool({ minSize: 2, maxSize: 10 });
  }

  async initialize() {
    await this.connectionPool.initialize();
  }

  /**
   * Execute query with all optimizations
   */
  async executeQuery(query, executeFunction) {
    // Get connection from pool
    const connection = await this.connectionPool.acquire();

    try {
      // Check cache
      const cached = this.optimizer.getCachedResult(query);
      if (cached) {
        return cached;
      }

      // Optimize query
      const optimized = this.optimizer.optimizeQuery(query);
      const startTime = Date.now();

      // Execute
      const result = await executeFunction(optimized, connection);
      const duration = Date.now() - startTime;

      // Cache result
      this.optimizer.cacheQuery(query, result);

      // Record statistics
      this.optimizer.recordQuery(query, duration, optimized.useIndex);

      return result;
    } finally {
      this.connectionPool.release(connection);
    }
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    return {
      optimizer: {
        indexes: this.optimizer.indexes.size,
        cachedQueries: this.optimizer.queryCache.size,
        slowQueries: this.optimizer.getSlowQueries(100)
      },
      preparedStatements: this.preparedStatements.getStats(),
      connectionPool: this.connectionPool.getStats()
    };
  }
}

// Example usage
async function demonstrateDatabaseQueryOptimization() {
  console.log('=== Database Query Optimization ===\n');

  // Query Optimizer
  console.log('=== Query Optimizer ===\n');
  const optimizer = new QueryOptimizer();
  
  // Create indexes
  optimizer.createIndex('idx_user_email', 'users', 'email');
  optimizer.createIndex('idx_user_name', 'users', ['name', 'email']);
  
  // Build query
  const query = {
    select: ['id', 'name', 'email'],
    from: 'users',
    where: { email: 'test@example.com' },
    limit: 10
  };
  
  const optimized = optimizer.optimizeQuery(query);
  console.log('Original Query:', query);
  console.log('Optimized Query:', optimized);
  
  // Cache query result
  optimizer.cacheQuery(query, [{ id: 1, name: 'John', email: 'test@example.com' }]);
  const cached = optimizer.getCachedResult(query);
  console.log('Cached Result:', cached);

  // Query Builder
  console.log('\n=== Query Builder ===\n');
  const builder = new OptimizedQueryBuilder(optimizer);
  
  const result = await builder
    .select(['id', 'name'])
    .from('users')
    .where({ email: 'test@example.com' })
    .limit(10)
    .execute(async (query) => {
      // Simulate query execution
      await new Promise(resolve => setTimeout(resolve, 50));
      return [{ id: 1, name: 'John' }];
    });
  
  console.log('Query Result:', result);

  // Prepared Statements
  console.log('\n=== Prepared Statements ===\n');
  const preparedManager = new PreparedStatementManager();
  
  preparedManager.prepare('getUser', 'SELECT * FROM users WHERE id = :id', ['id']);
  
  await preparedManager.execute('getUser', [1], async (query) => {
    await new Promise(resolve => setTimeout(resolve, 10));
    return [{ id: 1, name: 'John' }];
  });
  
  console.log('Prepared Statement Stats:', preparedManager.getStats());

  // Optimized Executor
  console.log('\n=== Optimized Query Executor ===\n');
  const executor = new OptimizedQueryExecutor();
  await executor.initialize();
  
  const queryResult = await executor.executeQuery(query, async (query, connection) => {
    await new Promise(resolve => setTimeout(resolve, 20));
    return [{ id: 1, name: 'John', email: 'test@example.com' }];
  });
  
  console.log('Executed Query Result:', queryResult);
  console.log('Optimization Stats:', executor.getStats());
}

if (require.main === module) {
  demonstrateDatabaseQueryOptimization();
}

module.exports = {
  QueryOptimizer,
  OptimizedQueryBuilder,
  PreparedStatementManager,
  QueryConnectionPool,
  OptimizedQueryExecutor
};

