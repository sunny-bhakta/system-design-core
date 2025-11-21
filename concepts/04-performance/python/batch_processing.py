"""
Batch Processing Implementation
Demonstrates batch operations for improved performance
"""
import asyncio
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class BatchEntry:
    """Batch entry"""
    item: Any
    timestamp: float


class BatchProcessor:
    """Batch processor implementation"""
    
    def __init__(self, config: Dict[str, Any] = None):
        config = config or {}
        self.batch_size = config.get('batch_size', 10)
        self.flush_interval = config.get('flush_interval', 5.0)  # 5 seconds
        self.batch: List[BatchEntry] = []
        self.processing = False
        self.stats = {
            'processed': 0,
            'batches': 0,
            'errors': 0
        }
        
        self._flush_task = None
        self._start_flush_timer()
    
    def _start_flush_timer(self):
        """Start flush timer"""
        async def flush_loop():
            while True:
                await asyncio.sleep(self.flush_interval)
                await self.flush()
        
        self._flush_task = asyncio.create_task(flush_loop())
    
    async def add(self, item: Any):
        """Add item to batch"""
        self.batch.append(BatchEntry(
            item=item,
            timestamp=datetime.now().timestamp()
        ))
        
        # Auto-flush if batch is full
        if len(self.batch) >= self.batch_size:
            await self.flush()
    
    async def process_batch(self, batch: List[BatchEntry]) -> List[Dict[str, Any]]:
        """Process batch"""
        print(f"Processing batch of {len(batch)} items...")
        
        results = []
        for entry in batch:
            try:
                # Simulate processing
                await asyncio.sleep(0.01)
                results.append({'success': True, 'item': entry.item})
                self.stats['processed'] += 1
            except Exception as e:
                results.append({'success': False, 'item': entry.item, 'error': str(e)})
                self.stats['errors'] += 1
        
        return results
    
    async def flush(self) -> Optional[List[Dict[str, Any]]]:
        """Flush current batch"""
        if self.processing or not self.batch:
            return None
        
        self.processing = True
        batch_to_process = self.batch.copy()
        self.batch.clear()
        
        try:
            results = await self.process_batch(batch_to_process)
            self.stats['batches'] += 1
            return results
        finally:
            self.processing = False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics"""
        return {
            **self.stats,
            'pending_items': len(self.batch),
            'processing': self.processing
        }
    
    async def shutdown(self):
        """Shutdown and flush remaining"""
        if self._flush_task:
            self._flush_task.cancel()
        
        # Flush remaining items
        while self.batch:
            await self.flush()
            await asyncio.sleep(0.1)


class DatabaseBatchOperations:
    """Database batch operations implementation"""
    
    async def batch_insert(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Batch insert"""
        if not items:
            return []
        
        print(f"Batch inserting {len(items)} records...")
        await asyncio.sleep(len(items) * 0.005)
        
        return [
            {'id': int(datetime.now().timestamp() * 1000) + i, **item, 'inserted': True}
            for i, item in enumerate(items)
        ]
    
    async def batch_update(self, updates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Batch update"""
        if not updates:
            return []
        
        print(f"Batch updating {len(updates)} records...")
        await asyncio.sleep(len(updates) * 0.003)
        
        return [
            {**update, 'updated': True, 'updated_at': datetime.now().timestamp()}
            for update in updates
        ]
    
    async def batch_delete(self, ids: List[int]) -> List[Dict[str, Any]]:
        """Batch delete"""
        if not ids:
            return []
        
        print(f"Batch deleting {len(ids)} records...")
        await asyncio.sleep(len(ids) * 0.002)
        
        return [{'id': id, 'deleted': True} for id in ids]


async def demonstrate_batch_processing():
    """Demonstrate batch processing"""
    print('=== Batch Processing ===\n')
    
    # Batch processor
    processor = BatchProcessor({
        'batch_size': 5,
        'flush_interval': 3.0
    })
    
    # Add items
    print('Adding items to batch...')
    for i in range(1, 13):
        await processor.add({'id': i, 'data': f'item-{i}'})
    
    # Wait a bit
    await asyncio.sleep(1)
    print('Stats:', processor.get_stats())
    
    # Flush remaining
    await processor.flush()
    print('Final stats:', processor.get_stats())
    
    # Database batch operations
    print('\n=== Database Batch Operations ===\n')
    db_ops = DatabaseBatchOperations()
    
    # Batch insert
    items = [{'name': f'Item {i}', 'value': i * 10} for i in range(10)]
    inserted = await db_ops.batch_insert(items)
    print(f"Inserted {len(inserted)} records")
    
    # Batch update
    updates = [{'id': item['id'], 'name': f"Updated {item['name']}"} for item in inserted[:5]]
    updated = await db_ops.batch_update(updates)
    print(f"Updated {len(updated)} records")
    
    # Batch delete
    ids = [item['id'] for item in inserted[5:]]
    deleted = await db_ops.batch_delete(ids)
    print(f"Deleted {len(deleted)} records")
    
    await processor.shutdown()


if __name__ == '__main__':
    asyncio.run(demonstrate_batch_processing())

