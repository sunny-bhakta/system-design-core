/**
 * JWT Authentication Implementation
 * Demonstrates JWT token generation, validation, and refresh
 */

const crypto = require('crypto');

/**
 * JWT Token Manager
 */
class JWTAuth {
  constructor(secret, options = {}) {
    this.secret = secret || this.generateSecret();
    this.algorithm = options.algorithm || 'HS256';
    this.accessTokenExpiry = options.accessTokenExpiry || 3600; // 1 hour
    this.refreshTokenExpiry = options.refreshTokenExpiry || 604800; // 7 days
    this.refreshTokens = new Map(); // Store refresh tokens
  }

  /**
   * Generate secret key
   */
  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Base64 URL encode
   */
  base64UrlEncode(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64 URL decode
   */
  base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
      str += '=';
    }
    return Buffer.from(str, 'base64').toString('utf8');
  }

  /**
   * Create HMAC signature
   */
  createSignature(header, payload) {
    const data = `${header}.${payload}`;
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return signature;
  }

  /**
   * Verify signature
   */
  verifySignature(header, payload, signature) {
    const expectedSignature = this.createSignature(header, payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload) {
    const header = {
      alg: this.algorithm,
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const tokenPayload = {
      ...payload,
      iat: now,
      exp: now + this.accessTokenExpiry,
      type: 'access'
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(tokenPayload));
    const signature = this.createSignature(encodedHeader, encodedPayload);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (this.refreshTokenExpiry * 1000);
    
    this.refreshTokens.set(token, {
      userId,
      expiresAt,
      createdAt: Date.now()
    });

    return token;
  }

  /**
   * Verify and decode token
   */
  verifyToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const [encodedHeader, encodedPayload, signature] = parts;

      // Verify signature
      if (!this.verifySignature(encodedHeader, encodedPayload, signature)) {
        throw new Error('Invalid signature');
      }

      // Decode payload
      const payload = JSON.parse(this.base64UrlDecode(encodedPayload));

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(refreshToken) {
    const tokenData = this.refreshTokens.get(refreshToken);
    
    if (!tokenData) {
      throw new Error('Invalid refresh token');
    }

    if (Date.now() > tokenData.expiresAt) {
      this.refreshTokens.delete(refreshToken);
      throw new Error('Refresh token expired');
    }

    // Generate new access token
    const newAccessToken = this.generateAccessToken({
      userId: tokenData.userId
    });

    return newAccessToken;
  }

  /**
   * Revoke refresh token
   */
  revokeRefreshToken(refreshToken) {
    return this.refreshTokens.delete(refreshToken);
  }

  /**
   * Cleanup expired refresh tokens
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of this.refreshTokens.entries()) {
      if (now > data.expiresAt) {
        this.refreshTokens.delete(token);
      }
    }
  }

  /**
   * Authenticate user and generate tokens
   */
  authenticate(userId, userData = {}) {
    const accessToken = this.generateAccessToken({
      userId,
      ...userData
    });

    const refreshToken = this.generateRefreshToken(userId);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenExpiry
    };
  }
}

// Example usage
function demonstrateJWTAuth() {
  console.log('=== JWT Authentication ===\n');

  const jwtAuth = new JWTAuth('my-secret-key', {
    accessTokenExpiry: 3600, // 1 hour
    refreshTokenExpiry: 604800 // 7 days
  });

  // Authenticate user
  console.log('1. Authenticating user...');
  const tokens = jwtAuth.authenticate('user123', { username: 'john', role: 'admin' });
  console.log('Tokens generated:', {
    accessToken: tokens.accessToken.substring(0, 50) + '...',
    refreshToken: tokens.refreshToken.substring(0, 20) + '...',
    expiresIn: tokens.expiresIn
  });

  // Verify access token
  console.log('\n2. Verifying access token...');
  try {
    const payload = jwtAuth.verifyToken(tokens.accessToken);
    console.log('Token verified:', payload);
  } catch (error) {
    console.error('Verification failed:', error.message);
  }

  // Refresh access token
  console.log('\n3. Refreshing access token...');
  try {
    const newAccessToken = jwtAuth.refreshAccessToken(tokens.refreshToken);
    console.log('New access token generated:', newAccessToken.substring(0, 50) + '...');
    
    const newPayload = jwtAuth.verifyToken(newAccessToken);
    console.log('New token payload:', newPayload);
  } catch (error) {
    console.error('Refresh failed:', error.message);
  }

  // Test expired token
  console.log('\n4. Testing token expiration...');
  const expiredToken = jwtAuth.generateAccessToken({ userId: 'user123' });
  // Simulate expiration by modifying expiry
  const parts = expiredToken.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  payload.exp = Math.floor(Date.now() / 1000) - 100; // Expired 100 seconds ago
  parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64');
  const expiredTokenModified = parts.join('.');
  
  try {
    jwtAuth.verifyToken(expiredTokenModified);
  } catch (error) {
    console.log('Correctly detected expired token:', error.message);
  }
}

if (require.main === module) {
  demonstrateJWTAuth();
}

module.exports = JWTAuth;

