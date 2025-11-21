/**
 * Throughput Optimization
 * Demonstrates techniques to maximize the number of requests processed per unit time
 */

/**
 * Worker Pool
 */
class WorkerPool {
  constructor(config) {
    this.numWorkers = config.numWorkers || 4;
    this.workers = [];
    this.queue = [];
    this.active = 0;
  }

  /**
   * Initialize workers
   */
  async initialize(workerFunction) {
    for (let i = 0; i < this.numWorkers; i++) {
      this.workers.push({
        id: i,
        busy: false,
        process: async (task) => {
          this.active++;
          try {
            return await workerFunction(task);
          } finally {
            this.active--;
            this.processQueue();
          }
        }
      });
    }
  }

  /**
   * Add task to queue
   */
  async execute(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process queue
   */
  processQueue() {
    if (this.queue.length === 0) {
      return;
    }

    const availableWorker = this.workers.find(w => !w.busy);
    if (!availableWorker) {
      return;
    }

    const item = this.queue.shift();
    availableWorker.busy = true;

    availableWorker.process(item.task)
      .then(item.resolve)
      .catch(item.reject)
      .finally(() => {
        availableWorker.busy = false;
        this.processQueue();
      });
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalWorkers: this.numWorkers,
      active: this.active,
      queued: this.queue.length,
      utilization: ((this.active / this.numWorkers) * 100).toFixed(2) + '%'
    };
  }
}

/**
 * Parallel Processing
 */
class ParallelProcessor {
  constructor(config = {}) {
    this.maxConcurrent = config.maxConcurrent || 10;
    this.batchSize = config.batchSize || 100;
  }

