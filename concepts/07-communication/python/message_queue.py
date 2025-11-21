"""
Message Queue Implementation
Demonstrates pub/sub and point-to-point messaging
"""
import asyncio
import secrets
from typing import List, Dict, Any, Callable, Optional
from dataclasses import dataclass, field
from datetime import datetime
from collections import deque


@dataclass
class Message:
    """Message representation"""
    id: str
    timestamp: float
    data: Any
    attempts: int = 0


class MessageQueue:
    """Message queue implementation"""
    
    def __init__(self, name: str):
        self.name = name
        self.messages: List[Message] = []
        self.subscribers: List[Callable] = []
        self.max_size = 1000
    
    def publish(self, message: Any) -> Message:
        """Publish message"""
        if len(self.messages) >= self.max_size:
            self.messages.pop(0)  # Remove oldest
        
        msg = Message(
            id=f'msg-{int(datetime.now().timestamp() * 1000)}-{secrets.token_hex(4)}',
            timestamp=datetime.now().timestamp(),
            data=message
        )
        
        self.messages.append(msg)
        
        # Notify subscribers
        self._notify_subscribers(msg)
        
        return msg
    
    def subscribe(self, callback: Callable) -> Callable:
        """Subscribe to messages"""
        self.subscribers.append(callback)
        
        def unsubscribe():
            if callback in self.subscribers:
                self.subscribers.remove(callback)
        
        return unsubscribe
    
    def _notify_subscribers(self, message: Message):
        """Notify subscribers"""
        for callback in self.subscribers:
            try:
                callback(message)
            except Exception as e:
                print(f'Subscriber error: {e}')
    
    def get_messages(self, limit: Optional[int] = None) -> List[Message]:
        """Get messages"""
        if limit:
            return self.messages[-limit:]
        return self.messages.copy()
    
    def clear(self):
        """Clear messages"""
        self.messages.clear()


class PubSubSystem:
    """Pub/Sub system implementation"""
    
    def __init__(self):
        self.topics: Dict[str, MessageQueue] = {}
    
    def get_topic(self, topic_name: str) -> MessageQueue:
        """Create or get topic"""
        if topic_name not in self.topics:
            self.topics[topic_name] = MessageQueue(topic_name)
        return self.topics[topic_name]
    
    def publish(self, topic_name: str, message: Any) -> Message:
        """Publish to topic"""
        topic = self.get_topic(topic_name)
        return topic.publish(message)
    
    def subscribe(self, topic_name: str, callback: Callable) -> Callable:
        """Subscribe to topic"""
        topic = self.get_topic(topic_name)
        return topic.subscribe(callback)
    
    def list_topics(self) -> List[str]:
        """List topics"""
        return list(self.topics.keys())


class PointToPointQueue:
    """Point-to-point queue implementation"""
    
    def __init__(self, name: str):
        self.name = name
        self.queue: deque = deque()
        self.consumers: List[Callable] = []
        self.max_size = 1000
        self.processing = False
    
    def send(self, message: Any) -> Message:
        """Send message"""
        if len(self.queue) >= self.max_size:
            raise Exception('Queue is full')
        
        msg = Message(
            id=f'msg-{int(datetime.now().timestamp() * 1000)}-{secrets.token_hex(4)}',
            timestamp=datetime.now().timestamp(),
            data=message
        )
        
        self.queue.append(msg)
        asyncio.create_task(self._process_queue())
        
        return msg
    
    def register_consumer(self, callback: Callable):
        """Register consumer"""
        self.consumers.append(callback)
        asyncio.create_task(self._process_queue())
    
    async def _process_queue(self):
        """Process queue"""
        if self.processing or not self.queue or not self.consumers:
            return
        
        self.processing = True
        
        while self.queue and self.consumers:
            message = self.queue.popleft()
            consumer = self.consumers[0]  # Round-robin
            
            try:
                if asyncio.iscoroutinefunction(consumer):
                    await consumer(message)
                else:
                    consumer(message)
                print(f"Message {message.id} processed successfully")
            except Exception as e:
                print(f"Message {message.id} processing failed: {e}")
                message.attempts += 1
                
                # Retry if attempts < 3
                if message.attempts < 3:
                    self.queue.append(message)
                else:
                    print(f"Message {message.id} failed after {message.attempts} attempts")
        
        self.processing = False
    
    def get_size(self) -> int:
        """Get queue size"""
        return len(self.queue)


async def demonstrate_message_queues():
    """Demonstrate message queues"""
    print('=== Pub/Sub System ===\n')
    
    pubsub = PubSubSystem()
    
    # Subscribe to topic
    pubsub.subscribe('user-events', lambda msg: print(f'Subscriber 1 received: {msg.data}'))
    pubsub.subscribe('user-events', lambda msg: print(f'Subscriber 2 received: {msg.data}'))
    
    # Publish messages
    pubsub.publish('user-events', {'type': 'user-created', 'userId': '123'})
    pubsub.publish('user-events', {'type': 'user-updated', 'userId': '123'})
    
    await asyncio.sleep(0.1)
    
    print('\n=== Point-to-Point Queue ===\n')
    
    queue = PointToPointQueue('task-queue')
    
    # Register consumer
    async def process_message(message: Message):
        print(f'Processing message: {message.id}')
        await asyncio.sleep(0.1)
        print(f'Message processed: {message.id}')
    
    queue.register_consumer(process_message)
    
    # Send messages
    queue.send({'task': 'task1', 'priority': 'high'})
    queue.send({'task': 'task2', 'priority': 'medium'})
    queue.send({'task': 'task3', 'priority': 'low'})
    
    # Wait for processing
    await asyncio.sleep(0.5)
    print('Queue size:', queue.get_size())


if __name__ == '__main__':
    asyncio.run(demonstrate_message_queues())

