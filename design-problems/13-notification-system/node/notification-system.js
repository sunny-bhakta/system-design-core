/**
 * Design Notification System
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Multi-channel notification system with batching and throttling.
 * 
 * CAPACITY ESTIMATION:
 * - Users: 1B+ users
 * - Notifications: 10B notifications/day = ~116K notifications/second
 * - Channels: Push, Email, SMS
 * - Storage: 10B/day * 500 bytes = 5TB/day = 1.8PB/year
 * 
 * ARCHITECTURE:
 * Client → Load Balancer → Notification Service → Channel Handlers → Delivery
 * 
 * KEY FEATURES:
 * - Multi-channel delivery (Push, Email, SMS)
 * - User preferences management
 * - Notification templates
 * - Batching for efficiency
 * - Throttling to prevent spam
 * - Delivery tracking
 * 
 * DELIVERY STRATEGIES:
 * - Batching: Group notifications for efficiency
 * - Throttling: Limit notifications per user
 * - Priority: High/low priority queues
 * - Retry: Retry failed deliveries
 */
class NotificationSystem {
  /**
   * Constructor
   * 
   * INITIALIZES DATA STRUCTURES:
   * ============================
   * All data structures are in-memory Maps for simplicity.
   * In production, would use distributed databases and message queues.
   */
  constructor() {
    /**
     * USER STORAGE
     * ============
     * Stores user information.
     * In production: SQL database
     */
    this.users = new Map();
    
    /**
     * USER PREFERENCES
     * ================
     * Stores notification preferences per user (push, email, SMS).
     * In production: SQL database
     */
    this.preferences = new Map(); // userId -> preferences
    
    /**
     * NOTIFICATION STORAGE
     * ====================
     * Stores notifications per user.
     * In production: NoSQL database (MongoDB, Cassandra)
     */
    this.notifications = new Map(); // userId -> List of notifications
    
    /**
     * TEMPLATE STORAGE
     * ================
     * Stores notification templates for different channels.
     * In production: SQL database or template service
     */
    this.templates = new Map(); // templateId -> template
    
    /**
     * BATCH QUEUE
     * ===========
     * Queues notifications for batching by channel.
     * In production: Message queue (Kafka, RabbitMQ)
     */
    this.batchQueue = new Map(); // channel -> List of notifications
    
    /**
     * DELIVERY STATS
     * ==============
     * Tracks delivery statistics per channel.
     * In production: Time-series database (InfluxDB)
     */
    this.deliveryStats = new Map(); // channel -> stats
  }

  /**
   * Create user
   */
  createUser(userId, email, phone = null) {
    const user = {
      id: userId,
      email,
      phone,
      createdAt: Date.now()
    };

    this.users.set(userId, user);
    this.preferences.set(userId, {
      push: true,
      email: true,
      sms: false
    });
    this.notifications.set(userId, []);

    return user;
  }

  /**
   * Set user preferences
   */
  setUserPreferences(userId, preferences) {
    const current = this.preferences.get(userId) || {};
    this.preferences.set(userId, { ...current, ...preferences });
    return this.preferences.get(userId);
  }

  /**
   * Create template
   */
  createTemplate(templateId, channel, subject, body) {
    const template = {
      id: templateId,
      channel,
      subject,
      body,
      createdAt: Date.now()
    };

    this.templates.set(templateId, template);
    return template;
  }

