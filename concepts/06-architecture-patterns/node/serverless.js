/**
 * Serverless Architecture Implementation
 * Demonstrates function-as-a-service, event triggers, and stateless functions
 */

/**
 * Serverless Function
 */
class ServerlessFunction {
  constructor(name, handler, config = {}) {
    this.name = name;
    this.handler = handler;
    this.timeout = config.timeout || 30000;
    this.memory = config.memory || 128;
    this.environment = config.environment || {};
    this.invocations = 0;
    this.errors = 0;
    this.totalExecutionTime = 0;
  }

  /**
   * Invoke function
   */
  async invoke(event, context = {}) {
    const startTime = Date.now();
    this.invocations++;

    try {
      // Set context
      const functionContext = {
        functionName: this.name,
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        memoryLimitInMB: this.memory,
        getRemainingTimeInMillis: () => {
          const elapsed = Date.now() - startTime;
          return Math.max(0, this.timeout - elapsed);
        },
        ...context
      };

      // Execute handler
      const result = await Promise.race([
        this.handler(event, functionContext),
        this.createTimeout()
      ]);

      const executionTime = Date.now() - startTime;
      this.totalExecutionTime += executionTime;

      return {
        success: true,
        result,
        executionTime,
        requestId: functionContext.requestId
      };
    } catch (error) {
      this.errors++;
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        error: error.message,
        executionTime,
        requestId: context.requestId
      };
    }
  }

  /**
   * Create timeout promise
   */
  createTimeout() {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Function timeout')), this.timeout);
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      name: this.name,
      invocations: this.invocations,
      errors: this.errors,
      successRate: this.invocations > 0 
        ? ((this.invocations - this.errors) / this.invocations * 100).toFixed(2) + '%'
        : '0%',
      avgExecutionTime: this.invocations > 0
        ? Math.round(this.totalExecutionTime / this.invocations)
        : 0
    };
  }
}

/**
 * Serverless Platform
 */
class ServerlessPlatform {
  constructor() {
    this.functions = new Map();
    this.triggers = new Map();
    this.eventBus = null;
  }

  /**
   * Deploy function
   */
  deployFunction(functionDef) {
    this.functions.set(functionDef.name, functionDef);
    console.log(`Function ${functionDef.name} deployed`);
    return functionDef;
  }

  /**
   * Create function
   */
  createFunction(name, handler, config) {
    const func = new ServerlessFunction(name, handler, config);
    return this.deployFunction(func);
  }

  /**
   * Invoke function
   */
  async invokeFunction(functionName, event) {
    const func = this.functions.get(functionName);
    if (!func) {
      throw new Error(`Function ${functionName} not found`);
    }
    return await func.invoke(event);
  }

  /**
   * Register trigger
   */
  registerTrigger(triggerType, functionName, config = {}) {
    if (!this.triggers.has(triggerType)) {
      this.triggers.set(triggerType, []);
    }

    this.triggers.get(triggerType).push({
      functionName,
      config
    });
  }

