/**
 * Database Types Implementation
 * Demonstrates different database types: SQL, NoSQL, and their characteristics
 */

/**
 * SQL Database (Relational)
 */
class SQLDatabase {
  constructor(name) {
    this.name = name;
    this.tables = new Map();
    this.transactions = [];
    this.connections = [];
  }

  /**
   * Create table
   */
  createTable(name, schema) {
    const table = {
      name,
      schema,
      data: [],
      indexes: new Map()
    };

    this.tables.set(name, table);
    return table;
  }

  /**
   * Create index
   */
  createIndex(tableName, columnName) {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    const index = {
      column: columnName,
      values: new Map()
    };

    // Build index from existing data
    table.data.forEach((row, i) => {
      const value = row[columnName];
      if (!index.values.has(value)) {
        index.values.set(value, []);
      }
      index.values.get(value).push(i);
    });

    table.indexes.set(columnName, index);
    return index;
  }

  /**
   * Insert data
   */
  insert(tableName, data) {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    // Validate against schema
    this.validateData(table.schema, data);

    const row = { id: table.data.length + 1, ...data };
    table.data.push(row);

    // Update indexes
    this.updateIndexes(table, row, table.data.length - 1);

    return row;
  }

  /**
   * Query with JOIN
   */
  query(sql) {
    // Simplified SQL parser for demonstration
    if (sql.includes('SELECT') && sql.includes('FROM') && sql.includes('JOIN')) {
      return this.executeJoin(sql);
    }
    
    if (sql.includes('SELECT') && sql.includes('WHERE')) {
      return this.executeSelect(sql);
    }

    return [];
  }

  /**
   * Execute SELECT with WHERE
   */
  executeSelect(sql) {
    // Parse: SELECT * FROM users WHERE id = 1
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*(\d+)/i);

    if (!tableMatch) return [];

    const tableName = tableMatch[1];
    const table = this.tables.get(tableName);
    if (!table) return [];

    if (whereMatch) {
      const column = whereMatch[1];
      const value = parseInt(whereMatch[2]);

      // Use index if available
      if (table.indexes.has(column)) {
        const index = table.indexes.get(column);
        const rowIndices = index.values.get(value) || [];
        return rowIndices.map(i => table.data[i]);
      }

      // Full table scan
      return table.data.filter(row => row[column] === value);
    }

    return table.data;
  }

  /**
   * Execute JOIN
   */
  executeJoin(sql) {
    // Simplified JOIN: SELECT * FROM users JOIN orders ON users.id = orders.user_id
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    const joinMatch = sql.match(/JOIN\s+(\w+)\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i);

    if (!fromMatch || !joinMatch) return [];

    const table1Name = fromMatch[1];
    const table2Name = joinMatch[1];
    const table1 = this.tables.get(table1Name);
    const table2 = this.tables.get(table2Name);

    if (!table1 || !table2) return [];

    const results = [];
    for (const row1 of table1.data) {
      for (const row2 of table2.data) {
        if (row1[joinMatch[4]] === row2[joinMatch[6]]) {
          results.push({ ...row1, ...row2 });
        }
      }
    }

    return results;
  }

  /**
   * Start transaction
   */
  beginTransaction() {
    const transaction = {
      id: `txn_${Date.now()}`,
      operations: [],
      started: Date.now()
    };
    this.transactions.push(transaction);
    return transaction;
  }

  /**
   * Commit transaction
   */
  commit(transactionId) {
    const transaction = this.transactions.find(t => t.id === transactionId);
    if (transaction) {
      // Apply all operations
      transaction.operations.forEach(op => {
        op.execute();
      });
      this.transactions = this.transactions.filter(t => t.id !== transactionId);
      return true;
    }
    return false;
  }

  /**
   * Rollback transaction
   */
  rollback(transactionId) {
    this.transactions = this.transactions.filter(t => t.id !== transactionId);
    return true;
  }

  validateData(schema, data) {
    for (const [column, definition] of Object.entries(schema)) {
      if (definition.required && !(column in data)) {
        throw new Error(`Column ${column} is required`);
      }
      if (data[column] && definition.type && typeof data[column] !== definition.type) {
        throw new Error(`Column ${column} must be of type ${definition.type}`);
      }
    }
  }

  updateIndexes(table, row, index) {
    for (const [column, indexData] of table.indexes.entries()) {
      const value = row[column];
      if (!indexData.values.has(value)) {
        indexData.values.set(value, []);
      }
      indexData.values.get(value).push(index);
    }
  }
}

