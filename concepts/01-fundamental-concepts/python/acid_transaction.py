"""
ACID Transaction Implementation
Demonstrates Atomicity, Consistency, Isolation, Durability
"""
from typing import Dict, List, Optional
from datetime import datetime
import asyncio
from collections import defaultdict


class Database:
    """Database with ACID transaction support"""
    
    def __init__(self):
        self.accounts: Dict[str, float] = {}
        self.transactions: List[Dict] = []
        self.locks: Dict[str, str] = {}
    
    def create_account(self, account_id: str, balance: float) -> Dict:
        """Initialize account"""
        if balance < 0:
            raise ValueError('Initial balance cannot be negative')
        self.accounts[account_id] = balance
        return {'account_id': account_id, 'balance': balance}
    
    async def transfer(self, from_account: str, to_account: str, amount: float) -> Dict:
        """
        ACID Transaction: Money Transfer
        Demonstrates all ACID properties
        """
        transaction_id = f"txn_{int(datetime.now().timestamp() * 1000)}"
        transaction = {
            'id': transaction_id,
            'from_account': from_account,
            'to_account': to_account,
            'amount': amount,
            'status': 'pending',
            'start_time': datetime.now()
        }
        
        try:
            # ATOMICITY: All operations succeed or all fail
            await self.begin_transaction(transaction)
            
            # CONSISTENCY: Maintain account balance constraints
            from_balance = self.accounts.get(from_account)
            to_balance = self.accounts.get(to_account)
            
            if from_balance is None:
                raise ValueError(f"Account {from_account} not found")
            if to_balance is None:
                raise ValueError(f"Account {to_account} not found")
            if from_balance < amount:
                raise ValueError(f"Insufficient balance in {from_account}")
            
            # ISOLATION: Lock accounts to prevent concurrent modifications
            await self.acquire_lock(from_account, transaction_id)
            await self.acquire_lock(to_account, transaction_id)
            
            # Perform transfer
            new_from_balance = from_balance - amount
            new_to_balance = to_balance + amount
            
            # DURABILITY: Write to persistent storage (simulated)
            await self.persist_account(from_account, new_from_balance)
            await self.persist_account(to_account, new_to_balance)
            
            self.accounts[from_account] = new_from_balance
            self.accounts[to_account] = new_to_balance
            
            # Commit transaction
            await self.commit_transaction(transaction)
            
            return {
                'success': True,
                'transaction_id': transaction_id,
                'from_account': {'id': from_account, 'balance': new_from_balance},
                'to_account': {'id': to_account, 'balance': new_to_balance}
            }
        
        except Exception as error:
            # ATOMICITY: Rollback on error
            await self.rollback_transaction(transaction)
            raise error
        
        finally:
            # ISOLATION: Release locks
            await self.release_lock(from_account)
            await self.release_lock(to_account)
    
    async def begin_transaction(self, transaction: Dict):
        """Begin transaction"""
        transaction['status'] = 'active'
        self.transactions.append(transaction)
        print(f"[{transaction['id']}] Transaction started")
    
    async def commit_transaction(self, transaction: Dict):
        """Commit transaction"""
        transaction['status'] = 'committed'
        transaction['end_time'] = datetime.now()
        print(f"[{transaction['id']}] Transaction committed")
    
    async def rollback_transaction(self, transaction: Dict):
        """Rollback transaction"""
        transaction['status'] = 'rolled-back'
        transaction['end_time'] = datetime.now()
        print(f"[{transaction['id']}] Transaction rolled back")
    
    async def acquire_lock(self, account_id: str, transaction_id: str):
        """Acquire lock for account"""
        if account_id in self.locks:
            raise Exception(f"Account {account_id} is locked by another transaction")
        self.locks[account_id] = transaction_id
        print(f"[{transaction_id}] Lock acquired for {account_id}")
    
    async def release_lock(self, account_id: str):
        """Release lock for account"""
        if account_id in self.locks:
            del self.locks[account_id]
            print(f"Lock released for {account_id}")
    
    async def persist_account(self, account_id: str, balance: float):
        """Persist account to disk (simulated)"""
        await asyncio.sleep(0.05)
        print(f"Persisted {account_id}: {balance} to disk")
    
    def get_balance(self, account_id: str) -> Optional[float]:
        """Get account balance"""
        return self.accounts.get(account_id)
    
    def get_transaction_history(self) -> List[Dict]:
        """Get transaction history"""
        return self.transactions


async def demonstrate_acid():
    """Demonstrate ACID properties"""
    db = Database()
    
    # Create accounts
    db.create_account('A001', 1000.0)
    db.create_account('A002', 500.0)
    print('Initial balances:')
    print(f"A001: {db.get_balance('A001')}")
    print(f"A002: {db.get_balance('A002')}")
    
    # Successful transfer
    print('\n=== Successful Transfer ===')
    try:
        result = await db.transfer('A001', 'A002', 200.0)
        print(f"Transfer successful: {result}")
        print(f"A001 balance: {db.get_balance('A001')}")
        print(f"A002 balance: {db.get_balance('A002')}")
    except Exception as e:
        print(f"Transfer failed: {e}")
    
    # Failed transfer (insufficient balance)
    print('\n=== Failed Transfer (Insufficient Balance) ===')
    try:
        await db.transfer('A001', 'A002', 10000.0)
    except Exception as e:
        print(f"Transfer failed: {e}")
        print('Balances unchanged (atomicity):')
        print(f"A001: {db.get_balance('A001')}")
        print(f"A002: {db.get_balance('A002')}")
    
    # Concurrent transactions (isolation)
    print('\n=== Concurrent Transactions ===')
    db2 = Database()
    db2.create_account('B001', 1000.0)
    db2.create_account('B002', 1000.0)
    
    # Simulate concurrent transfers
    try:
        await asyncio.gather(
            db2.transfer('B001', 'B002', 100.0),
            db2.transfer('B001', 'B002', 200.0)
        )
        print('Final balances:')
        print(f"B001: {db2.get_balance('B001')}")
        print(f"B002: {db2.get_balance('B002')}")
    except Exception as e:
        print(f"Concurrent transaction error: {e}")


if __name__ == '__main__':
    asyncio.run(demonstrate_acid())

