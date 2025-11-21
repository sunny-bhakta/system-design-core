/**
 * Partitioning Implementation
 * Demonstrates different partitioning strategies: range, hash, list, composite
 */

/**
 * Range Partitioning
 */
class RangePartitioning {
  constructor(partitions) {
    this.partitions = partitions.sort((a, b) => a.range[0] - b.range[0]);
  }

  /**
   * Get partition for key
   */
  getPartition(key) {
    const keyNum = Number(key);
    
    if (isNaN(keyNum)) {
      throw new Error('Key must be numeric for range partitioning');
    }

    for (const partition of this.partitions) {
      const [min, max] = partition.range;
      if (keyNum >= min && keyNum < max) {
        return partition;
      }
    }

    // Return last partition if key exceeds all ranges
    return this.partitions[this.partitions.length - 1];
  }

  /**
   * Add partition
   */
  addPartition(name, range) {
    const partition = {
      name,
      range,
      data: new Map()
    };
    this.partitions.push(partition);
    this.partitions.sort((a, b) => a.range[0] - b.range[0]);
    return partition;
  }

  /**
   * Split partition
   */
  splitPartition(partitionName, splitPoint) {
    const partition = this.partitions.find(p => p.name === partitionName);
    if (!partition) {
      throw new Error(`Partition ${partitionName} not found`);
    }

    const [min, max] = partition.range;
    
    // Create new partition
    const newPartition = this.addPartition(
      `${partitionName}_split`,
      [splitPoint, max]
    );

    // Update original partition range
    partition.range = [min, splitPoint];

    // Redistribute data
    for (const [key, value] of partition.data.entries()) {
      const keyNum = Number(key);
      if (keyNum >= splitPoint) {
        newPartition.data.set(key, value);
        partition.data.delete(key);
      }
    }

    return { original: partition, new: newPartition };
  }
}

/**
 * Hash Partitioning
 */
class HashPartitioning {
  constructor(numPartitions) {
    this.numPartitions = numPartitions;
    this.partitions = [];
    
    for (let i = 0; i < numPartitions; i++) {
      this.partitions.push({
        id: i,
        name: `partition_${i}`,
        data: new Map()
      });
    }
  }

  /**
   * Hash function
   */
  hash(key) {
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
   * Get partition for key
   */
  getPartition(key) {
    const hashValue = this.hash(key);
    const partitionIndex = hashValue % this.numPartitions;
    return this.partitions[partitionIndex];
  }

  /**
   * Add partition (requires rehashing)
   */
  addPartition() {
    const newPartition = {
      id: this.numPartitions,
      name: `partition_${this.numPartitions}`,
      data: new Map()
    };

    this.partitions.push(newPartition);
    this.numPartitions++;

    // Rehash all data
    this.rehash();
    
    return newPartition;
  }

  /**
   * Rehash all data
   */
  rehash() {
    const allData = [];
    
    // Collect all data
    for (const partition of this.partitions) {
      for (const [key, value] of partition.data.entries()) {
        allData.push({ key, value });
      }
      partition.data.clear();
    }

    // Redistribute
    for (const { key, value } of allData) {
      const partition = this.getPartition(key);
      partition.data.set(key, value);
    }
  }
}

/**
 * List Partitioning
 */
class ListPartitioning {
  constructor(partitions) {
    this.partitions = new Map();
    
    for (const partition of partitions) {
      this.partitions.set(partition.name, {
        name: partition.name,
        values: new Set(partition.values),
        data: new Map()
      });
    }
  }

  /**
   * Get partition for key
   */
  getPartition(key) {
    for (const [name, partition] of this.partitions.entries()) {
      if (partition.values.has(key)) {
        return partition;
      }
    }

    // Default partition
    return this.partitions.get('default') || Array.from(this.partitions.values())[0];
  }

