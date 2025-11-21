"""
Health Checks Implementation
Demonstrates liveness, readiness, and startup probes
"""
import asyncio
import random
from typing import Dict, Any
from datetime import datetime


class HealthChecker:
    """Health checker for service health monitoring"""
    
    def __init__(self):
        self.is_alive = True
        self.is_ready = False
        self.is_started = False
        self.dependencies = {
            'database': False,
            'cache': False,
            'external_service': False
        }
        self.start_time = datetime.now()
        self.initialization_time = 2.0  # 2 seconds
    
    async def initialize(self):
        """Initialize service (simulate startup)"""
        print('Initializing service...')
        
        # Simulate initialization
        await asyncio.sleep(self.initialization_time)
        
        # Check dependencies
        await self.check_dependencies()
        
        self.is_started = True
        self.is_ready = True
        print('Service initialized and ready')
    
    async def check_dependencies(self) -> Dict[str, bool]:
        """Check dependencies"""
        # Simulate dependency checks
        self.dependencies['database'] = random.random() > 0.2  # 80% chance
        self.dependencies['cache'] = random.random() > 0.1  # 90% chance
        self.dependencies['external_service'] = random.random() > 0.15  # 85% chance
        
        return self.dependencies
    
    def liveness_probe(self) -> Dict[str, Any]:
        """Liveness Probe - checks if service is alive"""
        if not self.is_alive:
            return {
                'status': 'unhealthy',
                'message': 'Service is not alive',
                'timestamp': datetime.now().isoformat()
            }
        
        # Check if process is responsive
        uptime = (datetime.now() - self.start_time).total_seconds()
        
        return {
            'status': 'healthy',
            'message': 'Service is alive',
            'uptime': f'{int(uptime)}s',
            'timestamp': datetime.now().isoformat()
        }
    
    def readiness_probe(self) -> Dict[str, Any]:
        """Readiness Probe - checks if service is ready to serve traffic"""
        if not self.is_ready:
            return {
                'status': 'not ready',
                'message': 'Service is not ready to serve traffic',
                'dependencies': self.dependencies,
                'timestamp': datetime.now().isoformat()
            }
        
        # Check if all critical dependencies are available
        critical_deps = ['database', 'cache']
        unavailable_deps = [dep for dep in critical_deps if not self.dependencies[dep]]
        
        if unavailable_deps:
            return {
                'status': 'not ready',
                'message': 'Critical dependencies unavailable',
                'unavailable_dependencies': unavailable_deps,
                'dependencies': self.dependencies,
                'timestamp': datetime.now().isoformat()
            }
        
        return {
            'status': 'ready',
            'message': 'Service is ready to serve traffic',
            'dependencies': self.dependencies,
            'timestamp': datetime.now().isoformat()
        }
    
    def startup_probe(self) -> Dict[str, Any]:
        """Startup Probe - checks if service has finished starting up"""
        if self.is_started:
            return {
                'status': 'started',
                'message': 'Service has started',
                'initialization_time': f'{self.initialization_time * 1000}ms',
                'timestamp': datetime.now().isoformat()
            }
        
        elapsed = (datetime.now() - self.start_time).total_seconds() * 1000
        remaining = max(0, self.initialization_time * 1000 - elapsed)
        
        return {
            'status': 'starting',
            'message': 'Service is still starting',
            'elapsed': f'{int(elapsed)}ms',
            'estimated_remaining': f'{int(remaining)}ms',
            'timestamp': datetime.now().isoformat()
        }
    
    def health_check(self) -> Dict[str, Any]:
        """Combined health check"""
        return {
            'liveness': self.liveness_probe(),
            'readiness': self.readiness_probe(),
            'startup': self.startup_probe(),
            'overall': self.get_overall_health()
        }
    
    def get_overall_health(self) -> str:
        """Get overall health status"""
        liveness = self.liveness_probe()
        readiness = self.readiness_probe()
        startup = self.startup_probe()
        
        if liveness['status'] != 'healthy':
            return 'unhealthy'
        
        if startup['status'] == 'starting':
            return 'starting'
        
        if readiness['status'] != 'ready':
            return 'not ready'
        
        return 'healthy'
    
    def simulate_failure(self):
        """Simulate service failure"""
        self.is_alive = False
        print('Service failure simulated')
    
    def simulate_dependency_failure(self, dependency: str):
        """Simulate dependency failure"""
        if dependency in self.dependencies:
            self.dependencies[dependency] = False
            self.is_ready = False
            print(f'Dependency failure simulated: {dependency}')
    
    def recover(self):
        """Recover from failure"""
        self.is_alive = True
        self.is_ready = True
        for key in self.dependencies:
            self.dependencies[key] = True
        print('Service recovered')


class HealthCheckServer:
    """Health check server with endpoints"""
    
    def __init__(self, health_checker: HealthChecker, port: int = 3000):
        self.health_checker = health_checker
        self.port = port
    
    def start(self):
        """Start health check endpoints"""
        print(f'Health check server started on port {self.port}')
        print('Endpoints:')
        print('  GET /health - Combined health check')
        print('  GET /live - Liveness probe')
        print('  GET /ready - Readiness probe')
        print('  GET /startup - Startup probe')
    
    def handle_request(self, path: str) -> Dict[str, Any]:
        """Handle health check request"""
        if path == '/health':
            return self.health_checker.health_check()
        elif path == '/live':
            return self.health_checker.liveness_probe()
        elif path == '/ready':
            return self.health_checker.readiness_probe()
        elif path == '/startup':
            return self.health_checker.startup_probe()
        else:
            return {'error': 'Not found'}


async def demonstrate_health_checks():
    """Demonstrate health checks"""
    print('=== Health Checks Demonstration ===\n')
    
    health_checker = HealthChecker()
    server = HealthCheckServer(health_checker)
    
    # Initial state (starting)
    print('1. Initial state (starting):')
    import json
    print(json.dumps(health_checker.startup_probe(), indent=2))
    
    # Initialize service
    await health_checker.initialize()
    
    # After initialization
    print('\n2. After initialization:')
    print(json.dumps(health_checker.health_check(), indent=2))
    
    # Simulate dependency failure
    print('\n3. Simulating dependency failure:')
    health_checker.simulate_dependency_failure('database')
    print(json.dumps(health_checker.readiness_probe(), indent=2))
    
    # Recover
    print('\n4. Recovering:')
    health_checker.recover()
    print(json.dumps(health_checker.health_check(), indent=2))
    
    # Simulate service failure
    print('\n5. Simulating service failure:')
    health_checker.simulate_failure()
    print(json.dumps(health_checker.liveness_probe(), indent=2))


if __name__ == '__main__':
    asyncio.run(demonstrate_health_checks())

