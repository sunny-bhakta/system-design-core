/**
 * Data Models Implementation
 * Demonstrates different data modeling approaches: relational, document, graph, etc.
 */

/**
 * Relational Data Model
 */
class RelationalModel {
  constructor() {
    this.tables = new Map();
    this.relationships = [];
  }

  /**
   * Define table
   */
  defineTable(name, columns, constraints = {}) {
    const table = {
      name,
      columns,
      constraints,
      primaryKey: constraints.primaryKey || 'id',
      foreignKeys: constraints.foreignKeys || []
    };

    this.tables.set(name, table);
    return table;
  }

  /**
   * Define relationship
   */
  defineRelationship(type, fromTable, toTable, fromColumn, toColumn) {
    const relationship = {
      type, // 'one-to-one', 'one-to-many', 'many-to-many'
      fromTable,
      toTable,
      fromColumn,
      toColumn
    };

    this.relationships.push(relationship);
    return relationship;
  }

  /**
   * Normalize data (3NF)
   */
  normalize(tableName) {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    // Check for normalization violations
    const violations = this.checkNormalization(table);
    
    return {
      normalized: violations.length === 0,
      violations,
      recommendations: this.getNormalizationRecommendations(violations)
    };
  }

  checkNormalization(table) {
    const violations = [];
    
    // Check for duplicate columns (simplified)
    const columnNames = Object.keys(table.columns);
    const duplicates = columnNames.filter((name, index) => 
      columnNames.indexOf(name) !== index
    );

    if (duplicates.length > 0) {
      violations.push({
        type: 'duplicate_columns',
        columns: duplicates
      });
    }

    return violations;
  }

  getNormalizationRecommendations(violations) {
    return violations.map(v => {
      if (v.type === 'duplicate_columns') {
        return 'Remove duplicate columns';
      }
      return 'Review table structure';
    });
  }
}

/**
 * Document Data Model
 */
class DocumentModel {
  constructor() {
    this.schemas = new Map();
  }

  /**
   * Define schema
   */
  defineSchema(collectionName, schema) {
    this.schemas.set(collectionName, schema);
    return schema;
  }

