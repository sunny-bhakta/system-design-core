"""
Sharding Strategies Implementation
Demonstrates different sharding approaches
"""
from typing import Dict, Any, Optional
import hashlib


class RangeBasedSharding:
    """Range-based sharding implementation"""
    
    def __init__(self, num_shards: int):
        self.num_shards = num_shards
        self.shards: Dict[int, Dict] = {i: {} for i in range(num_shards)}
    
    def get_shard(self, key: int) -> int:
        """Get shard for key based on range"""
        return key % self.num_shards
    
    def set(self, key: int, value: Any) -> Dict[str, Any]:
        """Set value"""
        shard_id = self.get_shard(key)
        self.shards[shard_id][key] = value
        return {'shard_id': shard_id, 'key': key, 'value': value}
    
    def get(self, key: int) -> Optional[Any]:
        """Get value"""
        shard_id = self.get_shard(key)
        return self.shards[shard_id].get(key)
    
    def get_stats(self) -> Dict[int, Dict]:
        """Get shard statistics"""
        return {
            i: {
                'size': len(self.shards[i]),
                'keys': list(self.shards[i].keys())
            }
            for i in range(self.num_shards)
        }


class HashBasedSharding:
    """Hash-based sharding implementation"""
    
    def __init__(self, num_shards: int):
        self.num_shards = num_shards
        self.shards: Dict[int, Dict] = {i: {} for i in range(num_shards)}
    
    def hash(self, key: str) -> int:
        """Hash function"""
        return int(hashlib.md5(key.encode()).hexdigest(), 16)
    
    def get_shard(self, key: str) -> int:
        """Get shard for key based on hash"""
        hash_value = self.hash(key)
        return hash_value % self.num_shards
    
    def set(self, key: str, value: Any) -> Dict[str, Any]:
        """Set value"""
        shard_id = self.get_shard(key)
        self.shards[shard_id][key] = value
        return {'shard_id': shard_id, 'key': key, 'value': value}
    
    def get(self, key: str) -> Optional[Any]:
        """Get value"""
        shard_id = self.get_shard(key)
        return self.shards[shard_id].get(key)
    
    def get_stats(self) -> Dict[int, Dict]:
        """Get shard statistics"""
        return {
            i: {'size': len(self.shards[i])}
            for i in range(self.num_shards)
        }


class DirectoryBasedSharding:
    """Directory-based sharding implementation"""
    
    def __init__(self, num_shards: int):
        self.num_shards = num_shards
        self.shards: Dict[int, Dict] = {i: {} for i in range(num_shards)}
        self.directory: Dict[str, int] = {}  # Key -> Shard mapping
    
    def get_shard(self, key: str) -> int:
        """Get shard for key (with directory lookup)"""
        if key in self.directory:
            return self.directory[key]
        
        # Assign to shard (could be based on load, etc.)
        import random
        shard_id = random.randint(0, self.num_shards - 1)
        self.directory[key] = shard_id
        return shard_id
    
    def set(self, key: str, value: Any) -> Dict[str, Any]:
        """Set value"""
        shard_id = self.get_shard(key)
        self.shards[shard_id][key] = value
        return {'shard_id': shard_id, 'key': key, 'value': value}
    
    def get(self, key: str) -> Optional[Any]:
        """Get value"""
        shard_id = self.directory.get(key)
        if shard_id is None:
            return None
        return self.shards[shard_id].get(key)
    
    def rebalance(self, key: str, new_shard_id: int) -> Optional[Dict[str, Any]]:
        """Rebalance: Move key to different shard"""
        old_shard_id = self.directory.get(key)
        if old_shard_id is not None:
            value = self.shards[old_shard_id].pop(key)
            self.shards[new_shard_id][key] = value
            self.directory[key] = new_shard_id
            return {'key': key, 'old_shard_id': old_shard_id, 'new_shard_id': new_shard_id}
        return None
    
    def get_stats(self) -> Dict[int, Dict]:
        """Get shard statistics"""
        return {
            i: {'size': len(self.shards[i])}
            for i in range(self.num_shards)
        }


