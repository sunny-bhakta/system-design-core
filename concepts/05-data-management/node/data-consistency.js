/**
 * Data Consistency Implementation
 * Demonstrates different consistency models: strong, eventual, causal, etc.
 */

/**
 * Strong Consistency
 */
class StrongConsistency {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.locks = new Map();
    this.transactions = new Map();
  }

  /**
   * Read with strong consistency
   */
  async read(key) {
    // Acquire read lock
    await this.acquireLock(key, 'read');
    
    try {
      const value = this.dataStore.get(key);
      return { value, consistency: 'strong' };
    } finally {
      this.releaseLock(key, 'read');
    }
  }

  /**
   * Write with strong consistency
   */
  async write(key, value) {
    // Acquire write lock (exclusive)
    await this.acquireLock(key, 'write');
    
    try {
      this.dataStore.set(key, value);
      return { success: true, consistency: 'strong' };
    } finally {
      this.releaseLock(key, 'write');
    }
  }

  /**
   * Acquire lock
   */
  async acquireLock(key, type) {
    if (!this.locks.has(key)) {
      this.locks.set(key, { readers: 0, writer: null });
    }

    const lock = this.locks.get(key);

    if (type === 'read') {
      // Wait for writer to release
      while (lock.writer !== null) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      lock.readers++;
    } else if (type === 'write') {
      // Wait for all readers and writer to release
      while (lock.readers > 0 || lock.writer !== null) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      lock.writer = 'current';
    }
  }

  /**
   * Release lock
   */
  releaseLock(key, type) {
    const lock = this.locks.get(key);
    if (!lock) return;

    if (type === 'read') {
      lock.readers = Math.max(0, lock.readers - 1);
    } else if (type === 'write') {
      lock.writer = null;
    }
  }
}

/**
 * Eventual Consistency
 */
class EventualConsistency {
  constructor(replicas) {
    this.replicas = replicas;
    this.versionVector = new Map();
    this.pendingWrites = [];
  }

  /**
   * Write to primary (async replication)
   */
  async write(key, value) {
    const version = Date.now();
    const primary = this.replicas[0];

    // Write to primary immediately
    primary.set(key, { value, version, timestamp: Date.now() });
    this.versionVector.set(key, version);

    // Replicate to other replicas asynchronously
    this.replicateToOthers(key, value, version);

    return { success: true, version, consistency: 'eventual' };
  }

  /**
   * Read from any replica
   */
  async read(key) {
    // Read from first available replica
    for (const replica of this.replicas) {
      const data = replica.get(key);
      if (data) {
        return {
          value: data.value,
          version: data.version,
          consistency: 'eventual',
          replica: replica.id
        };
      }
    }

    return null;
  }

  /**
   * Replicate to other replicas
   */
  async replicateToOthers(key, value, version) {
    const otherReplicas = this.replicas.slice(1);
    
    for (const replica of otherReplicas) {
      // Simulate network delay
      setTimeout(() => {
        replica.set(key, { value, version, timestamp: Date.now() });
      }, 50 + Math.random() * 100);
    }
  }

  /**
   * Check consistency status
   */
  checkConsistency(key) {
    const versions = this.replicas
      .map(r => r.get(key))
      .filter(d => d !== undefined)
      .map(d => d.version);

    if (versions.length === 0) {
      return { consistent: true, message: 'Key not found' };
    }

    const allSame = versions.every(v => v === versions[0]);
    
    return {
      consistent: allSame,
      versions,
      message: allSame ? 'All replicas consistent' : 'Replicas have different versions'
    };
  }
}

/**
 * Causal Consistency
 */
class CausalConsistency {
  constructor(replicas) {
    this.replicas = replicas;
    this.vectorClock = new Map();
    this.operations = [];
  }

  /**
   * Initialize vector clock
   */
  initializeVectorClock(replicaId) {
    const clock = new Map();
    for (const replica of this.replicas) {
      clock.set(replica.id, 0);
    }
    this.vectorClock.set(replicaId, clock);
    return clock;
  }

