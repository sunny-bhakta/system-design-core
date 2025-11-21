"""
Caching Strategies Implementation
Demonstrates Cache-Aside, Write-Through, Write-Behind, and Refresh-Ahead
"""
from typing import Optional, Dict, Any
from collections import OrderedDict
import asyncio
from datetime import datetime, timedelta


class Cache:
    """LRU Cache with TTL support"""
    
    def __init__(self, max_size: int = 100, ttl_seconds: int = 3600):
        self.data: Dict[str, Dict] = {}
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.access_order = OrderedDict()
        self.access_count: Dict[str, int] = {}
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if key not in self.data:
            return None
        
        item = self.data[key]
        
        # Check if expired
        if datetime.now() > item['expires_at']:
            self.delete(key)
            return None
        
        # Update access order for LRU
        if key in self.access_order:
            self.access_order.move_to_end(key)
        else:
            self.access_order[key] = True
        
        self.access_count[key] = self.access_count.get(key, 0) + 1
        return item['value']
    
    def set(self, key: str, value: Any, custom_ttl: Optional[int] = None):
        """Set value in cache"""
        expires_at = datetime.now() + timedelta(
            seconds=custom_ttl or self.ttl_seconds
        )
        
        # Evict if at capacity
        if len(self.data) >= self.max_size and key not in self.data:
            self._evict_lru()
        
        self.data[key] = {
            'value': value,
            'expires_at': expires_at,
            'created_at': datetime.now()
        }
        self.access_order[key] = True
        self.access_order.move_to_end(key)
    
    def delete(self, key: str):
        """Delete key from cache"""
        self.data.pop(key, None)
        self.access_order.pop(key, None)
        self.access_count.pop(key, None)
    
    def _evict_lru(self):
        """Evict least recently used item"""
        if self.access_order:
            lru_key = next(iter(self.access_order))
            self.delete(lru_key)
    
    def clear(self):
        """Clear all cache"""
        self.data.clear()
        self.access_order.clear()
        self.access_count.clear()
    
    def size(self) -> int:
        """Get cache size"""
        return len(self.data)


class MockDatabase:
    """Mock database with latency simulation"""
    
    def __init__(self):
        self.data: Dict[str, Any] = {}
        self.latency = 0.1  # 100ms
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from database"""
        await asyncio.sleep(self.latency)
        return self.data.get(key)
    
    async def set(self, key: str, value: Any):
        """Set value in database"""
        await asyncio.sleep(self.latency)
        self.data[key] = value
        return value
    
    async def delete(self, key: str):
        """Delete key from database"""
        await asyncio.sleep(self.latency)
        self.data.pop(key, None)


class CacheAside:
    """Cache-Aside (Lazy Loading) Strategy"""
    
    def __init__(self, cache: Cache, database: MockDatabase):
        self.cache = cache
        self.database = database
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value using cache-aside pattern"""
        # Try cache first
        value = self.cache.get(key)
        if value is not None:
            print(f"Cache hit for key: {key}")
            return value
        
        # Cache miss - fetch from database
        print(f"Cache miss for key: {key}, fetching from database")
        value = await self.database.get(key)
        
        if value is not None:
            # Store in cache for future requests
            self.cache.set(key, value)
        
        return value
    
    async def set(self, key: str, value: Any):
        """Set value using cache-aside pattern"""
        # Write to database
        await self.database.set(key, value)
        
        # Update cache
        self.cache.set(key, value)
        
        return value
    
    async def delete(self, key: str):
        """Delete key"""
        await self.database.delete(key)
        self.cache.delete(key)