/**
 * NoSQL Database (Document Store)
 */
class NoSQLDatabase {
  constructor(name) {
    this.name = name;
    this.collections = new Map();
  }

  /**
   * Create collection
   */
  createCollection(name) {
    const collection = {
      name,
      documents: [],
      indexes: new Map()
    };
    this.collections.set(name, collection);
    return collection;
  }

  /**
   * Insert document
   */
  insert(collectionName, document) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    const doc = {
      _id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...document,
      createdAt: new Date().toISOString()
    };

    collection.documents.push(doc);
    this.updateIndexes(collection, doc);
    return doc;
  }

  /**
   * Find documents
   */
  find(collectionName, query = {}) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      return [];
    }

    if (Object.keys(query).length === 0) {
      return collection.documents;
    }

    return collection.documents.filter(doc => {
      for (const [key, value] of Object.entries(query)) {
        if (doc[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Find one document
   */
  findOne(collectionName, query) {
    const results = this.find(collectionName, query);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Update documents
   */
  update(collectionName, query, update) {
    const collection = this.collections.get(collectionName);
    if (!collection) return 0;

    let count = 0;
    collection.documents.forEach(doc => {
      let matches = true;
      for (const [key, value] of Object.entries(query)) {
        if (doc[key] !== value) {
          matches = false;
          break;
        }
      }

      if (matches) {
        Object.assign(doc, update);
        doc.updatedAt = new Date().toISOString();
        count++;
      }
    });

    return count;
  }

  /**
   * Delete documents
   */
  delete(collectionName, query) {
    const collection = this.collections.get(collectionName);
    if (!collection) return 0;

    const initialLength = collection.documents.length;
    collection.documents = collection.documents.filter(doc => {
      for (const [key, value] of Object.entries(query)) {
        if (doc[key] === value) {
          return false;
        }
      }
      return true;
    });

    return initialLength - collection.documents.length;
  }

  /**
   * Create index
   */
  createIndex(collectionName, field) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    const index = {
      field,
      values: new Map()
    };

    collection.documents.forEach((doc, i) => {
      const value = this.getNestedValue(doc, field);
      if (!index.values.has(value)) {
        index.values.set(value, []);
      }
      index.values.get(value).push(i);
    });

    collection.indexes.set(field, index);
    return index;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  updateIndexes(collection, doc) {
    for (const [field, index] of collection.indexes.entries()) {
      const value = this.getNestedValue(doc, field);
      if (!index.values.has(value)) {
        index.values.set(value, []);
      }
      index.values.get(value).push(collection.documents.length - 1);
    }
  }
}

/**
 * Key-Value Store
 */
class KeyValueStore {
  constructor(name) {
    this.name = name;
    this.store = new Map();
    this.ttl = new Map(); // Time-to-live
  }

  /**
   * Set key-value pair
   */
  set(key, value, ttl = null) {
    this.store.set(key, value);
    
    if (ttl) {
      this.ttl.set(key, Date.now() + ttl);
      
      // Auto-expire
      setTimeout(() => {
        if (this.ttl.has(key) && Date.now() >= this.ttl.get(key)) {
          this.delete(key);
        }
      }, ttl);
    }

    return true;
  }

  /**
   * Get value by key
   */
  get(key) {
    // Check TTL
    if (this.ttl.has(key) && Date.now() >= this.ttl.get(key)) {
      this.delete(key);
      return null;
    }

    return this.store.get(key) || null;
  }

  /**
   * Delete key
   */
  delete(key) {
    this.ttl.delete(key);
    return this.store.delete(key);
  }

  /**
   * Check if key exists
   */
  exists(key) {
    return this.store.has(key);
  }

  /**
   * Get all keys
   */
  keys() {
    return Array.from(this.store.keys());
  }

  /**
   * Get all values
   */
  values() {
    return Array.from(this.store.values());
  }

  /**
   * Clear all data
   */
  clear() {
    this.store.clear();
    this.ttl.clear();
  }
}

/**
 * Graph Database
 */
class GraphDatabase {
  constructor(name) {
    this.name = name;
    this.nodes = new Map();
    this.edges = new Map();
  }

  /**
   * Create node
   */
  createNode(id, properties = {}) {
    const node = {
      id,
      properties,
      edges: []
    };
    this.nodes.set(id, node);
    return node;
  }

  /**
   * Create edge (relationship)
   */
  createEdge(fromId, toId, type, properties = {}) {
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);

    if (!fromNode || !toNode) {
      throw new Error('Source or target node not found');
    }

    const edge = {
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: fromId,
      to: toId,
      type,
      properties
    };

    this.edges.set(edge.id, edge);
    fromNode.edges.push(edge.id);

    return edge;
  }

  /**
   * Find node
   */
  findNode(id) {
    return this.nodes.get(id) || null;
  }

  /**
   * Find nodes by property
   */
  findNodesByProperty(key, value) {
    const results = [];
    for (const node of this.nodes.values()) {
      if (node.properties[key] === value) {
        results.push(node);
      }
    }
    return results;
  }

  /**
   * Traverse graph
   */
  traverse(startId, maxDepth = 3) {
    const visited = new Set();
    const results = [];

    const traverseNode = (nodeId, depth) => {
      if (depth > maxDepth || visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (node) {
        results.push(node);

        for (const edgeId of node.edges) {
          const edge = this.edges.get(edgeId);
          if (edge) {
            traverseNode(edge.to, depth + 1);
          }
        }
      }
    };

    traverseNode(startId, 0);
    return results;
  }

  /**
   * Find shortest path
   */
  shortestPath(fromId, toId) {
    const queue = [[fromId]];
    const visited = new Set([fromId]);

    while (queue.length > 0) {
      const path = queue.shift();
      const currentId = path[path.length - 1];

      if (currentId === toId) {
        return path.map(id => this.nodes.get(id));
      }

      const node = this.nodes.get(currentId);
      if (node) {
        for (const edgeId of node.edges) {
          const edge = this.edges.get(edgeId);
          if (edge && !visited.has(edge.to)) {
            visited.add(edge.to);
            queue.push([...path, edge.to]);
          }
        }
      }
    }

    return null; // No path found
  }
}

/**
 * Time-Series Database
 */
class TimeSeriesDatabase {
  constructor(name) {
    this.name = name;
    this.series = new Map();
  }

  /**
   * Create time series
   */
  createSeries(name) {
    const series = {
      name,
      dataPoints: [],
      retention: 86400000 // 24 hours
    };
    this.series.set(name, series);
    return series;
  }

  /**
   * Insert data point
   */
  insert(name, value, timestamp = Date.now()) {
    const series = this.series.get(name);
    if (!series) {
      throw new Error(`Series ${name} not found`);
    }

    const dataPoint = {
      timestamp,
      value,
      id: `dp_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
    };

    series.dataPoints.push(dataPoint);

    // Cleanup old data points
    this.cleanupOldData(series);

    return dataPoint;
  }

  /**
   * Query time series
   */
  query(name, startTime, endTime) {
    const series = this.series.get(name);
    if (!series) {
      return [];
    }

    return series.dataPoints.filter(dp => 
      dp.timestamp >= startTime && dp.timestamp <= endTime
    );
  }

  /**
   * Aggregate data
   */
  aggregate(name, startTime, endTime, functionName = 'avg') {
    const dataPoints = this.query(name, startTime, endTime);
    
    if (dataPoints.length === 0) {
      return null;
    }

    const values = dataPoints.map(dp => dp.value);

    switch (functionName) {
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return null;
    }
  }

  /**
   * Cleanup old data
   */
  cleanupOldData(series) {
    const cutoff = Date.now() - series.retention;
    series.dataPoints = series.dataPoints.filter(dp => dp.timestamp > cutoff);
  }
}

/**
 * Database Factory
 */
class DatabaseFactory {
  static create(type, name) {
    switch (type.toLowerCase()) {
      case 'sql':
      case 'relational':
        return new SQLDatabase(name);
      case 'nosql':
      case 'document':
        return new NoSQLDatabase(name);
      case 'keyvalue':
      case 'key-value':
        return new KeyValueStore(name);
      case 'graph':
        return new GraphDatabase(name);
      case 'timeseries':
      case 'time-series':
        return new TimeSeriesDatabase(name);
      default:
        throw new Error(`Unknown database type: ${type}`);
    }
  }
}

// Example usage
function demonstrateDatabaseTypes() {
  console.log('=== Database Types ===\n');

  // SQL Database
  console.log('=== SQL Database (Relational) ===\n');
  const sqlDB = new SQLDatabase('myapp_db');
  
  sqlDB.createTable('users', {
    id: { type: 'number', required: true },
    name: { type: 'string', required: true },
    email: { type: 'string', required: true }
  });

  sqlDB.createTable('orders', {
    id: { type: 'number', required: true },
    user_id: { type: 'number', required: true },
    total: { type: 'number', required: true }
  });

  sqlDB.insert('users', { id: 1, name: 'John', email: 'john@example.com' });
  sqlDB.insert('orders', { id: 1, user_id: 1, total: 99.99 });

  sqlDB.createIndex('users', 'email');
  
  const users = sqlDB.query('SELECT * FROM users WHERE id = 1');
  console.log('SQL Query Result:', users);

  // NoSQL Database
  console.log('\n=== NoSQL Database (Document Store) ===\n');
  const nosqlDB = new NoSQLDatabase('myapp_nosql');
  
  nosqlDB.createCollection('users');
  nosqlDB.insert('users', { name: 'Jane', email: 'jane@example.com', age: 30 });
  nosqlDB.insert('users', { name: 'Bob', email: 'bob@example.com', age: 25 });

  const jane = nosqlDB.findOne('users', { name: 'Jane' });
  console.log('NoSQL Find One:', jane);

  // Key-Value Store
  console.log('\n=== Key-Value Store ===\n');
  const kvStore = new KeyValueStore('cache');
  
  kvStore.set('user:1', { name: 'John', email: 'john@example.com' });
  kvStore.set('session:abc', { userId: 1, expiresAt: Date.now() + 3600000 }, 3600000);
  
  const user = kvStore.get('user:1');
  console.log('Key-Value Get:', user);

  // Graph Database
  console.log('\n=== Graph Database ===\n');
  const graphDB = new GraphDatabase('social');
  
  graphDB.createNode('user1', { name: 'Alice' });
  graphDB.createNode('user2', { name: 'Bob' });
  graphDB.createNode('user3', { name: 'Charlie' });
  
  graphDB.createEdge('user1', 'user2', 'follows');
  graphDB.createEdge('user2', 'user3', 'follows');
  
  const path = graphDB.shortestPath('user1', 'user3');
  console.log('Shortest Path:', path?.map(n => n.properties.name));

  // Time-Series Database
  console.log('\n=== Time-Series Database ===\n');
  const tsDB = new TimeSeriesDatabase('metrics');
  
  tsDB.createSeries('cpu_usage');
  
  for (let i = 0; i < 10; i++) {
    tsDB.insert('cpu_usage', 50 + Math.random() * 20, Date.now() - (10 - i) * 60000);
  }
  
  const avg = tsDB.aggregate('cpu_usage', Date.now() - 600000, Date.now(), 'avg');
  console.log('Average CPU Usage:', avg?.toFixed(2));

  // Database Factory
  console.log('\n=== Database Factory ===\n');
  const db1 = DatabaseFactory.create('sql', 'db1');
  const db2 = DatabaseFactory.create('nosql', 'db2');
  const db3 = DatabaseFactory.create('keyvalue', 'db3');
  
  console.log('Created databases:', db1.name, db2.name, db3.name);
}

if (require.main === module) {
  demonstrateDatabaseTypes();
}

module.exports = {
  SQLDatabase,
  NoSQLDatabase,
  KeyValueStore,
  GraphDatabase,
  TimeSeriesDatabase,
  DatabaseFactory
};

