/**
 * Design Payment System
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Payment processing system with multiple payment methods and fraud detection.
 * 
 * CAPACITY ESTIMATION:
 * - Users: 100M+ users
 * - Transactions: 100M transactions/day = ~1.16K transactions/second
 * - Storage: 100M/day * 1KB = 100GB/day = 36.5TB/year
 * - Payment methods: Credit card, debit card, wallet, bank transfer
 * 
 * ARCHITECTURE:
 * Client → Load Balancer → Payment Service → Payment Gateway → Bank
 * 
 * KEY FEATURES:
 * - Multiple payment methods (card, wallet, bank)
 * - Idempotency for safe retries
 * - Fraud detection
 * - Transaction history
 * - Refund processing
 * - Payment method tokenization
 * 
 * SECURITY:
 * - PCI DSS compliance
 * - Tokenization: Never store raw card data
 * - Encryption: Encrypt sensitive data
 * - Fraud detection: ML-based fraud detection
 */
class PaymentSystem {
  /**
   * Constructor
   * 
   * INITIALIZES DATA STRUCTURES:
   * ============================
   * All data structures are in-memory Maps for simplicity.
   * In production, would use secure databases and payment gateways.
   */
  constructor() {
    /**
     * USER STORAGE
     * ============
     * Stores user information.
     * In production: SQL database with encryption
     */
    this.users = new Map();
    
    /**
     * PAYMENT METHODS
     * ===============
     * Stores tokenized payment methods per user.
     * Never stores raw card data (PCI DSS compliance).
     * In production: Secure database with encryption
     */
    this.paymentMethods = new Map(); // userId -> List of payment methods
    
    /**
     * TRANSACTION STORAGE
     * ===================
     * Stores all payment transactions.
     * In production: SQL database with audit logging
     */
    this.transactions = new Map();
    
    /**
     * IDEMPOTENCY KEYS
     * ================
     * Maps idempotency keys to transaction IDs.
     * Prevents duplicate transactions on retries.
     * In production: Redis with TTL
     */
    this.idempotencyKeys = new Map(); // key -> transaction ID
    
    /**
     * FRAUD RULES
     * ===========
     * List of fraud detection rules.
     * In production: ML model or rule engine
     */
    this.fraudRules = [];
  }

  /**
   * Create user
   */
  createUser(userId, email, name) {
    const user = {
      id: userId,
      email,
      name,
      createdAt: Date.now()
    };

    this.users.set(userId, user);
    this.paymentMethods.set(userId, []);

    return user;
  }

  /**
   * Add payment method
   */
  addPaymentMethod(userId, type, token, lastFour) {
    const methods = this.paymentMethods.get(userId) || [];
    
    const method = {
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type, // card, wallet, bank
      token, // Tokenized payment method
      lastFour,
      createdAt: Date.now()
    };

    methods.push(method);
    this.paymentMethods.set(userId, methods);

    return method;
  }

  /**
   * Process payment
   */
  async processPayment({ userId, amount, currency, paymentMethod, idempotencyKey, description = '' }) {
    // Check idempotency
    if (idempotencyKey) {
      const existingTransactionId = this.idempotencyKeys.get(idempotencyKey);
      if (existingTransactionId) {
        const existingTransaction = this.transactions.get(existingTransactionId);
        return existingTransaction;
      }
    }

    // Validate
    if (amount <= 0) {
      throw new Error('Invalid amount');
    }

    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check payment method
    const methods = this.paymentMethods.get(userId) || [];
    const method = methods.find(m => m.id === paymentMethod || m.type === paymentMethod);
    if (!method) {
      throw new Error('Payment method not found');
    }

    // Fraud detection
    const fraudCheck = await this.detectFraud(userId, amount);
    if (fraudCheck.isFraud) {
      throw new Error(`Fraud detected: ${fraudCheck.reason}`);
    }

    // Create transaction
    const transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      amount,
      currency,
      paymentMethod: method.id,
      status: 'pending',
      idempotencyKey: idempotencyKey || null,
      gatewayTransactionId: null,
      description,
      createdAt: Date.now(),
      completedAt: null
    };

    this.transactions.set(transaction.id, transaction);

    // Store idempotency key
    if (idempotencyKey) {
      this.idempotencyKeys.set(idempotencyKey, transaction.id);
    }

