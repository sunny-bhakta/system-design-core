/**
 * Input Validation & Sanitization
 * Demonstrates defensive security measures for input handling
 */

/**
 * Input Validator
 */
class InputValidator {
  /**
   * Validate email
   */
  static validateEmail(email) {
    if (typeof email !== 'string') {
      return { valid: false, error: 'Email must be a string' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Invalid email format' };
    }
    
    if (email.length > 254) {
      return { valid: false, error: 'Email too long' };
    }
    
    return { valid: true, sanitized: email.toLowerCase().trim() };
  }

  /**
   * Validate and sanitize string
   */
  static validateString(input, options = {}) {
    if (typeof input !== 'string') {
      return { valid: false, error: 'Input must be a string' };
    }
    
    const {
      minLength = 0,
      maxLength = 1000,
      allowEmpty = false,
      pattern = null,
      whitelist = null
    } = options;
    
    const trimmed = input.trim();
    
    if (!allowEmpty && trimmed.length === 0) {
      return { valid: false, error: 'Input cannot be empty' };
    }
    
    if (trimmed.length < minLength) {
      return { valid: false, error: `Input too short (min: ${minLength})` };
    }
    
    if (trimmed.length > maxLength) {
      return { valid: false, error: `Input too long (max: ${maxLength})` };
    }
    
    if (pattern && !pattern.test(trimmed)) {
      return { valid: false, error: 'Input does not match required pattern' };
    }
    
    if (whitelist && !whitelist.includes(trimmed)) {
      return { valid: false, error: 'Input not in allowed list' };
    }
    
    return { valid: true, sanitized: trimmed };
  }

  /**
   * Validate number
   */
  static validateNumber(input, options = {}) {
    const {
      min = -Infinity,
      max = Infinity,
      integer = false
    } = options;
    
    const num = Number(input);
    
    if (isNaN(num)) {
      return { valid: false, error: 'Input is not a number' };
    }
    
    if (integer && !Number.isInteger(num)) {
      return { valid: false, error: 'Input must be an integer' };
    }
    
    if (num < min) {
      return { valid: false, error: `Number too small (min: ${min})` };
    }
    
    if (num > max) {
      return { valid: false, error: `Number too large (max: ${max})` };
    }
    
    return { valid: true, sanitized: num };
  }

  /**
   * Validate URL
   */
  static validateURL(url) {
    if (typeof url !== 'string') {
      return { valid: false, error: 'URL must be a string' };
    }
    
    try {
      const urlObj = new URL(url);
      
      // Only allow http and https
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: 'Only HTTP and HTTPS URLs allowed' };
      }
      
      return { valid: true, sanitized: urlObj.href };
    } catch (error) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }
}

/**
 * Input Sanitizer
 */
class InputSanitizer {
  /**
   * Sanitize HTML
   */
  static sanitizeHTML(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    // Remove HTML tags
    const withoutTags = input.replace(/<[^>]*>/g, '');
    
    // Escape HTML entities
    const escaped = withoutTags
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    return escaped;
  }

  /**
   * Sanitize SQL input (use parameterized queries instead!)
   */
  static sanitizeSQL(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    // Escape SQL special characters
    return input
      .replace(/'/g, "''")
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '');
  }

  /**
   * Sanitize file path
   */
  static sanitizePath(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    // Remove path traversal attempts
    let sanitized = input
      .replace(/\.\./g, '')
      .replace(/\/\//g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    
    // Remove dangerous characters
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');
    
    return sanitized;
  }

  /**
   * Sanitize command input
   */
  static sanitizeCommand(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    // Remove command injection characters
    return input
      .replace(/[;&|`$(){}[\]]/g, '')
      .replace(/\n/g, '')
      .replace(/\r/g, '');
  }
}

/**
 * SQL Injection Prevention
 */
class SQLInjectionPrevention {
  /**
   * Parameterized query builder
   */
  static buildParameterizedQuery(query, params) {
    // Simulate parameterized query
    let parameterizedQuery = query;
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `$${paramIndex}`;
      parameterizedQuery = parameterizedQuery.replace(`:${key}`, placeholder);
      paramIndex++;
    }
    
    return {
      query: parameterizedQuery,
      params: Object.values(params),
      safe: true
    };
  }

  /**
   * Detect SQL injection attempts
   */
  static detectSQLInjection(input) {
    if (typeof input !== 'string') {
      return { detected: false };
    }
    
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(--|#|\/\*|\*\/)/,
      /(;|\||&)/,
      /(UNION\s+SELECT)/i,
      /(OR\s+1\s*=\s*1)/i,
      /('|"|`)/,
      /(\bxp_\w+)/i
    ];
    
    for (const pattern of sqlPatterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          pattern: pattern.toString(),
          input: input.substring(0, 100) // First 100 chars
        };
      }
    }
    
