/**
 * WebSocket Implementation
 * Demonstrates real-time bidirectional communication
 */

/**
 * WebSocket Server
 */
class WebSocketServer {
  constructor() {
    this.clients = new Map();
    this.rooms = new Map();
    this.messageHandlers = new Map();
  }

  /**
   * Handle new connection
   */
  handleConnection(clientId, socket) {
    const client = {
      id: clientId,
      socket,
      rooms: new Set(),
      connectedAt: Date.now()
    };

    this.clients.set(clientId, client);
    console.log(`Client ${clientId} connected`);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'welcome',
      message: 'Connected to WebSocket server'
    });

    return client;
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      // Leave all rooms
      for (const room of client.rooms) {
        this.leaveRoom(clientId, room);
      }

      this.clients.delete(clientId);
      console.log(`Client ${clientId} disconnected`);
    }
  }

  /**
   * Handle message
   */
  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message;

      // Route message based on type
      const handler = this.messageHandlers.get(data.type);
      if (handler) {
        handler(client, data);
      } else {
        // Default: echo message
        this.sendToClient(clientId, {
          type: 'echo',
          original: data
        });
      }
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message
      });
    }
  }

  /**
   * Register message handler
   */
  on(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Send message to client
   */
  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client) {
      // Simulate sending
      console.log(`Sending to ${clientId}:`, data);
      return true;
    }
    return false;
  }

  /**
   * Broadcast to all clients
   */
  broadcast(data, excludeClientId = null) {
    let count = 0;
    for (const [clientId, client] of this.clients.entries()) {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, data);
        count++;
      }
    }
    return count;
  }

  /**
   * Join room
   */
  joinRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.rooms.add(roomName);

    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }

    this.rooms.get(roomName).add(clientId);

    // Notify others in room
    this.broadcastToRoom(roomName, {
      type: 'user_joined',
      clientId,
      room: roomName
    }, clientId);

    return true;
  }

  /**
   * Leave room
   */
  leaveRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.rooms.delete(roomName);

    const room = this.rooms.get(roomName);
    if (room) {
      room.delete(clientId);
      if (room.size === 0) {
        this.rooms.delete(roomName);
      }
    }

    // Notify others in room
    this.broadcastToRoom(roomName, {
      type: 'user_left',
      clientId,
      room: roomName
    });

    return true;
  }

  /**
   * Broadcast to room
   */
  broadcastToRoom(roomName, data, excludeClientId = null) {
    const room = this.rooms.get(roomName);
    if (!room) {
      return 0;
    }

    let count = 0;
    for (const clientId of room) {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, data);
        count++;
      }
    }
    return count;
  }

  /**
   * Get room clients
   */
  getRoomClients(roomName) {
    const room = this.rooms.get(roomName);
    return room ? Array.from(room) : [];
  }

  /**
   * Get server stats
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      totalRooms: this.rooms.size,
      rooms: Array.from(this.rooms.entries()).map(([name, clients]) => ({
        name,
        clientCount: clients.size
      }))
    };
  }
}

/**
 * WebSocket Client
 */
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.connected = false;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Connect
   */
  async connect() {
    try {
      // Simulate connection
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log(`Connected to ${this.url}`);
      
      // Simulate receiving welcome message
      this.handleMessage({
        type: 'welcome',
        message: 'Connected'
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Disconnect
   */
  disconnect() {
    this.connected = false;
    console.log('Disconnected');
  }

  /**
   * Send message
   */
  send(data) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data);
    console.log('Sending:', message);
    return true;
  }

  /**
   * Handle incoming message
   */
  handleMessage(message) {
    const data = typeof message === 'string' ? JSON.parse(message) : message;
    
    const handler = this.messageHandlers.get(data.type);
    if (handler) {
      handler(data);
    }
  }

  /**
   * Register message handler
   */
  on(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Handle error
   */
  handleError(error) {
    console.error('WebSocket error:', error.message);
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
    }
  }
}

/**
 * Real-time Chat Example
 */
class ChatServer {
  constructor(wsServer) {
    this.wsServer = wsServer;
    this.setupHandlers();
  }

  setupHandlers() {
    // Handle join chat room
    this.wsServer.on('join_chat', (client, data) => {
      const roomName = data.room || 'general';
      this.wsServer.joinRoom(client.id, roomName);
      
      this.wsServer.sendToClient(client.id, {
        type: 'joined_chat',
        room: roomName
      });
    });

    // Handle chat message
    this.wsServer.on('chat_message', (client, data) => {
      const roomName = data.room || 'general';
      
      this.wsServer.broadcastToRoom(roomName, {
        type: 'chat_message',
        clientId: client.id,
        message: data.message,
        timestamp: Date.now()
      }, client.id);
    });

    // Handle leave chat
    this.wsServer.on('leave_chat', (client, data) => {
      const roomName = data.room || 'general';
      this.wsServer.leaveRoom(client.id, roomName);
    });
  }
}

/**
 * Real-time Notifications Example
 */
class NotificationServer {
  constructor(wsServer) {
    this.wsServer = wsServer;
    this.setupHandlers();
  }

  setupHandlers() {
    // Handle subscribe to notifications
    this.wsServer.on('subscribe', (client, data) => {
      const channel = data.channel || 'all';
      this.wsServer.joinRoom(client.id, `notifications:${channel}`);
    });

    // Send notification
    sendNotification(channel, notification) {
      this.wsServer.broadcastToRoom(`notifications:${channel}`, {
        type: 'notification',
        ...notification,
        timestamp: Date.now()
      });
    }
  }
}

// Example usage
function demonstrateWebSocket() {
  console.log('=== WebSocket Implementation ===\n');

  const server = new WebSocketServer();

  // Handle connections
  const client1 = server.handleConnection('client1', {});
  const client2 = server.handleConnection('client2', {});
  const client3 = server.handleConnection('client3', {});

  // Join rooms
  server.joinRoom('client1', 'room1');
  server.joinRoom('client2', 'room1');
  server.joinRoom('client3', 'room2');

  // Broadcast to room
  server.broadcastToRoom('room1', {
    type: 'message',
    text: 'Hello room1!'
  });

  // Broadcast to all
  server.broadcast({
    type: 'announcement',
    text: 'Server maintenance in 5 minutes'
  });

  // Chat server
  console.log('\n=== Chat Server ===\n');
  const chatServer = new ChatServer(server);

  server.handleMessage('client1', JSON.stringify({
    type: 'join_chat',
    room: 'general'
  }));

  server.handleMessage('client1', JSON.stringify({
    type: 'chat_message',
    room: 'general',
    message: 'Hello everyone!'
  }));

  // WebSocket Client
  console.log('\n=== WebSocket Client ===\n');
  const client = new WebSocketClient('ws://localhost:3000');
  
  client.on('message', (data) => {
    console.log('Received message:', data);
  });

  client.connect();
  client.send({ type: 'chat_message', message: 'Hello!' });

  // Server stats
  console.log('\nServer Stats:', server.getStats());
}

if (require.main === module) {
  demonstrateWebSocket();
}

module.exports = {
  WebSocketServer,
  WebSocketClient,
  ChatServer,
  NotificationServer
};

