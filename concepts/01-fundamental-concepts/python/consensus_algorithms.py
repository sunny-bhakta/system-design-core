"""
Consensus Algorithms Implementation
Demonstrates Raft and Paxos consensus algorithms
"""
import asyncio
import random
from typing import List, Dict, Optional, Any
from dataclasses import dataclass


@dataclass
class LogEntry:
    """Log entry in Raft"""
    term: int
    command: Any
    index: int


class RaftNode:
    """Raft consensus algorithm implementation"""
    
    def __init__(self, node_id: int, nodes: List['RaftNode']):
        self.node_id = node_id
        self.nodes = nodes
        self.state = 'follower'  # follower, candidate, leader
        self.current_term = 0
        self.voted_for: Optional[int] = None
        self.log: List[LogEntry] = []
        self.commit_index = -1
        self.last_applied = -1
        
        # Leader state
        self.next_index: Dict[int, int] = {}
        self.match_index: Dict[int, int] = {}
        
        # Election timeout
        self.election_timeout = 0.15 + random.random() * 0.15  # 150-300ms
        self.heartbeat_interval = 0.05  # 50ms
        self.last_heartbeat = asyncio.get_event_loop().time()
        
        self._election_task = None
        self._heartbeat_task = None
    
    async def start(self):
        """Start the node"""
        await self._start_election_timer()
    
    async def _start_election_timer(self):
        """Start election timer"""
        if self.state == 'leader':
            return
        
        await asyncio.sleep(self.election_timeout)
        
        current_time = asyncio.get_event_loop().time()
        if self.state != 'leader' and current_time - self.last_heartbeat > self.election_timeout:
            await self._start_election()
        else:
            await self._start_election_timer()
    
    async def _start_election(self):
        """Start leader election"""
        print(f"[Node {self.node_id}] Starting election for term {self.current_term + 1}")
        self.state = 'candidate'
        self.current_term += 1
        self.voted_for = self.node_id
        
        votes = 1  # Vote for self
        votes_needed = len(self.nodes) // 2 + 1
        
        # Request votes from other nodes
        for node in self.nodes:
            if node.node_id != self.node_id:
                granted = await node.request_vote(
                    self.current_term,
                    self.node_id,
                    len(self.log) - 1,
                    self.log[-1].term if self.log else 0
                )
                if granted:
                    votes += 1
        
        if votes >= votes_needed:
            await self._become_leader()
        else:
            self.state = 'follower'
            await self._start_election_timer()
    
    async def request_vote(self, term: int, candidate_id: int, 
                          last_log_index: int, last_log_term: int) -> bool:
        """Request vote from this node"""
        if term > self.current_term:
            self.current_term = term
            self.voted_for = None
            self.state = 'follower'
        
        if (term == self.current_term and
            (self.voted_for is None or self.voted_for == candidate_id) and
            (last_log_term > (self.log[-1].term if self.log else 0) or
             (last_log_term == (self.log[-1].term if self.log else 0) and
              last_log_index >= len(self.log) - 1))):
            self.voted_for = candidate_id
            return True
        
        return False
    
    async def _become_leader(self):
        """Become leader"""
        print(f"[Node {self.node_id}] Elected as leader for term {self.current_term}")
        self.state = 'leader'
        
        # Initialize next_index and match_index
        for node in self.nodes:
            self.next_index[node.node_id] = len(self.log)
            self.match_index[node.node_id] = -1
        
        # Send initial heartbeat
        await self._send_heartbeat()
        
        # Start periodic heartbeats
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
    
    async def _heartbeat_loop(self):
        """Periodic heartbeat loop"""
        while self.state == 'leader':
            await asyncio.sleep(self.heartbeat_interval)
            await self._send_heartbeat()
    
    async def _send_heartbeat(self):
        """Send heartbeat to followers"""
        for node in self.nodes:
            if node.node_id != self.node_id:
                await node.append_entries(
                    self.current_term,
                    self.node_id,
                    len(self.log) - 1,
                    self.log[-1].term if self.log else 0,
                    [],
                    self.commit_index
                )
    
    async def append_entries(self, term: int, leader_id: int, prev_log_index: int,
                           prev_log_term: int, entries: List[LogEntry], 
                           leader_commit: int) -> bool:
        """Append entries (heartbeat or log replication)"""
        if term >= self.current_term:
            self.current_term = term
            self.state = 'follower'
            self.voted_for = None
            self.last_heartbeat = asyncio.get_event_loop().time()
            
            # Check if log matches
            if (prev_log_index >= 0 and
                (len(self.log) <= prev_log_index or
                 self.log[prev_log_index].term != prev_log_term)):
                return False
            
            # Append new entries
            if entries:
                self.log = self.log[:prev_log_index + 1]
                self.log.extend(entries)
            
            # Update commit index
            if leader_commit > self.commit_index:
                self.commit_index = min(leader_commit, len(self.log) - 1)
            
            return True
        
        return False
    
    async def propose_entry(self, command: Any) -> LogEntry:
        """Propose a new log entry (client request)"""
        if self.state != 'leader':
            raise Exception('Only leader can propose entries')
        
        entry = LogEntry(
            term=self.current_term,
            command=command,
            index=len(self.log)
        )
        
        self.log.append(entry)
        await self._replicate_log()
        
        return entry
    
    async def _replicate_log(self):
        """Replicate log to followers"""
        for node in self.nodes:
            if node.node_id != self.node_id:
                next_idx = self.next_index[node.node_id]
                entries = self.log[next_idx:]
                prev_log_index = next_idx - 1
                prev_log_term = self.log[prev_log_index].term if prev_log_index >= 0 else 0
                
                success = await node.append_entries(
                    self.current_term,
                    self.node_id,
                    prev_log_index,
                    prev_log_term,
                    entries,
                    self.commit_index
                )
                
                if success:
                    self.next_index[node.node_id] = len(self.log)
                    self.match_index[node.node_id] = len(self.log) - 1
                else:
                    self.next_index[node.node_id] = max(0, self.next_index[node.node_id] - 1)
        
        # Update commit index
        self._update_commit_index()
    
    def _update_commit_index(self):
        """Update commit index based on majority"""
        for i in range(self.commit_index + 1, len(self.log)):
            count = 1  # Leader has the entry
            for node in self.nodes:
                if node.node_id != self.node_id and self.match_index.get(node.node_id, -1) >= i:
                    count += 1
            
            if count > len(self.nodes) / 2 and self.log[i].term == self.current_term:
                self.commit_index = i
    
    def get_committed_entries(self) -> List[LogEntry]:
        """Get committed log entries"""
        return self.log[:self.commit_index + 1]