    return { detected: false };
  }
}

/**
 * XSS Prevention
 */
class XSSPrevention {
  /**
   * Escape HTML
   */
  static escapeHTML(input) {
    if (typeof input !== 'string') {
      return String(input);
    }
    
    const entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;'
    };
    
    return input.replace(/[&<>"'\/]/g, char => entityMap[char]);
  }

  /**
   * Detect XSS attempts
   */
  static detectXSS(input) {
    if (typeof input !== 'string') {
      return { detected: false };
    }
    
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]+src[^>]*=.*javascript:/gi,
      /<svg[^>]*onload/gi
    ];
    
    for (const pattern of xssPatterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          pattern: pattern.toString(),
          input: input.substring(0, 100)
        };
      }
    }
    
    return { detected: false };
  }
}

/**
 * CSRF Protection
 */
class CSRFProtection {
  constructor() {
    this.tokens = new Map();
  }

  /**
   * Generate CSRF token
   */
  generateToken(sessionId) {
    const token = require('crypto').randomBytes(32).toString('hex');
    this.tokens.set(sessionId, {
      token,
      expiresAt: Date.now() + 3600000 // 1 hour
    });
    return token;
  }

  /**
   * Validate CSRF token
   */
  validateToken(sessionId, token) {
    const stored = this.tokens.get(sessionId);
    
    if (!stored) {
      return { valid: false, error: 'No token found for session' };
    }
    
    if (Date.now() > stored.expiresAt) {
      this.tokens.delete(sessionId);
      return { valid: false, error: 'Token expired' };
    }
    
    if (stored.token !== token) {
      return { valid: false, error: 'Invalid token' };
    }
    
    return { valid: true };
  }

  /**
   * Cleanup expired tokens
   */
  cleanup() {
    const now = Date.now();
    for (const [sessionId, data] of this.tokens.entries()) {
      if (now > data.expiresAt) {
        this.tokens.delete(sessionId);
      }
    }
  }
}

// Example usage
function demonstrateSecurity() {
  console.log('=== Input Validation ===\n');
  
  // Email validation
  console.log('Email validation:');
  console.log(InputValidator.validateEmail('user@example.com'));
  console.log(InputValidator.validateEmail('invalid-email'));
  
  // String validation
  console.log('\nString validation:');
  console.log(InputValidator.validateString('hello', { minLength: 3, maxLength: 10 }));
  console.log(InputValidator.validateString('x', { minLength: 3 }));
  
  // SQL Injection detection
  console.log('\n=== SQL Injection Prevention ===\n');
  const sqlCheck = SQLInjectionPrevention.detectSQLInjection("admin' OR '1'='1");
  console.log('SQL Injection detected:', sqlCheck);
  
  // Parameterized query
  const safeQuery = SQLInjectionPrevention.buildParameterizedQuery(
    'SELECT * FROM users WHERE username = :username AND password = :password',
    { username: 'admin', password: 'pass123' }
  );
  console.log('Safe query:', safeQuery);
  
  // XSS detection
  console.log('\n=== XSS Prevention ===\n');
  const xssCheck = XSSPrevention.detectXSS('<script>alert("XSS")</script>');
  console.log('XSS detected:', xssCheck);
  
  const escaped = XSSPrevention.escapeHTML('<script>alert("XSS")</script>');
  console.log('Escaped HTML:', escaped);
  
  // CSRF protection
  console.log('\n=== CSRF Protection ===\n');
  const csrf = new CSRFProtection();
  const sessionId = 'session123';
  const token = csrf.generateToken(sessionId);
  console.log('CSRF token generated:', token.substring(0, 20) + '...');
  
  const validation = csrf.validateToken(sessionId, token);
  console.log('Token validation:', validation);
}

if (require.main === module) {
  demonstrateSecurity();
}

module.exports = {
  InputValidator,
  InputSanitizer,
  SQLInjectionPrevention,
  XSSPrevention,
  CSRFProtection
};

