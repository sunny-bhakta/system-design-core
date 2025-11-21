/**
 * Monolithic Architecture Implementation
 * Demonstrates a single, unified application with all components in one codebase
 */

/**
 * Monolithic Application
 */
class MonolithicApp {
  constructor() {
    // All modules in one application
    this.userModule = new UserModule();
    this.productModule = new ProductModule();
    this.orderModule = new OrderModule();
    this.paymentModule = new PaymentModule();
    this.notificationModule = new NotificationModule();
    this.database = new Database();
    this.cache = new Cache();
  }

  /**
   * Initialize application
   */
  async initialize() {
    await this.database.connect();
    await this.cache.connect();
    console.log('Monolithic application initialized');
  }

  /**
   * Handle HTTP request
   */
  async handleRequest(method, path, body = {}) {
    const route = this.route(method, path);
    
    if (!route) {
      return { status: 404, body: { error: 'Not found' } };
    }

    try {
      const result = await route.handler(body);
      return { status: 200, body: result };
    } catch (error) {
      return { status: 500, body: { error: error.message } };
    }
  }

  /**
   * Route requests to appropriate modules
   */
  route(method, path) {
    // User routes
    if (path.startsWith('/api/users')) {
      if (method === 'GET' && path === '/api/users') {
        return { handler: (body) => this.userModule.listUsers() };
      }
      if (method === 'GET' && path.match(/^\/api\/users\/(\d+)$/)) {
        const id = path.split('/')[3];
        return { handler: () => this.userModule.getUser(id) };
      }
      if (method === 'POST' && path === '/api/users') {
        return { handler: (body) => this.userModule.createUser(body) };
      }
    }

    // Product routes
    if (path.startsWith('/api/products')) {
      if (method === 'GET' && path === '/api/products') {
        return { handler: () => this.productModule.listProducts() };
      }
      if (method === 'POST' && path === '/api/products') {
        return { handler: (body) => this.productModule.createProduct(body) };
      }
    }

    // Order routes
    if (path.startsWith('/api/orders')) {
      if (method === 'POST' && path === '/api/orders') {
        return { handler: (body) => this.orderModule.createOrder(body) };
      }
    }

    return null;
  }

  /**
   * Start server
   */
  start(port = 3000) {
    console.log(`Monolithic application started on port ${port}`);
    return { port, status: 'running' };
  }
}

/**
 * User Module
 */
class UserModule {
  constructor() {
    this.users = new Map();
  }

  async listUsers() {
    return Array.from(this.users.values());
  }

  async getUser(id) {
    return this.users.get(id) || null;
  }

  async createUser(data) {
    const user = {
      id: Date.now().toString(),
      name: data.name,
      email: data.email,
      createdAt: new Date().toISOString()
    };
    this.users.set(user.id, user);
    return user;
  }
}

/**
 * Product Module
 */
class ProductModule {
  constructor() {
    this.products = new Map();
  }

  async listProducts() {
    return Array.from(this.products.values());
  }

  async createProduct(data) {
    const product = {
      id: Date.now().toString(),
      name: data.name,
      price: data.price,
      createdAt: new Date().toISOString()
    };
    this.products.set(product.id, product);
    return product;
  }
}

/**
 * Order Module
 */
class OrderModule {
  constructor(userModule, productModule, paymentModule, notificationModule) {
    this.userModule = userModule;
    this.productModule = productModule;
    this.paymentModule = paymentModule;
    this.notificationModule = notificationModule;
    this.orders = new Map();
  }

  async createOrder(data) {
    // Validate user
    const user = await this.userModule.getUser(data.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate products
    const products = [];
    for (const productId of data.productIds) {
      const product = await this.productModule.getProduct(productId);
      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }
      products.push(product);
    }

    // Calculate total
    const total = products.reduce((sum, p) => sum + p.price, 0);

    // Process payment
    const payment = await this.paymentModule.processPayment({
      userId: data.userId,
      amount: total
    });

    // Create order
    const order = {
      id: Date.now().toString(),
      userId: data.userId,
      products: products.map(p => ({ id: p.id, name: p.name, price: p.price })),
      total,
      paymentId: payment.id,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    this.orders.set(order.id, order);

    // Send notification
    await this.notificationModule.sendOrderConfirmation(user, order);

    return order;
  }
}

/**
 * Payment Module
 */
class PaymentModule {
  constructor() {
    this.payments = new Map();
  }

