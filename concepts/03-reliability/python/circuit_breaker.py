"""
Circuit Breaker Pattern Implementation
Prevents cascading failures by stopping requests to failing services
"""
from typing import Callable, Any, Optional
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import random


class CircuitState(Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    """Circuit breaker to prevent cascading failures"""
    
    def __init__(self, failure_threshold: int = 5, reset_timeout: int = 60,
                 monitoring_window: int = 60):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout  # seconds
        self.monitoring_window = monitoring_window  # seconds
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.next_attempt_time: Optional[datetime] = None
        
        self.failures = []
        self.successes = []
    
    async def execute(self, fn: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection"""
        # Check if circuit should transition
        self._check_state()
        
        if self.state == CircuitState.OPEN:
            if self.next_attempt_time and datetime.now() < self.next_attempt_time:
                raise Exception('Circuit breaker is OPEN')
            else:
                # Transition to HALF_OPEN
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
                print('Circuit breaker: OPEN -> HALF_OPEN')
        
        try:
            result = await fn(*args, **kwargs) if asyncio.iscoroutinefunction(fn) else fn(*args, **kwargs)
            self._on_success()
            return result
        except Exception as error:
            self._on_failure()
            raise error
    
    def _on_success(self):
        """Handle successful request"""
        now = datetime.now()
        self.successes.append(now)
        self._clean_old_records(now)
        
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= 2:
                # Close circuit after 2 successes
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.success_count = 0
                print('Circuit breaker: HALF_OPEN -> CLOSED')
        elif self.state == CircuitState.CLOSED:
            # Reset failure count on success
            self.failure_count = 0
    
    def _on_failure(self):
        """Handle failed request"""
        now = datetime.now()
        self.failures.append(now)
        self._clean_old_records(now)
        
        self.failure_count += 1
        self.last_failure_time = now
        
        if self.state == CircuitState.HALF_OPEN:
            # Any failure in HALF_OPEN opens circuit
            self.state = CircuitState.OPEN
            self.next_attempt_time = now + timedelta(seconds=self.reset_timeout)
            print('Circuit breaker: HALF_OPEN -> OPEN')
        elif self.state == CircuitState.CLOSED:
            if self.failure_count >= self.failure_threshold:
                # Open circuit
                self.state = CircuitState.OPEN
                self.next_attempt_time = now + timedelta(seconds=self.reset_timeout)
                print('Circuit breaker: CLOSED -> OPEN')
    
    def _check_state(self):
        """Check and update circuit state"""
        if self.state == CircuitState.OPEN:
            if self.next_attempt_time and datetime.now() >= self.next_attempt_time:
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
                print('Circuit breaker: OPEN -> HALF_OPEN (timeout expired)')
    
    def _clean_old_records(self, now: datetime):
        """Clean old failure/success records"""
        cutoff = now - timedelta(seconds=self.monitoring_window)
        self.failures = [t for t in self.failures if t > cutoff]
        self.successes = [t for t in self.successes if t > cutoff]
    
    def get_state(self) -> dict:
        """Get current state"""
        return {
            'state': self.state.value,
            'failure_count': self.failure_count,
            'success_count': self.success_count,
            'next_attempt_time': self.next_attempt_time.isoformat() if self.next_attempt_time else None
        }
    
    def get_stats(self) -> dict:
        """Get statistics"""
        now = datetime.now()
        window_start = now - timedelta(seconds=self.monitoring_window)
        
        recent_failures = len([t for t in self.failures if t > window_start])
        recent_successes = len([t for t in self.successes if t > window_start])
        total = recent_failures + recent_successes
        failure_rate = (recent_failures / total * 100) if total > 0 else 0
        
        return {
            'state': self.state.value,
            'failure_count': self.failure_count,
            'success_count': self.success_count,
            'recent_failures': recent_failures,
            'recent_successes': recent_successes,
            'failure_rate': f'{failure_rate:.2f}%',
            'next_attempt_time': self.next_attempt_time.isoformat() if self.next_attempt_time else None
        }
    
    def reset(self):
        """Reset circuit breaker"""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.next_attempt_time = None
        self.failures = []
        self.successes = []
        print('Circuit breaker: RESET -> CLOSED')


class RetryWithBackoff:
    """Retry with exponential backoff"""
    
    def __init__(self, max_retries: int = 3, base_delay: int = 1000,
                 max_delay: int = 30000, jitter: bool = True):
        self.max_retries = max_retries
        self.base_delay = base_delay  # milliseconds
        self.max_delay = max_delay
        self.jitter = jitter
    
    async def execute(self, fn: Callable, *args, **kwargs) -> Any:
        """Execute function with retry"""
        last_error = None
        
        for attempt in range(self.max_retries + 1):
            try:
                if asyncio.iscoroutinefunction(fn):
                    return await fn(*args, **kwargs)
                else:
                    return fn(*args, **kwargs)
            except Exception as error:
                last_error = error
                
                if attempt < self.max_retries:
                    delay = self._calculate_delay(attempt)
                    print(f"Attempt {attempt + 1} failed, retrying in {delay}ms...")
                    await asyncio.sleep(delay / 1000)
        
        raise last_error
    
    def _calculate_delay(self, attempt: int) -> int:
        """Calculate delay with exponential backoff"""
        # Exponential backoff: baseDelay * 2^attempt
        delay = self.base_delay * (2 ** attempt)
        
        # Cap at maxDelay
        delay = min(delay, self.max_delay)
        
        # Add jitter (random variation)
        if self.jitter:
            jitter_amount = delay * 0.1  # 10% jitter
            delay += random.uniform(-jitter_amount, jitter_amount)
        
        return max(0, int(delay))


class ResilientService:
    """Combined Circuit Breaker + Retry"""
    
    def __init__(self, circuit_breaker_options: dict = None, retry_options: dict = None):
        self.circuit_breaker = CircuitBreaker(**(circuit_breaker_options or {}))
        self.retry = RetryWithBackoff(**(retry_options or {}))
    
    async def call(self, fn: Callable, *args, **kwargs) -> Any:
        """Call function with circuit breaker and retry"""
        return await self.circuit_breaker.execute(
            lambda: self.retry.execute(fn, *args, **kwargs)
        )
    
    def get_stats(self) -> dict:
        """Get statistics"""
        return self.circuit_breaker.get_stats()


async def demonstrate_circuit_breaker():
    """Demonstrate circuit breaker"""
    # Simulate a flaky service
    call_count = 0
    
    async def flaky_service():
        nonlocal call_count
        call_count += 1
        # Fail first 7 calls, then succeed
        if call_count <= 7:
            raise Exception('Service unavailable')
        return {'data': 'Success', 'call_count': call_count}
    
    circuit_breaker = CircuitBreaker(
        failure_threshold=5,
        reset_timeout=5  # 5 seconds
    )
    
    print('=== Circuit Breaker Demonstration ===\n')
    
    # Make requests that will fail
    for i in range(1, 8):
        try:
            await circuit_breaker.execute(flaky_service)
        except Exception as e:
            print(f"Request {i}: {e}")
            print(f"State: {circuit_breaker.get_state()['state']}")
    
    # Circuit should be OPEN now
    print('\nCircuit is OPEN, requests will be rejected immediately')
    try:
        await circuit_breaker.execute(flaky_service)
    except Exception as e:
        print(f"Request rejected: {e}")
    
    # Wait for reset timeout
    print('\nWaiting for reset timeout...')
    await asyncio.sleep(6)
    
    # Circuit should transition to HALF_OPEN
    print('\nCircuit is HALF_OPEN, testing service...')
    try:
        result = await circuit_breaker.execute(flaky_service)
        print(f"Request succeeded: {result}")
    except Exception as e:
        print(f"Request failed: {e}")
    
    # Second success should close circuit
    try:
        result = await circuit_breaker.execute(flaky_service)
        print(f"Request succeeded: {result}")
        print(f"State: {circuit_breaker.get_state()['state']}")
    except Exception as e:
        print(f"Request failed: {e}")
    
    print('\n=== Statistics ===')
    print(circuit_breaker.get_stats())


async def demonstrate_retry():
    """Demonstrate retry with exponential backoff"""
    print('\n=== Retry with Exponential Backoff ===\n')
    
    attempt = 0
    
    async def flaky_service():
        nonlocal attempt
        attempt += 1
        if attempt < 3:
            raise Exception(f'Service error (attempt {attempt})')
        return {'data': 'Success', 'attempt': attempt}
    
    retry = RetryWithBackoff(max_retries=3, base_delay=1000)
    
    try:
        result = await retry.execute(flaky_service)
        print(f'Final result: {result}')
    except Exception as e:
        print(f'All retries exhausted: {e}')


if __name__ == '__main__':
    asyncio.run(demonstrate_circuit_breaker())
    asyncio.run(demonstrate_retry())

