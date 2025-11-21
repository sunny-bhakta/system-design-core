/**
 * Consensus Algorithms Implementation
 * Demonstrates Raft and Paxos consensus algorithms
 */

/**
 * Raft Consensus Algorithm
 */
class RaftNode {
  constructor(nodeId, nodes) {
    this.nodeId = nodeId;
    this.nodes = nodes; // All nodes in cluster
    this.state = 'follower'; // follower, candidate, leader
    this.currentTerm = 0;
    this.votedFor = null;
    this.log = [];
    this.commitIndex = -1;
    this.lastApplied = -1;
    
    // Leader state
    this.nextIndex = new Map();
    this.matchIndex = new Map();
    
    // Election timeout
    this.electionTimeout = 150 + Math.random() * 150; // 150-300ms
    this.heartbeatInterval = 50; // 50ms
    this.lastHeartbeat = Date.now();
    
    this.startElectionTimer();
  }

  /**
   * Start election timer
   */
  startElectionTimer() {
    if (this.state === 'leader') return;
    
    setTimeout(() => {
      if (this.state !== 'leader' && Date.now() - this.lastHeartbeat > this.electionTimeout) {
        this.startElection();
      } else {
        this.startElectionTimer();
      }
    }, this.electionTimeout);
  }

  /**
   * Start leader election
   */
  startElection() {
    console.log(`[Node ${this.nodeId}] Starting election for term ${this.currentTerm + 1}`);
    this.state = 'candidate';
    this.currentTerm++;
    this.votedFor = this.nodeId;
    
    let votes = 1; // Vote for self
    const votesNeeded = Math.floor(this.nodes.length / 2) + 1;
    
    // Request votes from other nodes
    for (const node of this.nodes) {
      if (node.nodeId !== this.nodeId) {
        const granted = node.requestVote(this.currentTerm, this.nodeId, this.log.length - 1, this.log.length > 0 ? this.log[this.log.length - 1].term : 0);
        if (granted) {
          votes++;
        }
      }
    }
    
    if (votes >= votesNeeded) {
      this.becomeLeader();
    } else {
      this.state = 'follower';
      this.startElectionTimer();
    }
  }

  /**
   * Request vote from this node
   */
  requestVote(term, candidateId, lastLogIndex, lastLogTerm) {
    if (term > this.currentTerm) {
      this.currentTerm = term;
      this.votedFor = null;
      this.state = 'follower';
    }
    
    if (term === this.currentTerm && 
        (this.votedFor === null || this.votedFor === candidateId) &&
        (lastLogTerm > (this.log.length > 0 ? this.log[this.log.length - 1].term : 0) ||
         (lastLogTerm === (this.log.length > 0 ? this.log[this.log.length - 1].term : 0) &&
          lastLogIndex >= this.log.length - 1))) {
      this.votedFor = candidateId;
      return true;
    }
    
    return false;
  }

  /**
   * Become leader
   */
  becomeLeader() {
    console.log(`[Node ${this.nodeId}] Elected as leader for term ${this.currentTerm}`);
    this.state = 'leader';
    
    // Initialize nextIndex and matchIndex
    for (const node of this.nodes) {
      this.nextIndex.set(node.nodeId, this.log.length);
      this.matchIndex.set(node.nodeId, -1);
    }
    
    // Send initial heartbeat
    this.sendHeartbeat();
    
    // Start periodic heartbeats
    setInterval(() => {
      if (this.state === 'leader') {
        this.sendHeartbeat();
      }
    }, this.heartbeatInterval);
  }

  /**
   * Send heartbeat to followers
   */
  sendHeartbeat() {
    for (const node of this.nodes) {
      if (node.nodeId !== this.nodeId) {
        node.appendEntries(
          this.currentTerm,
          this.nodeId,
          this.log.length - 1,
          this.log.length > 0 ? this.log[this.log.length - 1].term : 0,
          [],
          this.commitIndex
        );
      }
    }
  }

