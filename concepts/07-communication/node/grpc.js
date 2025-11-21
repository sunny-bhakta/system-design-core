/**
 * gRPC Implementation
 * Demonstrates gRPC service definition, client-server communication, and streaming
 */

/**
 * gRPC Service Definition
 */
class ServiceDefinition {
  constructor(name) {
    this.name = name;
    this.methods = new Map();
  }

  /**
   * Define RPC method
   */
  defineMethod(name, requestType, responseType, streaming = {}) {
    this.methods.set(name, {
      name,
      requestType,
      responseType,
      requestStream: streaming.requestStream || false,
      responseStream: streaming.responseStream || false
    });
    return this;
  }

  /**
   * Get method definition
   */
  getMethod(name) {
    return this.methods.get(name);
  }
}

/**
 * gRPC Server
 */
class GRPCServer {
  constructor() {
    this.services = new Map();
    this.handlers = new Map();
  }

  /**
   * Register service
   */
  registerService(serviceDefinition, implementation) {
    this.services.set(serviceDefinition.name, serviceDefinition);
    
    for (const [methodName, methodDef] of serviceDefinition.methods.entries()) {
      const handlerKey = `${serviceDefinition.name}.${methodName}`;
      this.handlers.set(handlerKey, {
        method: methodDef,
        handler: implementation[methodName]
      });
    }
  }

  /**
   * Handle RPC call
   */
  async handleCall(serviceName, methodName, request, metadata = {}) {
    const handlerKey = `${serviceName}.${methodName}`;
    const handler = this.handlers.get(handlerKey);

    if (!handler) {
      throw new Error(`Method ${serviceName}.${methodName} not found`);
    }

    try {
      if (handler.method.requestStream || handler.method.responseStream) {
        return await this.handleStreaming(handler, request, metadata);
      } else {
        return await handler.handler(request, metadata);
      }
    } catch (error) {
      return {
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message
        }
      };
    }
  }

  /**
   * Handle streaming
   */
  async handleStreaming(handler, request, metadata) {
    if (handler.method.responseStream) {
      // Server streaming
      return this.handleServerStreaming(handler, request, metadata);
    } else if (handler.method.requestStream) {
      // Client streaming
      return this.handleClientStreaming(handler, request, metadata);
    }
  }

  /**
   * Handle server streaming
   */
  async* handleServerStreaming(handler, request, metadata) {
    // Simulate streaming response
    for (let i = 0; i < 5; i++) {
      yield await handler.handler(request, metadata, i);
    }
  }

  /**
   * Handle client streaming
   */
  async handleClientStreaming(handler, requests, metadata) {
    const results = [];
    for await (const request of requests) {
      const result = await handler.handler(request, metadata);
      results.push(result);
    }
    return { results };
  }
}

/**
 * gRPC Client
 */
class GRPCClient {
  constructor(serviceName, server) {
    this.serviceName = serviceName;
    this.server = server;
    this.metadata = {};
  }

  /**
   * Set metadata
   */
  setMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
  }

  /**
   * Unary RPC call
   */
  async call(methodName, request) {
    return await this.server.handleCall(this.serviceName, methodName, request, this.metadata);
  }

  /**
   * Server streaming RPC
   */
  async* serverStream(methodName, request) {
    const handlerKey = `${this.serviceName}.${methodName}`;
    const handler = this.server.handlers.get(handlerKey);

    if (!handler || !handler.method.responseStream) {
      throw new Error(`Method ${methodName} is not a server streaming method`);
    }

    yield* await this.server.handleServerStreaming(handler, request, this.metadata);
  }

  /**
   * Client streaming RPC
   */
  async clientStream(methodName, requests) {
    const handlerKey = `${this.serviceName}.${methodName}`;
    const handler = this.server.handlers.get(handlerKey);

    if (!handler || !handler.method.requestStream) {
      throw new Error(`Method ${methodName} is not a client streaming method`);
    }

    return await this.server.handleClientStreaming(handler, requests, this.metadata);
  }

  /**
   * Bidirectional streaming RPC
   */
  async* bidirectionalStream(methodName, requests) {
    // Simplified bidirectional streaming
    for await (const request of requests) {
      yield await this.call(methodName, request);
    }
  }
}

/**
 * User Service Example
 */
class UserService {
  constructor() {
    this.users = new Map();
  }

  /**
   * Get user (Unary)
   */
  async getUser(request) {
    const user = this.users.get(request.id);
    if (!user) {
      throw new Error('User not found');
    }
    return { user };
  }

