/**
 * Disaster Recovery Implementation
 * Demonstrates backup, restore, and recovery procedures
 */

/**
 * Backup Manager
 */
class BackupManager {
  constructor(config = {}) {
    this.backupInterval = config.backupInterval || 3600000; // 1 hour
    this.retentionDays = config.retentionDays || 30;
    this.backups = [];
    this.storage = config.storage || new Map(); // Simulated storage
  }

  /**
   * Create backup
   */
  async createBackup(data, metadata = {}) {
    const backup = {
      id: `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(data)), // Deep copy
      metadata: {
        ...metadata,
        version: metadata.version || '1.0',
        type: metadata.type || 'full'
      },
      size: JSON.stringify(data).length,
      status: 'completed'
    };

    // Store backup
    this.storage.set(backup.id, backup);
    this.backups.push(backup);

    console.log(`Backup created: ${backup.id} (${backup.size} bytes)`);
    
    // Cleanup old backups
    this.cleanupOldBackups();

    return backup;
  }

  /**
   * Restore from backup
   */
  async restore(backupId) {
    const backup = this.storage.get(backupId);
    
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    console.log(`Restoring from backup: ${backupId}`);
    console.log(`Backup timestamp: ${new Date(backup.timestamp).toISOString()}`);

    return backup.data;
  }

  /**
   * Get latest backup
   */
  getLatestBackup() {
    if (this.backups.length === 0) {
      return null;
    }

    return this.backups.sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  /**
   * List backups
   */
  listBackups() {
    return this.backups
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(backup => ({
        id: backup.id,
        timestamp: new Date(backup.timestamp).toISOString(),
        size: backup.size,
        type: backup.metadata.type
      }));
  }

  /**
   * Cleanup old backups
   */
  cleanupOldBackups() {
    const cutoffTime = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    
    this.backups = this.backups.filter(backup => {
      if (backup.timestamp < cutoffTime) {
        this.storage.delete(backup.id);
        return false;
      }
      return true;
    });
  }

  /**
   * Start automatic backups
   */
  startAutomaticBackups(dataProvider) {
    const backup = async () => {
      try {
        const data = await dataProvider();
        await this.createBackup(data, { type: 'automatic' });
      } catch (error) {
        console.error('Automatic backup failed:', error.message);
      }

      setTimeout(backup, this.backupInterval);
    };

    backup();
  }
}

/**
 * Replication Manager
 * Maintains replicas in different locations
 */
class ReplicationManager {
  constructor(config = {}) {
    this.replicas = config.replicas || [];
    this.replicationStrategy = config.strategy || 'synchronous'; // synchronous, asynchronous
    this.primary = null;
  }

  /**
   * Set primary
   */
  setPrimary(primary) {
    this.primary = primary;
  }

  /**
   * Add replica
   */
  addReplica(replica) {
    this.replicas.push(replica);
  }

  /**
   * Replicate data
   */
  async replicate(data) {
    if (!this.primary) {
      throw new Error('No primary set');
    }

    // Write to primary
    await this.primary.write(data);

    // Replicate to replicas
    const replicationPromises = this.replicas.map(async (replica) => {
      try {
        if (this.replicationStrategy === 'synchronous') {
          await replica.write(data);
        } else {
          // Asynchronous - don't wait
          replica.write(data).catch(error => {
            console.error(`Replication to ${replica.name} failed:`, error.message);
          });
        }
      } catch (error) {
        console.error(`Replication to ${replica.name} failed:`, error.message);
      }
    });

    if (this.replicationStrategy === 'synchronous') {
      await Promise.all(replicationPromises);
    }

    return { success: true, replicated: this.replicas.length };
  }

  /**
   * Failover to replica
   */
  async failover(replicaName) {
    const replica = this.replicas.find(r => r.name === replicaName);
    
    if (!replica) {
      throw new Error(`Replica ${replicaName} not found`);
    }

    console.log(`Failing over to replica: ${replicaName}`);
    
    // Promote replica to primary
    const oldPrimary = this.primary;
    this.primary = replica;
    
    // Add old primary as replica
    if (oldPrimary) {
      this.replicas.push(oldPrimary);
      this.replicas = this.replicas.filter(r => r.name !== replicaName);
    }

    return { newPrimary: replica.name, success: true };
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      primary: this.primary ? this.primary.name : null,
      replicas: this.replicas.map(r => ({
        name: r.name,
        healthy: r.healthy !== false
      })),
      strategy: this.replicationStrategy
    };
  }
}

/**
 * Data Store (simulated)
 */
class DataStore {
  constructor(name) {
    this.name = name;
    this.data = new Map();
    this.healthy = true;
  }

  async write(data) {
    // Simulate write operation
    await new Promise(resolve => setTimeout(resolve, 10));
    
    for (const [key, value] of Object.entries(data)) {
      this.data.set(key, value);
    }
    
    return { success: true, store: this.name };
  }

  async read(key) {
    await new Promise(resolve => setTimeout(resolve, 5));
    return this.data.get(key);
  }

  async healthCheck() {
    return this.healthy;
  }
}

/**
 * Recovery Point Objective (RPO) Manager
 */
class RPOManager {
  constructor(config = {}) {
    this.maxDataLoss = config.maxDataLoss || 3600000; // 1 hour
    this.lastBackupTime = null;
    this.backupManager = config.backupManager;
  }

  /**
   * Check RPO compliance
   */
  checkRPO() {
    if (!this.lastBackupTime) {
      return {
        compliant: false,
        message: 'No backup has been performed',
        dataLossRisk: 'HIGH'
      };
    }

    const timeSinceBackup = Date.now() - this.lastBackupTime;
    const compliant = timeSinceBackup <= this.maxDataLoss;

    return {
      compliant,
      timeSinceBackup,
      maxDataLoss: this.maxDataLoss,
      dataLossRisk: compliant ? 'LOW' : 'HIGH',
      message: compliant 
        ? 'RPO is within acceptable limits'
        : `RPO exceeded by ${timeSinceBackup - this.maxDataLoss}ms`
    };
  }

  /**
   * Record backup
   */
  recordBackup() {
    this.lastBackupTime = Date.now();
  }
}

/**
 * Recovery Time Objective (RTO) Manager
 */
class RTOManager {
  constructor(config = {}) {
    this.maxRecoveryTime = config.maxRecoveryTime || 3600000; // 1 hour
    this.recoveryProcedures = config.recoveryProcedures || [];
  }

  /**
   * Estimate recovery time
   */
  estimateRecoveryTime(procedure) {
    // Simulate recovery time estimation
    const baseTime = 300000; // 5 minutes
    const procedureTime = this.recoveryProcedures.find(p => p.name === procedure)?.time || 0;
    
    return baseTime + procedureTime;
  }

  /**
   * Check RTO compliance
   */
  checkRTO(estimatedTime) {
    const compliant = estimatedTime <= this.maxRecoveryTime;

    return {
      compliant,
      estimatedTime,
      maxRecoveryTime: this.maxRecoveryTime,
      message: compliant
        ? 'Estimated recovery time is within RTO'
        : `Estimated recovery time exceeds RTO by ${estimatedTime - this.maxRecoveryTime}ms`
    };
  }
}

/**
 * Disaster Recovery Plan
 */
class DisasterRecoveryPlan {
  constructor() {
    this.backupManager = new BackupManager({ retentionDays: 30 });
    this.replicationManager = new ReplicationManager({ strategy: 'asynchronous' });
    this.rpoManager = new RPOManager({ maxDataLoss: 3600000 });
    this.rtoManager = new RTOManager({ maxRecoveryTime: 3600000 });
  }

  /**
   * Execute recovery
   */
  async executeRecovery(recoveryType = 'backup') {
    console.log(`\n=== Executing ${recoveryType} Recovery ===\n`);

    switch (recoveryType) {
      case 'backup':
        const latestBackup = this.backupManager.getLatestBackup();
        if (!latestBackup) {
          throw new Error('No backup available for recovery');
        }
        return await this.backupManager.restore(latestBackup.id);

      case 'replica':
        const status = this.replicationManager.getStatus();
        if (status.replicas.length === 0) {
          throw new Error('No replicas available for recovery');
        }
        const healthyReplica = status.replicas.find(r => r.healthy);
        if (healthyReplica) {
          return await this.replicationManager.failover(healthyReplica.name);
        }
        throw new Error('No healthy replicas available');

      default:
        throw new Error(`Unknown recovery type: ${recoveryType}`);
    }
  }

  /**
   * Get recovery status
   */
  getRecoveryStatus() {
    return {
      rpo: this.rpoManager.checkRPO(),
      rto: this.rtoManager.checkRTO(300000), // Example: 5 minutes
      backups: {
        count: this.backupManager.backups.length,
        latest: this.backupManager.getLatestBackup()?.id || null
      },
      replication: this.replicationManager.getStatus()
    };
  }
}

// Example usage
async function demonstrateDisasterRecovery() {
  console.log('=== Disaster Recovery ===\n');

  // Backup Manager
  console.log('=== Backup Manager ===\n');
  const backupManager = new BackupManager({ retentionDays: 7 });

  const data = {
    users: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }],
    products: [{ id: 1, name: 'Product 1' }]
  };

  const backup1 = await backupManager.createBackup(data, { type: 'full' });
  console.log('Backup created:', backup1.id);

  // Modify data
  data.users.push({ id: 3, name: 'Bob' });

  const backup2 = await backupManager.createBackup(data, { type: 'incremental' });
  console.log('Backup created:', backup2.id);

  console.log('\nBackups:', backupManager.listBackups());

  // Restore
  const restored = await backupManager.restore(backup1.id);
  console.log('\nRestored data:', restored);

  // Replication
  console.log('\n=== Replication Manager ===\n');
  const primary = new DataStore('primary');
  const replica1 = new DataStore('replica-1');
  const replica2 = new DataStore('replica-2');

  const replicationManager = new ReplicationManager({ strategy: 'asynchronous' });
  replicationManager.setPrimary(primary);
  replicationManager.addReplica(replica1);
  replicationManager.addReplica(replica2);

  await replicationManager.replicate({ key1: 'value1', key2: 'value2' });
  console.log('Replication status:', replicationManager.getStatus());

  // Disaster Recovery Plan
  console.log('\n=== Disaster Recovery Plan ===\n');
  const drPlan = new DisasterRecoveryPlan();
  drPlan.backupManager = backupManager;
  drPlan.replicationManager = replicationManager;
  drPlan.rpoManager.recordBackup();

  const status = drPlan.getRecoveryStatus();
  console.log('Recovery Status:', JSON.stringify(status, null, 2));
}

if (require.main === module) {
  demonstrateDisasterRecovery();
}

module.exports = {
  BackupManager,
  ReplicationManager,
  DataStore,
  RPOManager,
  RTOManager,
  DisasterRecoveryPlan
};

