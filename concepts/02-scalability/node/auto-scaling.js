/**
 * Auto-scaling Implementation
 * Demonstrates horizontal and vertical auto-scaling strategies
 */

/**
 * Horizontal Auto-scaling
 */
class HorizontalAutoScaler {
  constructor(config) {
    this.minInstances = config.minInstances || 1;
    this.maxInstances = config.maxInstances || 10;
    this.targetCPU = config.targetCPU || 70; // 70% CPU target
    this.targetMemory = config.targetMemory || 80; // 80% memory target
    this.scaleUpThreshold = config.scaleUpThreshold || 80;
    this.scaleDownThreshold = config.scaleDownThreshold || 30;
    this.cooldownPeriod = config.cooldownPeriod || 300000; // 5 minutes
    
    this.instances = [];
    this.lastScaleTime = Date.now();
    this.scalingHistory = [];
    
    // Initialize with minimum instances
    this.initialize();
  }

  /**
   * Initialize with minimum instances
   */
  initialize() {
    for (let i = 0; i < this.minInstances; i++) {
      this.addInstance();
    }
  }

  /**
   * Add new instance
   */
  addInstance() {
    const instance = {
      id: `instance-${Date.now()}-${Math.random()}`,
      createdAt: Date.now(),
      metrics: {
        cpu: 0,
        memory: 0,
        requests: 0
      }
    };
    
    this.instances.push(instance);
    console.log(`Added instance: ${instance.id} (Total: ${this.instances.length})`);
    
    return instance;
  }

  /**
   * Remove instance
   */
  removeInstance() {
    if (this.instances.length <= this.minInstances) {
      return null;
    }
    
    // Remove instance with lowest load
    const sorted = [...this.instances].sort((a, b) => {
      const loadA = (a.metrics.cpu + a.metrics.memory) / 2;
      const loadB = (b.metrics.cpu + b.metrics.memory) / 2;
      return loadA - loadB;
    });
    
    const toRemove = sorted[0];
    const index = this.instances.indexOf(toRemove);
    this.instances.splice(index, 1);
    
    console.log(`Removed instance: ${toRemove.id} (Total: ${this.instances.length})`);
    return toRemove;
  }

  /**
   * Update instance metrics
   */
  updateMetrics(instanceId, metrics) {
    const instance = this.instances.find(inst => inst.id === instanceId);
    if (instance) {
      instance.metrics = { ...instance.metrics, ...metrics };
    }
  }

  /**
   * Calculate average metrics
   */
  getAverageMetrics() {
    if (this.instances.length === 0) {
      return { cpu: 0, memory: 0, requests: 0 };
    }
    
    const totals = this.instances.reduce((acc, inst) => {
      acc.cpu += inst.metrics.cpu;
      acc.memory += inst.metrics.memory;
      acc.requests += inst.metrics.requests;
      return acc;
    }, { cpu: 0, memory: 0, requests: 0 });
    
    return {
      cpu: totals.cpu / this.instances.length,
      memory: totals.memory / this.instances.length,
      requests: totals.requests / this.instances.length
    };
  }

  /**
   * Check if scaling is needed
   */
  checkScaling() {
    const now = Date.now();
    
    // Cooldown period check
    if (now - this.lastScaleTime < this.cooldownPeriod) {
      return { action: 'none', reason: 'cooldown' };
    }
    
    const avgMetrics = this.getAverageMetrics();
    
    // Scale up conditions
    if (this.instances.length < this.maxInstances) {
      if (avgMetrics.cpu > this.scaleUpThreshold || 
          avgMetrics.memory > this.scaleUpThreshold) {
        return { action: 'scale-up', metrics: avgMetrics };
      }
    }
    
    // Scale down conditions
    if (this.instances.length > this.minInstances) {
      if (avgMetrics.cpu < this.scaleDownThreshold && 
          avgMetrics.memory < this.scaleDownThreshold) {
        return { action: 'scale-down', metrics: avgMetrics };
      }
    }
    
    return { action: 'none', metrics: avgMetrics };
  }

  /**
   * Execute scaling decision
   */
  executeScaling() {
    const decision = this.checkScaling();
    
    if (decision.action === 'scale-up') {
      const instance = this.addInstance();
      this.lastScaleTime = Date.now();
      this.scalingHistory.push({
        action: 'scale-up',
        timestamp: Date.now(),
        instanceCount: this.instances.length,
        metrics: decision.metrics
      });
      return { action: 'scaled-up', instance };
    }
    
    if (decision.action === 'scale-down') {
      const instance = this.removeInstance();
      if (instance) {
        this.lastScaleTime = Date.now();
        this.scalingHistory.push({
          action: 'scale-down',
          timestamp: Date.now(),
          instanceCount: this.instances.length,
          metrics: decision.metrics
        });
        return { action: 'scaled-down', instance };
      }
    }
    
    return { action: 'no-action', decision };
  }

