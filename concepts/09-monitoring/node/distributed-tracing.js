/**
 * Distributed Tracing Implementation
 * Demonstrates trace correlation, span tracking, and performance analysis
 */

/**
 * Trace Context
 */
class TraceContext {
  constructor(traceId = null, parentSpanId = null) {
    this.traceId = traceId || this.generateTraceId();
    this.parentSpanId = parentSpanId;
    this.spans = [];
  }

  generateTraceId() {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSpanId() {
    return `span-${Math.random().toString(36).substr(2, 9)}`;
  }

  createSpan(name, tags = {}) {
    const span = new Span(this.traceId, this.generateSpanId(), this.parentSpanId, name, tags);
    this.spans.push(span);
    return span;
  }

  getSpans() {
    return this.spans;
  }

  getTraceId() {
    return this.traceId;
  }
}

/**
 * Span
 */
class Span {
  constructor(traceId, spanId, parentSpanId, name, tags = {}) {
    this.traceId = traceId;
    this.spanId = spanId;
    this.parentSpanId = parentSpanId;
    this.name = name;
    this.tags = tags;
    this.startTime = Date.now();
    this.endTime = null;
    this.duration = null;
    this.logs = [];
    this.status = 'started';
    this.children = [];
  }

  /**
   * Add tag
   */
  addTag(key, value) {
    this.tags[key] = value;
  }

  /**
   * Add log
   */
  addLog(message, fields = {}) {
    this.logs.push({
      timestamp: Date.now(),
      message,
      fields
    });
  }

  /**
   * Create child span
   */
  createChild(name, tags = {}) {
    const childSpan = new Span(this.traceId, this.generateSpanId(), this.spanId, name, tags);
    this.children.push(childSpan);
    return childSpan;
  }

