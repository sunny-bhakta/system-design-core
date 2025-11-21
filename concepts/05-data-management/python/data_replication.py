"""
Data Replication Implementation
Demonstrates master-slave and master-master replication
"""
import asyncio
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Master:
    """Master node"""
    id: str
    data: Dict[str, Any] = field(default_factory=dict)
    write_log: List[Dict] = field(default_factory=list)


@dataclass
class Slave:
    """Slave node"""
    id: str
    data: Dict[str, Any] = field(default_factory=dict)
    replication_lag: float = 0.0
    last_replicated: float = field(default_factory=lambda: datetime.now().timestamp())


class MasterSlaveReplication:
    """Master-slave replication implementation"""
    
    def __init__(self, config: Dict[str, Any] = None):
        config = config or {}
        self.master = Master(
            id='master',
            data={},
            write_log=[]
        )
        
        num_slaves = config.get('num_slaves', 2)
        self.slaves = [
            Slave(id=f'slave-{i}')
            for i in range(num_slaves)
        ]
        
        self.replication_delay = config.get('replication_delay', 0.1)  # seconds
        self.stats = {
            'writes': 0,
            'reads': 0,
            'replications': 0
        }
    
    async def write(self, key: str, value: Any) -> Dict[str, Any]:
        """Write to master"""
        # Write to master
        self.master.data[key] = value
        self.master.write_log.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().timestamp()
        })
        
        self.stats['writes'] += 1
        
        # Replicate to slaves asynchronously
        asyncio.create_task(self._replicate_to_slaves(key, value))
        
        return {'success': True, 'key': key, 'value': value}
    
    async def _replicate_to_slaves(self, key: str, value: Any):
        """Replicate to slaves"""
        replication_tasks = []
        for slave in self.slaves:
            async def replicate_slave(s):
                # Simulate network delay
                await asyncio.sleep(self.replication_delay)
                
                s.data[key] = value
                s.last_replicated = datetime.now().timestamp()
                if self.master.write_log:
                    s.replication_lag = (datetime.now().timestamp() - 
                                        self.master.write_log[-1]['timestamp']) * 1000
                
                self.stats['replications'] += 1
            
            replication_tasks.append(replicate_slave(slave))
        
        await asyncio.gather(*replication_tasks)
    
    def read(self, key: str, prefer_slave: bool = True) -> Optional[Dict[str, Any]]:
        """Read from slave (load balancing)"""
        self.stats['reads'] += 1
        
        if prefer_slave and self.slaves:
            # Round-robin slave selection
            slave_index = self.stats['reads'] % len(self.slaves)
            slave = self.slaves[slave_index]
            
            if key in slave.data:
                return {
                    'value': slave.data[key],
                    'source': slave.id,
                    'lag': slave.replication_lag
                }
        
        # Fallback to master
        if key in self.master.data:
            return {
                'value': self.master.data[key],
                'source': 'master',
                'lag': 0
            }
        
        return None
    
    def promote_slave(self, slave_id: str) -> Master:
        """Promote slave to master (failover)"""
        slave_index = next((i for i, s in enumerate(self.slaves) if s.id == slave_id), None)
        if slave_index is None:
            raise ValueError(f"Slave {slave_id} not found")
        
        slave = self.slaves[slave_index]
        
        # Promote slave to master
        self.master = Master(
            id=slave.id,
            data=slave.data.copy(),
            write_log=self.master.write_log.copy()
        )
        
        # Remove from slaves
        self.slaves.pop(slave_index)
        
        print(f"Slave {slave_id} promoted to master")
        return self.master
    
    def get_status(self) -> Dict[str, Any]:
        """Get replication status"""
        return {
            'master': {
                'id': self.master.id,
                'data_size': len(self.master.data),
                'write_log_size': len(self.master.write_log)
            },
            'slaves': [
                {
                    'id': slave.id,
                    'data_size': len(slave.data),
                    'replication_lag': slave.replication_lag,
                    'last_replicated': datetime.fromtimestamp(slave.last_replicated).isoformat()
                }
                for slave in self.slaves
            ],
            'stats': self.stats
        }


