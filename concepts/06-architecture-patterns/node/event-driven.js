/**
 * Event-Driven Architecture Implementation
 * Demonstrates event publishing, subscribing, and event sourcing
 */

/**
 * Event Bus
 */
class EventBus {
  constructor() {
    this.subscribers = new Map();
    this.eventHistory = [];
    this.maxHistory = 1000;
  }

  /**
   * Subscribe to event type
   */
  subscribe(eventType, handler, options = {}) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }

    const subscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      handler,
      once: options.once || false,
      priority: options.priority || 0
    };

    this.subscribers.get(eventType).push(subscription);
    
    // Sort by priority (higher first)
    this.subscribers.get(eventType).sort((a, b) => b.priority - a.priority);

    return subscription.id;
  }

  /**
   * Unsubscribe
   */
  unsubscribe(eventType, subscriptionId) {
    const subscribers = this.subscribers.get(eventType);
    if (!subscribers) return false;

    const index = subscribers.findIndex(s => s.id === subscriptionId);
    if (index > -1) {
      subscribers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Publish event
   */
  async publish(eventType, eventData, metadata = {}) {
    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      data: eventData,
      metadata: {
        timestamp: Date.now(),
        ...metadata
      }
    };

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    // Notify subscribers
    const subscribers = this.subscribers.get(eventType) || [];
    const results = [];

    for (const subscription of subscribers) {
      try {
        const result = await subscription.handler(event);
        results.push({ subscriptionId: subscription.id, result });

        // Remove if one-time subscription
        if (subscription.once) {
          this.unsubscribe(eventType, subscription.id);
        }
      } catch (error) {
        console.error(`Error in subscriber ${subscription.id}:`, error);
        results.push({ subscriptionId: subscription.id, error: error.message });
      }
    }

    return { event, results };
  }

  /**
   * Get event history
   */
  getEventHistory(eventType = null, limit = 100) {
    let history = this.eventHistory;
    
    if (eventType) {
      history = history.filter(e => e.type === eventType);
    }

    return history.slice(-limit);
  }
}

/**
 * Event Store (Event Sourcing)
 */
class EventStore {
  constructor() {
    this.events = [];
    this.snapshots = new Map();
  }

  /**
   * Append event
   */
  appendEvent(aggregateId, eventType, eventData) {
    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      aggregateId,
      type: eventType,
      data: eventData,
      timestamp: Date.now(),
      version: this.getNextVersion(aggregateId)
    };

    this.events.push(event);
    return event;
  }

  /**
   * Get events for aggregate
   */
  getEvents(aggregateId, fromVersion = 0) {
    return this.events.filter(
      e => e.aggregateId === aggregateId && e.version >= fromVersion
    );
  }

  /**
   * Save snapshot
   */
  saveSnapshot(aggregateId, snapshot) {
    this.snapshots.set(aggregateId, {
      ...snapshot,
      version: this.getCurrentVersion(aggregateId),
      timestamp: Date.now()
    });
  }

  /**
   * Get snapshot
   */
  getSnapshot(aggregateId) {
    return this.snapshots.get(aggregateId) || null;
  }

  /**
   * Get next version for aggregate
   */
  getNextVersion(aggregateId) {
    const events = this.getEvents(aggregateId);
    return events.length;
  }

  /**
   * Get current version for aggregate
   */
  getCurrentVersion(aggregateId) {
    return this.getNextVersion(aggregateId) - 1;
  }
}

/**
 * Event-Driven Service
 */
class EventDrivenService {
  constructor(eventBus, serviceName) {
    this.eventBus = eventBus;
    this.serviceName = serviceName;
    this.subscriptions = [];
  }

  /**
   * Subscribe to events
   */
  subscribe(eventType, handler) {
    const subscriptionId = this.eventBus.subscribe(eventType, handler);
    this.subscriptions.push({ eventType, subscriptionId });
    return subscriptionId;
  }

  /**
   * Publish event
   */
  async publish(eventType, eventData) {
    return await this.eventBus.publish(eventType, eventData, {
      service: this.serviceName
    });
  }

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    for (const sub of this.subscriptions) {
      this.eventBus.unsubscribe(sub.eventType, sub.subscriptionId);
    }
    this.subscriptions = [];
  }
}

/**
 * Order Service (Event-Driven)
 */
class OrderService extends EventDrivenService {
  constructor(eventBus) {
    super(eventBus, 'OrderService');
    this.orders = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Subscribe to payment completed events
    this.subscribe('payment.completed', async (event) => {
      const order = this.orders.get(event.data.orderId);
      if (order) {
        order.status = 'paid';
        await this.publish('order.paid', {
          orderId: order.id,
          userId: order.userId
        });
      }
    });

    // Subscribe to inventory reserved events
    this.subscribe('inventory.reserved', async (event) => {
      const order = this.orders.get(event.data.orderId);
      if (order) {
        order.status = 'confirmed';
        await this.publish('order.confirmed', {
          orderId: order.id
        });
      }
    });
  }

  async createOrder(data) {
    const order = {
      id: Date.now().toString(),
      userId: data.userId,
      items: data.items,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    this.orders.set(order.id, order);

    // Publish order created event
    await this.publish('order.created', {
      orderId: order.id,
      userId: order.userId,
      items: order.items
    });

    return order;
  }
}

/**
 * Payment Service (Event-Driven)
 */
class PaymentService extends EventDrivenService {
  constructor(eventBus) {
    super(eventBus, 'PaymentService');
    this.payments = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Subscribe to order created events
    this.subscribe('order.created', async (event) => {
      await this.processPayment(event.data);
    });
  }