  /**
   * Append entries (heartbeat or log replication)
   */
  appendEntries(term, leaderId, prevLogIndex, prevLogTerm, entries, leaderCommit) {
    if (term >= this.currentTerm) {
      this.currentTerm = term;
      this.state = 'follower';
      this.votedFor = null;
      this.lastHeartbeat = Date.now();
      
      // Check if log matches
      if (prevLogIndex >= 0 && 
          (this.log.length <= prevLogIndex || 
           this.log[prevLogIndex].term !== prevLogTerm)) {
        return false;
      }
      
      // Append new entries
      if (entries.length > 0) {
        this.log = this.log.slice(0, prevLogIndex + 1);
        this.log.push(...entries);
      }
      
      // Update commit index
      if (leaderCommit > this.commitIndex) {
        this.commitIndex = Math.min(leaderCommit, this.log.length - 1);
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Propose a new log entry (client request)
   */
  proposeEntry(command) {
    if (this.state !== 'leader') {
      throw new Error('Only leader can propose entries');
    }
    
    const entry = {
      term: this.currentTerm,
      command: command,
      index: this.log.length
    };
    
    this.log.push(entry);
    
    // Replicate to followers
    this.replicateLog();
    
    return entry;
  }

  /**
   * Replicate log to followers
   */
  replicateLog() {
    for (const node of this.nodes) {
      if (node.nodeId !== this.nodeId) {
        const nextIdx = this.nextIndex.get(node.nodeId);
        const entries = this.log.slice(nextIdx);
        const prevLogIndex = nextIdx - 1;
        const prevLogTerm = prevLogIndex >= 0 ? this.log[prevLogIndex].term : 0;
        
        const success = node.appendEntries(
          this.currentTerm,
          this.nodeId,
          prevLogIndex,
          prevLogTerm,
          entries,
          this.commitIndex
        );
        
        if (success) {
          this.nextIndex.set(node.nodeId, this.log.length);
          this.matchIndex.set(node.nodeId, this.log.length - 1);
        } else {
          this.nextIndex.set(node.nodeId, Math.max(0, this.nextIndex.get(node.nodeId) - 1));
        }
      }
    }
    
    // Update commit index
    this.updateCommitIndex();
  }

  /**
   * Update commit index based on majority
   */
  updateCommitIndex() {
    for (let i = this.commitIndex + 1; i < this.log.length; i++) {
      let count = 1; // Leader has the entry
      for (const node of this.nodes) {
        if (node.nodeId !== this.nodeId && this.matchIndex.get(node.nodeId) >= i) {
          count++;
        }
      }
      
      if (count > this.nodes.length / 2 && this.log[i].term === this.currentTerm) {
        this.commitIndex = i;
      }
    }
  }

  /**
   * Get committed log entries
   */
  getCommittedEntries() {
    return this.log.slice(0, this.commitIndex + 1);
  }
}

/**
 * Simple Paxos Implementation
 */
class PaxosProposer {
  constructor(proposerId, acceptors) {
    this.proposerId = proposerId;
    this.acceptors = acceptors;
    this.proposalNumber = proposerId;
  }

  /**
   * Phase 1: Prepare
   */
  async prepare(value) {
    const n = this.proposalNumber;
    this.proposalNumber += this.acceptors.length; // Ensure uniqueness
    
    const promises = [];
    for (const acceptor of this.acceptors) {
      promises.push(acceptor.prepare(n));
    }
    
    const responses = await Promise.all(promises);
    const promises_count = responses.filter(r => r.promised).length;
    
    if (promises_count <= this.acceptors.length / 2) {
      throw new Error('Failed to get majority promises');
    }
    
    // Find highest accepted value
    let highestAccepted = null;
    let highestN = -1;
    
    for (const response of responses) {
      if (response.promised && response.acceptedValue && response.acceptedN > highestN) {
        highestN = response.acceptedN;
        highestAccepted = response.acceptedValue;
      }
    }
    
    const valueToPropose = highestAccepted !== null ? highestAccepted : value;
    
    // Phase 2: Accept
    return await this.accept(n, valueToPropose);
  }

  /**
   * Phase 2: Accept
   */
  async accept(n, value) {
    const promises = [];
    for (const acceptor of this.acceptors) {
      promises.push(acceptor.accept(n, value));
    }
    
    const responses = await Promise.all(promises);
    const accepts_count = responses.filter(r => r.accepted).length;
    
    if (accepts_count > this.acceptors.length / 2) {
      return { chosen: true, value: value, proposalNumber: n };
    } else {
      throw new Error('Failed to get majority accepts');
    }
  }
}

class PaxosAcceptor {
  constructor(acceptorId) {
    this.acceptorId = acceptorId;
    this.promisedN = -1;
    this.acceptedN = -1;
    this.acceptedValue = null;
  }

  prepare(n) {
    if (n > this.promisedN) {
      this.promisedN = n;
      return {
        promised: true,
        acceptedN: this.acceptedN,
        acceptedValue: this.acceptedValue
      };
    }
    return { promised: false };
  }

  accept(n, value) {
    if (n >= this.promisedN) {
      this.promisedN = n;
      this.acceptedN = n;
      this.acceptedValue = value;
      return { accepted: true };
    }
    return { accepted: false };
  }
}

// Example usage
function demonstrateRaft() {
  console.log('=== Raft Consensus Algorithm ===\n');
  
  const nodes = [];
  for (let i = 0; i < 5; i++) {
    nodes.push(new RaftNode(i, []));
  }
  
  // Set up node references
  for (const node of nodes) {
    node.nodes = nodes;
  }
  
  // Wait a bit for election
  setTimeout(() => {
    const leader = nodes.find(n => n.state === 'leader');
    if (leader) {
      console.log(`\nLeader elected: Node ${leader.nodeId}`);
      leader.proposeEntry({ type: 'SET', key: 'x', value: 1 });
      console.log('Proposed entry:', leader.log[leader.log.length - 1]);
    }
  }, 500);
}

function demonstratePaxos() {
  console.log('\n=== Paxos Consensus Algorithm ===\n');
  
  const acceptors = [];
  for (let i = 0; i < 5; i++) {
    acceptors.push(new PaxosAcceptor(i));
  }
  
  const proposer = new PaxosProposer(1, acceptors);
  
  proposer.prepare('value1')
    .then(result => {
      console.log('Paxos result:', result);
    })
    .catch(error => {
      console.error('Paxos error:', error.message);
    });
}

if (require.main === module) {
  demonstrateRaft();
  setTimeout(demonstratePaxos, 1000);
}

module.exports = { RaftNode, PaxosProposer, PaxosAcceptor };