  async processPayment(data) {
    const payment = {
      id: Date.now().toString(),
      userId: data.userId,
      amount: data.amount,
      status: 'completed',
      processedAt: new Date().toISOString()
    };
    this.payments.set(payment.id, payment);
    return payment;
  }
}

/**
 * Notification Module
 */
class NotificationModule {
  async sendOrderConfirmation(user, order) {
    console.log(`Sending order confirmation to ${user.email} for order ${order.id}`);
    return { sent: true, userId: user.id, orderId: order.id };
  }
}

/**
 * Database (simulated)
 */
class Database {
  async connect() {
    console.log('Database connected');
    return true;
  }

  async query(sql) {
    // Simulate database query
    return [];
  }
}

/**
 * Cache (simulated)
 */
class Cache {
  async connect() {
    console.log('Cache connected');
    return true;
  }

  async get(key) {
    return null;
  }

  async set(key, value) {
    return true;
  }
}

/**
 * Monolithic Application with Shared State
 */
class SharedStateMonolith {
  constructor() {
    // Shared state across all modules
    this.sharedState = {
      config: {
        appName: 'Monolithic App',
        version: '1.0.0'
      },
      session: new Map(),
      cache: new Map()
    };

    this.modules = {
      auth: new AuthModule(this.sharedState),
      api: new APIModule(this.sharedState),
      admin: new AdminModule(this.sharedState)
    };
  }

  /**
   * All modules share the same state
   */
  getSharedState() {
    return this.sharedState;
  }
}

/**
 * Auth Module (uses shared state)
 */
class AuthModule {
  constructor(sharedState) {
    this.sharedState = sharedState;
  }

  login(userId) {
    const sessionId = `session_${Date.now()}`;
    this.sharedState.session.set(sessionId, { userId, createdAt: Date.now() });
    return sessionId;
  }

  getSession(sessionId) {
    return this.sharedState.session.get(sessionId);
  }
}

/**
 * API Module (uses shared state)
 */
class APIModule {
  constructor(sharedState) {
    this.sharedState = sharedState;
  }

  getConfig() {
    return this.sharedState.config;
  }
}

/**
 * Admin Module (uses shared state)
 */
class AdminModule {
  constructor(sharedState) {
    this.sharedState = sharedState;
  }

  getAllSessions() {
    return Array.from(this.sharedState.session.entries());
  }
}

// Example usage
async function demonstrateMonolithic() {
  console.log('=== Monolithic Architecture ===\n');

  // Create monolithic application
  const app = new MonolithicApp();
  await app.initialize();

  // Start server
  app.start(3000);

  // Handle requests
  console.log('\n=== Handling Requests ===\n');

  // Create user
  const createUserResponse = await app.handleRequest('POST', '/api/users', {
    name: 'John Doe',
    email: 'john@example.com'
  });
  console.log('Create User:', createUserResponse);

  // Get users
  const listUsersResponse = await app.handleRequest('GET', '/api/users');
  console.log('List Users:', listUsersResponse);

  // Create product
  const createProductResponse = await app.handleRequest('POST', '/api/products', {
    name: 'Laptop',
    price: 999.99
  });
  console.log('Create Product:', createProductResponse);

  // Shared State Monolith
  console.log('\n=== Shared State Monolith ===\n');
  const sharedMonolith = new SharedStateMonolith();

  const sessionId = sharedMonolith.modules.auth.login('user123');
  console.log('Session created:', sessionId);

  const session = sharedMonolith.modules.auth.getSession(sessionId);
  console.log('Session retrieved:', session);

  const config = sharedMonolith.modules.api.getConfig();
  console.log('Config:', config);

  const allSessions = sharedMonolith.modules.admin.getAllSessions();
  console.log('All sessions:', allSessions);
}

if (require.main === module) {
  demonstrateMonolithic();
}

module.exports = {
  MonolithicApp,
  UserModule,
  ProductModule,
  OrderModule,
  PaymentModule,
  NotificationModule,
  SharedStateMonolith
};

