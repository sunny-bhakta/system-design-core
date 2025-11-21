/**
 * Layered Architecture Implementation
 * Demonstrates separation of concerns into distinct layers
 */

/**
 * Presentation Layer
 */
class PresentationLayer {
  constructor(applicationLayer) {
    this.applicationLayer = applicationLayer;
  }

  /**
   * Handle HTTP request
   */
  async handleRequest(req, res) {
    try {
      const { method, path, body, params } = req;
      
      // Route to appropriate handler
      if (path === '/api/users' && method === 'GET') {
        const users = await this.applicationLayer.getAllUsers();
        return res.json(users);
      }

      if (path.match(/^\/api\/users\/(\d+)$/) && method === 'GET') {
        const userId = params.id;
        const user = await this.applicationLayer.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        return res.json(user);
      }

      if (path === '/api/users' && method === 'POST') {
        const user = await this.applicationLayer.createUser(body);
        return res.status(201).json(user);
      }

      return res.status(404).json({ error: 'Not found' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Validate input
   */
  validateInput(data, schema) {
    // Simple validation
    for (const [key, validator] of Object.entries(schema)) {
      if (validator.required && !data[key]) {
        throw new Error(`${key} is required`);
      }
      if (data[key] && validator.type && typeof data[key] !== validator.type) {
        throw new Error(`${key} must be of type ${validator.type}`);
      }
    }
    return true;
  }
}

/**
 * Application Layer (Business Logic)
 */
class ApplicationLayer {
  constructor(domainLayer, dataAccessLayer) {
    this.domainLayer = domainLayer;
    this.dataAccessLayer = dataAccessLayer;
  }

  /**
   * Get all users
   */
  async getAllUsers() {
    const users = await this.dataAccessLayer.findAllUsers();
    return users.map(u => this.domainLayer.toUserDTO(u));
  }

  /**
   * Get user by ID
   */
  async getUser(id) {
    const user = await this.dataAccessLayer.findUserById(id);
    if (!user) {
      return null;
    }
    return this.domainLayer.toUserDTO(user);
  }

  /**
   * Create user
   */
  async createUser(userData) {
    // Business logic validation
    const existingUser = await this.dataAccessLayer.findUserByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create domain entity
    const user = this.domainLayer.createUser(userData);

    // Save through data access layer
    const savedUser = await this.dataAccessLayer.saveUser(user);

    return this.domainLayer.toUserDTO(savedUser);
  }

  /**
   * Update user
   */
  async updateUser(id, userData) {
    const user = await this.dataAccessLayer.findUserById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Apply business rules
    const updatedUser = this.domainLayer.updateUser(user, userData);
    
    return await this.dataAccessLayer.saveUser(updatedUser);
  }

  /**
   * Delete user
   */
  async deleteUser(id) {
    const user = await this.dataAccessLayer.findUserById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Business logic: check if user can be deleted
    if (!this.domainLayer.canDeleteUser(user)) {
      throw new Error('User cannot be deleted');
    }

    await this.dataAccessLayer.deleteUser(id);
    return { success: true };
  }
}

/**
 * Domain Layer (Business Entities and Rules)
 */
class DomainLayer {
  /**
   * Create user entity
   */
  createUser(data) {
    return {
      id: null, // Will be set by data layer
      name: data.name,
      email: data.email,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: null
    };
  }

  /**
   * Update user entity
   */
  updateUser(user, data) {
    return {
      ...user,
      ...data,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Business rule: Can user be deleted?
   */
  canDeleteUser(user) {
    // Business rule: Active users can be deleted
    return user.status === 'active';
  }

  /**
   * Convert to DTO (Data Transfer Object)
   */
  toUserDTO(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status
    };
  }

  /**
   * Validate email
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Data Access Layer
 */
class DataAccessLayer {
  constructor() {
    this.users = new Map();
    this.nextId = 1;
  }

  /**
   * Find all users
   */
  async findAllUsers() {
    return Array.from(this.users.values());
  }

  /**
   * Find user by ID
   */
  async findUserById(id) {
    return this.users.get(id) || null;
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  /**
   * Save user
   */
  async saveUser(user) {
    if (!user.id) {
      user.id = this.nextId.toString();
      this.nextId++;
    }
    this.users.set(user.id, { ...user });
    return this.users.get(user.id);
  }

  /**
   * Delete user
   */
  async deleteUser(id) {
    return this.users.delete(id);
  }
}

/**
 * Layered Application
 */
class LayeredApplication {
  constructor() {
    // Initialize layers from bottom to top
    this.dataAccessLayer = new DataAccessLayer();
    this.domainLayer = new DomainLayer();
    this.applicationLayer = new ApplicationLayer(
      this.domainLayer,
      this.dataAccessLayer
    );
    this.presentationLayer = new PresentationLayer(this.applicationLayer);
  }

  /**
   * Handle request
   */
  async handleRequest(req, res) {
    return await this.presentationLayer.handleRequest(req, res);
  }
}

/**
 * Service Layer Pattern
 */
class ServiceLayer {
  constructor(dataAccessLayer) {
    this.dataAccessLayer = dataAccessLayer;
  }

  /**
   * User service
   */
  async getUserService() {
    return {
      getAll: async () => {
        return await this.dataAccessLayer.findAllUsers();
      },
      getById: async (id) => {
        return await this.dataAccessLayer.findUserById(id);
      },
      create: async (data) => {
        return await this.dataAccessLayer.saveUser({
          id: null,
          ...data,
          createdAt: new Date().toISOString()
        });
      }
    };
  }
}

/**
 * Repository Pattern
 */
class UserRepository {
  constructor(dataAccessLayer) {
    this.dataAccessLayer = dataAccessLayer;
  }

  async findAll() {
    return await this.dataAccessLayer.findAllUsers();
  }

  async findById(id) {
    return await this.dataAccessLayer.findUserById(id);
  }

  async save(user) {
    return await this.dataAccessLayer.saveUser(user);
  }

  async delete(id) {
    return await this.dataAccessLayer.deleteUser(id);
  }
}

/**
 * DTO (Data Transfer Object)
 */
class UserDTO {
  constructor(user) {
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.status = user.status;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      status: this.status
    };
  }
}

// Example usage
async function demonstrateLayeredArchitecture() {
  console.log('=== Layered Architecture ===\n');

  // Create layered application
  const app = new LayeredApplication();

  // Simulate requests
  console.log('=== Handling Requests ===\n');

  // Create user request
  const createReq = {
    method: 'POST',
    path: '/api/users',
    body: {
      name: 'John Doe',
      email: 'john@example.com'
    },
    params: {}
  };

  const createRes = {
    status: 200,
    json: (data) => {
      console.log('Response:', data);
      return data;
    },
    statusCode: 200
  };

  await app.handleRequest(createReq, createRes);

  // Get users request
  const listReq = {
    method: 'GET',
    path: '/api/users',
    body: {},
    params: {}
  };

  const listRes = {
    json: (data) => {
      console.log('Users:', data);
      return data;
    }
  };

  await app.handleRequest(listReq, listRes);

  // Repository pattern
  console.log('\n=== Repository Pattern ===\n');
  const repository = new UserRepository(app.dataAccessLayer);
  const users = await repository.findAll();
  console.log('Repository users:', users);
}

if (require.main === module) {
  demonstrateLayeredArchitecture();
}

module.exports = {
  PresentationLayer,
  ApplicationLayer,
  DomainLayer,
  DataAccessLayer,
  LayeredApplication,
  ServiceLayer,
  UserRepository,
  UserDTO
};

