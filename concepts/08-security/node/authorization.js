/**
 * Authorization Implementation
 * Demonstrates Role-Based Access Control (RBAC), Attribute-Based Access Control (ABAC), and Permission Management
 */

/**
 * Permission
 */
class Permission {
  constructor(resource, action) {
    this.resource = resource;
    this.action = action;
  }

  toString() {
    return `${this.resource}:${this.action}`;
  }

  equals(other) {
    return this.resource === other.resource && this.action === other.action;
  }
}

/**
 * Role
 */
class Role {
  constructor(name, permissions = []) {
    this.name = name;
    this.permissions = new Set(permissions.map(p => p.toString()));
    this.parentRoles = [];
  }

  /**
   * Add permission
   */
  addPermission(permission) {
    this.permissions.add(permission.toString());
  }

  /**
   * Remove permission
   */
  removePermission(permission) {
    this.permissions.delete(permission.toString());
  }

  /**
   * Check if role has permission
   */
  hasPermission(permission) {
    // Check direct permissions
    if (this.permissions.has(permission.toString())) {
      return true;
    }

    // Check inherited permissions from parent roles
    for (const parentRole of this.parentRoles) {
      if (parentRole.hasPermission(permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add parent role (role inheritance)
   */
  addParentRole(parentRole) {
    if (!this.parentRoles.includes(parentRole)) {
      this.parentRoles.push(parentRole);
    }
  }
}

/**
 * User
 */
class User {
  constructor(id, username, roles = []) {
    this.id = id;
    this.username = username;
    this.roles = roles;
    this.attributes = {};
  }

  /**
   * Add role
   */
  addRole(role) {
    if (!this.roles.includes(role)) {
      this.roles.push(role);
    }
  }

  /**
   * Remove role
   */
  removeRole(role) {
    const index = this.roles.indexOf(role);
    if (index > -1) {
      this.roles.splice(index, 1);
    }
  }

  /**
   * Set attribute
   */
  setAttribute(key, value) {
    this.attributes[key] = value;
  }

  /**
   * Get attribute
   */
  getAttribute(key) {
    return this.attributes[key];
  }
}

/**
 * RBAC (Role-Based Access Control)
 */
class RBAC {
  constructor() {
    this.roles = new Map();
    this.users = new Map();
  }

  /**
   * Create role
   */
  createRole(name, permissions = []) {
    const role = new Role(name, permissions);
    this.roles.set(name, role);
    return role;
  }

  /**
   * Get role
   */
  getRole(name) {
    return this.roles.get(name);
  }

  /**
   * Create user
   */
  createUser(id, username, roles = []) {
    const user = new User(id, username, roles);
    this.users.set(id, user);
    return user;
  }

  /**
   * Assign role to user
   */
  assignRole(userId, roleName) {
    const user = this.users.get(userId);
    const role = this.roles.get(roleName);
    
    if (!user || !role) {
      throw new Error('User or role not found');
    }

    user.addRole(role);
  }

  /**
   * Check if user has permission
   */
  hasPermission(userId, permission) {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }

    for (const role of user.roles) {
      if (role.hasPermission(permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user can perform action on resource
   */
  canAccess(userId, resource, action) {
    const permission = new Permission(resource, action);
    return this.hasPermission(userId, permission);
  }
}

/**
 * ABAC (Attribute-Based Access Control)
 */
class ABAC {
  constructor() {
    this.policies = [];
  }

  /**
   * Add policy
   */
  addPolicy(policy) {
    this.policies.push(policy);
  }

  /**
   * Evaluate access
   */
  evaluateAccess(user, resource, action, environment = {}) {
    for (const policy of this.policies) {
      if (policy.evaluate(user, resource, action, environment)) {
        return policy.effect === 'allow';
      }
    }

    // Default deny
    return false;
  }
}

/**
 * Policy
 */
class Policy {
  constructor(name, effect = 'allow') {
    this.name = name;
    this.effect = effect; // 'allow' or 'deny'
    this.conditions = [];
  }

  /**
   * Add condition
   */
  addCondition(condition) {
    this.conditions.push(condition);
  }

  /**
   * Evaluate policy
   */
  evaluate(user, resource, action, environment) {
    // All conditions must be true
    for (const condition of this.conditions) {
      if (!condition(user, resource, action, environment)) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Authorization Middleware
 */
class AuthorizationMiddleware {
  constructor(authorization) {
    this.authorization = authorization;
  }

  /**
   * RBAC middleware
   */
  rbacMiddleware(requiredPermission) {
    return (req, res, next) => {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const permission = new Permission(
        requiredPermission.resource,
        requiredPermission.action
      );

      if (this.authorization.hasPermission(userId, permission)) {
        next();
      } else {
        res.status(403).json({ error: 'Forbidden' });
      }
    };
  }

  /**
   * ABAC middleware
   */
  abacMiddleware(requiredResource, requiredAction) {
    return (req, res, next) => {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const environment = {
        ip: req.ip,
        time: new Date(),
        method: req.method
      };

      if (this.authorization.evaluateAccess(user, requiredResource, requiredAction, environment)) {
        next();
      } else {
        res.status(403).json({ error: 'Forbidden' });
      }
    };
  }
}

/**
 * Permission Manager
 */
class PermissionManager {
  constructor() {
    this.permissions = new Map();
  }

  /**
   * Define permission
   */
  definePermission(name, resource, action) {
    const permission = new Permission(resource, action);
    this.permissions.set(name, permission);
    return permission;
  }

  /**
   * Get permission
   */
  getPermission(name) {
    return this.permissions.get(name);
  }

  /**
   * List all permissions
   */
  listPermissions() {
    return Array.from(this.permissions.entries()).map(([name, perm]) => ({
      name,
      resource: perm.resource,
      action: perm.action
    }));
  }
}

// Example usage
function demonstrateAuthorization() {
  console.log('=== RBAC (Role-Based Access Control) ===\n');

  const rbac = new RBAC();

  // Create permissions
  const readUsers = new Permission('users', 'read');
  const writeUsers = new Permission('users', 'write');
  const deleteUsers = new Permission('users', 'delete');
  const readProducts = new Permission('products', 'read');
  const writeProducts = new Permission('products', 'write');
  const adminAccess = new Permission('*', '*');

  // Create roles
  const adminRole = rbac.createRole('admin', [adminAccess]);
  const editorRole = rbac.createRole('editor', [readUsers, writeUsers, readProducts, writeProducts]);
  const viewerRole = rbac.createRole('viewer', [readUsers, readProducts]);

  // Role inheritance: editor inherits from viewer
  editorRole.addParentRole(viewerRole);

  // Create users
  const admin = rbac.createUser('1', 'admin', [adminRole]);
  const editor = rbac.createUser('2', 'editor', [editorRole]);
  const viewer = rbac.createUser('3', 'viewer', [viewerRole]);

  // Check permissions
  console.log('Admin can delete users:', rbac.canAccess('1', 'users', 'delete'));
  console.log('Editor can write users:', rbac.canAccess('2', 'users', 'write'));
  console.log('Editor can delete users:', rbac.canAccess('2', 'users', 'delete'));
  console.log('Viewer can read users:', rbac.canAccess('3', 'users', 'read'));
  console.log('Viewer can write users:', rbac.canAccess('3', 'users', 'write'));

  console.log('\n=== ABAC (Attribute-Based Access Control) ===\n');

  const abac = new ABAC();

  // Create policy: Allow access during business hours
  const businessHoursPolicy = new Policy('business-hours', 'allow');
  businessHoursPolicy.addCondition((user, resource, action, env) => {
    const hour = env.time.getHours();
    return hour >= 9 && hour < 17; // 9 AM to 5 PM
  });

  // Create policy: Allow access from specific IP
  const ipPolicy = new Policy('ip-whitelist', 'allow');
  ipPolicy.addCondition((user, resource, action, env) => {
    return env.ip === '192.168.1.100';
  });

  // Create policy: Allow based on user attribute
  const departmentPolicy = new Policy('department', 'allow');
  departmentPolicy.addCondition((user, resource, action, env) => {
    return user.getAttribute('department') === 'IT';
  });

  abac.addPolicy(businessHoursPolicy);
  abac.addPolicy(ipPolicy);
  abac.addPolicy(departmentPolicy);

  // Test ABAC
  const user = new User('4', 'testuser');
  user.setAttribute('department', 'IT');

  const env1 = { ip: '192.168.1.100', time: new Date('2024-01-01T14:00:00') };
  const env2 = { ip: '192.168.1.101', time: new Date('2024-01-01T14:00:00') };
  const env3 = { ip: '192.168.1.100', time: new Date('2024-01-01T20:00:00') };

  console.log('Access with valid IP and time:', abac.evaluateAccess(user, 'data', 'read', env1));
  console.log('Access with invalid IP:', abac.evaluateAccess(user, 'data', 'read', env2));
  console.log('Access outside business hours:', abac.evaluateAccess(user, 'data', 'read', env3));

  console.log('\n=== Permission Manager ===\n');
  const permManager = new PermissionManager();
  
  permManager.definePermission('READ_USERS', 'users', 'read');
  permManager.definePermission('WRITE_USERS', 'users', 'write');
  permManager.definePermission('DELETE_USERS', 'users', 'delete');
  
  console.log('Permissions:', permManager.listPermissions());
}

if (require.main === module) {
  demonstrateAuthorization();
}

module.exports = {
  Permission,
  Role,
  User,
  RBAC,
  ABAC,
  Policy,
  AuthorizationMiddleware,
  PermissionManager
};

