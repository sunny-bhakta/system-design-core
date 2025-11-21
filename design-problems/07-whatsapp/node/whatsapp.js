/**
 * Design WhatsApp
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Messaging application with one-on-one and group chats, real-time delivery.
 * 
 * CAPACITY ESTIMATION:
 * - Users: 2B+ users
 * - Messages: 100B messages/day = ~1.16M messages/second
 * - Media: 1B media/day * 1MB = 1PB/day = 365PB/year
 * - Storage: 100B/day * 100 bytes = 10TB/day = 3.65PB/year
 * 
 * ARCHITECTURE:
 * Client → Load Balancer → Message Service → WebSocket Server → Recipient
 * 
 * KEY FEATURES:
 * - One-on-one messaging
 * - Group messaging (up to 256 members)
 * - Real-time delivery via WebSocket
 * - Message status (sent, delivered, read)
 * - Online/offline presence
 * - Media sharing (images, videos, audio, documents)
 * - Message history
 * - End-to-end encryption (in production)
 * 
 * MESSAGING ARCHITECTURE:
 * - WebSocket: Persistent connection for real-time delivery
 * - Message Queue: For offline users
 * - Database: Message persistence
 * - Media Storage: Object storage for media files
 */

/**
 * WhatsApp Service
 * 
 * CORE FUNCTIONALITY:
 * ===================
 * Implements WhatsApp-like messaging service with:
 * - User management
 * - One-on-one messaging
 * - Group messaging
 * - Real-time delivery
 * - Message status tracking
 * - Presence management
 * - Offline message queuing
 * 
 * DATA STRUCTURES:
 * ================
 * - users: Map<userId, userData> - User information
 * - chats: Map<chatId, Array<message>> - Chat messages (one-on-one and group)
 * - groups: Map<groupId, groupData> - Group information
 * - presence: Map<userId, presenceData> - Online/offline status
 * - messageQueue: Map<userId, Array<message>> - Pending messages for offline users
 * 
 * PRODUCTION CONSIDERATIONS:
 * - In production, would use:
 *   * SQL/NoSQL database for messages
 *   * WebSocket server for real-time delivery
 *   * Message queue (Kafka, RabbitMQ) for offline delivery
 *   * Object storage (S3) for media files
 *   * Redis for presence and connection management
 *   * End-to-end encryption for security
 */
class WhatsAppService {
  /**
   * Constructor
   * 
   * INITIALIZES DATA STRUCTURES:
   * ============================
   * All data structures are in-memory Maps for simplicity.
   * In production, would use distributed databases.
   */
  constructor() {
    /**
     * USER STORAGE
     * ============
     * Stores user information (id, phoneNumber, name, status, lastSeen).
     * In production: SQL database (PostgreSQL, MySQL)
     */
    this.users = new Map();
    
    /**
     * CHAT STORAGE
     * ============
     * Stores messages for both one-on-one and group chats.
     * Key: chatId (for one-on-one: "userId1_userId2", for group: groupId)
     * Value: Array of message objects
     * In production: NoSQL database (MongoDB, Cassandra) for messages
     */
    this.chats = new Map(); // chatId -> messages
    
    /**
     * GROUP STORAGE
     * =============
     * Stores group information (id, name, members, admins).
     * In production: SQL database for groups
     */
    this.groups = new Map(); // groupId -> group data
    
    /**
     * PRESENCE STORAGE
     * ================
     * Tracks online/offline status and last seen timestamp.
     * In production: Redis for fast presence lookups
     */
    this.presence = new Map(); // userId -> online status
    
    /**
     * MESSAGE QUEUE
     * =============
     * Stores pending messages for offline users.
     * When user comes online, messages are delivered.
     * In production: Message queue (Kafka, RabbitMQ) for offline delivery
     */
    this.messageQueue = new Map(); // For offline users
  }

  /**
   * Create user
   */
  createUser(userId, phoneNumber, name) {
    this.users.set(userId, {
      id: userId,
      phoneNumber,
      name,
      status: 'Hey there! I am using WhatsApp',
      lastSeen: Date.now(),
      createdAt: Date.now()
    });
    this.presence.set(userId, { online: false, lastSeen: Date.now() });
    return this.users.get(userId);
  }

