# Design Principles - Node.js Examples

This directory contains Node.js implementations demonstrating all major design principles.

## Files

### 1. `solid-principles.js`
Demonstrates all five SOLID principles:
- **S** - Single Responsibility Principle
- **O** - Open/Closed Principle
- **L** - Liskov Substitution Principle
- **I** - Interface Segregation Principle
- **D** - Dependency Inversion Principle

**Key Examples:**
- User service with separated concerns (SRP)
- Extensible shape calculator (OCP)
- Bird hierarchy demonstrating substitution (LSP)
- Segregated worker interfaces (ISP)
- Database abstraction with dependency injection (DIP)

### 2. `dry-kiss-yagni.js`
Demonstrates three fundamental principles:
- **DRY** - Don't Repeat Yourself
- **KISS** - Keep It Simple, Stupid
- **YAGNI** - You Aren't Gonna Need It

**Key Examples:**
- Shared validator to avoid duplication (DRY)
- Simple calculator vs complex implementation (KISS)
- Minimal service with only needed features (YAGNI)
- Combined example showing all principles

### 3. `design-for-failure.js`
Demonstrates building resilient systems:
- Resilient service with retry and timeout
- Graceful degradation with fallbacks
- Health check system
- Bulkhead pattern for isolation
- Circuit breaker implementation

**Key Examples:**
- Retry mechanism with exponential backoff
- Feature fallbacks when primary fails
- Health monitoring system
- Resource isolation to prevent cascading failures

### 4. `design-for-scale.js`
Demonstrates scalable system design:
- Stateless services
- Horizontal scaling support
- Caching layer
- Connection pooling
- Async processing
- Sharding support

**Key Examples:**
- Stateless request processing
- Instance management for horizontal scaling
- LRU cache implementation
- Database connection pool
- Async job queue
- Data sharding across multiple nodes

### 5. `separation-of-concerns.js`
Demonstrates organizing code by concerns:
- Layered architecture (Presentation, Business, Data)
- Service layer pattern
- Repository pattern
- Dependency injection container
- Module pattern

**Key Examples:**
- User controller, service, and repository layers
- Order service with multiple dependencies
- Dependency injection container
- Modular validation and formatting

## Running Examples

```bash
# Run all examples
npm run all

# Run individual examples
npm run solid
npm run dry-kiss-yagni
npm run design-for-failure
npm run design-for-scale
npm run separation

# Or run directly
node solid-principles.js
node dry-kiss-yagni.js
node design-for-failure.js
node design-for-scale.js
node separation-of-concerns.js
```

## Key Concepts Covered

1. **SOLID Principles** - All five principles with practical examples
2. **DRY** - Code reuse and shared utilities
3. **KISS** - Simple vs complex solutions
4. **YAGNI** - Building only what's needed
5. **Design for Failure** - Resilience patterns
6. **Design for Scale** - Scalability patterns
7. **Separation of Concerns** - Layered architecture
8. **Dependency Injection** - Loose coupling
9. **Repository Pattern** - Data access abstraction
10. **Module Pattern** - Code organization

## Best Practices Demonstrated

- ✅ Single responsibility per class
- ✅ Open for extension, closed for modification
- ✅ Proper inheritance and polymorphism
- ✅ Interface segregation
- ✅ Dependency inversion
- ✅ Code reuse without duplication
- ✅ Simple, clear implementations
- ✅ Building only what's needed
- ✅ Failure handling and resilience
- ✅ Scalability considerations
- ✅ Clear separation of concerns

