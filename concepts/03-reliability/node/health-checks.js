/**
 * Health Checks Implementation
 * Demonstrates liveness, readiness, and startup probes
 */

class HealthChecker {
  constructor() {
    this.isAlive = true;
    this.isReady = false;
    this.isStarted = false;
    this.dependencies = {
      database: false,
      cache: false,
      externalService: false
    };
    this.startTime = Date.now();
    this.initializationTime = 2000; // 2 seconds
  }

  /**
   * Initialize service (simulate startup)
   */
  async initialize() {
    console.log('Initializing service...');
    
    // Simulate initialization
    await new Promise(resolve => setTimeout(resolve, this.initializationTime));
    
    // Check dependencies
    await this.checkDependencies();
    
    this.isStarted = true;
    this.isReady = true;
    console.log('Service initialized and ready');
  }

  /**
   * Check dependencies
   */
  async checkDependencies() {
    // Simulate dependency checks
    this.dependencies.database = Math.random() > 0.2; // 80% chance of success
    this.dependencies.cache = Math.random() > 0.1; // 90% chance of success
    this.dependencies.externalService = Math.random() > 0.15; // 85% chance of success
    
    return this.dependencies;
  }

  /**
   * Liveness Probe
   * Checks if the service is alive (not deadlocked, crashed, etc.)
   */
  livenessProbe() {
    if (!this.isAlive) {
      return {
        status: 'unhealthy',
        message: 'Service is not alive',
        timestamp: new Date().toISOString()
      };
    }

    // Check if process is responsive
    const uptime = Date.now() - this.startTime;
    
    return {
      status: 'healthy',
      message: 'Service is alive',
      uptime: `${Math.floor(uptime / 1000)}s`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Readiness Probe
   * Checks if the service is ready to serve traffic
   */
  readinessProbe() {
    if (!this.isReady) {
      return {
        status: 'not ready',
        message: 'Service is not ready to serve traffic',
        dependencies: this.dependencies,
        timestamp: new Date().toISOString()
      };
    }

    // Check if all critical dependencies are available
    const criticalDeps = ['database', 'cache'];
    const unavailableDeps = criticalDeps.filter(dep => !this.dependencies[dep]);

    if (unavailableDeps.length > 0) {
      return {
        status: 'not ready',
        message: 'Critical dependencies unavailable',
        unavailableDependencies: unavailableDeps,
        dependencies: this.dependencies,
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: 'ready',
      message: 'Service is ready to serve traffic',
      dependencies: this.dependencies,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Startup Probe
   * Checks if the service has finished starting up
   */
  startupProbe() {
    if (this.isStarted) {
      return {
        status: 'started',
        message: 'Service has started',
        initializationTime: `${this.initializationTime}ms`,
        timestamp: new Date().toISOString()
      };
    }

    const elapsed = Date.now() - this.startTime;
    const remaining = Math.max(0, this.initializationTime - elapsed);

    return {
      status: 'starting',
      message: 'Service is still starting',
      elapsed: `${elapsed}ms`,
      estimatedRemaining: `${remaining}ms`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Combined health check
   */
  healthCheck() {
    return {
      liveness: this.livenessProbe(),
      readiness: this.readinessProbe(),
      startup: this.startupProbe(),
      overall: this.getOverallHealth()
    };
  }

  /**
   * Get overall health status
   */
  getOverallHealth() {
    const liveness = this.livenessProbe();
    const readiness = this.readinessProbe();
    const startup = this.startupProbe();

    if (liveness.status !== 'healthy') {
      return 'unhealthy';
    }

    if (startup.status === 'starting') {
      return 'starting';
    }

    if (readiness.status !== 'ready') {
      return 'not ready';
    }

    return 'healthy';
  }

  /**
   * Simulate service failure
   */
  simulateFailure() {
    this.isAlive = false;
    console.log('Service failure simulated');
  }

  /**
   * Simulate dependency failure
   */
  simulateDependencyFailure(dependency) {
    if (this.dependencies.hasOwnProperty(dependency)) {
      this.dependencies[dependency] = false;
      this.isReady = false;
      console.log(`Dependency failure simulated: ${dependency}`);
    }
  }

  /**
   * Recover from failure
   */
  recover() {
    this.isAlive = true;
    this.isReady = true;
    Object.keys(this.dependencies).forEach(key => {
      this.dependencies[key] = true;
    });
    console.log('Service recovered');
  }
}

/**
 * Health Check Server
 */
class HealthCheckServer {
  constructor(healthChecker, port = 3000) {
    this.healthChecker = healthChecker;
    this.port = port;
  }

  /**
   * Start health check endpoints
   */
  start() {
    // Simulate HTTP server endpoints
    console.log(`Health check server started on port ${this.port}`);
    console.log('Endpoints:');
    console.log('  GET /health - Combined health check');
    console.log('  GET /live - Liveness probe');
    console.log('  GET /ready - Readiness probe');
    console.log('  GET /startup - Startup probe');
  }

  /**
   * Handle health check request
   */
  handleRequest(path) {
    switch (path) {
      case '/health':
        return this.healthChecker.healthCheck();
      case '/live':
        return this.healthChecker.livenessProbe();
      case '/ready':
        return this.healthChecker.readinessProbe();
      case '/startup':
        return this.healthChecker.startupProbe();
      default:
        return { error: 'Not found' };
    }
  }
}

// Example usage
async function demonstrateHealthChecks() {
  console.log('=== Health Checks Demonstration ===\n');

  const healthChecker = new HealthChecker();
  const server = new HealthCheckServer(healthChecker);

  // Initial state (starting)
  console.log('1. Initial state (starting):');
  console.log(JSON.stringify(healthChecker.startupProbe(), null, 2));

  // Initialize service
  await healthChecker.initialize();

  // After initialization
  console.log('\n2. After initialization:');
  console.log(JSON.stringify(healthChecker.healthCheck(), null, 2));

  // Simulate dependency failure
  console.log('\n3. Simulating dependency failure:');
  healthChecker.simulateDependencyFailure('database');
  console.log(JSON.stringify(healthChecker.readinessProbe(), null, 2));

  // Recover
  console.log('\n4. Recovering:');
  healthChecker.recover();
  console.log(JSON.stringify(healthChecker.healthCheck(), null, 2));

  // Simulate service failure
  console.log('\n5. Simulating service failure:');
  healthChecker.simulateFailure();
  console.log(JSON.stringify(healthChecker.livenessProbe(), null, 2));
}

if (require.main === module) {
  demonstrateHealthChecks();
}

module.exports = { HealthChecker, HealthCheckServer };