  /**
   * Add partition
   */
  addPartition(name, values) {
    this.partitions.set(name, {
      name,
      values: new Set(values),
      data: new Map()
    });
    return this.partitions.get(name);
  }
}

/**
 * Composite Partitioning
 */
class CompositePartitioning {
  constructor(primaryStrategy, secondaryStrategy) {
    this.primaryStrategy = primaryStrategy;
    this.secondaryStrategy = secondaryStrategy;
  }

  /**
   * Get partition for key
   */
  getPartition(key) {
    // First level partitioning
    const primaryPartition = this.primaryStrategy.getPartition(key);
    
    // Second level partitioning within primary
    if (!primaryPartition.subPartitions) {
      primaryPartition.subPartitions = this.secondaryStrategy.partitions;
    }

    const secondaryPartition = this.secondaryStrategy.getPartition(key);
    
    return {
      primary: primaryPartition,
      secondary: secondaryPartition,
      fullPath: `${primaryPartition.name}/${secondaryPartition.name}`
    };
  }
}

/**
 * Directory-Based Partitioning
 */
class DirectoryPartitioning {
  constructor() {
    this.directory = new Map();
    this.partitions = new Map();
  }

  /**
   * Create partition
   */
  createPartition(name) {
    const partition = {
      name,
      data: new Map()
    };
    this.partitions.set(name, partition);
    return partition;
  }

  /**
   * Map key to partition
   */
  mapKey(key, partitionName) {
    this.directory.set(key, partitionName);
  }

  /**
   * Get partition for key
   */
  getPartition(key) {
    const partitionName = this.directory.get(key);
    if (!partitionName) {
      return null;
    }
    return this.partitions.get(partitionName);
  }

  /**
   * Remap key to different partition
   */
  remapKey(key, newPartitionName) {
    if (!this.partitions.has(newPartitionName)) {
      throw new Error(`Partition ${newPartitionName} not found`);
    }
    this.directory.set(key, newPartitionName);
    return true;
  }
}

/**
 * Consistent Hashing Partitioning
 */
class ConsistentHashingPartitioning {
  constructor(numReplicas = 3) {
    this.numReplicas = numReplicas;
    this.ring = new Map();
    this.partitions = [];
    this.sortedKeys = [];
  }

  /**
   * Add partition
   */
  addPartition(name) {
    const partition = {
      name,
      hash: this.hash(name),
      data: new Map()
    };

    this.partitions.push(partition);
    
    // Add replicas to ring
    for (let i = 0; i < this.numReplicas; i++) {
      const replicaHash = this.hash(`${name}:${i}`);
      this.ring.set(replicaHash, partition);
      this.sortedKeys.push(replicaHash);
    }

    this.sortedKeys.sort((a, b) => a - b);
    return partition;
  }

