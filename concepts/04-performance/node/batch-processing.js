/**
 * Batch Processing Implementation
 * Demonstrates batch operations for improved performance
 */

/**
 * Batch Processor
 */
class BatchProcessor {
  constructor(config = {}) {
    this.batchSize = config.batchSize || 10;
    this.flushInterval = config.flushInterval || 5000; // 5 seconds
    this.batch = [];
    this.processing = false;
    this.stats = {
      processed: 0,
      batches: 0,
      errors: 0
    };
    
    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Add item to batch
   */
  async add(item) {
    this.batch.push({
      item,
      timestamp: Date.now()
    });

    // Auto-flush if batch is full
    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Process batch
   */
  async processBatch(batch) {
    // Simulate batch processing
    console.log(`Processing batch of ${batch.length} items...`);
    
    const results = [];
    for (const entry of batch) {
      try {
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push({ success: true, item: entry.item });
        this.stats.processed++;
      } catch (error) {
        results.push({ success: false, item: entry.item, error });
        this.stats.errors++;
      }
    }
    
    return results;
  }

  /**
   * Flush current batch
   */
  async flush() {
    if (this.processing || this.batch.length === 0) {
      return;
    }

    this.processing = true;
    const batchToProcess = [...this.batch];
    this.batch = [];

    try {
      const results = await this.processBatch(batchToProcess);
      this.stats.batches++;
      return results;
    } finally {
      this.processing = false;
    }
  }

  /**
   * Start flush timer
   */
  startFlushTimer() {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      pendingItems: this.batch.length,
      processing: this.processing
    };
  }

  /**
   * Shutdown and flush remaining
   */
  async shutdown() {
    // Stop flush timer
    clearInterval(this.flushTimer);
    
    // Flush remaining items
    while (this.batch.length > 0) {
      await this.flush();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

/**
 * Database Batch Operations
 */
class DatabaseBatchOperations {
  constructor() {
    this.insertBatch = [];
    this.updateBatch = [];
    this.deleteBatch = [];
  }

  /**
   * Batch insert
   */
  async batchInsert(items) {
    if (items.length === 0) return [];
    
    // Simulate batch INSERT
    console.log(`Batch inserting ${items.length} records...`);
    await new Promise(resolve => setTimeout(resolve, items.length * 5));
    
    return items.map((item, index) => ({
      id: Date.now() + index,
      ...item,
      inserted: true
    }));
  }

  /**
   * Batch update
   */
  async batchUpdate(updates) {
    if (updates.length === 0) return [];
    
    // Simulate batch UPDATE
    console.log(`Batch updating ${updates.length} records...`);
    await new Promise(resolve => setTimeout(resolve, updates.length * 3));
    
    return updates.map(update => ({
      ...update,
      updated: true,
      updatedAt: Date.now()
    }));
  }

  /**
   * Batch delete
   */
  async batchDelete(ids) {
    if (ids.length === 0) return [];
    
    // Simulate batch DELETE
    console.log(`Batch deleting ${ids.length} records...`);
    await new Promise(resolve => setTimeout(resolve, ids.length * 2));
    
    return ids.map(id => ({ id, deleted: true }));
  }
}

// Example usage
async function demonstrateBatchProcessing() {
  console.log('=== Batch Processing ===\n');

  // Batch processor
  const processor = new BatchProcessor({
    batchSize: 5,
    flushInterval: 3000
  });

  // Add items
  console.log('Adding items to batch...');
  for (let i = 1; i <= 12; i++) {
    await processor.add({ id: i, data: `item-${i}` });
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('Stats:', processor.getStats());

  // Flush remaining
  await processor.flush();
  console.log('Final stats:', processor.getStats());

  // Database batch operations
  console.log('\n=== Database Batch Operations ===\n');
  const dbOps = new DatabaseBatchOperations();

  // Batch insert
  const items = Array.from({ length: 10 }, (_, i) => ({
    name: `Item ${i}`,
    value: i * 10
  }));
  const inserted = await dbOps.batchInsert(items);
  console.log(`Inserted ${inserted.length} records`);

  // Batch update
  const updates = inserted.slice(0, 5).map(item => ({
    id: item.id,
    name: `Updated ${item.name}`
  }));
  const updated = await dbOps.batchUpdate(updates);
  console.log(`Updated ${updated.length} records`);

  // Batch delete
  const ids = inserted.slice(5).map(item => item.id);
  const deleted = await dbOps.batchDelete(ids);
  console.log(`Deleted ${deleted.length} records`);
}

if (require.main === module) {
  demonstrateBatchProcessing();
}

module.exports = { BatchProcessor, DatabaseBatchOperations };

