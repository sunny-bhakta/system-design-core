/**
 * Load Balancer Implementation
 * Demonstrates different load balancing algorithms
 */

class LoadBalancer {
  constructor(servers, algorithm = 'round-robin') {
    this.servers = servers;
    this.algorithm = algorithm;
    this.currentIndex = 0;
    this.serverConnections = new Map();
    this.serverWeights = new Map();
    
    // Initialize connection counts
    servers.forEach(server => {
      this.serverConnections.set(server, 0);
      this.serverWeights.set(server, 1); // Default weight
    });
  }

  /**
   * Round Robin Algorithm
   * Distributes requests sequentially
   */
  roundRobin() {
    const server = this.servers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.servers.length;
    return server;
  }

  /**
   * Least Connections Algorithm
   * Routes to server with fewest active connections
   */
  leastConnections() {
    let minConnections = Infinity;
    let selectedServer = this.servers[0];

    for (const server of this.servers) {
      const connections = this.serverConnections.get(server);
      if (connections < minConnections) {
        minConnections = connections;
        selectedServer = server;
      }
    }

    return selectedServer;
  }

  /**
   * Weighted Round Robin
   * Routes based on server weights
   */
  weightedRoundRobin() {
    const totalWeight = Array.from(this.serverWeights.values())
      .reduce((sum, weight) => sum + weight, 0);
    
    let currentWeight = 0;
    let selectedServer = this.servers[0];

    for (const server of this.servers) {
      currentWeight += this.serverWeights.get(server);
      if (Math.random() * totalWeight < currentWeight) {
        selectedServer = server;
        break;
      }
    }

    return selectedServer;
  }

  /**
   * IP Hash Algorithm
   * Routes based on client IP hash
   */
  ipHash(clientIp) {
    const hash = this.simpleHash(clientIp);
    const index = hash % this.servers.length;
    return this.servers[index];
  }

  /**
   * Simple hash function
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Set server weight
   */
  setWeight(server, weight) {
    this.serverWeights.set(server, weight);
  }

  /**
   * Get next server based on algorithm
   */
  getNextServer(clientIp = null) {
    let server;

    switch (this.algorithm) {
      case 'round-robin':
        server = this.roundRobin();
        break;
      case 'least-connections':
        server = this.leastConnections();
        break;
      case 'weighted-round-robin':
        server = this.weightedRoundRobin();
        break;
      case 'ip-hash':
        if (!clientIp) {
          throw new Error('Client IP required for IP hash algorithm');
        }
        server = this.ipHash(clientIp);
        break;
      default:
        server = this.roundRobin();
    }

    // Increment connection count
    this.serverConnections.set(
      server,
      this.serverConnections.get(server) + 1
    );

    return server;
  }

  /**
   * Release connection from server
   */
  releaseConnection(server) {
    const current = this.serverConnections.get(server);
    if (current > 0) {
      this.serverConnections.set(server, current - 1);
    }
  }

  /**
   * Health check for servers
   */
  async healthCheck(server) {
    try {
      // Simulate health check
      const response = await fetch(`http://${server}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    const stats = {};
    for (const server of this.servers) {
      stats[server] = {
        connections: this.serverConnections.get(server),
        weight: this.serverWeights.get(server)
      };
    }
    return stats;
  }
}

// Example usage
const servers = ['server1:3000', 'server2:3000', 'server3:3000'];

// Round Robin
const roundRobinLB = new LoadBalancer(servers, 'round-robin');
console.log('Round Robin:');
for (let i = 0; i < 5; i++) {
  console.log(`Request ${i + 1}: ${roundRobinLB.getNextServer()}`);
}

// Least Connections
const leastConnectionsLB = new LoadBalancer(servers, 'least-connections');
console.log('\nLeast Connections:');
for (let i = 0; i < 5; i++) {
  const server = leastConnectionsLB.getNextServer();
  console.log(`Request ${i + 1}: ${server}`);
  if (i === 2) {
    leastConnectionsLB.releaseConnection(server);
  }
}

// IP Hash
const ipHashLB = new LoadBalancer(servers, 'ip-hash');
console.log('\nIP Hash:');
const clientIps = ['192.168.1.1', '192.168.1.2', '192.168.1.1'];
clientIps.forEach(ip => {
  console.log(`IP ${ip}: ${ipHashLB.getNextServer(ip)}`);
});

// Weighted Round Robin
const weightedLB = new LoadBalancer(servers, 'weighted-round-robin');
weightedLB.setWeight('server1:3000', 3);
weightedLB.setWeight('server2:3000', 2);
weightedLB.setWeight('server3:3000', 1);
console.log('\nWeighted Round Robin:');
const distribution = {};
for (let i = 0; i < 100; i++) {
  const server = weightedLB.getNextServer();
  distribution[server] = (distribution[server] || 0) + 1;
}
console.log('Distribution after 100 requests:', distribution);

module.exports = LoadBalancer;

