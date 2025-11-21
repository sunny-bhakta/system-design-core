/**
 * RESTful API Implementation
 * Demonstrates REST API design, routing, and best practices
 */

/**
 * RESTful API Server
 */
class RESTfulAPIServer {
  constructor() {
    this.routes = new Map();
    this.middleware = [];
    this.resources = new Map();
  }

  /**
   * Register route
   */
  route(method, path, handler) {
    const key = `${method.toUpperCase()} ${path}`;
    this.routes.set(key, {
      method: method.toUpperCase(),
      path,
      handler,
      params: this.extractParams(path)
    });
  }

  /**
   * Extract path parameters
   */
  extractParams(path) {
    const params = [];
    const paramRegex = /:(\w+)/g;
    let match;
    
    while ((match = paramRegex.exec(path)) !== null) {
      params.push(match[1]);
    }
    
    return params;
  }

  /**
   * Add middleware
   */
  use(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Register resource (CRUD operations)
   */
  resource(name, controller) {
    this.resources.set(name, controller);
    
    // Register standard REST routes
    this.route('GET', `/${name}`, async (req, res) => {
      const result = await controller.index(req);
      res.json(result);
    });

    this.route('GET', `/${name}/:id`, async (req, res) => {
      const result = await controller.show(req);
      if (!result) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(result);
    });

    this.route('POST', `/${name}`, async (req, res) => {
      const result = await controller.create(req);
      res.status(201).json(result);
    });

    this.route('PUT', `/${name}/:id`, async (req, res) => {
      const result = await controller.update(req);
      if (!result) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(result);
    });

    this.route('PATCH', `/${name}/:id`, async (req, res) => {
      const result = await controller.patch(req);
      if (!result) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(result);
    });

    this.route('DELETE', `/${name}/:id`, async (req, res) => {
      const deleted = await controller.destroy(req);
      if (!deleted) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.status(204).send();
    });
  }

  /**
   * Handle request
   */
  async handleRequest(method, path, req = {}) {
    // Apply middleware
    for (const middleware of this.middleware) {
      const result = await middleware(req);
      if (result && result.stop) {
        return result;
      }
    }

    // Find matching route
    const route = this.findRoute(method, path);
    
    if (!route) {
      return {
        status: 404,
        body: { error: 'Not found' }
      };
    }

    // Extract path parameters
    const params = this.extractPathParams(route.path, path);
    req.params = params;
    req.path = path;
    req.method = method;

    // Execute handler
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        return this;
      },
      send: function(data) {
        this.body = data;
        return this;
      }
    };

    try {
      await route.handler(req, res);
      return {
        status: res.statusCode,
        headers: res.headers,
        body: res.body
      };
    } catch (error) {
      return {
        status: 500,
        body: { error: error.message }
      };
    }
  }

  /**
   * Find matching route
   */
  findRoute(method, path) {
    for (const [key, route] of this.routes.entries()) {
      if (route.method === method.toUpperCase() && this.matchPath(route.path, path)) {
        return route;
      }
    }
    return null;
  }

  /**
   * Match path pattern
   */
  matchPath(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        continue; // Parameter match
      }
      if (patternParts[i] !== pathParts[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract path parameters
   */
  extractPathParams(pattern, path) {
    const params = {};
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].substring(1);
        params[paramName] = pathParts[i];
      }
    }

    return params;
  }
}

/**
 * REST Controller
 */
class RESTController {
  constructor(dataStore) {
    this.dataStore = dataStore || new Map();
  }

  async index(req) {
    // GET /resource
    return Array.from(this.dataStore.values());
  }

  async show(req) {
    // GET /resource/:id
    return this.dataStore.get(req.params.id) || null;
  }

  async create(req) {
    // POST /resource
    const id = Date.now().toString();
    const item = {
      id,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    this.dataStore.set(id, item);
    return item;
  }

  async update(req) {
    // PUT /resource/:id
    const existing = this.dataStore.get(req.params.id);
    if (!existing) {
      return null;
    }

    const updated = {
      ...existing,
      ...req.body,
      id: req.params.id,
      updatedAt: new Date().toISOString()
    };
    this.dataStore.set(req.params.id, updated);
    return updated;
  }

  async patch(req) {
    // PATCH /resource/:id
    return this.update(req);
  }

  async destroy(req) {
    // DELETE /resource/:id
    return this.dataStore.delete(req.params.id);
  }
}

/**
 * API Middleware
 */
class APIMiddleware {
  /**
   * JSON body parser
   */
  static jsonParser() {
    return async (req) => {
      if (req.body && typeof req.body === 'string') {
        try {
          req.body = JSON.parse(req.body);
        } catch (error) {
          // Invalid JSON
        }
      }
    };
  }

