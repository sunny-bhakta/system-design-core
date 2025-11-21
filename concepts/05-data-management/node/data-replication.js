/**
 * Data Replication Implementation
 * Demonstrates master-slave and master-master replication
 */

/**
 * Master-Slave Replication
 */
class MasterSlaveReplication {
  constructor(config) {
    this.master = {
      id: 'master',
      data: new Map(),
      writeLog: []
    };
    
    this.slaves = [];
    for (let i = 0; i < (config.numSlaves || 2); i++) {
      this.slaves.push({
        id: `slave-${i}`,
        data: new Map(),
        replicationLag: 0,
        lastReplicated: Date.now()
      });
    }
    
    this.replicationDelay = config.replicationDelay || 100; // ms
    this.stats = {
      writes: 0,
      reads: 0,
      replications: 0
    };
  }

  /**
   * Write to master
   */
  async write(key, value) {
    // Write to master
    this.master.data.set(key, value);
    this.master.writeLog.push({
      key,
      value,
      timestamp: Date.now()
    });
    
    this.stats.writes++;
    
    // Replicate to slaves asynchronously
    this.replicateToSlaves(key, value);
    
    return { success: true, key, value };
  }

  /**
   * Replicate to slaves
   */
  async replicateToSlaves(key, value) {
    const replicationPromises = this.slaves.map(async (slave) => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, this.replicationDelay));
      
      slave.data.set(key, value);
      slave.lastReplicated = Date.now();
      slave.replicationLag = Date.now() - this.master.writeLog[this.master.writeLog.length - 1].timestamp;
      
      this.stats.replications++;
    });
    
    await Promise.all(replicationPromises);
  }

  /**
   * Read from slave (load balancing)
   */
  read(key, preferSlave = true) {
    this.stats.reads++;
    
    if (preferSlave && this.slaves.length > 0) {
      // Round-robin slave selection
      const slaveIndex = this.stats.reads % this.slaves.length;
      const slave = this.slaves[slaveIndex];
      
      if (slave.data.has(key)) {
        return { 
          value: slave.data.get(key), 
          source: slave.id,
          lag: slave.replicationLag
        };
      }
    }
    
    // Fallback to master
    if (this.master.data.has(key)) {
      return { 
        value: this.master.data.get(key), 
        source: 'master',
        lag: 0
      };
    }
    
    return null;
  }

  /**
   * Promote slave to master (failover)
   */
  promoteSlave(slaveId) {
    const slaveIndex = this.slaves.findIndex(s => s.id === slaveId);
    if (slaveIndex === -1) {
      throw new Error(`Slave ${slaveId} not found`);
    }
    
    const slave = this.slaves[slaveIndex];
    
    // Promote slave to master
    this.master = {
      id: slave.id,
      data: new Map(slave.data),
      writeLog: [...this.master.writeLog]
    };
    
    // Remove from slaves
    this.slaves.splice(slaveIndex, 1);
    
    console.log(`Slave ${slaveId} promoted to master`);
    return this.master;
  }

  /**
   * Get replication status
   */
  getStatus() {
    return {
      master: {
        id: this.master.id,
        dataSize: this.master.data.size,
        writeLogSize: this.master.writeLog.length
      },
      slaves: this.slaves.map(slave => ({
        id: slave.id,
        dataSize: slave.data.size,
        replicationLag: slave.replicationLag,
        lastReplicated: new Date(slave.lastReplicated).toISOString()
      })),
      stats: this.stats
    };
  }
}

/**
 * Master-Master Replication
 */
class MasterMasterReplication {
  constructor(config) {
    this.masters = [];
    for (let i = 0; i < (config.numMasters || 2); i++) {
      this.masters.push({
        id: `master-${i}`,
        data: new Map(),
        writeLog: [],
        lastSync: Date.now()
      });
    }
    
    this.replicationDelay = config.replicationDelay || 100;
    this.conflictResolution = config.conflictResolution || 'last-write-wins';
    this.stats = {
      writes: 0,
      conflicts: 0,
      replications: 0
    };
  }

