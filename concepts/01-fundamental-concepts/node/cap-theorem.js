/**
 * CAP Theorem Demonstrations
 * Shows different consistency and availability trade-offs
 */

/**
 * CP System (Consistency + Partition Tolerance)
 * Sacrifices Availability
 */
class CPSystem {
  constructor() {
    this.data = new Map();
    this.isPartitioned = false;
  }

  setPartitioned(partitioned) {
    this.isPartitioned = partitioned;
  }

  async write(key, value) {
    if (this.isPartitioned) {
      // In CP system, we reject writes during partition
      throw new Error('System unavailable due to partition');
    }

    // Ensure consistency across all nodes
    this.data.set(key, value);
    await this.replicateToAllNodes(key, value);
    return { success: true, key, value };
  }

  async read(key) {
    if (this.isPartitioned) {
      // In CP system, we reject reads during partition
      throw new Error('System unavailable due to partition');
    }

    return this.data.get(key);
  }

  async replicateToAllNodes(key, value) {
    // Simulate replication to ensure consistency
    console.log(`Replicating ${key}=${value} to all nodes`);
    return new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * AP System (Availability + Partition Tolerance)
 * Sacrifices Consistency
 */
class APSystem {
  constructor() {
    this.data = new Map();
    this.pendingWrites = [];
    this.isPartitioned = false;
  }

  setPartitioned(partitioned) {
    this.isPartitioned = partitioned;
  }

  async write(key, value) {
    // In AP system, we always accept writes
    this.data.set(key, value);
    
    if (this.isPartitioned) {
      // Queue writes for later replication
      this.pendingWrites.push({ key, value, timestamp: Date.now() });
      console.log(`Write queued due to partition: ${key}=${value}`);
    } else {
      await this.replicateToAllNodes(key, value);
    }

    return { success: true, key, value, consistent: !this.isPartitioned };
  }

  async read(key) {
    // In AP system, we always return data (may be stale)
    const value = this.data.get(key);
    return {
      value,
      consistent: !this.isPartitioned,
      note: this.isPartitioned ? 'Data may be stale due to partition' : 'Data is consistent'
    };
  }

  async replicateToAllNodes(key, value) {
    // Simulate replication
    console.log(`Replicating ${key}=${value} to all nodes`);
    return new Promise(resolve => setTimeout(resolve, 100));
  }

  async resolvePartition() {
    // When partition resolves, sync pending writes
    console.log('Partition resolved, syncing pending writes...');
    for (const write of this.pendingWrites) {
      await this.replicateToAllNodes(write.key, write.value);
    }
    this.pendingWrites = [];
    this.isPartitioned = false;
  }
}

/**
 * CA System (Consistency + Availability)
 * Only possible in single-node systems (no partition tolerance)
 */
class CASystem {
  constructor() {
    this.data = new Map();
  }

  async write(key, value) {
    // Single node, always consistent and available
    this.data.set(key, value);
    return { success: true, key, value, consistent: true };
  }

  async read(key) {
    return {
      value: this.data.get(key),
      consistent: true
    };
  }
}

// Example usage
async function demonstrateCAP() {
  console.log('=== CP System (Consistency + Partition Tolerance) ===');
  const cpSystem = new CPSystem();
  
  try {
    await cpSystem.write('user1', 'Alice');
    console.log('Write successful:', await cpSystem.read('user1'));
    
    cpSystem.setPartitioned(true);
    try {
      await cpSystem.write('user2', 'Bob');
    } catch (error) {
      console.log('Write rejected:', error.message);
    }
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n=== AP System (Availability + Partition Tolerance) ===');
  const apSystem = new APSystem();
  
  await apSystem.write('user1', 'Alice');
  console.log('Write successful:', await apSystem.read('user1'));
  
  apSystem.setPartitioned(true);
  await apSystem.write('user2', 'Bob');
  const readResult = await apSystem.read('user2');
  console.log('Read during partition:', readResult);
  
  await apSystem.resolvePartition();
  console.log('After partition resolved:', await apSystem.read('user2'));

  console.log('\n=== CA System (Consistency + Availability) ===');
  const caSystem = new CASystem();
  
  await caSystem.write('user1', 'Alice');
  console.log('Write successful:', await caSystem.read('user1'));
}

// Run demonstration
if (require.main === module) {
  demonstrateCAP().catch(console.error);
}

module.exports = { CPSystem, APSystem, CASystem };