class MasterMasterReplication:
    """Master-master replication implementation"""
    
    def __init__(self, config: Dict[str, Any] = None):
        config = config or {}
        num_masters = config.get('num_masters', 2)
        self.masters = [
            Master(
                id=f'master-{i}',
                data={},
                write_log=[]
            )
            for i in range(num_masters)
        ]
        
        self.replication_delay = config.get('replication_delay', 0.1)
        self.conflict_resolution = config.get('conflict_resolution', 'last-write-wins')
        self.stats = {
            'writes': 0,
            'conflicts': 0,
            'replications': 0
        }
    
    async def write(self, master_id: str, key: str, value: Any) -> Dict[str, Any]:
        """Write to a master"""
        master = next((m for m in self.masters if m.id == master_id), None)
        if not master:
            raise ValueError(f"Master {master_id} not found")
        
        # Check for conflicts
        conflict = self._check_conflict(key, value, master_id)
        if conflict:
            self.stats['conflicts'] += 1
            value = self._resolve_conflict(conflict, value)
        
        # Write to local master
        master.data[key] = value
        master.write_log.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().timestamp(),
            'master_id': master_id
        })
        
        self.stats['writes'] += 1
        
        # Replicate to other masters
        asyncio.create_task(self._replicate_to_other_masters(master_id, key, value))
        
        return {'success': True, 'key': key, 'value': value, 'master_id': master_id}
    
    def _check_conflict(self, key: str, new_value: Any, writer_id: str) -> Optional[Dict[str, Any]]:
        """Check for conflicts"""
        for master in self.masters:
            if master.id != writer_id and key in master.data:
                existing_value = master.data[key]
                existing_write = next((w for w in master.write_log if w['key'] == key), None)
                
                if existing_write and (datetime.now().timestamp() - existing_write['timestamp']) < self.replication_delay * 2:
                    return {
                        'key': key,
                        'existing_value': existing_value,
                        'new_value': new_value,
                        'existing_master': master.id,
                        'new_master': writer_id
                    }
        return None
    
    def _resolve_conflict(self, conflict: Dict[str, Any], new_value: Any) -> Any:
        """Resolve conflict"""
        if self.conflict_resolution == 'last-write-wins':
            return new_value
        elif self.conflict_resolution == 'first-write-wins':
            return conflict['existing_value']
        elif self.conflict_resolution == 'merge':
            # Simple merge strategy
            if isinstance(conflict['existing_value'], dict) and isinstance(new_value, dict):
                return {**conflict['existing_value'], **new_value}
            return new_value
        else:
            return new_value
    
    async def _replicate_to_other_masters(self, writer_id: str, key: str, value: Any):
        """Replicate to other masters"""
        other_masters = [m for m in self.masters if m.id != writer_id]
        
        replication_tasks = []
        for master in other_masters:
            async def replicate_master(m):
                await asyncio.sleep(self.replication_delay)
                m.data[key] = value
                m.last_sync = datetime.now().timestamp()
                self.stats['replications'] += 1
            
            replication_tasks.append(replicate_master(master))
        
        await asyncio.gather(*replication_tasks)
    
    def read(self, key: str, master_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Read from any master"""
        if master_id:
            master = next((m for m in self.masters if m.id == master_id), None)
            if master and key in master.data:
                return {'value': master.data[key], 'source': master.id}
        
        # Try all masters
        for master in self.masters:
            if key in master.data:
                return {'value': master.data[key], 'source': master.id}
        
        return None
    
    def get_status(self) -> Dict[str, Any]:
        """Get status"""
        return {
            'masters': [
                {
                    'id': master.id,
                    'data_size': len(master.data),
                    'write_log_size': len(master.write_log)
                }
                for master in self.masters
            ],
            'stats': self.stats,
            'conflict_resolution': self.conflict_resolution
        }


async def demonstrate_replication():
    """Demonstrate data replication"""
    print('=== Master-Slave Replication ===\n')
    
    ms_replication = MasterSlaveReplication({
        'num_slaves': 2,
        'replication_delay': 0.05
    })
    
    # Write to master
    await ms_replication.write('user1', 'Alice')
    await ms_replication.write('user2', 'Bob')
    
    # Wait for replication
    await asyncio.sleep(0.2)
    
    # Read from slaves
    print('Read from slave:', ms_replication.read('user1', True))
    print('Read from slave:', ms_replication.read('user2', True))
    
    print('\nStatus:', ms_replication.get_status())
    
    print('\n=== Master-Master Replication ===\n')
    
    mm_replication = MasterMasterReplication({
        'num_masters': 2,
        'replication_delay': 0.05,
        'conflict_resolution': 'last-write-wins'
    })
    
    # Write to different masters
    await mm_replication.write('master-0', 'key1', 'value1')
    await mm_replication.write('master-1', 'key2', 'value2')
    
    # Wait for replication
    await asyncio.sleep(0.2)
    
    # Read from any master
    print('Read key1:', mm_replication.read('key1'))
    print('Read key2:', mm_replication.read('key2'))
    
    print('\nStatus:', mm_replication.get_status())


if __name__ == '__main__':
    asyncio.run(demonstrate_replication())

