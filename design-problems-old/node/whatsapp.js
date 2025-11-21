/**
 * Design WhatsApp
 * Messaging application with one-on-one and group chats, real-time delivery
 */

/**
 * WhatsApp Service
 */
class WhatsAppService {
  constructor() {
    this.users = new Map();
    this.chats = new Map(); // chatId -> messages
    this.groups = new Map(); // groupId -> group data
    this.presence = new Map(); // userId -> online status
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
   */
  async sendMessage(senderId, recipientId, text, type = 'text') {
    const chatId = this.getChatId(senderId, recipientId);

    if (!this.chats.has(chatId)) {
      this.chats.set(chatId, []);
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chatId,
      senderId,
      recipientId,
      text,
      type, // text, image, video, audio, document
      status: 'sent',
      createdAt: Date.now(),
      deliveredAt: null,
      readAt: null
    };

    const messages = this.chats.get(chatId);
    messages.push(message);

    // Check if recipient is online
    const recipientPresence = this.presence.get(recipientId);
    
    if (recipientPresence && recipientPresence.online) {
      // Real-time delivery
      message.status = 'delivered';
      message.deliveredAt = Date.now();
    } else {
      // Queue for offline delivery
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

