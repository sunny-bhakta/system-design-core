/**
 * Message Queue Implementation
 * Demonstrates pub/sub and point-to-point messaging
 */

/**
 * Message Queue
 */
class MessageQueue {
  constructor(name) {
    this.name = name;
    this.messages = [];
    this.subscribers = [];
    this.maxSize = 1000;
  }

  /**
   * Publish message
   */
  publish(message) {
    if (this.messages.length >= this.maxSize) {
      this.messages.shift(); // Remove oldest
    }

    const msg = {
      id: `msg-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      data: message
    };

    this.messages.push(msg);

    // Notify subscribers
    this.notifySubscribers(msg);

    return msg;
  }

  /**
   * Subscribe to messages
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify subscribers
   */
  notifySubscribers(message) {
    this.subscribers.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Subscriber error:', error);
      }
    });
  }

  /**
   * Get messages
   */
  getMessages(limit = null) {
    if (limit) {
      return this.messages.slice(-limit);
    }
    return [...this.messages];
  }

  /**
   * Clear messages
   */
  clear() {
    this.messages = [];
  }
}

/**
 * Pub/Sub System
 */
class PubSubSystem {
  constructor() {
    this.topics = new Map();
  }

  /**
   * Create or get topic
   */
  getTopic(topicName) {
    if (!this.topics.has(topicName)) {
      this.topics.set(topicName, new MessageQueue(topicName));
    }
    return this.topics.get(topicName);
  }

  /**
   * Publish to topic
   */
  publish(topicName, message) {
    const topic = this.getTopic(topicName);
    return topic.publish(message);
  }

  /**
   * Subscribe to topic
   */
  subscribe(topicName, callback) {
    const topic = this.getTopic(topicName);
    return topic.subscribe(callback);
  }

  /**
   * List topics
   */
  listTopics() {
    return Array.from(this.topics.keys());
  }
}

/**
 * Point-to-Point Queue
 */
class PointToPointQueue {
  constructor(name) {
    this.name = name;
    this.queue = [];
    this.consumers = [];
    this.maxSize = 1000;
    this.processing = false;
  }

  /**
   * Send message
   */
  send(message) {
    if (this.queue.length >= this.maxSize) {
      throw new Error('Queue is full');
    }

    const msg = {
      id: `msg-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      data: message,
      attempts: 0
    };

    this.queue.push(msg);
    this.processQueue();

    return msg;
  }

  /**
   * Register consumer
   */
  registerConsumer(callback) {
    this.consumers.push(callback);
    this.processQueue();
  }

  /**
   * Process queue
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0 || this.consumers.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.consumers.length > 0) {
      const message = this.queue.shift();
      const consumer = this.consumers[0]; // Round-robin

      try {
        await consumer(message);
        console.log(`Message ${message.id} processed successfully`);
      } catch (error) {
        console.error(`Message ${message.id} processing failed:`, error);
        message.attempts++;
        
        // Retry if attempts < 3
        if (message.attempts < 3) {
          this.queue.push(message);
        } else {
          console.error(`Message ${message.id} failed after ${message.attempts} attempts`);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Get queue size
   */
  getSize() {
    return this.queue.length;
  }
}

// Example usage
async function demonstrateMessageQueues() {
  console.log('=== Pub/Sub System ===\n');

  const pubsub = new PubSubSystem();

  // Subscribe to topic
  pubsub.subscribe('user-events', (message) => {
    console.log('Subscriber 1 received:', message);
  });

  pubsub.subscribe('user-events', (message) => {
    console.log('Subscriber 2 received:', message);
  });

  // Publish messages
  pubsub.publish('user-events', { type: 'user-created', userId: '123' });
  pubsub.publish('user-events', { type: 'user-updated', userId: '123' });

  console.log('\n=== Point-to-Point Queue ===\n');

  const queue = new PointToPointQueue('task-queue');

  // Register consumer
  queue.registerConsumer(async (message) => {
    console.log('Processing message:', message.id);
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('Message processed:', message.id);
  });

  // Send messages
  queue.send({ task: 'task1', priority: 'high' });
  queue.send({ task: 'task2', priority: 'medium' });
  queue.send({ task: 'task3', priority: 'low' });

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Queue size:', queue.getSize());
}

if (require.main === module) {
  demonstrateMessageQueues();
}

module.exports = { MessageQueue, PubSubSystem, PointToPointQueue };

