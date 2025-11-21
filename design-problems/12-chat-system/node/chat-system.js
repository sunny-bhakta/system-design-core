/**
 * Design Chat System
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Real-time chat system with one-on-one and group messaging.
 * 
 * CAPACITY ESTIMATION:
 * - Users: 100M+ users
 * - Messages: 1B messages/day = ~11.6K messages/second
 * - Storage: 1B/day * 200 bytes = 200GB/day = 73TB/year
 * - Concurrent connections: 10M WebSocket connections
 * 
 * ARCHITECTURE:
 * Client → Load Balancer → Chat Service → WebSocket Server → Recipient
 * 
 * KEY FEATURES:
 * - One-on-one messaging
 * - Group messaging
 * - Real-time delivery via WebSocket
 * - Typing indicators
 * - Online/offline presence
 * - Message history
 * - Read receipts
 * 
 * MESSAGING ARCHITECTURE:
 * - WebSocket: Persistent connection for real-time delivery
 * - Message Queue: For offline users
 * - Database: Message persistence
 * - Presence: Redis for online status
 */
class ChatSystem {
  /**
   * Constructor
   * 
   * INITIALIZES DATA STRUCTURES:
   * ============================
   * All data structures are in-memory Maps for simplicity.
   * In production, would use distributed databases and WebSocket servers.
   */
  constructor() {
    /**
     * USER STORAGE
     * ============
     * Stores user information.
     * In production: SQL database (PostgreSQL, MySQL)
     */
    this.users = new Map();
    
    /**
     * CHAT STORAGE
     * ============
     * Stores chat information (one-on-one and group).
     * In production: SQL database
     */
    this.chats = new Map(); // chatId -> chat data
    
    /**
     * MESSAGE STORAGE
     * ===============
     * Stores messages per chat.
     * In production: NoSQL database (MongoDB, Cassandra)
     */
    this.messages = new Map(); // chatId -> List of messages
    
    /**
     * PRESENCE STORAGE
     * ================
     * Tracks online/offline status.
     * In production: Redis for fast presence lookups
     */
    this.presence = new Map(); // userId -> online status
    
    /**
     * TYPING INDICATORS
     * =================
     * Tracks users currently typing in each chat.
     * In production: Redis with TTL
     */
    this.typing = new Map(); // chatId -> Set of typing user IDs
  }

  /**
   * Create user
   */
  createUser(userId, name) {
    const user = {
      id: userId,
      name,
      createdAt: Date.now()
    };

    this.users.set(userId, user);
    this.presence.set(userId, { online: false, lastSeen: Date.now() });

    return user;
  }

