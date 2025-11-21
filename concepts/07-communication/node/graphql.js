/**
 * GraphQL Implementation
 * Demonstrates GraphQL schema, queries, mutations, and subscriptions
 */

/**
 * GraphQL Schema
 */
class GraphQLSchema {
  constructor() {
    this.types = new Map();
    this.queries = new Map();
    this.mutations = new Map();
    this.subscriptions = new Map();
  }

  /**
   * Define type
   */
  defineType(name, fields) {
    this.types.set(name, {
      name,
      fields
    });
    return this;
  }

  /**
   * Define query
   */
  defineQuery(name, returnType, resolver) {
    this.queries.set(name, {
      name,
      returnType,
      resolver
    });
    return this;
  }

  /**
   * Define mutation
   */
  defineMutation(name, returnType, resolver) {
    this.mutations.set(name, {
      name,
      returnType,
      resolver
    });
    return this;
  }

  /**
   * Define subscription
   */
  defineSubscription(name, returnType, resolver) {
    this.subscriptions.set(name, {
      name,
      returnType,
      resolver
    });
    return this;
  }
}

/**
 * GraphQL Executor
 */
class GraphQLExecutor {
  constructor(schema, dataStore) {
    this.schema = schema;
    this.dataStore = dataStore || new Map();
  }

  /**
   * Execute query
   */
  async execute(query, variables = {}) {
    try {
      const parsed = this.parseQuery(query);
      
      if (parsed.operation === 'query') {
        return await this.executeQuery(parsed);
      } else if (parsed.operation === 'mutation') {
        return await this.executeMutation(parsed);
      } else if (parsed.operation === 'subscription') {
        return await this.executeSubscription(parsed);
      }
    } catch (error) {
      return {
        errors: [{ message: error.message }]
      };
    }
  }

  /**
   * Parse query (simplified)
   */
  parseQuery(query) {
    // Simple parser - in production, use a proper GraphQL parser
    const operationMatch = query.match(/(query|mutation|subscription)\s+(\w+)?/);
    const operation = operationMatch ? operationMatch[1] : 'query';
    
    const fieldMatch = query.match(/\{\s*(\w+)/);
    const field = fieldMatch ? fieldMatch[1] : null;

    return {
      operation,
      field,
      query
    };
  }

  /**
   * Execute query
   */
  async executeQuery(parsed) {
    const queryDef = this.schema.queries.get(parsed.field);
    if (!queryDef) {
      throw new Error(`Query ${parsed.field} not found`);
    }

    const result = await queryDef.resolver(this.dataStore);
    return { data: { [parsed.field]: result } };
  }

  /**
   * Execute mutation
   */
  async executeMutation(parsed) {
    const mutationDef = this.schema.mutations.get(parsed.field);
    if (!mutationDef) {
      throw new Error(`Mutation ${parsed.field} not found`);
    }

    const result = await mutationDef.resolver(this.dataStore);
    return { data: { [parsed.field]: result } };
  }

  /**
   * Execute subscription
   */
  async* executeSubscription(parsed) {
    const subscriptionDef = this.schema.subscriptions.get(parsed.field);
    if (!subscriptionDef) {
      throw new Error(`Subscription ${parsed.field} not found`);
    }

    yield* subscriptionDef.resolver(this.dataStore);
  }
}

/**
 * GraphQL Resolvers
 */
class GraphQLResolvers {
  /**
   * User resolvers
   */
  static userResolvers(dataStore) {
    return {
      getUser: async (args) => {
        return dataStore.get(`user:${args.id}`) || null;
      },
      listUsers: async () => {
        const users = [];
        for (const [key, value] of dataStore.entries()) {
          if (key.startsWith('user:')) {
            users.push(value);
          }
        }
        return users;
      },
      createUser: async (args) => {
        const user = {
          id: Date.now().toString(),
          name: args.name,
          email: args.email,
          createdAt: new Date().toISOString()
        };
        dataStore.set(`user:${user.id}`, user);
        return user;
      },
      updateUser: async (args) => {
        const user = dataStore.get(`user:${args.id}`);
        if (!user) {
          throw new Error('User not found');
        }
        const updated = { ...user, ...args.input, updatedAt: new Date().toISOString() };
        dataStore.set(`user:${args.id}`, updated);
        return updated;
      },
      deleteUser: async (args) => {
        const deleted = dataStore.delete(`user:${args.id}`);
        return { success: deleted, id: args.id };
      }
    };
  }

  /**
   * Post resolvers
   */
  static postResolvers(dataStore) {
    return {
      getPost: async (args) => {
        return dataStore.get(`post:${args.id}`) || null;
      },
      listPosts: async () => {
        const posts = [];
        for (const [key, value] of dataStore.entries()) {
          if (key.startsWith('post:')) {
            posts.push(value);
          }
        }
        return posts;
      },
      createPost: async (args) => {
        const post = {
          id: Date.now().toString(),
          title: args.title,
          content: args.content,
          authorId: args.authorId,
          createdAt: new Date().toISOString()
        };
        dataStore.set(`post:${post.id}`, post);
        return post;
      }
    };
  }