class ConsistentHashing:
    """Consistent hashing implementation"""
    
    def __init__(self, num_shards: int, virtual_nodes: int = 3):
        self.num_shards = num_shards
        self.virtual_nodes = virtual_nodes
        self.shards: Dict[int, Dict] = {i: {} for i in range(num_shards)}
        self.ring: Dict[int, int] = {}  # Hash value -> Shard ID
        self.sorted_keys: list = []
        
        self._build_ring()
    
    def hash(self, key: str) -> int:
        """Hash function"""
        return int(hashlib.md5(key.encode()).hexdigest(), 16)
    
    def _build_ring(self):
        """Build hash ring"""
        self.ring.clear()
        self.sorted_keys = []
        
        for shard_id in range(self.num_shards):
            for v in range(self.virtual_nodes):
                hash_value = self.hash(f'{shard_id}-{v}')
                self.ring[hash_value] = shard_id
                self.sorted_keys.append(hash_value)
        
        self.sorted_keys.sort()
    
    def get_shard(self, key: str) -> int:
        """Get shard for key using consistent hashing"""
        key_hash = self.hash(key)
        
        # Find first node with hash >= key_hash
        for ring_hash in self.sorted_keys:
            if ring_hash >= key_hash:
                return self.ring[ring_hash]
        
        # Wrap around to first node
        return self.ring[self.sorted_keys[0]]
    
    def set(self, key: str, value: Any) -> Dict[str, Any]:
        """Set value"""
        shard_id = self.get_shard(key)
        self.shards[shard_id][key] = value
        return {'shard_id': shard_id, 'key': key, 'value': value}
    
    def get(self, key: str) -> Optional[Any]:
        """Get value"""
        shard_id = self.get_shard(key)
        return self.shards[shard_id].get(key)
    
    def add_shard(self) -> int:
        """Add new shard"""
        new_shard_id = self.num_shards
        self.num_shards += 1
        self.shards[new_shard_id] = {}
        self._build_ring()  # Rebuild ring
        return new_shard_id
    
    def remove_shard(self, shard_id: int):
        """Remove shard"""
        if shard_id in self.shards:
            # Move data to other shards (simplified)
            data = self.shards[shard_id].copy()
            for key, value in data.items():
                new_shard_id = self.get_shard(key)
                if new_shard_id != shard_id:
                    self.shards[new_shard_id][key] = value
            
            del self.shards[shard_id]
            self._build_ring()  # Rebuild ring
            self.num_shards -= 1
    
    def get_stats(self) -> Dict[int, Dict]:
        """Get shard statistics"""
        return {
            i: {'size': len(self.shards[i])}
            for i in range(self.num_shards)
        }


def demonstrate_sharding():
    """Demonstrate different sharding strategies"""
    print('=== Range-Based Sharding ===\n')
    range_sharding = RangeBasedSharding(3)
    for i in range(1, 11):
        range_sharding.set(i, f'value{i}')
    print('Stats:', range_sharding.get_stats())
    print('Get key 5:', range_sharding.get(5))
    
    print('\n=== Hash-Based Sharding ===\n')
    hash_sharding = HashBasedSharding(3)
    for i in range(1, 11):
        hash_sharding.set(f'user{i}', f'value{i}')
    print('Stats:', hash_sharding.get_stats())
    print('Get user5:', hash_sharding.get('user5'))
    
    print('\n=== Directory-Based Sharding ===\n')
    dir_sharding = DirectoryBasedSharding(3)
    for i in range(1, 11):
        dir_sharding.set(f'key{i}', f'value{i}')
    print('Stats:', dir_sharding.get_stats())
    dir_sharding.rebalance('key5', 2)
    print('After rebalance:', dir_sharding.get_stats())
    
    print('\n=== Consistent Hashing ===\n')
    consistent_hashing = ConsistentHashing(3, 3)
    for i in range(1, 11):
        consistent_hashing.set(f'key{i}', f'value{i}')
    print('Stats:', consistent_hashing.get_stats())
    print('Adding new shard...')
    consistent_hashing.add_shard()
    print('Stats after adding shard:', consistent_hashing.get_stats())


if __name__ == '__main__':
    demonstrate_sharding()

