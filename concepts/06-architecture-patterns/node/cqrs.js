/**
 * CQRS (Command Query Responsibility Segregation) Implementation
 * Demonstrates separation of read and write operations
 */

/**
 * Command (Write Operation)
 */
class Command {
  constructor(name, data) {
    this.id = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.data = data;
    this.timestamp = Date.now();
  }
}

/**
 * Query (Read Operation)
 */
class Query {
  constructor(name, filters = {}) {
    this.id = `qry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.filters = filters;
    this.timestamp = Date.now();
  }
}

/**
 * Command Handler
 */
class CommandHandler {
  constructor() {
    this.handlers = new Map();
  }

  /**
   * Register command handler
   */
  register(commandName, handler) {
    this.handlers.set(commandName, handler);
  }

  /**
   * Handle command
   */
  async handle(command) {
    const handler = this.handlers.get(command.name);
    if (!handler) {
      throw new Error(`No handler for command: ${command.name}`);
    }

    return await handler(command.data);
  }
}

/**
 * Query Handler
 */
class QueryHandler {
  constructor() {
    this.handlers = new Map();
  }

  /**
   * Register query handler
   */
  register(queryName, handler) {
    this.handlers.set(queryName, handler);
  }

  /**
   * Handle query
   */
  async handle(query) {
    const handler = this.handlers.get(query.name);
    if (!handler) {
      throw new Error(`No handler for query: ${query.name}`);
    }

    return await handler(query.filters);
  }
}

/**
 * Write Model (Command Side)
 */
class WriteModel {
  constructor() {
    this.aggregates = new Map();
    this.events = [];
  }

  /**
   * Create aggregate
   */
  createAggregate(type, data) {
    const aggregate = {
      id: Date.now().toString(),
      type,
      data,
      version: 0,
      createdAt: Date.now()
    };

    this.aggregates.set(aggregate.id, aggregate);
    
    // Emit event
    this.emitEvent('aggregate.created', {
      aggregateId: aggregate.id,
      type,
      data
    });

    return aggregate;
  }

  /**
   * Update aggregate
   */
  updateAggregate(id, updates) {
    const aggregate = this.aggregates.get(id);
    if (!aggregate) {
      throw new Error('Aggregate not found');
    }

    aggregate.data = { ...aggregate.data, ...updates };
    aggregate.version++;
    aggregate.updatedAt = Date.now();

    // Emit event
    this.emitEvent('aggregate.updated', {
      aggregateId: id,
      updates,
      version: aggregate.version
    });

    return aggregate;
  }

  /**
   * Delete aggregate
   */
  deleteAggregate(id) {
    const aggregate = this.aggregates.get(id);
    if (!aggregate) {
      throw new Error('Aggregate not found');
    }

    this.aggregates.delete(id);

    // Emit event
    this.emitEvent('aggregate.deleted', {
      aggregateId: id
    });

    return true;
  }

  /**
   * Emit event
   */
  emitEvent(eventType, eventData) {
    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      data: eventData,
      timestamp: Date.now()
    };

    this.events.push(event);
    return event;
  }

  /**
   * Get events
   */
  getEvents(aggregateId = null) {
    if (aggregateId) {
      return this.events.filter(e => e.data.aggregateId === aggregateId);
    }
    return this.events;
  }
}

/**
 * Read Model (Query Side)
 */
class ReadModel {
  constructor() {
    this.projections = new Map();
    this.indexes = new Map();
  }

  /**
   * Create projection
   */
  createProjection(name, data) {
    const projection = {
      id: data.id || Date.now().toString(),
      name,
      data,
      updatedAt: Date.now()
    };

    this.projections.set(projection.id, projection);
    this.updateIndexes(projection);

    return projection;
  }

  /**
   * Update projection
   */
  updateProjection(id, updates) {
    const projection = this.projections.get(id);
    if (!projection) {
      throw new Error('Projection not found');
    }

    projection.data = { ...projection.data, ...updates };
    projection.updatedAt = Date.now();
    this.updateIndexes(projection);

    return projection;
  }

  /**
   * Delete projection
   */
  deleteProjection(id) {
    this.projections.delete(id);
    this.removeFromIndexes(id);
    return true;
  }

  /**
   * Update indexes
   */
  updateIndexes(projection) {
    // Index by name
    if (!this.indexes.has('byName')) {
      this.indexes.set('byName', new Map());
    }
    const byNameIndex = this.indexes.get('byName');
    
    if (!byNameIndex.has(projection.name)) {
      byNameIndex.set(projection.name, []);
    }
    
    const nameList = byNameIndex.get(projection.name);
    const existingIndex = nameList.findIndex(p => p.id === projection.id);
    
    if (existingIndex > -1) {
      nameList[existingIndex] = projection;
    } else {
      nameList.push(projection);
    }
  }

  /**
   * Remove from indexes
   */
  removeFromIndexes(id) {
    for (const index of this.indexes.values()) {
      if (index instanceof Map) {
        for (const list of index.values()) {
          const itemIndex = list.findIndex(p => p.id === id);
          if (itemIndex > -1) {
            list.splice(itemIndex, 1);
          }
        }
      }
    }
  }

  /**
   * Query projections
   */
  query(filters) {
    let results = Array.from(this.projections.values());

    if (filters.name) {
      const byNameIndex = this.indexes.get('byName');
      if (byNameIndex && byNameIndex.has(filters.name)) {
        results = byNameIndex.get(filters.name);
      } else {
        results = results.filter(p => p.name === filters.name);
      }
    }

    if (filters.id) {
      results = results.filter(p => p.id === filters.id);
    }

    return results;
  }
}

/**
 * Event Handler (Syncs Write Model to Read Model)
 */
class EventHandler {
  constructor(writeModel, readModel) {
    this.writeModel = writeModel;
    this.readModel = readModel;
  }

  /**
   * Process events and update read model
   */
  async processEvents() {
    const events = this.writeModel.getEvents();
    
    for (const event of events) {
      await this.handleEvent(event);
    }
  }

  /**
   * Handle individual event
   */
  async handleEvent(event) {
    switch (event.type) {
      case 'aggregate.created':
        this.readModel.createProjection('user', {
          id: event.data.aggregateId,
          ...event.data.data
        });
        break;

      case 'aggregate.updated':
        this.readModel.updateProjection(event.data.aggregateId, event.data.updates);
        break;

      case 'aggregate.deleted':
        this.readModel.deleteProjection(event.data.aggregateId);
        break;
    }
  }
}

/**
 * CQRS System
 */
class CQRSSystem {
  constructor() {
    this.writeModel = new WriteModel();
    this.readModel = new ReadModel();
    this.commandHandler = new CommandHandler();
    this.queryHandler = new QueryHandler();
    this.eventHandler = new EventHandler(this.writeModel, this.readModel);

    this.setupHandlers();
  }

  /**
   * Setup command and query handlers
   */
  setupHandlers() {
    // Command handlers
    this.commandHandler.register('createUser', async (data) => {
      return this.writeModel.createAggregate('user', data);
    });

    this.commandHandler.register('updateUser', async (data) => {
      return this.writeModel.updateAggregate(data.id, data.updates);
    });

    this.commandHandler.register('deleteUser', async (data) => {
      return this.writeModel.deleteAggregate(data.id);
    });

    // Query handlers
    this.queryHandler.register('getUser', async (filters) => {
      // Sync events first
      await this.eventHandler.processEvents();
      
      const results = this.readModel.query(filters);
      return results.length > 0 ? results[0] : null;
    });

    this.queryHandler.register('listUsers', async (filters) => {
      // Sync events first
      await this.eventHandler.processEvents();
      
      return this.readModel.query(filters);
    });
  }

  /**
   * Execute command
   */
  async executeCommand(commandName, data) {
    const command = new Command(commandName, data);
    const result = await this.commandHandler.handle(command);
    
    // Process events to update read model
    await this.eventHandler.processEvents();
    
    return result;
  }

  /**
   * Execute query
   */
  async executeQuery(queryName, filters = {}) {
    const query = new Query(queryName, filters);
    return await this.queryHandler.handle(query);
  }
}

/**
 * CQRS with Event Sourcing
 */
class CQRSWithEventSourcing {
  constructor() {
    this.eventStore = [];
    this.readModel = new ReadModel();
    this.commandHandler = new CommandHandler();
    this.queryHandler = new QueryHandler();

    this.setupHandlers();
  }

  setupHandlers() {
    // Command handler - only appends events
    this.commandHandler.register('createUser', async (data) => {
      const event = {
        id: `evt_${Date.now()}`,
        type: 'user.created',
        data,
        timestamp: Date.now()
      };
      this.eventStore.push(event);
      return event;
    });

    this.commandHandler.register('updateUser', async (data) => {
      const event = {
        id: `evt_${Date.now()}`,
        type: 'user.updated',
        data,
        timestamp: Date.now()
      };
      this.eventStore.push(event);
      return event;
    });

    // Query handler - rebuilds from events
    this.queryHandler.register('getUser', async (filters) => {
      const user = this.rebuildFromEvents(filters.id);
      return user;
    });
  }

  /**
   * Rebuild aggregate from events
   */
  rebuildFromEvents(userId) {
    const events = this.eventStore.filter(e => 
      (e.type === 'user.created' || e.type === 'user.updated') && 
      e.data.id === userId
    );

    if (events.length === 0) {
      return null;
    }

    let user = null;
    for (const event of events) {
      if (event.type === 'user.created') {
        user = { ...event.data };
      } else if (event.type === 'user.updated') {
        user = { ...user, ...event.data.updates };
      }
    }

    return user;
  }

  async executeCommand(commandName, data) {
    const command = new Command(commandName, data);
    const result = await this.commandHandler.handle(command);
    
    // Update read model from events
    this.updateReadModel();
    
    return result;
  }

  updateReadModel() {
    // Rebuild read model from all events
    for (const event of this.eventStore) {
      if (event.type === 'user.created') {
        this.readModel.createProjection('user', event.data);
      } else if (event.type === 'user.updated') {
        this.readModel.updateProjection(event.data.id, event.data.updates);
      }
    }
  }

  async executeQuery(queryName, filters = {}) {
    const query = new Query(queryName, filters);
    return await this.queryHandler.handle(query);
  }
}

// Example usage
async function demonstrateCQRS() {
  console.log('=== CQRS (Command Query Responsibility Segregation) ===\n');

  // Standard CQRS
  console.log('=== Standard CQRS ===\n');
  const cqrs = new CQRSSystem();

  // Execute commands (write)
  console.log('=== Executing Commands ===\n');
  const createResult = await cqrs.executeCommand('createUser', {
    name: 'John Doe',
    email: 'john@example.com'
  });
  console.log('Create User:', createResult);

  const updateResult = await cqrs.executeCommand('updateUser', {
    id: createResult.id,
    updates: { name: 'John Updated' }
  });
  console.log('Update User:', updateResult);

  // Execute queries (read)
  console.log('\n=== Executing Queries ===\n');
  const getUserResult = await cqrs.executeQuery('getUser', { id: createResult.id });
  console.log('Get User:', getUserResult);

  const listUsersResult = await cqrs.executeQuery('listUsers', {});
  console.log('List Users:', listUsersResult);

  // CQRS with Event Sourcing
  console.log('\n=== CQRS with Event Sourcing ===\n');
  const cqrsES = new CQRSWithEventSourcing();

  const createResultES = await cqrsES.executeCommand('createUser', {
    id: 'user-123',
    name: 'Jane Doe',
    email: 'jane@example.com'
  });
  console.log('Create User (ES):', createResultES);

  const updateResultES = await cqrsES.executeCommand('updateUser', {
    id: 'user-123',
    updates: { name: 'Jane Updated' }
  });
  console.log('Update User (ES):', updateResultES);

  const getUserResultES = await cqrsES.executeQuery('getUser', { id: 'user-123' });
  console.log('Get User (ES):', getUserResultES);
}

if (require.main === module) {
  demonstrateCQRS();
}

module.exports = {
  Command,
  Query,
  CommandHandler,
  QueryHandler,
  WriteModel,
  ReadModel,
  EventHandler,
  CQRSSystem,
  CQRSWithEventSourcing
};

