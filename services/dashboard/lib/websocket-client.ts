/**
 * WebSocket Client for real-time dashboard updates
 * Connects to backend services via WebSocket for live data streaming
 */

import { EventEmitter } from 'events';

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface WebSocketMessage {
  type: 'metrics' | 'recommendations' | 'activity' | 'system' | 'competitor';
  data: any;
  timestamp: string;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isIntentionallyClosed = false;

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isIntentionallyClosed = false;
    
    try {
      // Only connect if in browser environment
      if (typeof window === 'undefined') {
        return;
      }
      
      this.ws = new WebSocket(this.config.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      // Silently fail and try to reconnect later
      this.scheduleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.emit('connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();

      // Subscribe to all event streams
      this.send({
        type: 'subscribe',
        streams: [
          'metrics.calculated',
          'recommendations.ready',
          'automation.status',
          'system.health'
        ]
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Don't emit error event if no listeners are attached
      if (this.listenerCount('error') > 0) {
        this.emit('error', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.emit('disconnected');
      this.stopHeartbeat();

      if (!this.isIntentionallyClosed) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    // Emit specific event based on message type
    this.emit(message.type, message.data);

    // Also emit a general message event
    this.emit('message', message);

    // Handle specific message types
    switch (message.type) {
      case 'metrics':
        this.handleMetricsUpdate(message.data);
        break;
      case 'recommendations':
        this.handleRecommendationsUpdate(message.data);
        break;
      case 'activity':
        this.handleActivityUpdate(message.data);
        break;
      case 'system':
        this.handleSystemUpdate(message.data);
        break;
      case 'competitor':
        this.handleCompetitorUpdate(message.data);
        break;
    }
  }

  /**
   * Handle metrics updates
   */
  private handleMetricsUpdate(data: any): void {
    // Update global state or cache
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('metrics-update', { detail: data }));
    }
  }

  /**
   * Handle recommendations updates
   */
  private handleRecommendationsUpdate(data: any): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('recommendations-update', { detail: data }));
    }
  }

  /**
   * Handle activity updates
   */
  private handleActivityUpdate(data: any): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('activity-update', { detail: data }));
    }
  }

  /**
   * Handle system updates
   */
  private handleSystemUpdate(data: any): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('system-update', { detail: data }));
    }
  }

  /**
   * Handle competitor updates
   */
  private handleCompetitorUpdate(data: any): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('competitor-update', { detail: data }));
    }
  }

  /**
   * Send message through WebSocket
   */
  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected. Queuing message...');
      // Could implement a message queue here for retry
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max-reconnect-reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.min(this.reconnectAttempts, 5);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get WebSocket readyState
   */
  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

/**
 * Initialize WebSocket client
 */
export function initWebSocket(url?: string): WebSocketClient {
  if (!wsClient) {
    const wsUrl = url || process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    wsClient = new WebSocketClient({ url: wsUrl });
    
    // Auto-connect if in browser
    if (typeof window !== 'undefined') {
      wsClient.connect();

      // Reconnect on page visibility change
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !wsClient?.isConnected()) {
          wsClient?.connect();
        }
      });

      // Cleanup on page unload
      window.addEventListener('beforeunload', () => {
        wsClient?.disconnect();
      });
    }
  }
  
  return wsClient;
}

/**
 * Get WebSocket client instance
 */
export function getWebSocketClient(): WebSocketClient | null {
  return wsClient;
}

/**
 * React Hook for WebSocket
 */
export function useWebSocket() {
  if (typeof window === 'undefined') {
    return null;
  }
  
  return initWebSocket();
}