class PaxosProposer:
    """Paxos proposer implementation"""
    
    def __init__(self, proposer_id: int, acceptors: List['PaxosAcceptor']):
        self.proposer_id = proposer_id
        self.acceptors = acceptors
        self.proposal_number = proposer_id
    
    async def prepare(self, value: Any) -> Dict[str, Any]:
        """Phase 1: Prepare"""
        n = self.proposal_number
        self.proposal_number += len(self.acceptors)  # Ensure uniqueness
        
        responses = await asyncio.gather(*[acceptor.prepare(n) for acceptor in self.acceptors])
        promises_count = sum(1 for r in responses if r['promised'])
        
        if promises_count <= len(self.acceptors) // 2:
            raise Exception('Failed to get majority promises')
        
        # Find highest accepted value
        highest_accepted = None
        highest_n = -1
        
        for response in responses:
            if (response['promised'] and response.get('accepted_value') and
                response.get('accepted_n', -1) > highest_n):
                highest_n = response['accepted_n']
                highest_accepted = response['accepted_value']
        
        value_to_propose = highest_accepted if highest_accepted is not None else value
        
        # Phase 2: Accept
        return await self.accept(n, value_to_propose)
    
    async def accept(self, n: int, value: Any) -> Dict[str, Any]:
        """Phase 2: Accept"""
        responses = await asyncio.gather(*[acceptor.accept(n, value) for acceptor in self.acceptors])
        accepts_count = sum(1 for r in responses if r['accepted'])
        
        if accepts_count > len(self.acceptors) // 2:
            return {'chosen': True, 'value': value, 'proposal_number': n}
        else:
            raise Exception('Failed to get majority accepts')


class PaxosAcceptor:
    """Paxos acceptor implementation"""
    
    def __init__(self, acceptor_id: int):
        self.acceptor_id = acceptor_id
        self.promised_n = -1
        self.accepted_n = -1
        self.accepted_value = None
    
    async def prepare(self, n: int) -> Dict[str, Any]:
        """Prepare phase"""
        if n > self.promised_n:
            self.promised_n = n
            return {
                'promised': True,
                'accepted_n': self.accepted_n,
                'accepted_value': self.accepted_value
            }
        return {'promised': False}
    
    async def accept(self, n: int, value: Any) -> Dict[str, Any]:
        """Accept phase"""
        if n >= self.promised_n:
            self.promised_n = n
            self.accepted_n = n
            self.accepted_value = value
            return {'accepted': True}
        return {'accepted': False}


async def demonstrate_raft():
    """Demonstrate Raft consensus"""
    print('=== Raft Consensus Algorithm ===\n')
    
    nodes = []
    for i in range(5):
        nodes.append(RaftNode(i, []))
    
    # Set up node references
    for node in nodes:
        node.nodes = nodes
    
    # Start all nodes
    tasks = [node.start() for node in nodes]
    await asyncio.gather(*tasks, return_exceptions=True)
    
    # Wait a bit for election
    await asyncio.sleep(1)
    
    leader = next((n for n in nodes if n.state == 'leader'), None)
    if leader:
        print(f"\nLeader elected: Node {leader.node_id}")
        entry = await leader.propose_entry({'type': 'SET', 'key': 'x', 'value': 1})
        print(f'Proposed entry: {entry}')


async def demonstrate_paxos():
    """Demonstrate Paxos consensus"""
    print('\n=== Paxos Consensus Algorithm ===\n')
    
    acceptors = [PaxosAcceptor(i) for i in range(5)]
    proposer = PaxosProposer(1, acceptors)
    
    try:
        result = await proposer.prepare('value1')
        print(f'Paxos result: {result}')
    except Exception as e:
        print(f'Paxos error: {e}')


if __name__ == '__main__':
    asyncio.run(demonstrate_raft())
    asyncio.run(demonstrate_paxos())