  /**
   * Write with causal ordering
   */
  async write(replicaId, key, value) {
    const clock = this.vectorClock.get(replicaId) || this.initializeVectorClock(replicaId);
    
    // Increment own clock
    clock.set(replicaId, (clock.get(replicaId) || 0) + 1);

    const operation = {
      type: 'write',
      replica: replicaId,
      key,
      value,
      vectorClock: new Map(clock),
      timestamp: Date.now()
    };

    this.operations.push(operation);
    
    // Apply to replica
    const replica = this.replicas.find(r => r.id === replicaId);
    if (replica) {
      replica.set(key, { value, vectorClock: new Map(clock) });
    }

    return operation;
  }

  /**
   * Read with causal ordering
   */
  async read(replicaId, key) {
    const replica = this.replicas.find(r => r.id === replicaId);
    if (!replica) {
      return null;
    }

    const data = replica.get(key);
    if (!data) {
      return null;
    }

    return {
      value: data.value,
      vectorClock: data.vectorClock,
      consistency: 'causal'
    };
  }

  /**
   * Check if operation can be applied (causally consistent)
   */
  canApply(operation, replicaClock) {
    const opClock = operation.vectorClock;
    
    // Check if all dependencies are satisfied
    for (const [replicaId, opValue] of opClock.entries()) {
      const replicaValue = replicaClock.get(replicaId) || 0;
      if (opValue > replicaValue) {
        return false; // Dependency not satisfied
      }
    }

    return true;
  }
}

/**
 * Read-Your-Writes Consistency
 */
class ReadYourWritesConsistency {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.writeLog = new Map(); // Track writes per client
  }

  /**
   * Write (tracked per client)
   */
  async write(clientId, key, value) {
    this.dataStore.set(key, value);
    
    // Track write
    if (!this.writeLog.has(clientId)) {
      this.writeLog.set(clientId, []);
    }
    
    this.writeLog.get(clientId).push({
      key,
      value,
      timestamp: Date.now()
    });

    return { success: true, clientId, key, value };
  }

  /**
   * Read (ensures client sees their own writes)
   */
  async read(clientId, key) {
    // Check if client has written to this key
    const clientWrites = this.writeLog.get(clientId) || [];
    const latestWrite = clientWrites
      .filter(w => w.key === key)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (latestWrite) {
      // Return client's latest write
      return {
        value: latestWrite.value,
        source: 'client-write',
        consistency: 'read-your-writes'
      };
    }

    // Otherwise read from store
    return {
      value: this.dataStore.get(key),
      source: 'store',
      consistency: 'read-your-writes'
    };
  }
}

/**
 * Monotonic Read Consistency
 */
class MonotonicReadConsistency {
  constructor(replicas) {
    this.replicas = replicas;
    this.clientVersions = new Map(); // Track last read version per client
  }

  /**
   * Read (monotonic - never see older data)
   */
  async read(clientId, key) {
    const lastVersion = this.clientVersions.get(`${clientId}:${key}`) || 0;

    // Find replica with version >= lastVersion
    for (const replica of this.replicas) {
      const data = replica.get(key);
      if (data && data.version >= lastVersion) {
        this.clientVersions.set(`${clientId}:${key}`, data.version);
        return {
          value: data.value,
          version: data.version,
          consistency: 'monotonic-read'
        };
      }
    }

    // If no newer version, return latest available
    let latest = null;
    for (const replica of this.replicas) {
      const data = replica.get(key);
      if (data && (!latest || data.version > latest.version)) {
        latest = data;
      }
    }

    if (latest) {
      this.clientVersions.set(`${clientId}:${key}`, latest.version);
    }

    return latest ? {
      value: latest.value,
      version: latest.version,
      consistency: 'monotonic-read'
    } : null;
  }

  /**
   * Write
   */
  async write(key, value) {
    const version = Date.now();
    const primary = this.replicas[0];
    primary.set(key, { value, version });
    return { success: true, version };
  }
}

/**
 * Session Consistency
 */
class SessionConsistency {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.sessions = new Map();
  }

  /**
   * Create session
   */
  createSession(sessionId) {
    this.sessions.set(sessionId, {
      id: sessionId,
      reads: new Map(),
      writes: new Map(),
      createdAt: Date.now()
    });
    return sessionId;
  }

  /**
   * Read within session
   */
  async read(sessionId, key) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if written in this session
    if (session.writes.has(key)) {
      return {
        value: session.writes.get(key),
        source: 'session-write',
        consistency: 'session'
      };
    }

    // Read from store
    const value = this.dataStore.get(key);
    session.reads.set(key, value);
    
    return {
      value,
      source: 'store',
      consistency: 'session'
    };
  }

  /**
   * Write within session
   */
  async write(sessionId, key, value) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Write to session
    session.writes.set(key, value);
    
    // Write to store
    this.dataStore.set(key, value);

    return { success: true, sessionId, key, value };
  }
}

