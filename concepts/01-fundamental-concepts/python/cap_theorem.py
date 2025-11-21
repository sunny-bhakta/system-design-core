"""
CAP Theorem Demonstrations
Shows different consistency and availability trade-offs
"""
from typing import Dict, Optional, List
import asyncio
from datetime import datetime


class CPSystem:
    """
    CP System (Consistency + Partition Tolerance)
    Sacrifices Availability
    """
    
    def __init__(self):
        self.data: Dict[str, str] = {}
        self.is_partitioned = False
    
    def set_partitioned(self, partitioned: bool):
        """Set partition status"""
        self.is_partitioned = partitioned
    
    async def write(self, key: str, value: str) -> Dict:
        """Write operation - rejects during partition"""
        if self.is_partitioned:
            raise Exception('System unavailable due to partition')
        
        # Ensure consistency across all nodes
        self.data[key] = value
        await self.replicate_to_all_nodes(key, value)
        return {'success': True, 'key': key, 'value': value}
    
    async def read(self, key: str) -> Optional[str]:
        """Read operation - rejects during partition"""
        if self.is_partitioned:
            raise Exception('System unavailable due to partition')
        
        return self.data.get(key)
    
    async def replicate_to_all_nodes(self, key: str, value: str):
        """Replicate to all nodes for consistency"""
        print(f"Replicating {key}={value} to all nodes")
        await asyncio.sleep(0.1)


class APSystem:
    """
    AP System (Availability + Partition Tolerance)
    Sacrifices Consistency
    """
    
    def __init__(self):
        self.data: Dict[str, str] = {}
        self.pending_writes: List[Dict] = []
        self.is_partitioned = False
    
    def set_partitioned(self, partitioned: bool):
        """Set partition status"""
        self.is_partitioned = partitioned
    
    async def write(self, key: str, value: str) -> Dict:
        """Write operation - always accepts"""
        self.data[key] = value
        
        if self.is_partitioned:
            # Queue writes for later replication
            self.pending_writes.append({
                'key': key,
                'value': value,
                'timestamp': datetime.now()
            })
            print(f"Write queued due to partition: {key}={value}")
        else:
            await self.replicate_to_all_nodes(key, value)
        
        return {
            'success': True,
            'key': key,
            'value': value,
            'consistent': not self.is_partitioned
        }
    
    async def read(self, key: str) -> Dict:
        """Read operation - always returns (may be stale)"""
        value = self.data.get(key)
        return {
            'value': value,
            'consistent': not self.is_partitioned,
            'note': 'Data may be stale due to partition' if self.is_partitioned 
                    else 'Data is consistent'
        }
    
    async def replicate_to_all_nodes(self, key: str, value: str):
        """Replicate to all nodes"""
        print(f"Replicating {key}={value} to all nodes")
        await asyncio.sleep(0.1)
    
    async def resolve_partition(self):
        """When partition resolves, sync pending writes"""
        print('Partition resolved, syncing pending writes...')
        for write in self.pending_writes:
            await self.replicate_to_all_nodes(write['key'], write['value'])
        self.pending_writes = []
        self.is_partitioned = False


class CASystem:
    """
    CA System (Consistency + Availability)
    Only possible in single-node systems (no partition tolerance)
    """
    
    def __init__(self):
        self.data: Dict[str, str] = {}
    
    async def write(self, key: str, value: str) -> Dict:
        """Write operation - single node, always consistent"""
        self.data[key] = value
        return {'success': True, 'key': key, 'value': value, 'consistent': True}
    
    async def read(self, key: str) -> Dict:
        """Read operation - single node, always consistent"""
        return {
            'value': self.data.get(key),
            'consistent': True
        }


async def demonstrate_cap():
    """Demonstrate CAP theorem trade-offs"""
    print("=== CP System (Consistency + Partition Tolerance) ===")
    cp_system = CPSystem()
    
    try:
        await cp_system.write('user1', 'Alice')
        result = await cp_system.read('user1')
        print(f"Write successful: {result}")
        
        cp_system.set_partitioned(True)
        try:
            await cp_system.write('user2', 'Bob')
        except Exception as e:
            print(f"Write rejected: {e}")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n=== AP System (Availability + Partition Tolerance) ===")
    ap_system = APSystem()
    
    await ap_system.write('user1', 'Alice')
    result = await ap_system.read('user1')
    print(f"Write successful: {result}")
    
    ap_system.set_partitioned(True)
    write_result = await ap_system.write('user2', 'Bob')
    print(f"Write during partition: {write_result}")
    
    read_result = await ap_system.read('user2')
    print(f"Read during partition: {read_result}")
    
    await ap_system.resolve_partition()
    result = await ap_system.read('user2')
    print(f"After partition resolved: {result}")
    
    print("\n=== CA System (Consistency + Availability) ===")
    ca_system = CASystem()
    
    await ca_system.write('user1', 'Alice')
    result = await ca_system.read('user1')
    print(f"Write successful: {result}")


if __name__ == '__main__':
    asyncio.run(demonstrate_cap())