  /**
   * Subscription resolvers
   */
  static subscriptionResolvers(dataStore) {
    return {
      userCreated: async function* () {
        // Simulate real-time updates
        for (let i = 0; i < 3; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          yield {
            userCreated: {
              id: `user-${i}`,
              name: `User ${i}`,
              email: `user${i}@example.com`
            }
          };
        }
      },
      postCreated: async function* () {
        for (let i = 0; i < 3; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          yield {
            postCreated: {
              id: `post-${i}`,
              title: `Post ${i}`,
              content: `Content ${i}`
            }
          };
        }
      }
    };
  }
}

/**
 * GraphQL Server
 */
class GraphQLServer {
  constructor() {
    this.schema = new GraphQLSchema();
    this.executor = null;
    this.dataStore = new Map();
  }

  /**
   * Setup schema
   */
  setupSchema() {
    // Define types
    this.schema.defineType('User', {
      id: 'ID!',
      name: 'String!',
      email: 'String!',
      createdAt: 'String!'
    });

    this.schema.defineType('Post', {
      id: 'ID!',
      title: 'String!',
      content: 'String!',
      authorId: 'ID!',
      createdAt: 'String!'
    });

    // Define queries
    const userResolvers = GraphQLResolvers.userResolvers(this.dataStore);
    this.schema.defineQuery('getUser', 'User', () => userResolvers.getUser);
    this.schema.defineQuery('listUsers', '[User]', () => userResolvers.listUsers);

    const postResolvers = GraphQLResolvers.postResolvers(this.dataStore);
    this.schema.defineQuery('getPost', 'Post', () => postResolvers.getPost);
    this.schema.defineQuery('listPosts', '[Post]', () => postResolvers.listPosts);

    // Define mutations
    this.schema.defineMutation('createUser', 'User', () => userResolvers.createUser);
    this.schema.defineMutation('updateUser', 'User', () => userResolvers.updateUser);
    this.schema.defineMutation('deleteUser', 'DeleteResponse', () => userResolvers.deleteUser);
    this.schema.defineMutation('createPost', 'Post', () => postResolvers.createPost);

    // Define subscriptions
    const subResolvers = GraphQLResolvers.subscriptionResolvers(this.dataStore);
    this.schema.defineSubscription('userCreated', 'User', () => subResolvers.userCreated);
    this.schema.defineSubscription('postCreated', 'Post', () => subResolvers.postCreated);

    // Create executor
    this.executor = new GraphQLExecutor(this.schema, this.dataStore);
  }

  /**
   * Execute query
   */
  async query(queryString, variables = {}) {
    return await this.executor.execute(queryString, variables);
  }

  /**
   * Execute mutation
   */
  async mutate(mutationString, variables = {}) {
    return await this.executor.execute(mutationString, variables);
  }

  /**
   * Subscribe
   */
  async* subscribe(subscriptionString, variables = {}) {
    yield* await this.executor.executeSubscription(subscriptionString, variables);
  }
}

// Example usage
async function demonstrateGraphQL() {
  console.log('=== GraphQL Implementation ===\n');

  const server = new GraphQLServer();
  server.setupSchema();

  // Query: Get user
  console.log('=== Query ===\n');
  const getUserQuery = `
    query {
      getUser(id: "1") {
        id
        name
        email
      }
    }
  `;
  const getUserResult = await server.query(getUserQuery);
  console.log('Get User:', getUserResult);

  // Query: List users
  const listUsersQuery = `
    query {
      listUsers {
        id
        name
        email
      }
    }
  `;
  const listUsersResult = await server.query(listUsersQuery);
  console.log('List Users:', listUsersResult);

  // Mutation: Create user
  console.log('\n=== Mutation ===\n');
  const createUserMutation = `
    mutation {
      createUser(name: "John Doe", email: "john@example.com") {
        id
        name
        email
      }
    }
  `;
  const createUserResult = await server.mutate(createUserMutation);
  console.log('Create User:', createUserResult);

  // Mutation: Update user
  const updateUserMutation = `
    mutation {
      updateUser(id: "1", input: { name: "John Updated" }) {
        id
        name
        email
      }
    }
  `;
  const updateUserResult = await server.mutate(updateUserMutation);
  console.log('Update User:', updateUserResult);

  // Subscription
  console.log('\n=== Subscription ===\n');
  const subscription = `
    subscription {
      userCreated {
        id
        name
        email
      }
    }
  `;
  
  console.log('Subscribing to userCreated...');
  for await (const event of server.subscribe(subscription)) {
    console.log('Event:', event);
  }
}

if (require.main === module) {
  demonstrateGraphQL();
}

module.exports = {
  GraphQLSchema,
  GraphQLExecutor,
  GraphQLResolvers,
  GraphQLServer
};