  async processPayment(data) {
    const payment = {
      id: Date.now().toString(),
      orderId: data.orderId,
      amount: data.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      status: 'processing'
    };

    this.payments.set(payment.id, payment);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 100));

    payment.status = 'completed';

    // Publish payment completed event
    await this.publish('payment.completed', {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount
    });

    return payment;
  }
}

/**
 * Inventory Service (Event-Driven)
 */
class InventoryService extends EventDrivenService {
  constructor(eventBus) {
    super(eventBus, 'InventoryService');
    this.inventory = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Subscribe to order created events
    this.subscribe('order.created', async (event) => {
      await this.reserveInventory(event.data);
    });
  }

  async reserveInventory(data) {
    // Check and reserve inventory
    for (const item of data.items) {
      const currentStock = this.inventory.get(item.productId) || 0;
      if (currentStock >= item.quantity) {
        this.inventory.set(item.productId, currentStock - item.quantity);
      } else {
        throw new Error(`Insufficient inventory for product ${item.productId}`);
      }
    }

    // Publish inventory reserved event
    await this.publish('inventory.reserved', {
      orderId: data.orderId,
      items: data.items
    });
  }
}

/**
 * Notification Service (Event-Driven)
 */
class NotificationService extends EventDrivenService {
  constructor(eventBus) {
    super(eventBus, 'NotificationService');
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Subscribe to order events
    this.subscribe('order.confirmed', async (event) => {
      await this.sendOrderConfirmation(event.data.orderId);
    });

    this.subscribe('order.paid', async (event) => {
      await this.sendPaymentConfirmation(event.data.orderId, event.data.userId);
    });
  }

  async sendOrderConfirmation(orderId) {
    console.log(`Sending order confirmation for order ${orderId}`);
    return { sent: true, orderId };
  }

  async sendPaymentConfirmation(orderId, userId) {
    console.log(`Sending payment confirmation for order ${orderId} to user ${userId}`);
    return { sent: true, orderId, userId };
  }
}

/**
 * Event Sourcing Aggregate
 */
class OrderAggregate {
  constructor(aggregateId, eventStore) {
    this.aggregateId = aggregateId;
    this.eventStore = eventStore;
    this.state = {
      id: aggregateId,
      userId: null,
      items: [],
      status: 'pending',
      version: 0
    };
  }

  /**
   * Replay events to rebuild state
   */
  replayEvents() {
    const snapshot = this.eventStore.getSnapshot(this.aggregateId);
    let fromVersion = 0;

    if (snapshot) {
      this.state = { ...snapshot };
      fromVersion = snapshot.version + 1;
    }

    const events = this.eventStore.getEvents(this.aggregateId, fromVersion);
    
    for (const event of events) {
      this.applyEvent(event);
    }
  }

  /**
   * Apply event to state
   */
  applyEvent(event) {
    switch (event.type) {
      case 'order.created':
        this.state.userId = event.data.userId;
        this.state.items = event.data.items;
        this.state.status = 'pending';
        break;
      case 'order.confirmed':
        this.state.status = 'confirmed';
        break;
      case 'order.paid':
        this.state.status = 'paid';
        break;
    }
    this.state.version = event.version;
  }

  /**
   * Create order (command)
   */
  createOrder(userId, items) {
    const event = this.eventStore.appendEvent(
      this.aggregateId,
      'order.created',
      { userId, items }
    );
    this.applyEvent(event);
    return event;
  }

  /**
   * Confirm order (command)
   */
  confirmOrder() {
    const event = this.eventStore.appendEvent(
      this.aggregateId,
      'order.confirmed',
      {}
    );
    this.applyEvent(event);
    return event;
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }
}

// Example usage
async function demonstrateEventDriven() {
  console.log('=== Event-Driven Architecture ===\n');

  // Create event bus
  const eventBus = new EventBus();

  // Create services
  const orderService = new OrderService(eventBus);
  const paymentService = new PaymentService(eventBus);
  const inventoryService = new InventoryService(eventBus);
  const notificationService = new NotificationService(eventBus);

  // Create order (triggers chain of events)
  console.log('=== Creating Order (Event Chain) ===\n');
  const order = await orderService.createOrder({
    userId: 'user123',
    items: [
      { productId: 'prod1', quantity: 2, price: 10 },
      { productId: 'prod2', quantity: 1, price: 20 }
    ]
  });
  console.log('Order created:', order);

  // Wait for events to process
  await new Promise(resolve => setTimeout(resolve, 500));

  // Event history
  console.log('\n=== Event History ===\n');
  const history = eventBus.getEventHistory();
  console.log('Recent events:', history.slice(-5).map(e => ({
    type: e.type,
    timestamp: new Date(e.metadata.timestamp).toISOString()
  })));

  // Event Sourcing
  console.log('\n=== Event Sourcing ===\n');
  const eventStore = new EventStore();
  const orderAggregate = new OrderAggregate('order-123', eventStore);

  // Create order through events
  orderAggregate.createOrder('user456', [
    { productId: 'prod1', quantity: 1, price: 10 }
  ]);

  orderAggregate.confirmOrder();

  // Replay events
  const newAggregate = new OrderAggregate('order-123', eventStore);
  newAggregate.replayEvents();
  console.log('Aggregate state after replay:', newAggregate.getState());
}

if (require.main === module) {
  demonstrateEventDriven();
}

module.exports = {
  EventBus,
  EventStore,
  EventDrivenService,
  OrderService,
  PaymentService,
  InventoryService,
  NotificationService,
  OrderAggregate
};