  /**
   * Send notification
   */
  async sendNotification(userId, channel, title, body, data = {}) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const preferences = this.preferences.get(userId);
    if (!preferences[channel]) {
      throw new Error(`Channel ${channel} not enabled for user`);
    }

    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      channel,
      title,
      body,
      data,
      status: 'pending',
      createdAt: Date.now(),
      deliveredAt: null
    };

    // Add to user's notifications
    const userNotifications = this.notifications.get(userId) || [];
    userNotifications.push(notification);
    this.notifications.set(userId, userNotifications);

    // Send via channel
    await this.deliverNotification(notification);

    return notification;
  }

  /**
   * Deliver notification
   */
  async deliverNotification(notification) {
    const channel = notification.channel;

    // Update stats
    if (!this.deliveryStats.has(channel)) {
      this.deliveryStats.set(channel, {
        sent: 0,
        delivered: 0,
        failed: 0
      });
    }

    const stats = this.deliveryStats.get(channel);
    stats.sent++;

    try {
      switch (channel) {
        case 'push':
          await this.sendPushNotification(notification);
          break;
        case 'email':
          await this.sendEmail(notification);
          break;
        case 'sms':
          await this.sendSMS(notification);
          break;
        default:
          throw new Error(`Unknown channel: ${channel}`);
      }

      notification.status = 'delivered';
      notification.deliveredAt = Date.now();
      stats.delivered++;
    } catch (error) {
      notification.status = 'failed';
      notification.error = error.message;
      stats.failed++;
    }
  }

  /**
   * Send push notification (simulated)
   */
  async sendPushNotification(notification) {
    // Simulate push notification
    console.log(`[PUSH] To: ${notification.userId}, Title: ${notification.title}, Body: ${notification.body}`);
    return true;
  }

  /**
   * Send email (simulated)
   */
  async sendEmail(notification) {
    const user = this.users.get(notification.userId);
    // Simulate email sending
    console.log(`[EMAIL] To: ${user.email}, Subject: ${notification.title}, Body: ${notification.body}`);
    return true;
  }

  /**
   * Send SMS (simulated)
   */
  async sendSMS(notification) {
    const user = this.users.get(notification.userId);
    if (!user.phone) {
      throw new Error('User phone number not available');
    }
    // Simulate SMS sending
    console.log(`[SMS] To: ${user.phone}, Body: ${notification.body}`);
    return true;
  }

  /**
   * Batch send notifications
   */
  async batchSend(notifications) {
    // Group by channel
    const byChannel = new Map();

    for (const notif of notifications) {
      if (!byChannel.has(notif.channel)) {
        byChannel.set(notif.channel, []);
      }
      byChannel.get(notif.channel).push(notif);
    }

    // Send batches
    for (const [channel, batch] of byChannel.entries()) {
      await this.sendBatch(channel, batch);
    }
  }

  /**
   * Send batch
   */
  async sendBatch(channel, notifications) {
    // Simulate batch sending
    console.log(`[BATCH ${channel.toUpperCase()}] Sending ${notifications.length} notifications`);
    
    for (const notif of notifications) {
      await this.deliverNotification(notif);
    }
  }

  /**
   * Get user notifications
   */
  getUserNotifications(userId, limit = 20) {
    const notifications = this.notifications.get(userId) || [];
    return notifications
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStats() {
    const stats = {};
    for (const [channel, data] of this.deliveryStats.entries()) {
      stats[channel] = {
        ...data,
        successRate: data.sent > 0 ? ((data.delivered / data.sent) * 100).toFixed(2) + '%' : '0%'
      };
    }
    return stats;
  }

  /**
   * Send using template
   */
  async sendWithTemplate(userId, templateId, variables = {}) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Replace variables in template
    let subject = template.subject;
    let body = template.body;

    for (const [key, value] of Object.entries(variables)) {
      subject = subject.replace(`{{${key}}}`, value);
      body = body.replace(`{{${key}}}`, value);
    }

    return await this.sendNotification(userId, template.channel, subject, body);
  }

  /**
   * Throttle notifications
   */
  throttleNotifications(userId, maxPerHour = 10) {
    const notifications = this.notifications.get(userId) || [];
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentNotifications = notifications.filter(n => n.createdAt > oneHourAgo);

    return recentNotifications.length < maxPerHour;
  }
}

// Example usage
async function demonstrateNotificationSystem() {
  console.log('=== Design Notification System ===\n');

  const notifications = new NotificationSystem();

  // Create user
  const user = notifications.createUser('user1', 'alice@example.com', '+1234567890');

  // Set preferences
  notifications.setUserPreferences('user1', {
    push: true,
    email: true,
    sms: true
  });

  // Create template
  notifications.createTemplate(
    'welcome',
    'email',
    'Welcome {{name}}!',
    'Hello {{name}}, welcome to our platform!'
  );

  // Send notification
  await notifications.sendNotification('user1', 'push', 'New message', 'You have a new message');
  await notifications.sendNotification('user1', 'email', 'Account update', 'Your account has been updated');
  await notifications.sendNotification('user1', 'sms', 'Alert', 'Your order has been shipped');

  // Send with template
  await notifications.sendWithTemplate('user1', 'welcome', { name: 'Alice' });

  // Get notifications
  const userNotifications = notifications.getUserNotifications('user1');
  console.log('User notifications:', userNotifications.length);

  // Get stats
  const stats = notifications.getDeliveryStats();
  console.log('Delivery stats:', stats);
}

if (require.main === module) {
  demonstrateNotificationSystem();
}

module.exports = { NotificationSystem };

