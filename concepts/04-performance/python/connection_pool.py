"""
Connection Pooling Implementation
Demonstrates database connection pooling
"""
import asyncio
import time
from typing import Dict, Any, Optional, Set
from dataclasses import dataclass
from collections import deque


@dataclass
class Connection:
    """Connection object"""
    id: str
    created_at: float
    last_used: float
    in_use: bool = False


class ConnectionPool:
    """Database connection pool implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        self.min_size = config.get('min_size', 2)
        self.max_size = config.get('max_size', 10)
        self.idle_timeout = config.get('idle_timeout', 30.0)  # 30 seconds
        self.max_lifetime = config.get('max_lifetime', 3600.0)  # 1 hour
        
        self.pool: list = []
        self.active: Set[str] = set()
        self.waiting: deque = deque()
        self.stats = {
            'created': 0,
            'acquired': 0,
            'released': 0,
            'destroyed': 0,
            'timeout': 0
        }
        
        self._cleanup_task = None
    
    async def initialize(self):
        """Initialize pool with minimum connections"""
        for _ in range(self.min_size):
            await self._create_connection()
        
        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
    
    async def _create_connection(self) -> Connection:
        """Create a new connection"""
        connection = Connection(
            id=f'conn-{time.time()}-{id(self)}',
            created_at=time.time(),
            last_used=time.time(),
            in_use=False
        )
        
        # Simulate connection creation
        await asyncio.sleep(0.1)
        
        self.pool.append(connection)
        self.stats['created'] += 1
        
        return connection
    
    async def acquire(self, timeout: float = 5.0) -> Connection:
        """Acquire connection from pool"""
        start_time = time.time()
        
        while True:
            # Find idle connection
            connection = next((conn for conn in self.pool if not conn.in_use), None)
            
            # Create new connection if pool not full
            if not connection and len(self.pool) < self.max_size:
                connection = await self._create_connection()
            
            if connection:
                connection.in_use = True
                connection.last_used = time.time()
                self.active.add(connection.id)
                self.stats['acquired'] += 1
                return connection
            
            # Check timeout
            if time.time() - start_time >= timeout:
                self.stats['timeout'] += 1
                raise TimeoutError('Connection acquisition timeout')
            
            # Wait and retry
            await asyncio.sleep(0.1)
    
    def release(self, connection: Connection):
        """Release connection back to pool"""
        if connection not in self.pool:
            return
        
        connection.in_use = False
        connection.last_used = time.time()
        self.active.discard(connection.id)
        self.stats['released'] += 1
        
        # Notify waiting requests
        if self.waiting:
            waiter = self.waiting.popleft()
            asyncio.create_task(self._notify_waiter(waiter))
    
    async def _notify_waiter(self, waiter):
        """Notify waiting request"""
        try:
            connection = await self.acquire(waiter['timeout'])
            waiter['resolve'](connection)
        except Exception as e:
            waiter['reject'](e)
    
    def destroy(self, connection: Connection):
        """Destroy connection"""
        if connection in self.pool:
            self.pool.remove(connection)
            self.active.discard(connection.id)
            self.stats['destroyed'] += 1
    
    async def _cleanup_loop(self):
        """Cleanup loop"""
        while True:
            await asyncio.sleep(10)  # Every 10 seconds
            self._cleanup()
    
    def _cleanup(self):
        """Cleanup idle and expired connections"""
        now = time.time()
        to_destroy = []
        
        for connection in self.pool:
            if connection.in_use:
                continue
            
            idle_time = now - connection.last_used
            lifetime = now - connection.created_at
            
            # Destroy if idle too long (but keep minimum)
            if idle_time > self.idle_timeout and len(self.pool) > self.min_size:
                to_destroy.append(connection)
            
            # Destroy if lifetime exceeded
            if lifetime > self.max_lifetime:
                to_destroy.append(connection)
        
        for conn in to_destroy:
            self.destroy(conn)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get pool statistics"""
        return {
            **self.stats,
            'pool_size': len(self.pool),
            'active_connections': len(self.active),
            'idle_connections': len(self.pool) - len(self.active),
            'waiting_requests': len(self.waiting),
            'min_size': self.min_size,
            'max_size': self.max_size
        }
    
    async def close(self):
        """Close all connections"""
        # Wait for active connections
        while self.active:
            await asyncio.sleep(0.1)
        
        # Destroy all connections
        for conn in self.pool[:]:
            self.destroy(conn)
        
        # Cancel cleanup task
        if self._cleanup_task:
            self._cleanup_task.cancel()


async def demonstrate_connection_pool():
    """Demonstrate connection pooling"""
    print('=== Connection Pooling Demonstration ===\n')
    
    pool = ConnectionPool({
        'min_size': 2,
        'max_size': 5,
        'idle_timeout': 10.0,
        'max_lifetime': 60.0
    })
    
    await pool.initialize()
    
    print('Initial stats:', pool.get_stats())
    
    # Acquire connections
    conn1 = await pool.acquire()
    conn2 = await pool.acquire()
    print('\nAcquired 2 connections')
    print('Stats:', pool.get_stats())
    
    # Release one
    pool.release(conn1)
    print('\nReleased 1 connection')
    print('Stats:', pool.get_stats())
    
    # Acquire more (should create new)
    conn3 = await pool.acquire()
    conn4 = await pool.acquire()
    conn5 = await pool.acquire()
    print('\nAcquired 3 more connections (pool at max)')
    print('Stats:', pool.get_stats())
    
    # Release all
    pool.release(conn2)
    pool.release(conn3)
    pool.release(conn4)
    pool.release(conn5)
    print('\nReleased all connections')
    print('Stats:', pool.get_stats())
    
    # Wait for cleanup
    print('\nWaiting for cleanup...')
    await asyncio.sleep(12)
    print('Stats after cleanup:', pool.get_stats())
    
    await pool.close()


if __name__ == '__main__':
    asyncio.run(demonstrate_connection_pool())