  /**
   * Get or create chat
   */
  getChatId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
  }

  /**
   * Send message
   * 
   * MESSAGE SENDING PROCESS:
   * ========================
   * 1. Get or create chat ID
   * 2. Create message object with metadata
   * 3. Store message in chat
   * 4. Check recipient's online status
   * 5. If online: Deliver immediately via WebSocket
   * 6. If offline: Queue message for later delivery
   * 7. Return message object
   * 
   * MESSAGE STATUS FLOW:
   * ====================
   * sent → delivered → read
   * 
   * - sent: Message created and stored
   * - delivered: Message delivered to recipient's device
   * - read: Recipient has read the message
   * 
   * REAL-TIME DELIVERY:
   * ==================
   * If recipient is online, message is delivered immediately via WebSocket.
   * Status is updated to "delivered" and deliveredAt timestamp is set.
   * 
   * OFFLINE DELIVERY:
   * ================
   * If recipient is offline, message is queued.
   * When recipient comes online, queued messages are delivered.
   * 
   * IN PRODUCTION:
   * - Would use WebSocket server for real-time delivery
   * - Message queue (Kafka, RabbitMQ) for offline delivery
   * - Push notifications for mobile apps
   * - End-to-end encryption for security
   * 
   * @param {string} senderId - User sending the message
   * @param {string} recipientId - User receiving the message
   * @param {string} text - Message content
   * @param {string} type - Message type (text, image, video, audio, document)
   * @returns {Promise<Object>} Created message object
   */
  async sendMessage(senderId, recipientId, text, type = 'text') {
    /**
     * STEP 1: GET OR CREATE CHAT
     * ===========================
     * Generate chat ID from user IDs (sorted for consistency).
     * Create chat if it doesn't exist.
     */
    const chatId = this.getChatId(senderId, recipientId);

    if (!this.chats.has(chatId)) {
      this.chats.set(chatId, []);
    }

    /**
     * STEP 2: CREATE MESSAGE OBJECT
     * =============================
     * Generate unique message ID and store metadata.
     * In production: Would use distributed ID generator (Snowflake)
     */
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chatId,
      senderId,
      recipientId,
      text,
      type, // text, image, video, audio, document
      status: 'sent', // sent → delivered → read
      createdAt: Date.now(),
      deliveredAt: null,
      readAt: null
    };

    /**
     * STEP 3: STORE MESSAGE
     * =====================
     * Add message to chat history.
     * In production: Would persist to database asynchronously
     */
    const messages = this.chats.get(chatId);
    messages.push(message);

    /**
     * STEP 4: CHECK RECIPIENT STATUS AND DELIVER
     * ===========================================
     * Check if recipient is online.
     * - If online: Deliver immediately via WebSocket, update status to "delivered"
     * - If offline: Queue message for later delivery
     */
    const recipientPresence = this.presence.get(recipientId);
    
    if (recipientPresence && recipientPresence.online) {
      /**
       * REAL-TIME DELIVERY
       * ==================
       * Recipient is online, deliver immediately via WebSocket.
       * In production: Would send via WebSocket server to recipient's connection.
       */
      message.status = 'delivered';
      message.deliveredAt = Date.now();
    } else {
      /**
       * OFFLINE DELIVERY
       * ================
       * Recipient is offline, queue message for later delivery.
       * When recipient comes online, queued messages will be delivered.
       * In production: Would use message queue (Kafka, RabbitMQ).
       */
      if (!this.messageQueue.has(recipientId)) {
        this.messageQueue.set(recipientId, []);
      }
      this.messageQueue.get(recipientId).push(message);
    }

    return message;
  }

  /**
   * Mark message as delivered
   */
  markAsDelivered(messageId, recipientId) {
    for (const messages of this.chats.values()) {
      const message = messages.find(m => m.id === messageId && m.recipientId === recipientId);
      if (message && message.status === 'sent') {
        message.status = 'delivered';
        message.deliveredAt = Date.now();
        return true;
      }
    }
    return false;
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId, readerId) {
    for (const messages of this.chats.values()) {
      const message = messages.find(m => m.id === messageId && m.recipientId === readerId);
      if (message && message.status !== 'read') {
        message.status = 'read';
        message.readAt = Date.now();
        return true;
      }
    }
    return false;
  }

  /**
   * Mark all messages as read
   */
  markAllAsRead(chatId, readerId) {
    const messages = this.chats.get(chatId) || [];
    let count = 0;

    for (const message of messages) {
      if (message.recipientId === readerId && message.status !== 'read') {
        message.status = 'read';
        message.readAt = Date.now();
        count++;
      }
    }

    return count;
  }

  /**
   * Get messages
   */
  getMessages(userId1, userId2, limit = 50) {
    const chatId = this.getChatId(userId1, userId2);
    const messages = this.chats.get(chatId) || [];
    
    return messages
      .filter(m => m.senderId === userId1 || m.recipientId === userId1)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-limit);
  }

  /**
   * Get pending messages (for offline users)
   */
  getPendingMessages(userId) {
    return this.messageQueue.get(userId) || [];
  }

  /**
   * Clear pending messages
   */
  clearPendingMessages(userId) {
    this.messageQueue.delete(userId);
  }

  /**
   * Set online status
   */
  setOnlineStatus(userId, online) {
    const presence = this.presence.get(userId);
    if (presence) {
      presence.online = online;
      presence.lastSeen = Date.now();
      
      // If coming online, deliver pending messages
      if (online) {
        const pending = this.getPendingMessages(userId);
        for (const message of pending) {
          this.markAsDelivered(message.id, userId);
        }
        this.clearPendingMessages(userId);
      }
    }
  }

  /**
   * Get online status
   */
  getOnlineStatus(userId) {
    const presence = this.presence.get(userId);
    if (!presence) {
      return null;
    }

    if (presence.online) {
      return { online: true, lastSeen: null };
    }

    return { online: false, lastSeen: new Date(presence.lastSeen).toISOString() };
  }

  /**
   * Create group
   */
  createGroup(creatorId, name, members = []) {
    const group = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      creatorId,
      members: new Set([creatorId, ...members]),
      admins: new Set([creatorId]),
      createdAt: Date.now()
    };

    this.groups.set(group.id, group);
    this.chats.set(group.id, []);

    return group;
  }

  /**
   * Send group message
   */
  async sendGroupMessage(senderId, groupId, text) {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (!group.members.has(senderId)) {
      throw new Error('User not a member of the group');
    }

    if (!this.chats.has(groupId)) {
      this.chats.set(groupId, []);
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chatId: groupId,
      senderId,
      groupId,
      text,
      type: 'text',
      status: 'sent',
      createdAt: Date.now(),
      readBy: new Set()
    };

    const messages = this.chats.get(groupId);
    messages.push(message);

    // Mark as read by sender
    message.readBy.add(senderId);

    return message;
  }

  /**
   * Mark group message as read
   */
  markGroupMessageAsRead(messageId, groupId, readerId) {
    const messages = this.chats.get(groupId) || [];
    const message = messages.find(m => m.id === messageId);
    
    if (message && message.readBy) {
      message.readBy.add(readerId);
      return true;
    }
    return false;
  }

  /**
   * Add member to group
   */
  addGroupMember(adminId, groupId, userId) {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (!group.admins.has(adminId)) {
      throw new Error('Only admins can add members');
    }

    group.members.add(userId);
    return { added: true, memberCount: group.members.size };
  }

  /**
   * Remove member from group
   */
  removeGroupMember(adminId, groupId, userId) {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (!group.admins.has(adminId)) {
      throw new Error('Only admins can remove members');
    }

    group.members.delete(userId);
    return { removed: true, memberCount: group.members.size };
  }

  /**
   * Get group messages
   */
  getGroupMessages(groupId, limit = 50) {
    const messages = this.chats.get(groupId) || [];
    return messages
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-limit);
  }

  /**
   * Send media message
   */
  async sendMediaMessage(senderId, recipientId, mediaUrl, mediaType) {
    return await this.sendMessage(senderId, recipientId, mediaUrl, mediaType);
  }
}