  /**
   * Get current state
   */
  getState() {
    return {
      instanceCount: this.instances.length,
      minInstances: this.minInstances,
      maxInstances: this.maxInstances,
      averageMetrics: this.getAverageMetrics(),
      scalingHistory: this.scalingHistory.slice(-10) // Last 10 scaling events
    };
  }
}

/**
 * Predictive Auto-scaling
 */
class PredictiveAutoScaler extends HorizontalAutoScaler {
  constructor(config) {
    super(config);
    this.history = []; // Historical metrics
    this.predictionWindow = config.predictionWindow || 300000; // 5 minutes
  }

  /**
   * Record metrics history
   */
  recordMetrics() {
    const avgMetrics = this.getAverageMetrics();
    this.history.push({
      timestamp: Date.now(),
      ...avgMetrics,
      instanceCount: this.instances.length
    });
    
    // Keep only last hour of history
    const oneHourAgo = Date.now() - 3600000;
    this.history = this.history.filter(h => h.timestamp > oneHourAgo);
  }

  /**
   * Predict future load
   */
  predictLoad() {
    if (this.history.length < 10) {
      return null; // Not enough data
    }
    
    // Simple linear regression for prediction
    const recent = this.history.slice(-10);
    const cpuTrend = this.calculateTrend(recent.map(h => h.cpu));
    const memoryTrend = this.calculateTrend(recent.map(h => h.memory));
    
    const futureTime = Date.now() + this.predictionWindow;
    const predictedCPU = recent[recent.length - 1].cpu + cpuTrend * (this.predictionWindow / 60000);
    const predictedMemory = recent[recent.length - 1].memory + memoryTrend * (this.predictionWindow / 60000);
    
    return {
      predictedCPU: Math.max(0, Math.min(100, predictedCPU)),
      predictedMemory: Math.max(0, Math.min(100, predictedMemory)),
      cpuTrend,
      memoryTrend
    };
  }

  /**
   * Calculate trend (simple linear regression slope)
   */
  calculateTrend(values) {
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Predictive scaling check
   */
  predictiveScaling() {
    this.recordMetrics();
    const prediction = this.predictLoad();
    
    if (!prediction) {
      return super.checkScaling();
    }
    
    // Scale up if predicted load is high
    if (this.instances.length < this.maxInstances) {
      if (prediction.predictedCPU > this.scaleUpThreshold || 
          prediction.predictedMemory > this.scaleUpThreshold) {
        return { 
          action: 'predictive-scale-up', 
          prediction,
          reason: 'predicted high load'
        };
      }
    }
    
    return super.checkScaling();
  }
}

// Example usage
function demonstrateAutoScaling() {
  console.log('=== Horizontal Auto-scaling ===\n');
  
  const scaler = new HorizontalAutoScaler({
    minInstances: 2,
    maxInstances: 5,
    targetCPU: 70,
    scaleUpThreshold: 80,
    scaleDownThreshold: 30,
    cooldownPeriod: 60000 // 1 minute for demo
  });
  
  console.log('Initial state:', scaler.getState());
  
  // Simulate high load
  console.log('\nSimulating high load...');
  scaler.instances.forEach(inst => {
    scaler.updateMetrics(inst.id, { cpu: 85, memory: 90, requests: 1000 });
  });
  
  const scaleUp = scaler.executeScaling();
  console.log('Scaling decision:', scaleUp);
  console.log('State after scaling:', scaler.getState());
  
  // Simulate low load
  console.log('\nSimulating low load...');
  scaler.instances.forEach(inst => {
    scaler.updateMetrics(inst.id, { cpu: 20, memory: 25, requests: 100 });
  });
  
  const scaleDown = scaler.executeScaling();
  console.log('Scaling decision:', scaleDown);
  console.log('State after scaling:', scaler.getState());
  
  console.log('\n=== Predictive Auto-scaling ===\n');
  const predictiveScaler = new PredictiveAutoScaler({
    minInstances: 2,
    maxInstances: 5,
    scaleUpThreshold: 80,
    predictionWindow: 300000
  });
  
  // Record some history
  for (let i = 0; i < 15; i++) {
    predictiveScaler.instances.forEach(inst => {
      predictiveScaler.updateMetrics(inst.id, { 
        cpu: 50 + i * 3, 
        memory: 60 + i * 2, 
        requests: 500 + i * 50 
      });
    });
    predictiveScaler.recordMetrics();
  }
  
  const prediction = predictiveScaler.predictLoad();
  console.log('Load prediction:', prediction);
}

if (require.main === module) {
  demonstrateAutoScaling();
}

module.exports = { HorizontalAutoScaler, PredictiveAutoScaler };