    // Process payment (simulate gateway call)
    try {
      const gatewayResponse = await this.callPaymentGateway(transaction, method);
      transaction.status = 'completed';
      transaction.gatewayTransactionId = gatewayResponse.transactionId;
      transaction.completedAt = Date.now();
    } catch (error) {
      transaction.status = 'failed';
      transaction.error = error.message;
    }

    return transaction;
  }

  /**
   * Detect fraud (simplified)
   */
  async detectFraud(userId, amount) {
    // Get user transactions
    const userTransactions = Array.from(this.transactions.values())
      .filter(t => t.userId === userId && t.status === 'completed');

    // Check for suspicious patterns
    const recentTransactions = userTransactions.filter(
      t => Date.now() - t.createdAt < 60 * 60 * 1000 // Last hour
    );

    // Rule 1: Too many transactions in short time
    if (recentTransactions.length > 10) {
      return { isFraud: true, reason: 'Too many transactions in short time' };
    }

    // Rule 2: Unusually large amount
    const avgAmount = userTransactions.length > 0
      ? userTransactions.reduce((sum, t) => sum + t.amount, 0) / userTransactions.length
      : 0;

    if (avgAmount > 0 && amount > avgAmount * 5) {
      return { isFraud: true, reason: 'Unusually large amount' };
    }

    // Rule 3: Rapid successive transactions
    if (recentTransactions.length > 0) {
      const lastTransaction = recentTransactions[recentTransactions.length - 1];
      const timeSinceLastTransaction = Date.now() - lastTransaction.createdAt;
      if (timeSinceLastTransaction < 1000) { // Less than 1 second
        return { isFraud: true, reason: 'Rapid successive transactions' };
      }
    }

    return { isFraud: false };
  }

  /**
   * Call payment gateway (simulated)
   */
  async callPaymentGateway(transaction, paymentMethod) {
    // Simulate gateway call
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate 95% success rate
    if (Math.random() > 0.05) {
      return {
        transactionId: `gateway_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'success'
      };
    } else {
      throw new Error('Payment gateway error');
    }
  }

  /**
   * Refund transaction
   */
  async refund(transactionId, amount = null) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'completed') {
      throw new Error('Transaction not completed');
    }

    const refundAmount = amount || transaction.amount;

    if (refundAmount > transaction.amount) {
      throw new Error('Refund amount exceeds transaction amount');
    }

    // Create refund transaction
    const refund = {
      id: `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: transaction.userId,
      amount: refundAmount,
      currency: transaction.currency,
      paymentMethod: transaction.paymentMethod,
      status: 'pending',
      originalTransactionId: transactionId,
      createdAt: Date.now(),
      completedAt: null
    };

    this.transactions.set(refund.id, refund);

    // Process refund (simulate gateway call)
    try {
      await this.callRefundGateway(refund);
      refund.status = 'completed';
      refund.completedAt = Date.now();
      transaction.status = 'refunded';
    } catch (error) {
      refund.status = 'failed';
      refund.error = error.message;
    }

    return refund;
  }

  /**
   * Call refund gateway (simulated)
   */
  async callRefundGateway(refund) {
    // Simulate gateway call
    await new Promise(resolve => setTimeout(resolve, 100));
    return { status: 'success' };
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(userId, limit = 20) {
    const transactions = Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    return transactions;
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId) {
    return this.transactions.get(transactionId);
  }
}

// Example usage
async function demonstratePaymentSystem() {
  console.log('=== Design Payment System ===\n');

  const payments = new PaymentSystem();

  // Create user
  const user = payments.createUser('user1', 'alice@example.com', 'Alice');

  // Add payment method
  const paymentMethod = payments.addPaymentMethod('user1', 'card', 'tok_1234', '1234');
  console.log('Payment method added:', paymentMethod.id);

  // Process payment
  const transaction = await payments.processPayment({
    userId: 'user1',
    amount: 100.00,
    currency: 'USD',
    paymentMethod: paymentMethod.id,
    idempotencyKey: 'unique-key-123',
    description: 'Purchase item'
  });
  console.log('Payment processed:', {
    id: transaction.id,
    amount: transaction.amount,
    status: transaction.status
  });

  // Refund
  const refund = await payments.refund(transaction.id, 50.00);
  console.log('Refund processed:', {
    id: refund.id,
    amount: refund.amount,
    status: refund.status
  });

  // Get transaction history
  const history = payments.getTransactionHistory('user1');
  console.log('Transaction history:', history.length);
}

if (require.main === module) {
  demonstratePaymentSystem();
}

module.exports = { PaymentSystem };

