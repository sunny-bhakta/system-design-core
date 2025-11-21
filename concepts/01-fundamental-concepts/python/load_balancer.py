"""
Load Balancer Implementation
Demonstrates different load balancing algorithms
"""
from collections import defaultdict
from typing import List, Dict, Optional
import hashlib
import random


class LoadBalancer:
    """Load balancer with multiple algorithms"""
    
    def __init__(self, servers: List[str], algorithm: str = 'round-robin'):
        self.servers = servers
        self.algorithm = algorithm
        self.current_index = 0
        self.server_connections: Dict[str, int] = defaultdict(int)
        self.server_weights: Dict[str, int] = {}
        
        # Initialize weights
        for server in servers:
            self.server_weights[server] = 1
    
    def round_robin(self) -> str:
        """Round Robin Algorithm - distributes requests sequentially"""
        server = self.servers[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.servers)
        return server
    
    def least_connections(self) -> str:
        """Least Connections - routes to server with fewest connections"""
        min_connections = float('inf')
        selected_server = self.servers[0]
        
        for server in self.servers:
            connections = self.server_connections[server]
            if connections < min_connections:
                min_connections = connections
                selected_server = server
        
        return selected_server
    
    def weighted_round_robin(self) -> str:
        """Weighted Round Robin - routes based on server weights"""
        total_weight = sum(self.server_weights.values())
        current_weight = 0
        selected_server = self.servers[0]
        
        random_value = random.random() * total_weight
        
        for server in self.servers:
            current_weight += self.server_weights[server]
            if random_value < current_weight:
                selected_server = server
                break
        
        return selected_server
    
    def ip_hash(self, client_ip: str) -> str:
        """IP Hash - routes based on client IP hash"""
        hash_value = int(hashlib.md5(client_ip.encode()).hexdigest(), 16)
        index = hash_value % len(self.servers)
        return self.servers[index]
    
    def set_weight(self, server: str, weight: int):
        """Set weight for a server"""
        if server in self.servers:
            self.server_weights[server] = weight
        else:
            raise ValueError(f"Server {server} not found")
    
    def get_next_server(self, client_ip: Optional[str] = None) -> str:
        """Get next server based on algorithm"""
        server = None
        
        if self.algorithm == 'round-robin':
            server = self.round_robin()
        elif self.algorithm == 'least-connections':
            server = self.least_connections()
        elif self.algorithm == 'weighted-round-robin':
            server = self.weighted_round_robin()
        elif self.algorithm == 'ip-hash':
            if not client_ip:
                raise ValueError("Client IP required for IP hash algorithm")
            server = self.ip_hash(client_ip)
        else:
            server = self.round_robin()
        
        # Increment connection count
        self.server_connections[server] += 1
        return server
    
    def release_connection(self, server: str):
        """Release connection from server"""
        if self.server_connections[server] > 0:
            self.server_connections[server] -= 1
    
    def get_stats(self) -> Dict[str, Dict]:
        """Get server statistics"""
        stats = {}
        for server in self.servers:
            stats[server] = {
                'connections': self.server_connections[server],
                'weight': self.server_weights[server]
            }
        return stats


def demonstrate_load_balancing():
    """Demonstrate different load balancing algorithms"""
    servers = ['server1:3000', 'server2:3000', 'server3:3000']
    
    # Round Robin
    print("=== Round Robin ===")
    round_robin_lb = LoadBalancer(servers, 'round-robin')
    for i in range(5):
        server = round_robin_lb.get_next_server()
        print(f"Request {i + 1}: {server}")
    
    # Least Connections
    print("\n=== Least Connections ===")
    least_conn_lb = LoadBalancer(servers, 'least-connections')
    for i in range(5):
        server = least_conn_lb.get_next_server()
        print(f"Request {i + 1}: {server}")
        if i == 2:
            least_conn_lb.release_connection(server)
    
    # IP Hash
    print("\n=== IP Hash ===")
    ip_hash_lb = LoadBalancer(servers, 'ip-hash')
    client_ips = ['192.168.1.1', '192.168.1.2', '192.168.1.1']
    for ip in client_ips:
        server = ip_hash_lb.get_next_server(ip)
        print(f"IP {ip}: {server}")
    
    # Weighted Round Robin
    print("\n=== Weighted Round Robin ===")
    weighted_lb = LoadBalancer(servers, 'weighted-round-robin')
    weighted_lb.set_weight('server1:3000', 3)
    weighted_lb.set_weight('server2:3000', 2)
    weighted_lb.set_weight('server3:3000', 1)
    
    distribution = defaultdict(int)
    for _ in range(100):
        server = weighted_lb.get_next_server()
        distribution[server] += 1
    
    print("Distribution after 100 requests:")
    for server, count in distribution.items():
        print(f"  {server}: {count}")


if __name__ == '__main__':
    demonstrate_load_balancing()

