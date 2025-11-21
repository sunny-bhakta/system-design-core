/**
 * Separation of Concerns
 * Demonstrates organizing code by separating different concerns
 */

/**
 * Layered Architecture
 * Separates concerns into distinct layers
 */

// Presentation Layer
class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  async createUser(req, res) {
    try {
      const user = await this.userService.createUser(req.body);
      res.status(201).json({ success: true, user });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getUser(req, res) {
    try {
      const user = await this.userService.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      res.json({ success: true, user });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

// Business Logic Layer
class UserService {
  constructor(userRepository, validator, logger) {
    this.userRepository = userRepository;
    this.validator = validator;
    this.logger = logger;
  }

  async createUser(userData) {
    // Validation
    const validation = this.validator.validateUser(userData);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Business logic
    const user = {
      id: Date.now().toString(),
      ...userData,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    // Persistence
    await this.userRepository.save(user);
    
    this.logger.info('User created', { userId: user.id });
    
    return user;
  }

  async getUser(id) {
    return await this.userRepository.findById(id);
  }

  async updateUser(id, userData) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser = { ...user, ...userData, updatedAt: new Date().toISOString() };
    await this.userRepository.save(updatedUser);
    
    this.logger.info('User updated', { userId: id });
    
    return updatedUser;
  }
}

// Data Access Layer
class UserRepository {
  constructor(database) {
    this.database = database;
  }

  async save(user) {
    // Database save logic
    console.log(`Saving user ${user.id} to database`);
    this.database.set(`user:${user.id}`, user);
    return user;
  }

  async findById(id) {
    // Database query logic
    console.log(`Finding user ${id} from database`);
    return this.database.get(`user:${id}`) || null;
  }

  async findAll() {
    // Database query logic
    console.log('Finding all users from database');
    const keys = Array.from(this.database.keys()).filter(k => k.startsWith('user:'));
    return keys.map(key => this.database.get(key));
  }

  async delete(id) {
    // Database delete logic
    console.log(`Deleting user ${id} from database`);
    return this.database.delete(`user:${id}`);
  }
}

/**
 * Service Layer Pattern
 * Separates business logic from data access
 */
class OrderService {
  constructor(orderRepository, inventoryService, paymentService, notificationService) {
    this.orderRepository = orderRepository;
    this.inventoryService = inventoryService;
    this.paymentService = paymentService;
    this.notificationService = notificationService;
  }

  async createOrder(orderData) {
    // Check inventory
    const available = await this.inventoryService.checkAvailability(
      orderData.productId,
      orderData.quantity
    );
    
    if (!available) {
      throw new Error('Product not available');
    }

    // Process payment
    const payment = await this.paymentService.processPayment({
      amount: orderData.amount,
      method: orderData.paymentMethod
    });

    if (!payment.success) {
      throw new Error('Payment failed');
    }

    // Create order
    const order = {
      id: Date.now().toString(),
      ...orderData,
      paymentId: payment.id,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    await this.orderRepository.save(order);

    // Update inventory
    await this.inventoryService.reserve(orderData.productId, orderData.quantity);

    // Send notification
    await this.notificationService.sendOrderConfirmation(order);

    return order;
  }
}

/**
 * Repository Pattern
 * Abstracts data access
 */
class ProductRepository {
  constructor(database) {
    this.database = database;
  }

  async save(product) {
    this.database.set(`product:${product.id}`, product);
    return product;
  }

  async findById(id) {
    return this.database.get(`product:${id}`) || null;
  }

  async findByCategory(category) {
    const products = Array.from(this.database.values())
      .filter(p => p.category === category);
    return products;
  }

  async search(query) {
    const products = Array.from(this.database.values())
      .filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase())
      );
    return products;
  }
}

/**
 * Dependency Injection
 * Separates dependency creation from usage
 */
class DependencyContainer {
  constructor() {
    this.services = new Map();
  }

  register(name, factory) {
    this.services.set(name, factory);
  }

  resolve(name) {
    const factory = this.services.get(name);
    if (!factory) {
      throw new Error(`Service ${name} not found`);
    }
    return factory(this);
  }
}

// Example: Setting up dependencies
function setupDependencies() {
  const container = new DependencyContainer();
  const database = new Map();

  // Register services
  container.register('database', () => database);
  
  container.register('userRepository', (c) => {
    return new UserRepository(c.resolve('database'));
  });

  container.register('validator', () => {
    return {
      validateUser: (user) => {
        if (!user.email || !user.name) {
          return { valid: false, error: 'Email and name required' };
        }
        return { valid: true };
      }
    };
  });

  container.register('logger', () => {
    return {
      info: (message, data) => console.log(`[INFO] ${message}`, data),
      error: (message, data) => console.error(`[ERROR] ${message}`, data)
    };
  });

  container.register('userService', (c) => {
    return new UserService(
      c.resolve('userRepository'),
      c.resolve('validator'),
      c.resolve('logger')
    );
  });

  container.register('userController', (c) => {
    return new UserController(c.resolve('userService'));
  });

  return container;
}

/**
 * Module Pattern
 * Separates concerns into modules
 */
const ValidationModule = {
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  validatePhone(phone) {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return phoneRegex.test(phone);
  }
};

const FormattingModule = {
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  },

  formatDate(date) {
    return new Intl.DateTimeFormat('en-US').format(new Date(date));
  }
};

// Example usage
async function demonstrateSeparationOfConcerns() {
  console.log('=== Layered Architecture ===\n');
  
  const database = new Map();
  const userRepository = new UserRepository(database);
  const validator = {
    validateUser: (user) => {
      if (!user.email || !user.name) {
        return { valid: false, error: 'Email and name required' };
      }
      return { valid: true };
    }
  };
  const logger = {
    info: (msg, data) => console.log(`[INFO] ${msg}`, data),
    error: (msg, data) => console.error(`[ERROR] ${msg}`, data)
  };
  
  const userService = new UserService(userRepository, validator, logger);
  const userController = new UserController(userService);
  
  // Simulate request
  const mockReq = { body: { name: 'John', email: 'john@example.com' } };
  const mockRes = {
    status: (code) => ({
      json: (data) => console.log(`Status ${code}:`, data)
    }),
    json: (data) => console.log('Response:', data)
  };
  
  await userController.createUser(mockReq, mockRes);

  console.log('\n=== Dependency Injection ===\n');
  
  const container = setupDependencies();
  const controller = container.resolve('userController');
  console.log('Controller resolved:', controller.constructor.name);

  console.log('\n=== Module Pattern ===\n');
  
  console.log('Email valid:', ValidationModule.validateEmail('test@example.com'));
  console.log('Currency:', FormattingModule.formatCurrency(1234.56));
  console.log('Date:', FormattingModule.formatDate(new Date()));
}

if (require.main === module) {
  demonstrateSeparationOfConcerns();
}

module.exports = {
  UserController,
  UserService,
  UserRepository,
  OrderService,
  ProductRepository,
  DependencyContainer,
  ValidationModule,
  FormattingModule
};