  /**
   * Create user (Unary)
   */
  async createUser(request) {
    const user = {
      id: Date.now().toString(),
      name: request.name,
      email: request.email,
      createdAt: new Date().toISOString()
    };
    this.users.set(user.id, user);
    return { user };
  }

  /**
   * List users (Server Streaming)
   */
  async* listUsers(request) {
    const limit = request.limit || 10;
    let count = 0;
    
    for (const user of this.users.values()) {
      if (count >= limit) break;
      yield { user };
      count++;
    }
  }

  /**
   * Batch create users (Client Streaming)
   */
  async batchCreateUsers(requests) {
    const created = [];
    for await (const request of requests) {
      const user = {
        id: Date.now().toString() + Math.random(),
        name: request.name,
        email: request.email
      };
      this.users.set(user.id, user);
      created.push(user);
    }
    return { users: created, count: created.length };
  }
}

/**
 * Calculator Service Example
 */
class CalculatorService {
  /**
   * Add (Unary)
   */
  async add(request) {
    return {
      result: request.a + request.b
    };
  }

  /**
   * Multiply (Unary)
   */
  async multiply(request) {
    return {
      result: request.a * request.b
    };
  }

  /**
   * Generate numbers (Server Streaming)
   */
  async* generateNumbers(request) {
    const count = request.count || 10;
    for (let i = 0; i < count; i++) {
      yield { number: i + 1 };
    }
  }

  /**
   * Sum numbers (Client Streaming)
   */
  async sumNumbers(requests) {
    let sum = 0;
    for await (const request of requests) {
      sum += request.number;
    }
    return { sum };
  }
}

// Example usage
async function demonstrategRPC() {
  console.log('=== gRPC Implementation ===\n');

  // Define User Service
  const userServiceDef = new ServiceDefinition('UserService');
  userServiceDef
    .defineMethod('GetUser', 'GetUserRequest', 'GetUserResponse')
    .defineMethod('CreateUser', 'CreateUserRequest', 'CreateUserResponse')
    .defineMethod('ListUsers', 'ListUsersRequest', 'User', { responseStream: true })
    .defineMethod('BatchCreateUsers', 'CreateUserRequest', 'BatchCreateUsersResponse', { requestStream: true });

  // Create server
  const server = new GRPCServer();
  const userService = new UserService();
  server.registerService(userServiceDef, userService);

  // Create client
  const client = new GRPCClient('UserService', server);
  client.setMetadata({ 'user-id': '123' });

  // Unary RPC: Create user
  console.log('=== Unary RPC ===\n');
  const createResponse = await client.call('CreateUser', {
    name: 'John Doe',
    email: 'john@example.com'
  });
  console.log('Create User:', createResponse);

  // Unary RPC: Get user
  const getUserResponse = await client.call('GetUser', {
    id: createResponse.user.id
  });
  console.log('Get User:', getUserResponse);

  // Server Streaming
  console.log('\n=== Server Streaming ===\n');
  for await (const response of client.serverStream('ListUsers', { limit: 5 })) {
    console.log('User:', response.user);
  }

  // Client Streaming
  console.log('\n=== Client Streaming ===\n');
  async function* generateUserRequests() {
    for (let i = 0; i < 3; i++) {
      yield {
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`
      };
    }
  }

  const batchResponse = await client.clientStream('BatchCreateUsers', generateUserRequests());
  console.log('Batch Create:', batchResponse);

  // Calculator Service
  console.log('\n=== Calculator Service ===\n');
  const calcServiceDef = new ServiceDefinition('CalculatorService');
  calcServiceDef
    .defineMethod('Add', 'AddRequest', 'AddResponse')
    .defineMethod('Multiply', 'MultiplyRequest', 'MultiplyResponse')
    .defineMethod('GenerateNumbers', 'GenerateNumbersRequest', 'Number', { responseStream: true })
    .defineMethod('SumNumbers', 'Number', 'SumResponse', { requestStream: true });

  const calcService = new CalculatorService();
  server.registerService(calcServiceDef, calcService);

  const calcClient = new GRPCClient('CalculatorService', server);
  
  const addResponse = await calcClient.call('Add', { a: 5, b: 3 });
  console.log('Add:', addResponse);

  const multiplyResponse = await calcClient.call('Multiply', { a: 4, b: 7 });
  console.log('Multiply:', multiplyResponse);
}

if (require.main === module) {
  demonstrategRPC();
}

module.exports = {
  ServiceDefinition,
  GRPCServer,
  GRPCClient,
  UserService,
  CalculatorService
};