  /**
   * Validate document against schema
   */
  validate(collectionName, document) {
    const schema = this.schemas.get(collectionName);
    if (!schema) {
      return { valid: true }; // No schema = flexible
    }

    const errors = [];

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in document)) {
          errors.push(`Field ${field} is required`);
        }
      }
    }

    // Check field types
    if (schema.properties) {
      for (const [field, definition] of Object.entries(schema.properties)) {
        if (field in document) {
          if (definition.type && typeof document[field] !== definition.type) {
            errors.push(`Field ${field} must be of type ${definition.type}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Embed document
   */
  embed(parentDoc, childField, childDoc) {
    return {
      ...parentDoc,
      [childField]: childDoc
    };
  }

  /**
   * Reference document
   */
  reference(parentDoc, childField, childId) {
    return {
      ...parentDoc,
      [childField]: { $ref: childId }
    };
  }
}

/**
 * Graph Data Model
 */
class GraphModel {
  constructor() {
    this.nodeTypes = new Map();
    this.edgeTypes = new Map();
  }

  /**
   * Define node type
   */
  defineNodeType(name, properties = {}) {
    const nodeType = {
      name,
      properties,
      constraints: {}
    };
    this.nodeTypes.set(name, nodeType);
    return nodeType;
  }

  /**
   * Define edge type (relationship type)
   */
  defineEdgeType(name, fromType, toType, properties = {}) {
    const edgeType = {
      name,
      fromType,
      toType,
      properties
    };
    this.edgeTypes.set(name, edgeType);
    return edgeType;
  }

  /**
   * Create node instance
   */
  createNode(type, id, properties = {}) {
    const nodeType = this.nodeTypes.get(type);
    if (!nodeType) {
      throw new Error(`Node type ${type} not defined`);
    }

    return {
      id,
      type,
      properties: { ...nodeType.properties, ...properties }
    };
  }

  /**
   * Create edge instance
   */
  createEdge(type, fromId, toId, properties = {}) {
    const edgeType = this.edgeTypes.get(type);
    if (!edgeType) {
      throw new Error(`Edge type ${type} not defined`);
    }

    return {
      id: `edge_${Date.now()}`,
      type,
      from: fromId,
      to: toId,
      properties: { ...edgeType.properties, ...properties }
    };
  }
}

/**
 * Columnar Data Model
 */
class ColumnarModel {
  constructor() {
    this.tables = new Map();
  }

  /**
   * Create columnar table
   */
  createTable(name, columns) {
    const table = {
      name,
      columns: {},
      rowCount: 0
    };

    // Initialize column storage
    for (const column of columns) {
      table.columns[column] = [];
    }

    this.tables.set(name, table);
    return table;
  }

  /**
   * Insert row
   */
  insert(tableName, data) {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    for (const [column, value] of Object.entries(data)) {
      if (table.columns[column]) {
        table.columns[column].push(value);
      }
    }

    table.rowCount++;
    return table.rowCount;
  }

  /**
   * Query column
   */
  queryColumn(tableName, columnName, filter = null) {
    const table = this.tables.get(tableName);
    if (!table || !table.columns[columnName]) {
      return [];
    }

    const column = table.columns[columnName];
    
    if (filter) {
      return column.filter(filter);
    }

    return column;
  }

  /**
   * Aggregate column
   */
  aggregateColumn(tableName, columnName, functionName = 'sum') {
    const column = this.queryColumn(tableName, columnName);
    
    if (column.length === 0) {
      return null;
    }

    switch (functionName) {
      case 'sum':
        return column.reduce((a, b) => a + b, 0);
      case 'avg':
        return column.reduce((a, b) => a + b, 0) / column.length;
      case 'min':
        return Math.min(...column);
      case 'max':
        return Math.max(...column);
      default:
        return null;
    }
  }
}

/**
 * Wide Column Store Model
 */
class WideColumnModel {
  constructor() {
    this.columnFamilies = new Map();
  }

  /**
   * Create column family
   */
  createColumnFamily(name) {
    const family = {
      name,
      rows: new Map()
    };
    this.columnFamilies.set(name, family);
    return family;
  }

  /**
   * Insert row
   */
  insert(columnFamily, rowKey, columns) {
    const family = this.columnFamilies.get(columnFamily);
    if (!family) {
      throw new Error(`Column family ${columnFamily} not found`);
    }

    family.rows.set(rowKey, {
      key: rowKey,
      columns: new Map(Object.entries(columns)),
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Get row
   */
  get(columnFamily, rowKey) {
    const family = this.columnFamilies.get(columnFamily);
    if (!family) {
      return null;
    }

    const row = family.rows.get(rowKey);
    if (!row) {
      return null;
    }

    return {
      key: row.key,
      columns: Object.fromEntries(row.columns),
      timestamp: row.timestamp
    };
  }

  /**
   * Query by column
   */
  queryByColumn(columnFamily, columnName, value) {
    const family = this.columnFamilies.get(columnFamily);
    if (!family) {
      return [];
    }

    const results = [];
    for (const row of family.rows.values()) {
      if (row.columns.get(columnName) === value) {
        results.push({
          key: row.key,
          columns: Object.fromEntries(row.columns)
        });
      }
    }

    return results;
  }
}

/**
 * Data Model Factory
 */
class DataModelFactory {
  static create(type) {
    switch (type.toLowerCase()) {
      case 'relational':
        return new RelationalModel();
      case 'document':
        return new DocumentModel();
      case 'graph':
        return new GraphModel();
      case 'columnar':
        return new ColumnarModel();
      case 'widecolumn':
      case 'wide-column':
        return new WideColumnModel();
      default:
        throw new Error(`Unknown data model type: ${type}`);
    }
  }
}

// Example usage
function demonstrateDataModels() {
  console.log('=== Data Models ===\n');

  // Relational Model
  console.log('=== Relational Data Model ===\n');
  const relationalModel = new RelationalModel();
  
  relationalModel.defineTable('users', {
    id: 'number',
    name: 'string',
    email: 'string'
  }, {
    primaryKey: 'id'
  });

  relationalModel.defineTable('orders', {
    id: 'number',
    user_id: 'number',
    total: 'number'
  }, {
    primaryKey: 'id',
    foreignKeys: [{ column: 'user_id', references: 'users.id' }]
  });

  relationalModel.defineRelationship('one-to-many', 'users', 'orders', 'id', 'user_id');
  
  const normalization = relationalModel.normalize('users');
  console.log('Normalization Check:', normalization);

  // Document Model
  console.log('\n=== Document Data Model ===\n');
  const documentModel = new DocumentModel();
  
  documentModel.defineSchema('users', {
    required: ['name', 'email'],
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      age: { type: 'number' }
    }
  });

  const validation1 = documentModel.validate('users', {
    name: 'John',
    email: 'john@example.com',
    age: 30
  });
  console.log('Valid Document:', validation1);

  const validation2 = documentModel.validate('users', {
    name: 'Jane'
    // Missing email
  });
  console.log('Invalid Document:', validation2);

  // Embed vs Reference
  const userDoc = { id: 1, name: 'John' };
  const addressDoc = { street: '123 Main St', city: 'NYC' };
  const embedded = documentModel.embed(userDoc, 'address', addressDoc);
  console.log('Embedded Document:', embedded);

  const referenced = documentModel.reference(userDoc, 'address', 'addr-123');
  console.log('Referenced Document:', referenced);

  // Graph Model
  console.log('\n=== Graph Data Model ===\n');
  const graphModel = new GraphModel();
  
  graphModel.defineNodeType('User', {
    name: 'string',
    email: 'string'
  });

  graphModel.defineNodeType('Post', {
    title: 'string',
    content: 'string'
  });

  graphModel.defineEdgeType('CREATED', 'User', 'Post', {
    timestamp: 'number'
  });

  const userNode = graphModel.createNode('User', 'user1', {
    name: 'Alice',
    email: 'alice@example.com'
  });
  console.log('User Node:', userNode);

  const edge = graphModel.createEdge('CREATED', 'user1', 'post1', {
    timestamp: Date.now()
  });
  console.log('Edge:', edge);

  // Columnar Model
  console.log('\n=== Columnar Data Model ===\n');
  const columnarModel = new ColumnarModel();
  
  columnarModel.createTable('sales', ['date', 'product', 'amount', 'quantity']);
  
  columnarModel.insert('sales', { date: '2024-01-01', product: 'A', amount: 100, quantity: 2 });
  columnarModel.insert('sales', { date: '2024-01-02', product: 'B', amount: 200, quantity: 3 });
  columnarModel.insert('sales', { date: '2024-01-03', product: 'A', amount: 150, quantity: 1 });

  const totalAmount = columnarModel.aggregateColumn('sales', 'amount', 'sum');
  console.log('Total Sales Amount:', totalAmount);

  // Wide Column Model
  console.log('\n=== Wide Column Data Model ===\n');
  const wideColumnModel = new WideColumnModel();
  
  wideColumnModel.createColumnFamily('users');
  
  wideColumnModel.insert('users', 'user1', {
    'personal:name': 'John',
    'personal:email': 'john@example.com',
    'address:street': '123 Main St',
    'address:city': 'NYC'
  });

  const user = wideColumnModel.get('users', 'user1');
  console.log('Wide Column User:', user);
}

if (require.main === module) {
  demonstrateDataModels();
}

module.exports = {
  RelationalModel,
  DocumentModel,
  GraphModel,
  ColumnarModel,
  WideColumnModel,
  DataModelFactory
};

