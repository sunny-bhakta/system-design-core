"""
Rate Limiter Implementation
Demonstrates different rate limiting algorithms
"""
import time
from typing import Dict, Any, List
from collections import deque


class TokenBucket:
    """Token bucket rate limiter"""
    
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity  # Maximum tokens
        self.refill_rate = refill_rate  # Tokens per second
        self.tokens = float(capacity)
        self.last_refill = time.time()
    
    def try_consume(self, tokens: int = 1) -> Dict[str, Any]:
        """Try to consume tokens"""
        self._refill()
        
        if self.tokens >= tokens:
            self.tokens -= tokens
            return {'allowed': True, 'remaining': self.tokens}
        
        return {'allowed': False, 'remaining': self.tokens}
    
    def _refill(self):
        """Refill tokens based on time elapsed"""
        now = time.time()
        elapsed = now - self.last_refill
        tokens_to_add = elapsed * self.refill_rate
        
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = now
    
    def get_tokens(self) -> float:
        """Get current token count"""
        self._refill()
        return self.tokens


class LeakyBucket:
    """Leaky bucket rate limiter"""
    
    def __init__(self, capacity: int, leak_rate: float):
        self.capacity = capacity  # Maximum requests
        self.leak_rate = leak_rate  # Requests per second
        self.queue = deque()
        self.last_leak = time.time()
    
    def try_add(self) -> Dict[str, Any]:
        """Try to add request"""
        self._leak()
        
        if len(self.queue) < self.capacity:
            self.queue.append(time.time())
            return {'allowed': True, 'queue_size': len(self.queue)}
        
        return {'allowed': False, 'queue_size': len(self.queue)}
    
    def _leak(self):
        """Leak requests based on time elapsed"""
        now = time.time()
        elapsed = now - self.last_leak
        requests_to_remove = int(elapsed * self.leak_rate)
        
        # Remove oldest requests
        for _ in range(min(requests_to_remove, len(self.queue))):
            self.queue.popleft()
        
        self.last_leak = now
    
    def get_queue_size(self) -> int:
        """Get current queue size"""
        self._leak()
        return len(self.queue)


class FixedWindow:
    """Fixed window rate limiter"""
    
    def __init__(self, max_requests: int, window_size: float):
        self.max_requests = max_requests
        self.window_size = window_size  # in seconds
        self.windows = {}  # window start time -> count
    
    def _get_current_window(self) -> int:
        """Get current window start time"""
        now = time.time()
        return int(now / self.window_size) * int(self.window_size)
    
    def try_request(self) -> Dict[str, Any]:
        """Try to make request"""
        window = self._get_current_window()
        
        # Clean old windows
        self._cleanup()
        
        # Get or create window
        count = self.windows.get(window, 0)
        
        if count < self.max_requests:
            self.windows[window] = count + 1
            return {'allowed': True, 'remaining': self.max_requests - count - 1}
        
        return {'allowed': False, 'remaining': 0}
    
    def _cleanup(self):
        """Cleanup old windows"""
        current_window = self._get_current_window()
        windows_to_remove = [
            window for window in self.windows
            if window < current_window - self.window_size
        ]
        for window in windows_to_remove:
            del self.windows[window]
    
    def get_count(self) -> int:
        """Get current count"""
        self._cleanup()
        window = self._get_current_window()
        return self.windows.get(window, 0)


class SlidingWindow:
    """Sliding window rate limiter"""
    
    def __init__(self, max_requests: int, window_size: float):
        self.max_requests = max_requests
        self.window_size = window_size  # in seconds
        self.requests: List[float] = []  # Timestamps of requests
    
    def try_request(self) -> Dict[str, Any]:
        """Try to make request"""
        now = time.time()
        
        # Remove requests outside window
        self.requests = [
            timestamp for timestamp in self.requests
            if now - timestamp < self.window_size
        ]
        
        if len(self.requests) < self.max_requests:
            self.requests.append(now)
            return {
                'allowed': True,
                'remaining': self.max_requests - len(self.requests)
            }
        
        # Calculate time until next request allowed
        if self.requests:
            oldest_request = self.requests[0]
            wait_time = self.window_size - (now - oldest_request)
            retry_after = max(0, int(wait_time))
        else:
            retry_after = 0
        
        return {
            'allowed': False,
            'remaining': 0,
            'retry_after': retry_after
        }
    
    def get_count(self) -> int:
        """Get current count"""
        now = time.time()
        self.requests = [
            timestamp for timestamp in self.requests
            if now - timestamp < self.window_size
        ]
        return len(self.requests)


def demonstrate_rate_limiters():
    """Demonstrate different rate limiters"""
    print('=== Rate Limiting Demonstration ===\n')
    
    # Token Bucket
    print('1. Token Bucket (Capacity: 10, Refill: 2/sec)')
    token_bucket = TokenBucket(10, 2)
    for i in range(12):
        result = token_bucket.try_consume()
        print(f"Request {i + 1}: {'Allowed' if result['allowed'] else 'Denied'} "
              f"(Tokens: {result['remaining']:.2f})")
    
    # Leaky Bucket
    print('\n2. Leaky Bucket (Capacity: 5, Leak: 2/sec)')
    leaky_bucket = LeakyBucket(5, 2)
    for i in range(7):
        result = leaky_bucket.try_add()
        print(f"Request {i + 1}: {'Allowed' if result['allowed'] else 'Denied'} "
              f"(Queue: {result['queue_size']})")
    
    # Fixed Window
    print('\n3. Fixed Window (Max: 5, Window: 1s)')
    fixed_window = FixedWindow(5, 1.0)
    for i in range(7):
        result = fixed_window.try_request()
        print(f"Request {i + 1}: {'Allowed' if result['allowed'] else 'Denied'} "
              f"(Remaining: {result['remaining']})")
    
    # Sliding Window
    print('\n4. Sliding Window (Max: 5, Window: 1s)')
    sliding_window = SlidingWindow(5, 1.0)
    for i in range(7):
        result = sliding_window.try_request()
        print(f"Request {i + 1}: {'Allowed' if result['allowed'] else 'Denied'} "
              f"(Remaining: {result['remaining']})")
        if not result['allowed'] and result.get('retry_after'):
            print(f"  Retry after: {result['retry_after']}s")


if __name__ == '__main__':
    demonstrate_rate_limiters()

