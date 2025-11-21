/**
 * OAuth 2.0 Implementation
 * Demonstrates OAuth 2.0 authorization flows and token management
 */

/**
 * OAuth 2.0 Server
 */
class OAuth2Server {
  constructor(config) {
    this.clients = new Map();
    this.authorizationCodes = new Map();
    this.accessTokens = new Map();
    this.refreshTokens = new Map();
    this.authorizationCodeExpiry = config.authorizationCodeExpiry || 600000; // 10 minutes
    this.accessTokenExpiry = config.accessTokenExpiry || 3600000; // 1 hour
    this.refreshTokenExpiry = config.refreshTokenExpiry || 604800000; // 7 days
  }

  /**
   * Register client
   */
  registerClient(clientId, clientSecret, redirectUri, grantTypes = ['authorization_code']) {
    this.clients.set(clientId, {
      clientId,
      clientSecret,
      redirectUri,
      grantTypes
    });
  }

  /**
   * Generate authorization code
   */
  generateAuthorizationCode(clientId, userId, scopes = []) {
    const code = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.authorizationCodes.set(code, {
      clientId,
      userId,
      scopes,
      expiresAt: Date.now() + this.authorizationCodeExpiry,
      used: false
    });

    return code;
  }

  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(code, clientId, clientSecret, redirectUri) {
    const authCode = this.authorizationCodes.get(code);
    
    if (!authCode) {
      throw new Error('Invalid authorization code');
    }

    if (authCode.used) {
      throw new Error('Authorization code already used');
    }

    if (Date.now() > authCode.expiresAt) {
      throw new Error('Authorization code expired');
    }

    if (authCode.clientId !== clientId) {
      throw new Error('Client ID mismatch');
    }

    const client = this.clients.get(clientId);
    if (!client || client.clientSecret !== clientSecret || client.redirectUri !== redirectUri) {
      throw new Error('Invalid client credentials');
    }

    // Mark code as used
    authCode.used = true;

    // Generate tokens
    const accessToken = this.generateAccessToken(authCode.userId, authCode.scopes);
    const refreshToken = this.generateRefreshToken(authCode.userId, authCode.scopes);

    return {
      access_token: accessToken.token,
      token_type: 'Bearer',
      expires_in: Math.floor(this.accessTokenExpiry / 1000),
      refresh_token: refreshToken.token,
      scope: authCode.scopes.join(' ')
    };
  }

  /**
   * Generate access token
   */
  generateAccessToken(userId, scopes = []) {
    const token = `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.accessTokens.set(token, {
      userId,
      scopes,
      expiresAt: Date.now() + this.accessTokenExpiry,
      tokenType: 'Bearer'
    });

    return { token, expiresAt: this.accessTokens.get(token).expiresAt };
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId, scopes = []) {
    const token = `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.refreshTokens.set(token, {
      userId,
      scopes,
      expiresAt: Date.now() + this.refreshTokenExpiry
    });

    return { token, expiresAt: this.refreshTokens.get(token).expiresAt };
  }

  /**
   * Validate access token
   */
  validateAccessToken(token) {
    const tokenData = this.accessTokens.get(token);
    
    if (!tokenData) {
      return { valid: false, error: 'Invalid token' };
    }

    if (Date.now() > tokenData.expiresAt) {
      this.accessTokens.delete(token);
      return { valid: false, error: 'Token expired' };
    }

    return {
      valid: true,
      userId: tokenData.userId,
      scopes: tokenData.scopes
    };
  }

  /**
   * Refresh access token
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
    const accessToken = this.generateAccessToken(tokenData.userId, tokenData.scopes);

    return {
      access_token: accessToken.token,
      token_type: 'Bearer',
      expires_in: Math.floor(this.accessTokenExpiry / 1000),
      refresh_token: refreshToken // Return same refresh token
    };
  }

  /**
   * Revoke token
   */
  revokeToken(token) {
    if (this.accessTokens.has(token)) {
      this.accessTokens.delete(token);
      return true;
    }
    
    if (this.refreshTokens.has(token)) {
      this.refreshTokens.delete(token);
      return true;
    }

    return false;
  }
}

/**
 * Authorization Code Flow
 */
class AuthorizationCodeFlow {
  constructor(oauthServer) {
    this.oauthServer = oauthServer;
  }

  /**
   * Step 1: Generate authorization URL
   */
  generateAuthorizationUrl(clientId, redirectUri, scopes = [], state = null) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      ...(state && { state })
    });

    return `/oauth/authorize?${params.toString()}`;
  }

  /**
   * Step 2: Authorize and get code
   */
  authorize(clientId, userId, scopes = []) {
    return this.oauthServer.generateAuthorizationCode(clientId, userId, scopes);
  }

  /**
   * Step 3: Exchange code for tokens
   */
  exchangeCode(code, clientId, clientSecret, redirectUri) {
    return this.oauthServer.exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
  }
}