/**
 * Consistency Manager
 */
class ConsistencyManager {
  constructor() {
    this.models = new Map();
  }

  /**
   * Register consistency model
   */
  registerModel(name, model) {
    this.models.set(name, model);
  }

  /**
   * Get model
   */
  getModel(name) {
    return this.models.get(name);
  }

  /**
   * Compare consistency levels
   */
  compareConsistency(model1, model2) {
    const levels = {
      'strong': 5,
      'causal': 4,
      'session': 3,
      'monotonic-read': 2,
      'eventual': 1
    };

    const level1 = levels[model1] || 0;
    const level2 = levels[model2] || 0;

    return {
      model1: { name: model1, level: level1 },
      model2: { name: model2, level: level2 },
      stronger: level1 > level2 ? model1 : model2
    };
  }
}

// Example usage
async function demonstrateDataConsistency() {
  console.log('=== Data Consistency ===\n');

  // Strong Consistency
  console.log('=== Strong Consistency ===\n');
  const strongStore = new Map();
  const strongConsistency = new StrongConsistency(strongStore);
  
  await strongConsistency.write('key1', 'value1');
  const read1 = await strongConsistency.read('key1');
  console.log('Strong Read:', read1);

  // Eventual Consistency
  console.log('\n=== Eventual Consistency ===\n');
  const replica1 = { id: 'r1', data: new Map() };
  const replica2 = { id: 'r2', data: new Map() };
  const replica3 = { id: 'r3', data: new Map() };
  
  replica1.get = (k) => replica1.data.get(k);
  replica1.set = (k, v) => replica1.data.set(k, v);
  replica2.get = (k) => replica2.data.get(k);
  replica2.set = (k, v) => replica2.data.set(k, v);
  replica3.get = (k) => replica3.data.get(k);
  replica3.set = (k, v) => replica3.data.set(k, v);

  const eventualConsistency = new EventualConsistency([replica1, replica2, replica3]);
  
  await eventualConsistency.write('key1', 'value1');
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const consistency = eventualConsistency.checkConsistency('key1');
  console.log('Consistency Status:', consistency);

  // Causal Consistency
  console.log('\n=== Causal Consistency ===\n');
  const causalReplicas = [
    { id: 'r1', data: new Map(), get: function(k) { return this.data.get(k); }, set: function(k, v) { this.data.set(k, v); } },
    { id: 'r2', data: new Map(), get: function(k) { return this.data.get(k); }, set: function(k, v) { this.data.set(k, v); } }
  ];
  
  const causalConsistency = new CausalConsistency(causalReplicas);
  
  await causalConsistency.write('r1', 'key1', 'value1');
  const causalRead = await causalConsistency.read('r1', 'key1');
  console.log('Causal Read:', causalRead);

  // Read-Your-Writes
  console.log('\n=== Read-Your-Writes Consistency ===\n');
  const rywStore = new Map();
  const rywConsistency = new ReadYourWritesConsistency(rywStore);
  
  await rywConsistency.write('client1', 'key1', 'value1');
  const rywRead = await rywConsistency.read('client1', 'key1');
  console.log('Read-Your-Writes:', rywRead);

  // Session Consistency
  console.log('\n=== Session Consistency ===\n');
  const sessionStore = new Map();
  const sessionConsistency = new SessionConsistency(sessionStore);
  
  const sessionId = sessionConsistency.createSession('session1');
  await sessionConsistency.write(sessionId, 'key1', 'value1');
  const sessionRead = await sessionConsistency.read(sessionId, 'key1');
  console.log('Session Read:', sessionRead);
}

if (require.main === module) {
  demonstrateDataConsistency();
}

module.exports = {
  StrongConsistency,
  EventualConsistency,
  CausalConsistency,
  ReadYourWritesConsistency,
  MonotonicReadConsistency,
  SessionConsistency,
  ConsistencyManager
};

