# Design Payment System

## Problem Statement

Design a payment processing system that handles transactions, supports multiple payment methods, and ensures security.

## Requirements

### Functional Requirements
- Process payments
- Multiple payment methods (card, wallet, bank)
- Payment gateway integration
- Transaction history
- Refunds
- Fraud detection
- Idempotency

### Non-Functional Requirements
- High security (PCI-DSS compliance)
- ACID transactions
- Low latency (< 500ms)
- High availability (99.99%)
- Audit trail

## Capacity Estimation

### Storage
- **Transactions:** 10M/day * 1KB = 10GB/day = 3.65TB/year
- **User data:** 100M users * 2KB = 200GB
- **Payment methods:** 100M * 500 bytes = 50GB
- **Total:** ~4TB/year

### Bandwidth
- **Payment requests:** 116 requests/sec * 2KB = 232KB/sec
- **Gateway communication:** 116 requests/sec * 5KB = 580KB/sec

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Payment     │────▶│  Payment   │
│             │     │  Gateway     │     │  Gateway    │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                    ┌───────▼──────┐
                    │  Fraud       │
                    │  Detection   │
                    └──────────────┘
                            │
                    ┌───────▼──────┐
                    │  Database    │
                    │  (ACID)      │
                    └──────────────┘
```

### Payment Flow

#### Standard Flow
1. **Initiate payment:** Client → Payment Service
2. **Validate:** Check amount, user, payment method
3. **Fraud check:** Run fraud detection
4. **Process:** Payment Service → Payment Gateway
5. **Confirm:** Gateway → Payment Service
6. **Update:** Update transaction status
7. **Notify:** Notify client

#### Idempotency
- **Idempotency key:** Unique key per request
- **Duplicate detection:** Check for existing transaction
- **Idempotent response:** Return same result for duplicate

### Security

#### Encryption
- **In transit:** TLS/SSL
- **At rest:** Encrypt sensitive data
- **Tokenization:** Tokenize card numbers

#### Compliance
- **PCI-DSS:** Payment Card Industry Data Security Standard
- **Data retention:** Retain transaction data
- **Audit logging:** Log all operations

### Database Schema

#### Transactions Table
```sql
CREATE TABLE transactions (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(20), -- pending, completed, failed, refunded
  idempotency_key VARCHAR(100) UNIQUE,
  gateway_transaction_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_idempotency_key (idempotency_key)
);
```

#### Payment Methods Table
```sql
CREATE TABLE payment_methods (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  type VARCHAR(20), -- card, wallet, bank
  token VARCHAR(200), -- Tokenized payment method
  last_four VARCHAR(4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
);
```

## Data Structures

### In-Memory Storage (Production: Database)

#### User Storage
- **users:** Map<userId, userData> - User information
- **Production:** SQL database with encryption

#### Payment Methods
- **paymentMethods:** Map<userId, Array<paymentMethod>> - Tokenized payment methods
- **Production:** Secure database with encryption (PCI DSS compliance)

#### Transaction Storage
- **transactions:** Map<transactionId, transactionData> - All transactions
- **Production:** SQL database with audit logging

#### Idempotency Keys
- **idempotencyKeys:** Map<key, transactionId> - Idempotency key mapping
- **Production:** Redis with TTL

#### Fraud Rules
- **fraudRules:** Array<rule> - Fraud detection rules
- **Production:** ML model or rule engine

## Process Flow

### Process Payment Process

1. **Check Idempotency:** Verify idempotency key not used
2. **Validate Input:** Check amount, user, payment method
3. **Fraud Detection:** Run fraud detection checks
4. **Create Transaction:** Generate transaction ID
5. **Process Payment:** Call payment gateway
6. **Update Status:** Mark as completed or failed
7. **Store Idempotency:** Map key to transaction ID
8. **Return Transaction:** Return transaction object

### Fraud Detection Process

1. **Check Rules:** Evaluate fraud detection rules
2. **ML Model:** Run ML-based fraud detection (if available)
3. **Risk Score:** Calculate risk score
4. **Decision:** Approve, reject, or require additional verification
5. **Log Result:** Log fraud check result

## Security Considerations

### PCI DSS Compliance
- **Tokenization:** Never store raw card data
- **Encryption:** Encrypt sensitive data at rest and in transit
- **Access Control:** Limit access to payment data
- **Audit Logging:** Log all payment operations

### Idempotency
- **Purpose:** Prevent duplicate transactions on retries
- **Implementation:** Unique key per transaction request
- **Storage:** Redis with TTL (e.g., 24 hours)

## Implementation

### Node.js Implementation

See [Node.js Code](./node/payment-system.js)

**Key features:**
- Multiple payment methods (card, wallet, bank)
- Idempotent transactions for safe retries
- Fraud detection with rules and ML
- Refund processing
- Transaction history
- Payment method tokenization

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Payment processing flow
- Security and PCI DSS compliance
- Fraud detection mechanisms
- Idempotency handling
- Data structures
- Process flows
- Performance optimizations
- Production considerations

### Usage Example

```javascript
const { PaymentSystem } = require('./node/payment-system');

const payments = new PaymentSystem();

// Process payment
const transaction = await payments.processPayment({
  userId: 'user1',
  amount: 100.00,
  currency: 'USD',
  paymentMethod: 'card',
  idempotencyKey: 'unique-key-123'
});

// Refund
await payments.refund(transaction.id, 50.00);
```

## Performance Optimization

### Database Optimization
- **Read replicas:** Distribute read load
- **Partitioning:** Partition by date
- **Indexing:** Optimize queries

### Caching
- **Payment methods:** Cache user payment methods
- **Fraud rules:** Cache fraud detection rules

## Monitoring

### Key Metrics
- **Transaction success rate:** Successful transactions
- **Latency:** P50, P95, P99
- **Fraud detection rate:** Detected fraud
- **Refund rate:** Refund percentage

### Alerts
- Low transaction success rate
- High latency
- High fraud rate
- Payment gateway failures

## Trade-offs

### Security vs Performance
- **More security:** Slower, more complex
- **Less security:** Faster, simpler

### Consistency vs Availability
- **Strong consistency:** Slower, more complex
- **Eventual consistency:** Faster, simpler

## Further Enhancements

1. **Recurring payments:** Subscription billing
2. **Split payments:** Multiple recipients
3. **Multi-currency:** Currency conversion
4. **Loyalty points:** Reward system
5. **Payment plans:** Installment payments
6. **Dispute management:** Chargeback handling