  /**
   * Trigger event
   */
  async trigger(triggerType, event) {
    const triggers = this.triggers.get(triggerType) || [];
    
    const results = [];
    for (const trigger of triggers) {
      try {
        const result = await this.invokeFunction(trigger.functionName, event);
        results.push({ functionName: trigger.functionName, result });
      } catch (error) {
        results.push({ functionName: trigger.functionName, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get platform stats
   */
  getStats() {
    return {
      totalFunctions: this.functions.size,
      totalTriggers: Array.from(this.triggers.values()).reduce((sum, triggers) => sum + triggers.length, 0),
      functions: Array.from(this.functions.values()).map(f => f.getStats())
    };
  }
}

/**
 * HTTP Trigger Handler
 */
class HTTPTrigger {
  constructor(platform) {
    this.platform = platform;
  }

  /**
   * Handle HTTP request
   */
  async handleRequest(method, path, body, headers) {
    // Route to function based on path
    const functionName = this.routeToFunction(path);
    
    if (!functionName) {
      return {
        statusCode: 404,
        body: { error: 'Function not found' }
      };
    }

    const event = {
      httpMethod: method,
      path,
      body,
      headers,
      queryStringParameters: this.parseQuery(path)
    };

    const result = await this.platform.invokeFunction(functionName, event);

    if (result.success) {
      return {
        statusCode: 200,
        body: result.result
      };
    } else {
      return {
        statusCode: 500,
        body: { error: result.error }
      };
    }
  }

  routeToFunction(path) {
    // Simple routing
    if (path === '/api/users') return 'listUsers';
    if (path.match(/^\/api\/users\/(\d+)$/)) return 'getUser';
    if (path === '/api/users' && method === 'POST') return 'createUser';
    return null;
  }

  parseQuery(path) {
    // Simple query parsing
    return {};
  }
}

/**
 * Event Trigger Handler
 */
class EventTrigger {
  constructor(platform) {
    this.platform = platform;
  }

  /**
   * Emit event
   */
  async emit(eventType, eventData) {
    return await this.platform.trigger(eventType, eventData);
  }
}

/**
 * Scheduled Trigger Handler
 */
class ScheduledTrigger {
  constructor(platform) {
    this.platform = platform;
    this.schedules = new Map();
  }

  /**
   * Schedule function
   */
  schedule(functionName, cronExpression) {
    this.schedules.set(functionName, {
      cron: cronExpression,
      lastRun: null,
      nextRun: this.calculateNextRun(cronExpression)
    });

    // Simulate scheduled execution
    this.startScheduler(functionName);
  }

  calculateNextRun(cronExpression) {
    // Simplified: run every minute for demo
    return Date.now() + 60000;
  }

  startScheduler(functionName) {
    const schedule = this.schedules.get(functionName);
    if (!schedule) return;

    const now = Date.now();
    if (now >= schedule.nextRun) {
      this.platform.invokeFunction(functionName, {
        scheduled: true,
        timestamp: now
      });
      schedule.lastRun = now;
      schedule.nextRun = this.calculateNextRun(schedule.cron);
    }
  }
}

/**
 * Example Serverless Functions
 */

// User list function
async function listUsersHandler(event, context) {
  // Simulate database query
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return {
    users: [
      { id: '1', name: 'John', email: 'john@example.com' },
      { id: '2', name: 'Jane', email: 'jane@example.com' }
    ]
  };
}

// Get user function
async function getUserHandler(event, context) {
  const userId = event.path.split('/').pop();
  
  await new Promise(resolve => setTimeout(resolve, 30));
  
  return {
    id: userId,
    name: 'John Doe',
    email: 'john@example.com'
  };
}

// Create user function
async function createUserHandler(event, context) {
  const userData = event.body;
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return {
    id: Date.now().toString(),
    ...userData,
    createdAt: new Date().toISOString()
  };
}

// Image processing function
async function processImageHandler(event, context) {
  const imageData = event.imageData;
  
  // Simulate image processing
  await new Promise(resolve => setTimeout(resolve, 200));
  
  return {
    processed: true,
    size: imageData.length,
    format: 'jpeg'
  };
}

// Scheduled cleanup function
async function cleanupHandler(event, context) {
  console.log('Running scheduled cleanup...');
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    cleaned: true,
    timestamp: new Date().toISOString()
  };
}

// Event handler function
async function orderCreatedHandler(event, context) {
  console.log('Order created event:', event);
  
  // Process order
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return {
    processed: true,
    orderId: event.orderId
  };
}

// Example usage
async function demonstrateServerless() {
  console.log('=== Serverless Architecture ===\n');

  // Create platform
  const platform = new ServerlessPlatform();

  // Deploy functions
  console.log('=== Deploying Functions ===\n');
  platform.createFunction('listUsers', listUsersHandler, {
    timeout: 5000,
    memory: 256
  });

  platform.createFunction('getUser', getUserHandler, {
    timeout: 3000,
    memory: 128
  });

  platform.createFunction('createUser', createUserHandler, {
    timeout: 5000,
    memory: 256
  });

  platform.createFunction('processImage', processImageHandler, {
    timeout: 10000,
    memory: 512
  });

  platform.createFunction('cleanup', cleanupHandler, {
    timeout: 30000,
    memory: 128
  });

  platform.createFunction('orderCreated', orderCreatedHandler, {
    timeout: 5000,
    memory: 256
  });

  // Register triggers
  console.log('\n=== Registering Triggers ===\n');
  platform.registerTrigger('http', 'listUsers', { path: '/api/users' });
  platform.registerTrigger('http', 'getUser', { path: '/api/users/:id' });
  platform.registerTrigger('http', 'createUser', { path: '/api/users', method: 'POST' });
  platform.registerTrigger('s3.upload', 'processImage');
  platform.registerTrigger('order.created', 'orderCreated');
  
  const scheduledTrigger = new ScheduledTrigger(platform);
  scheduledTrigger.schedule('cleanup', '0 * * * *'); // Every hour

  // Invoke functions
  console.log('\n=== Invoking Functions ===\n');
  
  const listResult = await platform.invokeFunction('listUsers', {});
  console.log('List Users:', listResult);

  const getUserResult = await platform.invokeFunction('getUser', {
    path: '/api/users/123'
  });
  console.log('Get User:', getUserResult);

  const createResult = await platform.invokeFunction('createUser', {
    body: { name: 'John', email: 'john@example.com' }
  });
  console.log('Create User:', createResult);

  // Trigger events
  console.log('\n=== Triggering Events ===\n');
  const eventResults = await platform.trigger('order.created', {
    orderId: 'order-123',
    userId: 'user-456'
  });
  console.log('Event Results:', eventResults);

  // Platform stats
  console.log('\n=== Platform Statistics ===\n');
  console.log(platform.getStats());
}

if (require.main === module) {
  demonstrateServerless();
}

module.exports = {
  ServerlessFunction,
  ServerlessPlatform,
  HTTPTrigger,
  EventTrigger,
  ScheduledTrigger
};

