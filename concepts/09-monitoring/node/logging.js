/**
 * Structured Logging Implementation
 * Demonstrates structured logging with different log levels
 */

/**
 * Log Levels
 */
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

/**
 * Structured Logger
 */
class StructuredLogger {
  constructor(config = {}) {
    this.serviceName = config.serviceName || 'app';
    this.environment = config.environment || 'development';
    this.minLevel = config.minLevel || LogLevel.INFO;
    this.logs = [];
    this.maxLogs = config.maxLogs || 1000;
  }

  /**
   * Create log entry
   */
  createLogEntry(level, message, metadata = {}) {
    return {
      timestamp: new Date().toISOString(),
      level: Object.keys(LogLevel).find(key => LogLevel[key] === level),
      levelNum: level,
      service: this.serviceName,
      environment: this.environment,
      message,
      ...metadata,
      traceId: metadata.traceId || this.generateTraceId(),
      spanId: metadata.spanId || this.generateSpanId()
    };
  }

  /**
   * Generate trace ID
   */
  generateTraceId() {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate span ID
   */
  generateSpanId() {
    return `span-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log message
   */
  log(level, message, metadata = {}) {
    if (level < this.minLevel) {
      return;
    }

    const logEntry = this.createLogEntry(level, message, metadata);
    
    // Store log
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Output log
    this.outputLog(logEntry);
    
    return logEntry;
  }

  /**
   * Output log (can be overridden for different outputs)
   */
  outputLog(logEntry) {
    const level = logEntry.level;
    const timestamp = logEntry.timestamp;
    const message = logEntry.message;
    
    // Color codes for console
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
      FATAL: '\x1b[35m'  // Magenta
    };
    const reset = '\x1b[0m';
    
    console.log(
      `${colors[level] || ''}[${timestamp}] [${level}] ${message}${reset}`,
      logEntry
    );
  }

  /**
   * Debug log
   */
  debug(message, metadata = {}) {
    return this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Info log
   */
  info(message, metadata = {}) {
    return this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Warn log
   */
  warn(message, metadata = {}) {
    return this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Error log
   */
  error(message, error = null, metadata = {}) {
    const errorMetadata = {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : null
    };
    return this.log(LogLevel.ERROR, message, errorMetadata);
  }

  /**
   * Fatal log
   */
  fatal(message, error = null, metadata = {}) {
    const errorMetadata = {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : null
    };
    return this.log(LogLevel.FATAL, message, errorMetadata);
  }

  /**
   * Get logs
   */
  getLogs(level = null, limit = null) {
    let filtered = this.logs;
    
    if (level !== null) {
      filtered = filtered.filter(log => log.levelNum >= level);
    }
    
    if (limit !== null) {
      filtered = filtered.slice(-limit);
    }
    
    return filtered;
  }

  /**
   * Get logs as JSON
   */
  getLogsJSON(level = null, limit = null) {
    return JSON.stringify(this.getLogs(level, limit), null, 2);
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
  }
}

/**
 * Request Logger Middleware
 */
class RequestLogger {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Log HTTP request
   */
  logRequest(req, res, startTime) {
    const duration = Date.now() - startTime;
    const metadata = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress
    };

    if (res.statusCode >= 500) {
      this.logger.error('Request failed', null, metadata);
    } else if (res.statusCode >= 400) {
      this.logger.warn('Request error', metadata);
    } else {
      this.logger.info('Request completed', metadata);
    }
  }

  /**
   * Create middleware function
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const traceId = this.logger.generateTraceId();
      
      // Add trace ID to request
      req.traceId = traceId;
      
      // Log request start
      this.logger.info('Request started', {
        method: req.method,
        path: req.path,
        traceId
      });

      // Log response when finished
      res.on('finish', () => {
        this.logRequest(req, res, startTime);
      });

      next();
    };
  }
}

// Example usage
function demonstrateLogging() {
  console.log('=== Structured Logging ===\n');

  const logger = new StructuredLogger({
    serviceName: 'api-service',
    environment: 'production',
    minLevel: LogLevel.DEBUG
  });

  // Different log levels
  logger.debug('Debug message', { component: 'auth', userId: 'user123' });
  logger.info('User logged in', { userId: 'user123', ip: '192.168.1.1' });
  logger.warn('High memory usage', { memoryUsage: '85%', threshold: '80%' });
  
  try {
    throw new Error('Database connection failed');
  } catch (error) {
    logger.error('Database error', error, { database: 'users-db', query: 'SELECT * FROM users' });
  }

  logger.fatal('System crash', new Error('Out of memory'), { component: 'server' });

  // Get logs
  console.log('\n=== Recent Logs ===');
  const recentLogs = logger.getLogs(null, 5);
  console.log(JSON.stringify(recentLogs, null, 2));

  // Get error logs only
  console.log('\n=== Error Logs ===');
  const errorLogs = logger.getLogs(LogLevel.ERROR);
  console.log(JSON.stringify(errorLogs, null, 2));
}

if (require.main === module) {
  demonstrateLogging();
}

module.exports = { StructuredLogger, RequestLogger, LogLevel };

