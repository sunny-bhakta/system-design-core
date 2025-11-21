"""
Microservices Architecture Pattern
Demonstrates service communication and service discovery
"""
import asyncio
import random
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ServiceInfo:
    """Service information"""
    url: str
    version: str
    endpoints: List[str]
    registered_at: float = field(default_factory=lambda: datetime.now().timestamp())
    last_heartbeat: float = field(default_factory=lambda: datetime.now().timestamp())
    status: str = 'healthy'


class ServiceRegistry:
    """Service registry implementation"""
    
    def __init__(self):
        self.services: Dict[str, ServiceInfo] = {}
        self.health_checks: Dict[str, Any] = {}
    
    def register(self, service_name: str, service_info: Dict[str, Any]) -> ServiceInfo:
        """Register service"""
        service = ServiceInfo(
            url=service_info['url'],
            version=service_info.get('version', '1.0.0'),
            endpoints=service_info.get('endpoints', [])
        )
        
        self.services[service_name] = service
        print(f"Service registered: {service_name} at {service.url}")
        
        return service
    
    def deregister(self, service_name: str) -> bool:
        """Deregister service"""
        if service_name in self.services:
            del self.services[service_name]
            self.health_checks.pop(service_name, None)
            print(f"Service deregistered: {service_name}")
            return True
        return False
    
    def discover(self, service_name: str) -> Optional[ServiceInfo]:
        """Discover service"""
        service = self.services.get(service_name)
        if not service or service.status != 'healthy':
            return None
        return service
    
    def get_all_services(self) -> List[Dict[str, Any]]:
        """Get all services"""
        return [
            {'name': name, **service.__dict__}
            for name, service in self.services.items()
        ]
    
    def update_heartbeat(self, service_name: str):
        """Update heartbeat"""
        service = self.services.get(service_name)
        if service:
            service.last_heartbeat = datetime.now().timestamp()
    
    def mark_unhealthy(self, service_name: str):
        """Mark service unhealthy"""
        service = self.services.get(service_name)
        if service:
            service.status = 'unhealthy'
            print(f"Service marked unhealthy: {service_name}")
    
    def cleanup_stale_services(self, timeout: float = 30.0):
        """Cleanup stale services"""
        now = datetime.now().timestamp()
        for name, service in self.services.items():
            if now - service.last_heartbeat > timeout:
                self.mark_unhealthy(name)


class ServiceClient:
    """Service client implementation"""
    
    def __init__(self, service_registry: ServiceRegistry):
        self.registry = service_registry
        self.circuit_breakers: Dict[str, Any] = {}
    
    async def call(self, service_name: str, endpoint: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Call service"""
        service = self.registry.discover(service_name)
        
        if not service:
            raise Exception(f"Service {service_name} not found or unhealthy")
        
        # Simulate service call
        url = f"{service.url}{endpoint}"
        print(f"Calling {service_name}: {url}")
        
        # Simulate network call
        await asyncio.sleep(0.1)
        
        # Simulate success/failure
        if random.random() > 0.1:  # 90% success rate
            return {
                'service': service_name,
                'endpoint': endpoint,
                'data': {'result': 'success'},
                'timestamp': datetime.now().timestamp()
            }
        else:
            raise Exception(f"Service {service_name} call failed")
    
    async def call_with_retry(self, service_name: str, endpoint: str, max_retries: int = 3) -> Dict[str, Any]:
        """Call with retry"""
        last_error = None
        
        for attempt in range(max_retries):
            try:
                return await self.call(service_name, endpoint)
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    delay = (2 ** attempt) * 0.1  # Exponential backoff
                    await asyncio.sleep(delay)
        
        raise last_error


class APIGateway:
    """API Gateway implementation"""
    
    def __init__(self, service_registry: ServiceRegistry):
        self.registry = service_registry
        self.client = ServiceClient(service_registry)
        self.routes: Dict[str, Dict[str, str]] = {}
    
    def register_route(self, path: str, service_name: str, service_endpoint: str):
        """Register route"""
        self.routes[path] = {'service_name': service_name, 'service_endpoint': service_endpoint}
        print(f"Route registered: {path} -> {service_name}{service_endpoint}")
    
    async def handle_request(self, path: str, method: str = 'GET', body: Any = None) -> Dict[str, Any]:
        """Handle request"""
        route = self.routes.get(path)
        
        if not route:
            return {
                'status': 404,
                'error': 'Route not found'
            }
        
        try:
            result = await self.client.call_with_retry(
                route['service_name'],
                route['service_endpoint']
            )
            
            return {
                'status': 200,
                'data': result
            }
        except Exception as e:
            return {
                'status': 503,
                'error': str(e)
            }


async def demonstrate_microservices():
    """Demonstrate microservices architecture"""
    print('=== Microservices Architecture ===\n')
    
    # Create service registry
    registry = ServiceRegistry()
    
    # Register services
    registry.register('user-service', {
        'url': 'http://user-service:3001',
        'version': '1.0.0',
        'endpoints': ['/users', '/users/:id']
    })
    
    registry.register('order-service', {
        'url': 'http://order-service:3002',
        'version': '1.0.0',
        'endpoints': ['/orders', '/orders/:id']
    })
    
    registry.register('product-service', {
        'url': 'http://product-service:3003',
        'version': '1.0.0',
        'endpoints': ['/products', '/products/:id']
    })
    
    print('\nRegistered services:')
    print(registry.get_all_services())
    
    # Create API Gateway
    gateway = APIGateway(registry)
    
    # Register routes
    gateway.register_route('/api/users', 'user-service', '/users')
    gateway.register_route('/api/orders', 'order-service', '/orders')
    gateway.register_route('/api/products', 'product-service', '/products')
    
    # Handle requests through gateway
    print('\n=== Handling Requests ===')
    user_result = await gateway.handle_request('/api/users')
    print('User service response:', user_result)
    
    order_result = await gateway.handle_request('/api/orders')
    print('Order service response:', order_result)
    
    # Service discovery
    print('\n=== Service Discovery ===')
    user_service = registry.discover('user-service')
    print('Discovered user-service:', user_service.__dict__ if user_service else None)
    
    # Cleanup stale services
    print('\n=== Cleanup ===')
    registry.cleanup_stale_services(1.0)


if __name__ == '__main__':
    asyncio.run(demonstrate_microservices())

