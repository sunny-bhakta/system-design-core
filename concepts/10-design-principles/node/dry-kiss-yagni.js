/**
 * DRY, KISS, and YAGNI Principles
 * Demonstrates Don't Repeat Yourself, Keep It Simple, and You Aren't Gonna Need It
 */

/**
 * DRY - Don't Repeat Yourself
 * Avoid code duplication by extracting common functionality
 */

// ❌ BAD: Repeated code
class UserServiceBad {
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validatePhone(phone) {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return phoneRegex.test(phone);
  }

  validatePassword(password) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
  }
}

class OrderServiceBad {
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validatePhone(phone) {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return phoneRegex.test(phone);
  }
}

// ✅ GOOD: Extract common functionality
class Validator {
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhone(phone) {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return phoneRegex.test(phone);
  }

  static validatePassword(password) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
  }

  static validate(pattern, value) {
    return pattern.test(value);
  }
}

class UserService {
  validateUser(user) {
    return {
      email: Validator.validateEmail(user.email),
      phone: Validator.validatePhone(user.phone),
      password: Validator.validatePassword(user.password)
    };
  }
}

class OrderService {
  validateOrder(order) {
    return {
      email: Validator.validateEmail(order.email),
      phone: Validator.validatePhone(order.phone)
    };
  }
}

/**
 * KISS - Keep It Simple, Stupid
 * Prefer simple solutions over complex ones
 */

// ❌ BAD: Overly complex
class ComplexCalculator {
  calculate(a, b, operation) {
    const operations = {
      add: (x, y) => {
        const result = x + y;
        return {
          value: result,
          operation: 'addition',
          operands: [x, y],
          timestamp: Date.now()
        };
      },
      subtract: (x, y) => {
        const result = x - y;
        return {
          value: result,
          operation: 'subtraction',
          operands: [x, y],
          timestamp: Date.now()
        };
      }
    };
    
    if (!operations[operation]) {
      throw new Error('Invalid operation');
    }
    
    return operations[operation](a, b);
  }
}

// ✅ GOOD: Simple and clear
class SimpleCalculator {
  add(a, b) {
    return a + b;
  }

  subtract(a, b) {
    return a - b;
  }

  multiply(a, b) {
    return a * b;
  }

  divide(a, b) {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
}

/**
 * YAGNI - You Aren't Gonna Need It
 * Don't add functionality until it's needed
 */

// ❌ BAD: Adding features "just in case"
class UserServiceYAGNIBad {
  constructor() {
    this.users = [];
    this.cache = new Map();
    this.analytics = [];
    this.notifications = [];
    this.socialFeatures = [];
    this.gamification = [];
    // ... many more features that might never be used
  }

  createUser(user) {
    // Complex implementation with all features
    this.users.push(user);
    this.cache.set(user.id, user);
    this.analytics.push({ event: 'user_created', user });
    this.notifications.push({ type: 'welcome', user });
    // ... many more operations
  }
}

// ✅ GOOD: Only what's needed now
class UserServiceYAGNI {
  constructor() {
    this.users = [];
  }

  createUser(user) {
    // Simple implementation - only what's needed
    this.users.push(user);
    return user;
  }

  getUser(id) {
    return this.users.find(u => u.id === id);
  }

  // Add features only when actually needed
  // updateUser() - add when needed
  // deleteUser() - add when needed
  // searchUsers() - add when needed
}

/**
 * Practical Example: Combining all principles
 */

// Simple, DRY, and YAGNI-compliant logger
class Logger {
  static log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data);
  }

  static info(message, data) {
    this.log('info', message, data);
  }

  static error(message, data) {
    this.log('error', message, data);
  }

  static warn(message, data) {
    this.log('warn', message, data);
  }
}

// Simple service using all principles
class ProductService {
  constructor(validator, logger) {
    this.validator = validator;
    this.logger = logger;
    this.products = [];
  }

  createProduct(product) {
    // Validate (using shared validator - DRY)
    if (!this.validator.validateEmail(product.manufacturerEmail)) {
      this.logger.error('Invalid manufacturer email', { product });
      throw new Error('Invalid email');
    }

    // Simple creation (KISS)
    const newProduct = {
      id: Date.now().toString(),
      ...product,
      createdAt: new Date().toISOString()
    };

    this.products.push(newProduct);
    this.logger.info('Product created', { productId: newProduct.id });

    // Only return what's needed (YAGNI)
    return newProduct;
  }

  getProduct(id) {
    return this.products.find(p => p.id === id);
  }
}

// Example usage
function demonstrateDRYKISSYAGNI() {
  console.log('=== DRY Principle ===\n');
  
  const userService = new UserService();
  const orderService = new OrderService();
  
  const userValidation = userService.validateUser({
    email: 'user@example.com',
    phone: '+1234567890',
    password: 'Password123'
  });
  console.log('User validation:', userValidation);
  
  const orderValidation = orderService.validateOrder({
    email: 'order@example.com',
    phone: '+0987654321'
  });
  console.log('Order validation:', orderValidation);

  console.log('\n=== KISS Principle ===\n');
  
  const calculator = new SimpleCalculator();
  console.log('5 + 3 =', calculator.add(5, 3));
  console.log('10 - 4 =', calculator.subtract(10, 4));
  console.log('6 * 7 =', calculator.multiply(6, 7));
  console.log('20 / 4 =', calculator.divide(20, 4));

  console.log('\n=== YAGNI Principle ===\n');
  
  const productService = new ProductService(Validator, Logger);
  const product = productService.createProduct({
    name: 'Laptop',
    price: 999.99,
    manufacturerEmail: 'manufacturer@example.com'
  });
  console.log('Created product:', product);
}

if (require.main === module) {
  demonstrateDRYKISSYAGNI();
}

module.exports = {
  Validator,
  UserService,
  OrderService,
  SimpleCalculator,
  UserServiceYAGNI,
  Logger,
  ProductService
};