  /**
   * CORS middleware
   */
  static cors(allowedOrigins = ['*']) {
    return async (req) => {
      return {
        headers: {
          'Access-Control-Allow-Origin': allowedOrigins.includes('*') ? '*' : req.headers.origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      };
    };
  }

  /**
   * Request logging
   */
  static logger() {
    return async (req) => {
      console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    };
  }

  /**
   * Error handler
   */
  static errorHandler() {
    return async (req, res, next) => {
      try {
        await next();
      } catch (error) {
        return {
          status: 500,
          body: { error: error.message }
        };
      }
    };
  }
}

/**
 * API Client
 */
class APIClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Set authorization header
   */
  setAuth(token) {
    this.headers['Authorization'] = `Bearer ${token}`;
  }

  /**
   * GET request
   */
  async get(path, options = {}) {
    return this.request('GET', path, null, options);
  }

  /**
   * POST request
   */
  async post(path, data, options = {}) {
    return this.request('POST', path, data, options);
  }

  /**
   * PUT request
   */
  async put(path, data, options = {}) {
    return this.request('PUT', path, data, options);
  }

  /**
   * PATCH request
   */
  async patch(path, data, options = {}) {
    return this.request('PATCH', path, data, options);
  }

  /**
   * DELETE request
   */
  async delete(path, options = {}) {
    return this.request('DELETE', path, null, options);
  }

  /**
   * Make request
   */
  async request(method, path, data = null, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const config = {
      method,
      headers: { ...this.headers, ...options.headers },
      ...(data && { body: JSON.stringify(data) })
    };

    // Simulate HTTP request
    return {
      url,
      method,
      headers: config.headers,
      body: data,
      status: 200,
      data: { success: true }
    };
  }
}

// Example usage
async function demonstrateRESTfulAPI() {
  console.log('=== RESTful API ===\n');

  const server = new RESTfulAPIServer();

  // Add middleware
  server.use(APIMiddleware.logger());
  server.use(APIMiddleware.jsonParser());

  // Register users resource
  const usersController = new RESTController();
  server.resource('users', usersController);

  // Custom route
  server.route('GET', '/users/:id/posts', async (req, res) => {
    res.json({ userId: req.params.id, posts: [] });
  });

  // Test requests
  console.log('=== Testing REST API ===\n');

  // GET /users
  const listResponse = await server.handleRequest('GET', '/users');
  console.log('GET /users:', listResponse);

  // POST /users
  const createResponse = await server.handleRequest('POST', '/users', {
    body: JSON.stringify({ name: 'John', email: 'john@example.com' })
  });
  console.log('POST /users:', createResponse);

  // GET /users/:id
  const userId = JSON.parse(createResponse.body).id;
  const showResponse = await server.handleRequest('GET', `/users/${userId}`);
  console.log(`GET /users/${userId}:`, showResponse);

  // PUT /users/:id
  const updateResponse = await server.handleRequest('PUT', `/users/${userId}`, {
    body: JSON.stringify({ name: 'John Updated' })
  });
  console.log(`PUT /users/${userId}:`, updateResponse);

  // DELETE /users/:id
  const deleteResponse = await server.handleRequest('DELETE', `/users/${userId}`);
  console.log(`DELETE /users/${userId}:`, deleteResponse.status);

  // API Client
  console.log('\n=== API Client ===\n');
  const client = new APIClient('http://api.example.com');
  client.setAuth('token123');

  const clientResponse = await client.get('/users');
  console.log('Client GET /users:', clientResponse);
}

if (require.main === module) {
  demonstrateRESTfulAPI();
}

module.exports = {
  RESTfulAPIServer,
  RESTController,
  APIMiddleware,
  APIClient
};