/**
 * Client Credentials Flow
 */
class ClientCredentialsFlow {
  constructor(oauthServer) {
    this.oauthServer = oauthServer;
  }

  /**
   * Get access token using client credentials
   */
  getAccessToken(clientId, clientSecret, scopes = []) {
    const client = this.oauthServer.clients.get(clientId);
    
    if (!client || client.clientSecret !== clientSecret) {
      throw new Error('Invalid client credentials');
    }

    // For client credentials, use clientId as userId
    const accessToken = this.oauthServer.generateAccessToken(clientId, scopes);

    return {
      access_token: accessToken.token,
      token_type: 'Bearer',
      expires_in: Math.floor(this.oauthServer.accessTokenExpiry / 1000),
      scope: scopes.join(' ')
    };
  }
}

/**
 * OAuth 2.0 Middleware
 */
class OAuth2Middleware {
  constructor(oauthServer) {
    this.oauthServer = oauthServer;
  }

  /**
   * Validate access token middleware
   */
  validateToken() {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.substring(7);
      const validation = this.oauthServer.validateAccessToken(token);

      if (!validation.valid) {
        return res.status(401).json({ error: validation.error });
      }

      req.user = { id: validation.userId };
      req.scopes = validation.scopes;
      next();
    };
  }

  /**
   * Require scope middleware
   */
  requireScope(requiredScope) {
    return (req, res, next) => {
      if (!req.scopes || !req.scopes.includes(requiredScope)) {
        return res.status(403).json({ error: 'Insufficient scope' });
      }
      next();
    };
  }
}

/**
 * OAuth 2.0 Client
 */
class OAuth2Client {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.authorizationServer = config.authorizationServer;
    this.tokenEndpoint = config.tokenEndpoint || '/oauth/token';
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Get authorization URL
   */
  getAuthorizationUrl(scopes = [], state = null) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      ...(state && { state })
    });

    return `${this.authorizationServer}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code) {
    // Simulate API call
    const response = {
      access_token: 'access_token_here',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'refresh_token_here',
      scope: 'read write'
    };

    this.accessToken = response.access_token;
    this.refreshToken = response.refresh_token;

    return response;
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Simulate API call
    const response = {
      access_token: 'new_access_token',
      token_type: 'Bearer',
      expires_in: 3600
    };

    this.accessToken = response.access_token;
    return response;
  }

  /**
   * Make authenticated request
   */
  async makeRequest(url, options = {}) {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    return {
      url,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`
      },
      ...options
    };
  }
}

// Example usage
function demonstrateOAuth2() {
  console.log('=== OAuth 2.0 Implementation ===\n');

  // Setup OAuth 2.0 Server
  const oauthServer = new OAuth2Server({
    authorizationCodeExpiry: 600000,
    accessTokenExpiry: 3600000,
    refreshTokenExpiry: 604800000
  });

  // Register client
  oauthServer.registerClient(
    'client123',
    'secret123',
    'http://localhost:3000/callback',
    ['authorization_code', 'refresh_token']
  );

  // Authorization Code Flow
  console.log('=== Authorization Code Flow ===\n');
  const authFlow = new AuthorizationCodeFlow(oauthServer);

  // Step 1: Generate authorization URL
  const authUrl = authFlow.generateAuthorizationUrl(
    'client123',
    'http://localhost:3000/callback',
    ['read', 'write'],
    'state123'
  );
  console.log('Authorization URL:', authUrl);

  // Step 2: User authorizes (simulated)
  const authCode = authFlow.authorize('client123', 'user1', ['read', 'write']);
  console.log('Authorization Code:', authCode);

  // Step 3: Exchange code for tokens
  const tokens = authFlow.exchangeCode(
    authCode,
    'client123',
    'secret123',
    'http://localhost:3000/callback'
  );
  console.log('Tokens:', tokens);

  // Validate token
  const validation = oauthServer.validateAccessToken(tokens.access_token);
  console.log('Token Validation:', validation);

  // Refresh token
  console.log('\n=== Refresh Token ===\n');
  const newTokens = oauthServer.refreshAccessToken(tokens.refresh_token);
  console.log('New Tokens:', newTokens);

  // Client Credentials Flow
  console.log('\n=== Client Credentials Flow ===\n');
  const clientFlow = new ClientCredentialsFlow(oauthServer);
  oauthServer.registerClient('service-client', 'service-secret', null, ['client_credentials']);

  const serviceTokens = clientFlow.getAccessToken('service-client', 'service-secret', ['read']);
  console.log('Service Tokens:', serviceTokens);
}

if (require.main === module) {
  demonstrateOAuth2();
}

module.exports = {
  OAuth2Server,
  AuthorizationCodeFlow,
  ClientCredentialsFlow,
  OAuth2Middleware,
  OAuth2Client
};

