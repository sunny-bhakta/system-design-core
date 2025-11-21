/**
 * ACID Transaction Implementation
 * Demonstrates Atomicity, Consistency, Isolation, Durability
 */

class Database {
  constructor() {
    this.accounts = new Map();
    this.transactions = [];
    this.locks = new Map();
  }

  /**
   * Initialize account
   */
  createAccount(accountId, balance) {
    if (balance < 0) {
      throw new Error('Initial balance cannot be negative');
    }
    this.accounts.set(accountId, balance);
    return { accountId, balance };
  }

  /**
   * ACID Transaction: Money Transfer
   */
  async transfer(fromAccount, toAccount, amount) {
    const transactionId = `txn_${Date.now()}`;
    const transaction = {
      id: transactionId,
      fromAccount,
      toAccount,
      amount,
      status: 'pending',
      startTime: Date.now()
    };

    try {
      // ATOMICITY: All operations succeed or all fail
      await this.beginTransaction(transaction);

      // CONSISTENCY: Maintain account balance constraints
      const fromBalance = this.accounts.get(fromAccount);
      const toBalance = this.accounts.get(toAccount);

      if (!fromBalance && fromBalance !== 0) {
        throw new Error(`Account ${fromAccount} not found`);
      }
      if (!toBalance && toBalance !== 0) {
        throw new Error(`Account ${toAccount} not found`);
      }
      if (fromBalance < amount) {
        throw new Error(`Insufficient balance in ${fromAccount}`);
      }

      // ISOLATION: Lock accounts to prevent concurrent modifications
      await this.acquireLock(fromAccount, transactionId);
      await this.acquireLock(toAccount, transactionId);

      // Perform transfer
      const newFromBalance = fromBalance - amount;
      const newToBalance = toBalance + amount;

      // DURABILITY: Write to persistent storage (simulated)
      await this.persistAccount(fromAccount, newFromBalance);
      await this.persistAccount(toAccount, newToBalance);

      this.accounts.set(fromAccount, newFromBalance);
      this.accounts.set(toAccount, newToBalance);

      // Commit transaction
      await this.commitTransaction(transaction);
      
      return {
        success: true,
        transactionId,
        fromAccount: { id: fromAccount, balance: newFromBalance },
        toAccount: { id: toAccount, balance: newToBalance }
      };

    } catch (error) {
      // ATOMICITY: Rollback on error
      await this.rollbackTransaction(transaction);
      throw error;
    } finally {
      // ISOLATION: Release locks
      await this.releaseLock(fromAccount);
      await this.releaseLock(toAccount);
    }
  }

  /**
   * Begin transaction
   */
  async beginTransaction(transaction) {
    transaction.status = 'active';
    this.transactions.push(transaction);
    console.log(`[${transaction.id}] Transaction started`);
  }

  /**
   * Commit transaction
   */
  async commitTransaction(transaction) {
    transaction.status = 'committed';
    transaction.endTime = Date.now();
    console.log(`[${transaction.id}] Transaction committed`);
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction(transaction) {
    transaction.status = 'rolled-back';
    transaction.endTime = Date.now();
    console.log(`[${transaction.id}] Transaction rolled back`);
  }

  /**
   * Acquire lock for account
   */
  async acquireLock(accountId, transactionId) {
    if (this.locks.has(accountId)) {
      throw new Error(`Account ${accountId} is locked by another transaction`);
    }
    this.locks.set(accountId, transactionId);
    console.log(`[${transactionId}] Lock acquired for ${accountId}`);
  }

  /**
   * Release lock for account
   */
  async releaseLock(accountId) {
    this.locks.delete(accountId);
    console.log(`Lock released for ${accountId}`);
  }

  /**
   * Persist account to disk (simulated)
   */
  async persistAccount(accountId, balance) {
    // Simulate disk write
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(`Persisted ${accountId}: ${balance} to disk`);
        resolve();
      }, 50);
    });
  }

  /**
   * Get account balance
   */
  getBalance(accountId) {
    return this.accounts.get(accountId);
  }

  /**
   * Get transaction history
   */
  getTransactionHistory() {
    return this.transactions;
  }
}

// Example usage
async function demonstrateACID() {
  const db = new Database();

  // Create accounts
  db.createAccount('A001', 1000);
  db.createAccount('A002', 500);
  console.log('Initial balances:');
  console.log('A001:', db.getBalance('A001'));
  console.log('A002:', db.getBalance('A002'));

  // Successful transfer
  console.log('\n=== Successful Transfer ===');
  try {
    const result = await db.transfer('A001', 'A002', 200);
    console.log('Transfer successful:', result);
    console.log('A001 balance:', db.getBalance('A001'));
    console.log('A002 balance:', db.getBalance('A002'));
  } catch (error) {
    console.log('Transfer failed:', error.message);
  }

  // Failed transfer (insufficient balance)
  console.log('\n=== Failed Transfer (Insufficient Balance) ===');
  try {
    await db.transfer('A001', 'A002', 10000);
  } catch (error) {
    console.log('Transfer failed:', error.message);
    console.log('Balances unchanged (atomicity):');
    console.log('A001:', db.getBalance('A001'));
    console.log('A002:', db.getBalance('A002'));
  }

  // Concurrent transactions (isolation)
  console.log('\n=== Concurrent Transactions ===');
  const db2 = new Database();
  db2.createAccount('B001', 1000);
  db2.createAccount('B002', 1000);

  // Simulate concurrent transfers
  Promise.all([
    db2.transfer('B001', 'B002', 100),
    db2.transfer('B001', 'B002', 200)
  ]).then(() => {
    console.log('Final balances:');
    console.log('B001:', db2.getBalance('B001'));
    console.log('B002:', db2.getBalance('B002'));
  }).catch(error => {
    console.log('Concurrent transaction error:', error.message);
  });
}

// Run demonstration
if (require.main === module) {
  demonstrateACID().catch(console.error);
}

module.exports = Database;