  /**
   * Process items in parallel batches
   */
  async process(items, processor) {
    const results = [];
    
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      const batchResults = await this.processBatch(batch, processor);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Process batch with concurrency limit
   */
  async processBatch(items, processor) {
    const results = [];
    const executing = [];

    for (const item of items) {
      const promise = processor(item).then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      executing.push(promise);
      results.push(promise);

      if (executing.length >= this.maxConcurrent) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }
}

/**
 * Load Balancer
 */
class LoadBalancer {
  constructor(instances, algorithm = 'round-robin') {
    this.instances = instances;
    this.algorithm = algorithm;
    this.currentIndex = 0;
    this.stats = new Map();
    
    instances.forEach(inst => {
      this.stats.set(inst.name, {
        requests: 0,
        active: 0,
        totalTime: 0
      });
    });
  }

  /**
   * Route request
   */
  async route(request) {
    const instance = this.selectInstance();
    const stats = this.stats.get(instance.name);
    const startTime = Date.now();

    stats.requests++;
    stats.active++;

    try {
      const result = await instance.process(request);
      stats.totalTime += Date.now() - startTime;
      return result;
    } catch (error) {
      throw error;
    } finally {
      stats.active--;
    }
  }

  selectInstance() {
    switch (this.algorithm) {
      case 'round-robin':
        const instance = this.instances[this.currentIndex % this.instances.length];
        this.currentIndex++;
        return instance;

      case 'least-connections':
        return this.instances.reduce((least, current) => {
          const leastStats = this.stats.get(least.name);
          const currentStats = this.stats.get(current.name);
          return leastStats.active < currentStats.active ? least : current;
        });

      case 'weighted':
        // Simple weighted round-robin
        return this.instances[this.currentIndex++ % this.instances.length];

      default:
        return this.instances[0];
    }
  }

  getStats() {
    return Array.from(this.stats.entries()).map(([name, stats]) => ({
      name,
      requests: stats.requests,
      active: stats.active,
      avgTime: stats.requests > 0 
        ? Math.round(stats.totalTime / stats.requests)
        : 0
    }));
  }
}

/**
 * Message Queue for Throughput
 */
class ThroughputQueue {
  constructor(config = {}) {
    this.queue = [];
    this.consumers = [];
    this.concurrency = config.concurrency || 5;
    this.processing = false;
  }

  /**
   * Add message
   */
  enqueue(message) {
    this.queue.push(message);
    this.processQueue();
  }

  /**
   * Register consumer
   */
  registerConsumer(consumer) {
    this.consumers.push(consumer);
  }

  /**
   * Process queue
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.consumers.length > 0) {
      const batch = this.queue.splice(0, this.concurrency);
      
      const promises = batch.map(message => {
        const consumer = this.consumers[0]; // Simple: use first consumer
        return consumer(message).catch(error => {
          console.error('Consumer error:', error);
        });
      });

      await Promise.all(promises);
    }

    this.processing = false;
  }

  getStats() {
    return {
      queued: this.queue.length,
      consumers: this.consumers.length,
      processing: this.processing
    };
  }
}

/**
 * Batch Processor
 */
class BatchProcessor {
  constructor(config = {}) {
    this.batchSize = config.batchSize || 100;
    this.batchTimeout = config.batchTimeout || 1000;
    this.batch = [];
    this.processing = false;
  }

  /**
   * Add item to batch
   */
  async add(item) {
    return new Promise((resolve, reject) => {
      this.batch.push({ item, resolve, reject });

      if (this.batch.length >= this.batchSize) {
        this.processBatch();
      } else if (!this.processing) {
        setTimeout(() => this.processBatch(), this.batchTimeout);
      }
    });
  }

  async processBatch() {
    if (this.processing || this.batch.length === 0) {
      return;
    }

    this.processing = true;
    const currentBatch = this.batch.splice(0, this.batchSize);

    try {
      // Process batch
      const results = await this.processItems(currentBatch.map(b => b.item));
      
      currentBatch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      currentBatch.forEach(item => {
        item.reject(error);
      });
    }

    this.processing = false;

    if (this.batch.length > 0) {
      setTimeout(() => this.processBatch(), this.batchTimeout);
    }
  }

  async processItems(items) {
    // Simulate batch processing
    await new Promise(resolve => setTimeout(resolve, 50));
    return items.map((item, i) => ({ ...item, processed: true, index: i }));
  }
}

/**
 * Throughput Optimizer
 */
class ThroughputOptimizer {
  constructor(config = {}) {
    this.workerPool = new WorkerPool({ numWorkers: config.workers || 4 });
    this.parallelProcessor = new ParallelProcessor({ 
      maxConcurrent: config.maxConcurrent || 10 
    });
    this.batchProcessor = new BatchProcessor({
      batchSize: config.batchSize || 100,
      batchTimeout: config.batchTimeout || 1000
    });
  }

  /**
   * Process with worker pool
   */
  async processWithWorkers(task) {
    return await this.workerPool.execute(task);
  }

  /**
   * Process in parallel
   */
  async processParallel(items, processor) {
    return await this.parallelProcessor.process(items, processor);
  }

  /**
   * Process in batches
   */
  async processBatch(item) {
    return await this.batchProcessor.add(item);
  }
}

// Example usage
async function demonstrateThroughputOptimization() {
  console.log('=== Throughput Optimization ===\n');

  // Worker Pool
  console.log('=== Worker Pool ===\n');
  const workerPool = new WorkerPool({ numWorkers: 4 });
  
  await workerPool.initialize(async (task) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { task, processed: true };
  });

  const start1 = Date.now();
  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(workerPool.execute({ id: i }));
  }
  await Promise.all(promises);
  console.log(`Processed 20 tasks: ${Date.now() - start1}ms`);
  console.log('Worker Pool Stats:', workerPool.getStats());

  // Parallel Processing
  console.log('\n=== Parallel Processing ===\n');
  const parallelProcessor = new ParallelProcessor({ maxConcurrent: 5 });

  const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
  const start2 = Date.now();
  const results = await parallelProcessor.process(items, async (item) => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return { ...item, processed: true };
  });
  console.log(`Processed ${results.length} items: ${Date.now() - start2}ms`);

  // Load Balancer
  console.log('\n=== Load Balancer ===\n');
  const instances = [
    { name: 'instance-1', process: async (req) => ({ ...req, instance: '1' }) },
    { name: 'instance-2', process: async (req) => ({ ...req, instance: '2' }) },
    { name: 'instance-3', process: async (req) => ({ ...req, instance: '3' }) }
  ];

  const loadBalancer = new LoadBalancer(instances, 'round-robin');
  
  const start3 = Date.now();
  const requests = [];
  for (let i = 0; i < 30; i++) {
    requests.push(loadBalancer.route({ id: i }));
  }
  await Promise.all(requests);
  console.log(`Processed 30 requests: ${Date.now() - start3}ms`);
  console.log('Load Balancer Stats:', loadBalancer.getStats());
}

if (require.main === module) {
  demonstrateThroughputOptimization();
}

module.exports = {
  WorkerPool,
  ParallelProcessor,
  LoadBalancer,
  ThroughputQueue,
  BatchProcessor,
  ThroughputOptimizer
};