  /**
   * Get or create chat ID
   */
  getChatId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
  }

  /**
   * Send message
   */
  async sendMessage(senderId, recipientId, text, type = 'text') {
    const chatId = this.getChatId(senderId, recipientId);

    // Create chat if doesn't exist
    if (!this.chats.has(chatId)) {
      this.chats.set(chatId, {
        id: chatId,
        type: 'one_on_one',
        members: [senderId, recipientId],
        createdAt: Date.now()
      });
      this.messages.set(chatId, []);
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chatId,
      senderId,
      recipientId,
      text,
      type,
      createdAt: Date.now()
    };

    const messages = this.messages.get(chatId);
    messages.push(message);

    // Update chat timestamp
    const chat = this.chats.get(chatId);
    chat.updatedAt = Date.now();

    return message;
  }

  /**
   * Get messages
   */
  getMessages(userId1, userId2, limit = 50) {
    const chatId = this.getChatId(userId1, userId2);
    const messages = this.messages.get(chatId) || [];
    
    return messages
      .filter(m => m.senderId === userId1 || m.recipientId === userId1)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-limit);
  }

  /**
   * Create group
   */
  createGroup(creatorId, name, members = []) {
    const group = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type: 'group',
      creatorId,
      members: [creatorId, ...members],
      admins: [creatorId],
      createdAt: Date.now()
    };

    this.chats.set(group.id, group);
    this.messages.set(group.id, []);

    return group;
  }

  /**
   * Send group message
   */
  async sendGroupMessage(senderId, groupId, text) {
    const group = this.chats.get(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (!group.members.includes(senderId)) {
      throw new Error('User not a member of the group');
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chatId: groupId,
      senderId,
      groupId,
      text,
      type: 'text',
      createdAt: Date.now()
    };

    const messages = this.messages.get(groupId) || [];
    messages.push(message);

    // Update group timestamp
    group.updatedAt = Date.now();

    return message;
  }

  /**
   * Get group messages
   */
  getGroupMessages(groupId, limit = 50) {
    const messages = this.messages.get(groupId) || [];
    return messages
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-limit);
  }

  /**
   * Set online status
   */
  setOnlineStatus(userId, online) {
    const presence = this.presence.get(userId);
    if (presence) {
      presence.online = online;
      presence.lastSeen = Date.now();
    }
    return { online, lastSeen: presence.lastSeen };
  }

  /**
   * Get online status
   */
  getOnlineStatus(userId) {
    const presence = this.presence.get(userId);
    if (!presence) {
      return null;
    }

    return {
      online: presence.online,
      lastSeen: new Date(presence.lastSeen).toISOString()
    };
  }

  /**
   * Set typing indicator
   */
  setTyping(userId, chatId, typing) {
    if (!this.typing.has(chatId)) {
      this.typing.set(chatId, new Set());
    }

    const typingUsers = this.typing.get(chatId);
    if (typing) {
      typingUsers.add(userId);
    } else {
      typingUsers.delete(userId);
    }

    return Array.from(typingUsers);
  }

  /**
   * Get typing indicators
   */
  getTyping(chatId) {
    const typingUsers = this.typing.get(chatId) || new Set();
    return Array.from(typingUsers).map(userId => ({
      userId,
      name: this.users.get(userId)?.name
    }));
  }

  /**
   * Get user chats
   */
  getUserChats(userId) {
    const userChats = [];

    for (const chat of this.chats.values()) {
      if (chat.type === 'one_on_one' && chat.members.includes(userId)) {
        const otherUserId = chat.members.find(id => id !== userId);
        const messages = this.messages.get(chat.id) || [];
        const lastMessage = messages[messages.length - 1];

        userChats.push({
          chatId: chat.id,
          type: 'one_on_one',
          otherUser: this.users.get(otherUserId),
          lastMessage,
          updatedAt: chat.updatedAt || chat.createdAt
        });
      } else if (chat.type === 'group' && chat.members.includes(userId)) {
        const messages = this.messages.get(chat.id) || [];
        const lastMessage = messages[messages.length - 1];

        userChats.push({
          chatId: chat.id,
          type: 'group',
          name: chat.name,
          lastMessage,
          updatedAt: chat.updatedAt || chat.createdAt
        });
      }
    }

    return userChats.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Add member to group
   */
  addGroupMember(adminId, groupId, userId) {
    const group = this.chats.get(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (!group.admins.includes(adminId)) {
      throw new Error('Only admins can add members');
    }

    if (!group.members.includes(userId)) {
      group.members.push(userId);
    }

    return { added: true, memberCount: group.members.length };
  }

  /**
   * Remove member from group
   */
  removeGroupMember(adminId, groupId, userId) {
    const group = this.chats.get(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (!group.admins.includes(adminId)) {
      throw new Error('Only admins can remove members');
    }

    group.members = group.members.filter(id => id !== userId);

    return { removed: true, memberCount: group.members.length };
  }
}

// Example usage
async function demonstrateChatSystem() {
  console.log('=== Design Chat System ===\n');

  const chat = new ChatSystem();

  // Create users
  const user1 = chat.createUser('user1', 'Alice');
  const user2 = chat.createUser('user2', 'Bob');
  const user3 = chat.createUser('user3', 'Charlie');

  // Set online status
  chat.setOnlineStatus('user1', true);
  chat.setOnlineStatus('user2', true);

  // Send message
  const msg1 = await chat.sendMessage('user1', 'user2', 'Hello Bob!');
  console.log('Message sent:', msg1.text);

  const msg2 = await chat.sendMessage('user2', 'user1', 'Hi Alice!');
  console.log('Message sent:', msg2.text);

  // Get messages
  const messages = chat.getMessages('user1', 'user2');
  console.log('Messages:', messages.map(m => `${m.senderId}: ${m.text}`));

  // Create group
  const group = chat.createGroup('user1', 'Friends', ['user2', 'user3']);
  console.log('Group created:', group.name);

  // Send group message
  const groupMsg = await chat.sendGroupMessage('user1', group.id, 'Hello everyone!');
  console.log('Group message sent:', groupMsg.text);

  // Typing indicator
  chat.setTyping('user2', group.id, true);
  const typing = chat.getTyping(group.id);
  console.log('Typing:', typing.map(t => t.name));

  // Get user chats
  const userChats = chat.getUserChats('user1');
  console.log('User chats:', userChats.length);
}

if (require.main === module) {
  demonstrateChatSystem();
}

module.exports = { ChatSystem };