  /**
   * Hash function
   */
  hash(key) {
    let hash = 0;
    const keyStr = String(key);
    for (let i = 0; i < keyStr.length; i++) {
      const char = keyStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Get partition for key
   */
  getPartition(key) {
    if (this.sortedKeys.length === 0) {
      return null;
    }

    const keyHash = this.hash(key);
    
    // Find first partition with hash >= keyHash
    for (const ringHash of this.sortedKeys) {
      if (ringHash >= keyHash) {
        return this.ring.get(ringHash);
      }
    }

    // Wrap around to first partition
    return this.ring.get(this.sortedKeys[0]);
  }

  /**
   * Remove partition
   */
  removePartition(name) {
    const partition = this.partitions.find(p => p.name === name);
    if (!partition) {
      return false;
    }

    // Remove from ring
    for (let i = 0; i < this.numReplicas; i++) {
      const replicaHash = this.hash(`${name}:${i}`);
      this.ring.delete(replicaHash);
      this.sortedKeys = this.sortedKeys.filter(k => k !== replicaHash);
    }

    // Remove partition
    this.partitions = this.partitions.filter(p => p.name !== name);
    return true;
  }
}

/**
 * Partition Manager
 */
class PartitionManager {
  constructor(strategy) {
    this.strategy = strategy;
    this.stats = {
      totalKeys: 0,
      partitionCounts: new Map()
    };
  }

  /**
   * Insert data
   */
  insert(key, value) {
    const partition = this.strategy.getPartition(key);
    if (!partition) {
      throw new Error('No partition found for key');
    }

    partition.data.set(key, value);
    this.stats.totalKeys++;
    
    const count = this.stats.partitionCounts.get(partition.name) || 0;
    this.stats.partitionCounts.set(partition.name, count + 1);

    return partition;
  }

  /**
   * Get data
   */
  get(key) {
    const partition = this.strategy.getPartition(key);
    if (!partition) {
      return null;
    }

    return partition.data.get(key) || null;
  }

  /**
   * Get partition statistics
   */
  getStats() {
    return {
      totalKeys: this.stats.totalKeys,
      partitionCounts: Object.fromEntries(this.stats.partitionCounts),
      partitions: this.strategy.partitions?.map(p => ({
        name: p.name,
        size: p.data?.size || 0
      })) || []
    };
  }
}

// Example usage
function demonstratePartitioning() {
  console.log('=== Partitioning Strategies ===\n');

  // Range Partitioning
  console.log('=== Range Partitioning ===\n');
  const rangePartitioning = new RangePartitioning([
    { name: 'p1', range: [0, 1000], data: new Map() },
    { name: 'p2', range: [1000, 2000], data: new Map() },
    { name: 'p3', range: [2000, 3000], data: new Map() }
  ]);

  const p1 = rangePartitioning.getPartition(500);
  const p2 = rangePartitioning.getPartition(1500);
  const p3 = rangePartitioning.getPartition(2500);
  console.log('Partition for 500:', p1.name);
  console.log('Partition for 1500:', p2.name);
  console.log('Partition for 2500:', p3.name);

  // Hash Partitioning
  console.log('\n=== Hash Partitioning ===\n');
  const hashPartitioning = new HashPartitioning(3);
  
  const hashP1 = hashPartitioning.getPartition('user-123');
  const hashP2 = hashPartitioning.getPartition('user-456');
  const hashP3 = hashPartitioning.getPartition('user-789');
  console.log('Partition for user-123:', hashP1.name);
  console.log('Partition for user-456:', hashP2.name);
  console.log('Partition for user-789:', hashP3.name);

  // List Partitioning
  console.log('\n=== List Partitioning ===\n');
  const listPartitioning = new ListPartitioning([
    { name: 'us', values: ['US', 'USA'] },
    { name: 'uk', values: ['UK', 'GB'] },
    { name: 'default', values: [] }
  ]);

  const listP1 = listPartitioning.getPartition('US');
  const listP2 = listPartitioning.getPartition('UK');
  console.log('Partition for US:', listP1.name);
  console.log('Partition for UK:', listP2.name);

  // Consistent Hashing
  console.log('\n=== Consistent Hashing ===\n');
  const consistentHashing = new ConsistentHashingPartitioning(3);
  
  consistentHashing.addPartition('node1');
  consistentHashing.addPartition('node2');
  consistentHashing.addPartition('node3');

  const chP1 = consistentHashing.getPartition('key1');
  const chP2 = consistentHashing.getPartition('key2');
  console.log('Partition for key1:', chP1.name);
  console.log('Partition for key2:', chP2.name);

  // Partition Manager
  console.log('\n=== Partition Manager ===\n');
  const manager = new PartitionManager(hashPartitioning);
  
  manager.insert('key1', 'value1');
  manager.insert('key2', 'value2');
  manager.insert('key3', 'value3');
  
  console.log('Partition Stats:', manager.getStats());
}

if (require.main === module) {
  demonstratePartitioning();
}

module.exports = {
  RangePartitioning,
  HashPartitioning,
  ListPartitioning,
  CompositePartitioning,
  DirectoryPartitioning,
  ConsistentHashingPartitioning,
  PartitionManager
};

