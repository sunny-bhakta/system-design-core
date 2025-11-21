/**
 * Microservices Architecture Pattern
 * Demonstrates service communication and service discovery
 */

/**
 * Service Registry
 */
class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.healthChecks = new Map();
  }

  /**
   * Register service
   */
  register(serviceName, serviceInfo) {
    const service = {
      ...serviceInfo,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'healthy'
    };
    
    this.services.set(serviceName, service);
    console.log(`Service registered: ${serviceName} at ${serviceInfo.url}`);
    
    return service;
  }

  /**
   * Deregister service
   */
  deregister(serviceName) {
    const removed = this.services.delete(serviceName);
    this.healthChecks.delete(serviceName);
    if (removed) {
      console.log(`Service deregistered: ${serviceName}`);
    }
    return removed;
  }

  /**
   * Discover service
   */
  discover(serviceName) {
    const service = this.services.get(serviceName);
    if (!service || service.status !== 'healthy') {
      return null;
    }
    return service;
  }

  /**
   * Get all services
   */
  getAllServices() {
    return Array.from(this.services.entries()).map(([name, info]) => ({
      name,
      ...info
    }));
  }

  /**
   * Update heartbeat
   */
  updateHeartbeat(serviceName) {
    const service = this.services.get(serviceName);
    if (service) {
      service.lastHeartbeat = Date.now();
    }
  }

  /**
   * Mark service unhealthy
   */
  markUnhealthy(serviceName) {
    const service = this.services.get(serviceName);
    if (service) {
      service.status = 'unhealthy';
      console.log(`Service marked unhealthy: ${serviceName}`);
    }
  }

  /**
   * Cleanup stale services
   */
  cleanupStaleServices(timeout = 30000) {
    const now = Date.now();
    for (const [name, service] of this.services.entries()) {
      if (now - service.lastHeartbeat > timeout) {
        this.markUnhealthy(name);
      }
    }
  }
}

/**
 * Service Client
 */
class ServiceClient {
  constructor(serviceRegistry) {
    this.registry = serviceRegistry;
    this.circuitBreakers = new Map();
  }

  /**
   * Call service
   */
  async call(serviceName, endpoint, options = {}) {
    const service = this.registry.discover(serviceName);
    
    if (!service) {
      throw new Error(`Service ${serviceName} not found or unhealthy`);
    }

    // Simulate service call
    const url = `${service.url}${endpoint}`;
    console.log(`Calling ${serviceName}: ${url}`);
    
    // Simulate network call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate success/failure
        if (Math.random() > 0.1) { // 90% success rate
          resolve({
            service: serviceName,
            endpoint,
            data: { result: 'success' },
            timestamp: Date.now()
          });
        } else {
          reject(new Error(`Service ${serviceName} call failed`));
        }
      }, 100);
    });
  }

  /**
   * Call with retry
   */
  async callWithRetry(serviceName, endpoint, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.call(serviceName, endpoint);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 100; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}

/**
 * API Gateway
 */
class APIGateway {
  constructor(serviceRegistry) {
    this.registry = serviceRegistry;
    this.client = new ServiceClient(serviceRegistry);
    this.routes = new Map();
  }

  /**
   * Register route
   */
  registerRoute(path, serviceName, serviceEndpoint) {
    this.routes.set(path, { serviceName, serviceEndpoint });
    console.log(`Route registered: ${path} -> ${serviceName}${serviceEndpoint}`);
  }

  /**
   * Handle request
   */
  async handleRequest(path, method = 'GET', body = null) {
    const route = this.routes.get(path);
    
    if (!route) {
      return {
        status: 404,
        error: 'Route not found'
      };
    }

    try {
      const result = await this.client.callWithRetry(
        route.serviceName,
        route.serviceEndpoint
      );
      
      return {
        status: 200,
        data: result
      };
    } catch (error) {
      return {
        status: 503,
        error: error.message
      };
    }
  }
}

// Example usage
async function demonstrateMicroservices() {
  console.log('=== Microservices Architecture ===\n');

  // Create service registry
  const registry = new ServiceRegistry();

  // Register services
  registry.register('user-service', {
    url: 'http://user-service:3001',
    version: '1.0.0',
    endpoints: ['/users', '/users/:id']
  });

  registry.register('order-service', {
    url: 'http://order-service:3002',
    version: '1.0.0',
    endpoints: ['/orders', '/orders/:id']
  });

  registry.register('product-service', {
    url: 'http://product-service:3003',
    version: '1.0.0',
    endpoints: ['/products', '/products/:id']
  });

  console.log('\nRegistered services:');
  console.log(registry.getAllServices());

  // Create API Gateway
  const gateway = new APIGateway(registry);

  // Register routes
  gateway.registerRoute('/api/users', 'user-service', '/users');
  gateway.registerRoute('/api/orders', 'order-service', '/orders');
  gateway.registerRoute('/api/products', 'product-service', '/products');

  // Handle requests through gateway
  console.log('\n=== Handling Requests ===');
  const userResult = await gateway.handleRequest('/api/users');
  console.log('User service response:', userResult);

  const orderResult = await gateway.handleRequest('/api/orders');
  console.log('Order service response:', orderResult);

  // Service discovery
  console.log('\n=== Service Discovery ===');
  const userService = registry.discover('user-service');
  console.log('Discovered user-service:', userService);

  // Cleanup stale services
  console.log('\n=== Cleanup ===');
  registry.cleanupStaleServices(1000);
}

if (require.main === module) {
  demonstrateMicroservices();
}

module.exports = { ServiceRegistry, ServiceClient, APIGateway };