  /**
   * Write to a master
   */
  async write(masterId, key, value) {
    const master = this.masters.find(m => m.id === masterId);
    if (!master) {
      throw new Error(`Master ${masterId} not found`);
    }
    
    // Check for conflicts
    const conflict = this.checkConflict(key, value, masterId);
    if (conflict) {
      this.stats.conflicts++;
      value = this.resolveConflict(conflict, value);
    }
    
    // Write to local master
    master.data.set(key, value);
    master.writeLog.push({
      key,
      value,
      timestamp: Date.now(),
      masterId
    });
    
    this.stats.writes++;
    
    // Replicate to other masters
    this.replicateToOtherMasters(masterId, key, value);
    
    return { success: true, key, value, masterId };
  }

  /**
   * Check for conflicts
   */
  checkConflict(key, newValue, writerId) {
    for (const master of this.masters) {
      if (master.id !== writerId && master.data.has(key)) {
        const existingValue = master.data.get(key);
        const existingWrite = master.writeLog.find(w => w.key === key);
        
        if (existingWrite && Date.now() - existingWrite.timestamp < this.replicationDelay * 2) {
          return {
            key,
            existingValue,
            newValue,
            existingMaster: master.id,
            newMaster: writerId
          };
        }
      }
    }
    return null;
  }

  /**
   * Resolve conflict
   */
  resolveConflict(conflict, newValue) {
    switch (this.conflictResolution) {
      case 'last-write-wins':
        return newValue;
      case 'first-write-wins':
        return conflict.existingValue;
      case 'merge':
        // Simple merge strategy
        if (typeof conflict.existingValue === 'object' && typeof newValue === 'object') {
          return { ...conflict.existingValue, ...newValue };
        }
        return newValue;
      default:
        return newValue;
    }
  }

  /**
   * Replicate to other masters
   */
  async replicateToOtherMasters(writerId, key, value) {
    const otherMasters = this.masters.filter(m => m.id !== writerId);
    
    const replicationPromises = otherMasters.map(async (master) => {
      await new Promise(resolve => setTimeout(resolve, this.replicationDelay));
      
      master.data.set(key, value);
      master.lastSync = Date.now();
      
      this.stats.replications++;
    });
    
    await Promise.all(replicationPromises);
  }

  /**
   * Read from any master
   */
  read(key, masterId = null) {
    if (masterId) {
      const master = this.masters.find(m => m.id === masterId);
      if (master && master.data.has(key)) {
        return { value: master.data.get(key), source: master.id };
      }
    }
    
    // Try all masters
    for (const master of this.masters) {
      if (master.data.has(key)) {
        return { value: master.data.get(key), source: master.id };
      }
    }
    
    return null;
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      masters: this.masters.map(master => ({
        id: master.id,
        dataSize: master.data.size,
        writeLogSize: master.writeLog.length,
        lastSync: new Date(master.lastSync).toISOString()
      })),
      stats: this.stats,
      conflictResolution: this.conflictResolution
    };
  }
}

// Example usage
async function demonstrateReplication() {
  console.log('=== Master-Slave Replication ===\n');
  
  const msReplication = new MasterSlaveReplication({
    numSlaves: 2,
    replicationDelay: 50
  });
  
  // Write to master
  await msReplication.write('user1', 'Alice');
  await msReplication.write('user2', 'Bob');
  
  // Wait for replication
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Read from slaves
  console.log('Read from slave:', msReplication.read('user1', true));
  console.log('Read from slave:', msReplication.read('user2', true));
  
  console.log('\nStatus:', msReplication.getStatus());
  
  console.log('\n=== Master-Master Replication ===\n');
  
  const mmReplication = new MasterMasterReplication({
    numMasters: 2,
    replicationDelay: 50,
    conflictResolution: 'last-write-wins'
  });
  
  // Write to different masters
  await mmReplication.write('master-0', 'key1', 'value1');
  await mmReplication.write('master-1', 'key2', 'value2');
  
  // Wait for replication
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Read from any master
  console.log('Read key1:', mmReplication.read('key1'));
  console.log('Read key2:', mmReplication.read('key2'));
  
  console.log('\nStatus:', mmReplication.getStatus());
}

if (require.main === module) {
  demonstrateReplication();
}

module.exports = { MasterSlaveReplication, MasterMasterReplication };