// Example usage
async function demonstrateWhatsApp() {
  console.log('=== Design WhatsApp ===\n');

  const whatsapp = new WhatsAppService();

  // Create users
  const user1 = whatsapp.createUser('user1', '+1234567890', 'Alice');
  const user2 = whatsapp.createUser('user2', '+0987654321', 'Bob');
  const user3 = whatsapp.createUser('user3', '+1122334455', 'Charlie');

  // Set online status
  whatsapp.setOnlineStatus('user1', true);
  whatsapp.setOnlineStatus('user2', false);

  // Send messages
  const msg1 = await whatsapp.sendMessage('user1', 'user2', 'Hello Bob!');
  console.log('Message sent:', { id: msg1.id, status: msg1.status });

  // User2 comes online
  whatsapp.setOnlineStatus('user2', true);
  console.log('User2 online, message delivered');

  // Mark as read
  whatsapp.markAsRead(msg1.id, 'user2');
  console.log('Message marked as read');

  // Create group
  const group = whatsapp.createGroup('user1', 'Friends', ['user2', 'user3']);
  console.log('Group created:', group.name);

  // Send group message
  const groupMsg = await whatsapp.sendGroupMessage('user1', group.id, 'Hello everyone!');
  console.log('Group message sent:', groupMsg.text);

  // Get messages
  const messages = whatsapp.getMessages('user1', 'user2');
  console.log('Messages count:', messages.length);
}

if (require.main === module) {
  demonstrateWhatsApp();
}

module.exports = { WhatsAppService };