  generateSpanId() {
    return `span-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Finish span
   */
  finish(status = 'success', error = null) {
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    this.status = status;
    
    if (error) {
      this.addTag('error', true);
      this.addTag('error.message', error.message);
      this.addTag('error.type', error.constructor.name);
    }

    // Finish all children
    for (const child of this.children) {
      if (child.status === 'started') {
        child.finish();
      }
    }
  }

  /**
   * Get span data
   */
  getData() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      tags: this.tags,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      status: this.status,
      logs: this.logs,
      children: this.children.map(c => c.getData())
    };
  }
}

/**
 * Tracer
 */
class Tracer {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.traces = [];
    this.activeSpans = new Map();
  }

  /**
   * Start trace
   */
  startTrace(operationName, tags = {}) {
    const context = new TraceContext();
    const span = context.createSpan(operationName, {
      ...tags,
      'service.name': this.serviceName
    });
    
    this.activeSpans.set(span.spanId, span);
    this.traces.push(context);
    
    return { context, span };
  }

  /**
   * Start span
   */
  startSpan(context, name, tags = {}) {
    const span = context.createSpan(name, {
      ...tags,
      'service.name': this.serviceName
    });
    
    this.activeSpans.set(span.spanId, span);
    return span;
  }

  /**
   * Finish span
   */
  finishSpan(spanId, status = 'success', error = null) {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.finish(status, error);
      this.activeSpans.delete(spanId);
    }
  }

  /**
   * Get trace
   */
  getTrace(traceId) {
    const trace = this.traces.find(t => t.getTraceId() === traceId);
    if (!trace) return null;
    
    return {
      traceId: trace.getTraceId(),
      spans: trace.getSpans().map(s => s.getData())
    };
  }

  /**
   * Get all traces
   */
  getAllTraces() {
    return this.traces.map(trace => ({
      traceId: trace.getTraceId(),
      spans: trace.getSpans().map(s => s.getData())
    }));
  }

  /**
   * Analyze trace performance
   */
  analyzeTrace(traceId) {
    const trace = this.getTrace(traceId);
    if (!trace) return null;

    const spans = trace.spans;
    const totalDuration = Math.max(...spans.map(s => (s.endTime || Date.now()) - s.startTime));
    
    // Find root span
    const rootSpan = spans.find(s => !s.parentSpanId);
    
    // Find slowest spans
    const sortedByDuration = [...spans].sort((a, b) => 
      (b.duration || 0) - (a.duration || 0)
    );

    // Build span tree
    const spanMap = new Map();
    spans.forEach(span => {
      spanMap.set(span.spanId, { ...span, children: [] });
    });

    const root = Array.from(spanMap.values()).find(s => !s.parentSpanId);

    return {
      traceId,
      totalDuration,
      spanCount: spans.length,
      rootSpan: root ? root.name : null,
      slowestSpans: sortedByDuration.slice(0, 5).map(s => ({
        name: s.name,
        duration: s.duration,
        tags: s.tags
      })),
      errors: spans.filter(s => s.status === 'error').length
    };
  }
}

/**
 * Trace Middleware
 */
class TraceMiddleware {
  constructor(tracer) {
    this.tracer = tracer;
  }

  /**
   * HTTP middleware
   */
  middleware() {
    return (req, res, next) => {
      // Extract trace context from headers
      const traceId = req.headers['x-trace-id'] || null;
      const parentSpanId = req.headers['x-span-id'] || null;
      
      const context = traceId 
        ? new TraceContext(traceId, parentSpanId)
        : this.tracer.startTrace('http_request').context;
      
      const span = this.tracer.startSpan(context, `${req.method} ${req.path}`, {
        'http.method': req.method,
        'http.path': req.path,
        'http.url': req.url
      });

      // Add trace headers to response
      res.setHeader('X-Trace-Id', context.getTraceId());
      res.setHeader('X-Span-Id', span.spanId);

      // Track response
      res.on('finish', () => {
        span.addTag('http.status_code', res.statusCode);
        span.finish(res.statusCode >= 400 ? 'error' : 'success');
      });

      // Attach to request
      req.traceContext = context;
      req.span = span;

      next();
    };
  }
}

/**
 * Database Trace Wrapper
 */
class DatabaseTracer {
  constructor(tracer) {
    this.tracer = tracer;
  }

  /**
   * Wrap database query
   */
  async traceQuery(context, queryName, queryFunction) {
    const span = this.tracer.startSpan(context, `db.${queryName}`, {
      'db.operation': queryName,
      'db.type': 'sql'
    });

    try {
      const result = await queryFunction();
      span.finish('success');
      return result;
    } catch (error) {
      span.finish('error', error);
      throw error;
    }
  }
}

/**
 * External Service Trace Wrapper
 */
class ServiceTracer {
  constructor(tracer) {
    this.tracer = tracer;
  }

  /**
   * Trace external service call
   */
  async traceServiceCall(context, serviceName, operation, serviceCall) {
    const span = this.tracer.startSpan(context, `${serviceName}.${operation}`, {
      'service.name': serviceName,
      'service.operation': operation
    });

    try {
      const result = await serviceCall();
      span.finish('success');
      return result;
    } catch (error) {
      span.finish('error', error);
      throw error;
    }
  }

  /**
   * Inject trace context into headers
   */
  injectHeaders(context) {
    return {
      'X-Trace-Id': context.getTraceId(),
      'X-Span-Id': context.spans[context.spans.length - 1]?.spanId || null
    };
  }
}

// Example usage
async function demonstrateDistributedTracing() {
  console.log('=== Distributed Tracing ===\n');

  const tracer = new Tracer('api-service');

  // Simulate request flow
  const { context, span: rootSpan } = tracer.startTrace('user_request', {
    'user.id': 'user123',
    'request.id': 'req456'
  });

  // Database query span
  const dbTracer = new DatabaseTracer(tracer);
  await dbTracer.traceQuery(context, 'getUser', async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return { id: 'user123', name: 'John' };
  });

  // External service call span
  const serviceTracer = new ServiceTracer(tracer);
  await serviceTracer.traceServiceCall(context, 'payment-service', 'charge', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true, transactionId: 'txn789' };
  });

  // Nested span
  const cacheSpan = tracer.startSpan(context, 'cache.get', { 'cache.key': 'user:123' });
  await new Promise(resolve => setTimeout(resolve, 10));
  cacheSpan.finish('success');

  rootSpan.finish('success');

  // Get trace
  const trace = tracer.getTrace(context.getTraceId());
  console.log('Trace:', JSON.stringify(trace, null, 2));

  // Analyze trace
  const analysis = tracer.analyzeTrace(context.getTraceId());
  console.log('\nTrace Analysis:', JSON.stringify(analysis, null, 2));
}

if (require.main === module) {
  demonstrateDistributedTracing();
}

module.exports = {
  TraceContext,
  Span,
  Tracer,
  TraceMiddleware,
  DatabaseTracer,
  ServiceTracer
};