class WriteThrough:
    """Write-Through Strategy"""
    
    def __init__(self, cache: Cache, database: MockDatabase):
        self.cache = cache
        self.database = database
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value"""
        # Try cache first
        value = self.cache.get(key)
        if value is not None:
            return value
        
        # Cache miss - fetch from database
        value = await self.database.get(key)
        if value is not None:
            self.cache.set(key, value)
        
        return value
    
    async def set(self, key: str, value: Any):
        """Set value - write to both cache and database"""
        try:
            # Write to both simultaneously
            await self.database.set(key, value)
            self.cache.set(key, value)
            return value
        except Exception as error:
            # Rollback cache on database failure
            self.cache.delete(key)
            raise error
    
    async def delete(self, key: str):
        """Delete key"""
        await self.database.delete(key)
        self.cache.delete(key)


class WriteBehind:
    """Write-Behind (Write-Back) Strategy"""
    
    def __init__(self, cache: Cache, database: MockDatabase, flush_interval: int = 5):
        self.cache = cache
        self.database = database
        self.write_queue = []
        self.flush_interval = flush_interval
        self.flushing = False
        self._flush_task = None
        
        # Start background flush process
        self._start_flush_process()
    
    def _start_flush_process(self):
        """Start background flush process"""
        async def flush_loop():
            while True:
                await asyncio.sleep(self.flush_interval)
                await self.flush()
        
        self._flush_task = asyncio.create_task(flush_loop())
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value"""
        # Try cache first
        value = self.cache.get(key)
        if value is not None:
            return value
        
        # Cache miss - fetch from database
        value = await self.database.get(key)
        if value is not None:
            self.cache.set(key, value)
        
        return value
    
    async def set(self, key: str, value: Any):
        """Set value - write to cache immediately, queue for database"""
        # Write to cache immediately
        self.cache.set(key, value)
        
        # Queue for async database write
        self.write_queue.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now()
        })
        
        return value
    
    async def delete(self, key: str):
        """Delete key"""
        self.cache.delete(key)
        self.write_queue.append({
            'key': key,
            'value': None,
            'delete': True,
            'timestamp': datetime.now()
        })
    
    async def flush(self):
        """Flush queued writes to database"""
        if self.flushing or not self.write_queue:
            return
        
        self.flushing = True
        writes = self.write_queue.copy()
        self.write_queue.clear()
        
        for write in writes:
            try:
                if write.get('delete'):
                    await self.database.delete(write['key'])
                else:
                    await self.database.set(write['key'], write['value'])
            except Exception as error:
                print(f"Failed to flush write for key {write['key']}: {error}")
        
        self.flushing = False
    
    async def shutdown(self):
        """Shutdown and flush remaining writes"""
        if self._flush_task:
            self._flush_task.cancel()
        
        # Flush remaining writes
        while self.write_queue:
            await self.flush()
            await asyncio.sleep(0.1)


class RefreshAhead:
    """Refresh-Ahead Strategy"""
    
    def __init__(self, cache: Cache, database: MockDatabase, refresh_threshold: float = 0.8):
        self.cache = cache
        self.database = database
        self.refresh_threshold = refresh_threshold
        self.refreshing = set()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value with refresh-ahead"""
        item = self.cache.data.get(key)
        
        if not item:
            # Cache miss - fetch from database
            return await self._fetch_and_cache(key)
        
        # Check if close to expiration
        age = (datetime.now() - item['created_at']).total_seconds()
        ttl = (item['expires_at'] - item['created_at']).total_seconds()
        age_ratio = age / ttl if ttl > 0 else 0
        
        # If close to expiration, refresh in background
        if age_ratio >= self.refresh_threshold and key not in self.refreshing:
            self.refreshing.add(key)
            asyncio.create_task(self._refresh_in_background(key))
        
        # Return cached value (may be slightly stale)
        return item['value']
    
    async def _fetch_and_cache(self, key: str) -> Optional[Any]:
        """Fetch from database and cache"""
        value = await self.database.get(key)
        if value is not None:
            self.cache.set(key, value)
        return value
    
    async def _refresh_in_background(self, key: str):
        """Refresh cache in background"""
        try:
            value = await self.database.get(key)
            if value is not None:
                self.cache.set(key, value)
                print(f"Refreshed cache for key: {key}")
        except Exception as error:
            print(f"Failed to refresh key {key}: {error}")
        finally:
            self.refreshing.discard(key)
    
    async def set(self, key: str, value: Any):
        """Set value"""
        await self.database.set(key, value)
        self.cache.set(key, value)
        return value


async def demonstrate_caching_strategies():
    """Demonstrate different caching strategies"""
    database = MockDatabase()
    cache = Cache(10, 10)  # 10 items, 10 second TTL
    
    print("=== Cache-Aside Strategy ===")
    cache_aside = CacheAside(cache, database)
    await cache_aside.set('user1', 'Alice')
    print(f"Get user1: {await cache_aside.get('user1')}")
    print(f"Get user1 again (should be cache hit): {await cache_aside.get('user1')}")
    
    print("\n=== Write-Through Strategy ===")
    write_through = WriteThrough(Cache(), database)
    await write_through.set('user2', 'Bob')
    print(f"Get user2: {await write_through.get('user2')}")
    
    print("\n=== Write-Behind Strategy ===")
    write_behind = WriteBehind(Cache(), database, flush_interval=5)
    await write_behind.set('user3', 'Charlie')
    print(f"Get user3 (immediate): {await write_behind.get('user3')}")
    print("Waiting for flush...")
    await asyncio.sleep(6)
    await write_behind.shutdown()
    
    print("\n=== Refresh-Ahead Strategy ===")
    refresh_ahead = RefreshAhead(Cache(10, 5), database, refresh_threshold=0.8)
    await refresh_ahead.set('user4', 'David')
    print(f"Get user4: {await refresh_ahead.get('user4')}")
    await asyncio.sleep(4.5)  # Wait for refresh threshold
    print(f"Get user4 again (should trigger refresh): {await refresh_ahead.get('user4')}")
    await asyncio.sleep(1)


if __name__ == '__main__':
    asyncio.run(demonstrate_caching_strategies())

