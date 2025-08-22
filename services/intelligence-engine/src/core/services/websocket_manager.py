"""
Real-time WebSocket Manager for AI Visibility Audit
Provides live updates, progress tracking, and collaborative features
"""

import json
import asyncio
from typing import Dict, List, Set, Any, Optional, Callable
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
import logging
from asyncio import Queue
import redis.asyncio as aioredis
from aiohttp import web
import aiohttp_cors
from aiohttp import WSMsgType
import weakref

logger = logging.getLogger(__name__)


class EventType(Enum):
    """WebSocket event types"""
    # Audit lifecycle
    AUDIT_STARTED = "audit.started"
    AUDIT_PROGRESS = "audit.progress"
    AUDIT_COMPLETED = "audit.completed"
    AUDIT_FAILED = "audit.failed"
    
    # Query processing
    QUERY_GENERATED = "query.generated"
    QUERY_EXECUTING = "query.executing"
    QUERY_COMPLETED = "query.completed"
    
    # LLM responses
    LLM_RESPONSE_RECEIVED = "llm.response_received"
    LLM_PROVIDER_STATUS = "llm.provider_status"
    
    # Analysis updates
    ANALYSIS_STARTED = "analysis.started"
    ANALYSIS_COMPLETED = "analysis.completed"
    SCORE_UPDATED = "score.updated"
    
    # Real-time insights
    INSIGHT_DISCOVERED = "insight.discovered"
    COMPETITOR_ALERT = "competitor.alert"
    
    # System events
    CACHE_HIT = "system.cache_hit"
    ERROR_OCCURRED = "system.error"
    
    # Collaborative features
    USER_JOINED = "collaboration.user_joined"
    USER_LEFT = "collaboration.user_left"
    USER_CURSOR = "collaboration.cursor"
    USER_SELECTION = "collaboration.selection"


@dataclass
class WebSocketMessage:
    """Structured WebSocket message"""
    event_type: EventType
    audit_id: str
    data: Dict[str, Any]
    timestamp: datetime = None
    user_id: Optional[str] = None
    correlation_id: Optional[str] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()
        if self.correlation_id is None:
            self.correlation_id = str(uuid.uuid4())[:12]
    
    def to_json(self) -> str:
        """Convert to JSON for transmission"""
        return json.dumps({
            'event': self.event_type.value,
            'audit_id': self.audit_id,
            'data': self.data,
            'timestamp': self.timestamp.isoformat(),
            'user_id': self.user_id,
            'correlation_id': self.correlation_id
        })


@dataclass
class ClientConnection:
    """WebSocket client connection"""
    ws: web.WebSocketResponse
    client_id: str
    user_id: str
    audit_ids: Set[str]
    joined_at: datetime
    last_ping: datetime
    metadata: Dict[str, Any]


class AuditProgressTracker:
    """Track and broadcast audit progress"""
    
    def __init__(self):
        self.audits: Dict[str, Dict[str, Any]] = {}
        self.query_progress: Dict[str, Dict[str, int]] = {}
    
    def start_audit(self, audit_id: str, total_queries: int, total_providers: int):
        """Initialize audit tracking"""
        self.audits[audit_id] = {
            'total_queries': total_queries,
            'total_providers': total_providers,
            'total_operations': total_queries * total_providers,
            'completed_operations': 0,
            'started_at': datetime.now(),
            'phase': 'query_generation',
            'errors': []
        }
        
        self.query_progress[audit_id] = {
            'generated': 0,
            'executing': 0,
            'completed': 0,
            'failed': 0
        }
    
    def update_progress(self, audit_id: str, operation: str, increment: int = 1) -> Dict[str, Any]:
        """Update and return progress percentage"""
        if audit_id not in self.audits:
            return {}
        
        audit = self.audits[audit_id]
        audit['completed_operations'] += increment
        
        progress_percentage = (
            audit['completed_operations'] / audit['total_operations'] * 100
        )
        
        # Update phase based on progress
        if progress_percentage < 10:
            audit['phase'] = 'query_generation'
        elif progress_percentage < 60:
            audit['phase'] = 'llm_execution'
        elif progress_percentage < 90:
            audit['phase'] = 'response_analysis'
        else:
            audit['phase'] = 'finalizing'
        
        return {
            'percentage': round(progress_percentage, 2),
            'phase': audit['phase'],
            'completed_operations': audit['completed_operations'],
            'total_operations': audit['total_operations'],
            'elapsed_seconds': (datetime.now() - audit['started_at']).total_seconds(),
            'estimated_remaining': self._estimate_remaining_time(audit_id)
        }
    
    def _estimate_remaining_time(self, audit_id: str) -> Optional[float]:
        """Estimate remaining time based on current progress rate"""
        audit = self.audits.get(audit_id)
        if not audit or audit['completed_operations'] == 0:
            return None
        
        elapsed = (datetime.now() - audit['started_at']).total_seconds()
        rate = audit['completed_operations'] / elapsed
        remaining_ops = audit['total_operations'] - audit['completed_operations']
        
        return remaining_ops / rate if rate > 0 else None


class WebSocketManager:
    """Manage WebSocket connections and real-time updates"""
    
    def __init__(
        self,
        redis_client: Optional[aioredis.Redis] = None,
        port: int = 8080
    ):
        self.app = web.Application()
        self.port = port
        self.redis = redis_client
        
        # Connection management
        self.connections: Dict[str, ClientConnection] = {}
        self.audit_subscribers: Dict[str, Set[str]] = {}  # audit_id -> client_ids
        
        # Progress tracking
        self.progress_tracker = AuditProgressTracker()
        
        # Message queue for broadcasting
        self.broadcast_queue: Queue = Queue()
        
        # Weak references for cleanup
        self._websockets = weakref.WeakSet()
        
        # Setup routes
        self._setup_routes()
        
        # Setup CORS
        self._setup_cors()
    
    def _setup_routes(self):
        """Setup WebSocket and HTTP routes"""
        self.app.router.add_get('/ws', self.websocket_handler)
        self.app.router.add_get('/health', self.health_check)
        self.app.router.add_get('/audit/{audit_id}/status', self.get_audit_status)
        self.app.router.add_post('/audit/{audit_id}/subscribe', self.subscribe_to_audit)
    
    def _setup_cors(self):
        """Setup CORS for cross-origin requests"""
        cors = aiohttp_cors.setup(self.app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*"
            )
        })
        
        for route in list(self.app.router.routes()):
            cors.add(route)
    
    # =====================================================
    # WebSocket Handlers
    # =====================================================
    
    async def websocket_handler(self, request):
        """Handle WebSocket connections"""
        ws = web.WebSocketResponse(heartbeat=30)
        await ws.prepare(request)
        
        # Generate client ID
        client_id = str(uuid.uuid4())
        user_id = request.headers.get('X-User-Id', 'anonymous')
        
        # Create client connection
        client = ClientConnection(
            ws=ws,
            client_id=client_id,
            user_id=user_id,
            audit_ids=set(),
            joined_at=datetime.now(),
            last_ping=datetime.now(),
            metadata={'ip': request.remote, 'user_agent': request.headers.get('User-Agent')}
        )
        
        self.connections[client_id] = client
        self._websockets.add(ws)
        
        # Send welcome message
        await self._send_to_client(client, WebSocketMessage(
            event_type=EventType.USER_JOINED,
            audit_id="system",
            data={'client_id': client_id, 'user_id': user_id}
        ))
        
        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    await self._handle_client_message(client, msg.data)
                elif msg.type == WSMsgType.ERROR:
                    logger.error(f'WebSocket error for {client_id}: {ws.exception()}')
                elif msg.type == WSMsgType.CLOSE:
                    break
        finally:
            # Cleanup on disconnect
            await self._cleanup_client(client_id)
        
        return ws
    
    async def _handle_client_message(self, client: ClientConnection, message: str):
        """Handle incoming client messages"""
        try:
            data = json.loads(message)
            action = data.get('action')
            
            if action == 'subscribe':
                audit_id = data.get('audit_id')
                if audit_id:
                    await self._subscribe_client_to_audit(client.client_id, audit_id)
            
            elif action == 'unsubscribe':
                audit_id = data.get('audit_id')
                if audit_id:
                    await self._unsubscribe_client_from_audit(client.client_id, audit_id)
            
            elif action == 'ping':
                client.last_ping = datetime.now()
                await self._send_to_client(client, WebSocketMessage(
                    event_type=EventType.CACHE_HIT,
                    audit_id="system",
                    data={'type': 'pong', 'timestamp': datetime.now().isoformat()}
                ))
            
            elif action == 'cursor':
                # Collaborative cursor position
                await self._broadcast_cursor_position(client, data)
            
            elif action == 'selection':
                # Collaborative selection
                await self._broadcast_selection(client, data)
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from client {client.client_id}: {message}")
        except Exception as e:
            logger.error(f"Error handling message from {client.client_id}: {e}")
    
    async def _cleanup_client(self, client_id: str):
        """Clean up disconnected client"""
        if client_id not in self.connections:
            return
        
        client = self.connections[client_id]
        
        # Remove from audit subscriptions
        for audit_id in client.audit_ids:
            if audit_id in self.audit_subscribers:
                self.audit_subscribers[audit_id].discard(client_id)
        
        # Notify other users in same audits
        for audit_id in client.audit_ids:
            await self.broadcast_to_audit(
                audit_id,
                EventType.USER_LEFT,
                {'user_id': client.user_id, 'client_id': client_id}
            )
        
        del self.connections[client_id]
        logger.info(f"Client {client_id} disconnected")
    
    # =====================================================
    # Subscription Management
    # =====================================================
    
    async def _subscribe_client_to_audit(self, client_id: str, audit_id: str):
        """Subscribe client to audit updates"""
        if client_id not in self.connections:
            return
        
        client = self.connections[client_id]
        client.audit_ids.add(audit_id)
        
        if audit_id not in self.audit_subscribers:
            self.audit_subscribers[audit_id] = set()
        
        self.audit_subscribers[audit_id].add(client_id)
        
        # Send current audit status
        if audit_id in self.progress_tracker.audits:
            progress = self.progress_tracker.update_progress(audit_id, 'check', 0)
            await self._send_to_client(client, WebSocketMessage(
                event_type=EventType.AUDIT_PROGRESS,
                audit_id=audit_id,
                data=progress
            ))
        
        logger.info(f"Client {client_id} subscribed to audit {audit_id}")
    
    async def _unsubscribe_client_from_audit(self, client_id: str, audit_id: str):
        """Unsubscribe client from audit updates"""
        if client_id not in self.connections:
            return
        
        client = self.connections[client_id]
        client.audit_ids.discard(audit_id)
        
        if audit_id in self.audit_subscribers:
            self.audit_subscribers[audit_id].discard(client_id)
        
        logger.info(f"Client {client_id} unsubscribed from audit {audit_id}")
    
    # =====================================================
    # Broadcasting
    # =====================================================
    
    async def broadcast_to_audit(
        self,
        audit_id: str,
        event_type: EventType,
        data: Dict[str, Any],
        user_id: Optional[str] = None
    ):
        """Broadcast message to all clients subscribed to an audit"""
        
        message = WebSocketMessage(
            event_type=event_type,
            audit_id=audit_id,
            data=data,
            user_id=user_id
        )
        
        if audit_id not in self.audit_subscribers:
            return
        
        # Send to all subscribed clients
        tasks = []
        for client_id in self.audit_subscribers[audit_id]:
            if client_id in self.connections:
                client = self.connections[client_id]
                tasks.append(self._send_to_client(client, message))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _send_to_client(self, client: ClientConnection, message: WebSocketMessage):
        """Send message to specific client"""
        try:
            await client.ws.send_str(message.to_json())
        except Exception as e:
            logger.error(f"Error sending to client {client.client_id}: {e}")
    
    async def broadcast_progress(
        self,
        audit_id: str,
        operation: str,
        increment: int = 1
    ):
        """Broadcast progress update"""
        progress = self.progress_tracker.update_progress(audit_id, operation, increment)
        
        await self.broadcast_to_audit(
            audit_id,
            EventType.AUDIT_PROGRESS,
            progress
        )
    
    # =====================================================
    # Collaborative Features
    # =====================================================
    
    async def _broadcast_cursor_position(self, client: ClientConnection, data: Dict):
        """Broadcast cursor position for collaboration"""
        for audit_id in client.audit_ids:
            await self.broadcast_to_audit(
                audit_id,
                EventType.USER_CURSOR,
                {
                    'user_id': client.user_id,
                    'client_id': client.client_id,
                    'position': data.get('position'),
                    'element': data.get('element')
                },
                user_id=client.user_id
            )
    
    async def _broadcast_selection(self, client: ClientConnection, data: Dict):
        """Broadcast selection for collaboration"""
        for audit_id in client.audit_ids:
            await self.broadcast_to_audit(
                audit_id,
                EventType.USER_SELECTION,
                {
                    'user_id': client.user_id,
                    'client_id': client.client_id,
                    'selection': data.get('selection')
                },
                user_id=client.user_id
            )
    
    # =====================================================
    # HTTP Endpoints
    # =====================================================
    
    async def health_check(self, request):
        """Health check endpoint"""
        return web.json_response({
            'status': 'healthy',
            'connections': len(self.connections),
            'active_audits': len(self.audit_subscribers),
            'uptime': (datetime.now() - self.app['start_time']).total_seconds()
        })
    
    async def get_audit_status(self, request):
        """Get current audit status"""
        audit_id = request.match_info['audit_id']
        
        if audit_id not in self.progress_tracker.audits:
            return web.json_response({'error': 'Audit not found'}, status=404)
        
        progress = self.progress_tracker.update_progress(audit_id, 'check', 0)
        return web.json_response(progress)
    
    async def subscribe_to_audit(self, request):
        """HTTP endpoint to subscribe to audit (for non-WebSocket clients)"""
        audit_id = request.match_info['audit_id']
        data = await request.json()
        
        # Store subscription in Redis for polling clients
        if self.redis:
            await self.redis.setex(
                f"audit:subscription:{audit_id}:{data.get('client_id')}",
                300,  # 5 minute TTL
                json.dumps({'subscribed_at': datetime.now().isoformat()})
            )
        
        return web.json_response({'status': 'subscribed', 'audit_id': audit_id})
    
    # =====================================================
    # Lifecycle Management
    # =====================================================
    
    async def start(self):
        """Start WebSocket server"""
        self.app['start_time'] = datetime.now()
        
        # Start background tasks
        self.app['broadcast_task'] = asyncio.create_task(self._broadcast_worker())
        self.app['cleanup_task'] = asyncio.create_task(self._cleanup_worker())
        
        # Start web server
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', self.port)
        await site.start()
        
        logger.info(f"WebSocket server started on port {self.port}")
    
    async def stop(self):
        """Stop WebSocket server"""
        # Cancel background tasks
        if 'broadcast_task' in self.app:
            self.app['broadcast_task'].cancel()
        if 'cleanup_task' in self.app:
            self.app['cleanup_task'].cancel()
        
        # Close all WebSocket connections
        for client in self.connections.values():
            await client.ws.close()
        
        await self.app.shutdown()
        await self.app.cleanup()
        
        logger.info("WebSocket server stopped")
    
    async def _broadcast_worker(self):
        """Background worker for processing broadcast queue"""
        while True:
            try:
                # Process messages from queue
                if not self.broadcast_queue.empty():
                    message = await self.broadcast_queue.get()
                    # Process message
                    
                await asyncio.sleep(0.1)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Broadcast worker error: {e}")
    
    async def _cleanup_worker(self):
        """Background worker for cleaning up stale connections"""
        while True:
            try:
                now = datetime.now()
                stale_clients = []
                
                for client_id, client in self.connections.items():
                    # Check for stale connections (no ping in 60 seconds)
                    if (now - client.last_ping).total_seconds() > 60:
                        stale_clients.append(client_id)
                
                for client_id in stale_clients:
                    await self._cleanup_client(client_id)
                
                await asyncio.sleep(30)  # Run every 30 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup worker error: {e}")


# =====================================================
# Integration Functions
# =====================================================

async def notify_audit_started(
    ws_manager: WebSocketManager,
    audit_id: str,
    total_queries: int,
    total_providers: int,
    company_name: str
):
    """Notify clients that audit has started"""
    
    ws_manager.progress_tracker.start_audit(audit_id, total_queries, total_providers)
    
    await ws_manager.broadcast_to_audit(
        audit_id,
        EventType.AUDIT_STARTED,
        {
            'company_name': company_name,
            'total_queries': total_queries,
            'total_providers': total_providers,
            'started_at': datetime.now().isoformat()
        }
    )


async def notify_query_generated(
    ws_manager: WebSocketManager,
    audit_id: str,
    query: str,
    intent: str
):
    """Notify clients about generated query"""
    
    await ws_manager.broadcast_to_audit(
        audit_id,
        EventType.QUERY_GENERATED,
        {
            'query': query,
            'intent': intent
        }
    )
    
    await ws_manager.broadcast_progress(audit_id, 'query_generated')


async def notify_llm_response(
    ws_manager: WebSocketManager,
    audit_id: str,
    query: str,
    provider: str,
    brand_mentioned: bool,
    sentiment: str
):
    """Notify clients about LLM response"""
    
    await ws_manager.broadcast_to_audit(
        audit_id,
        EventType.LLM_RESPONSE_RECEIVED,
        {
            'query': query,
            'provider': provider,
            'brand_mentioned': brand_mentioned,
            'sentiment': sentiment
        }
    )
    
    await ws_manager.broadcast_progress(audit_id, 'llm_response')


async def notify_insight_discovered(
    ws_manager: WebSocketManager,
    audit_id: str,
    insight_type: str,
    insight_data: Dict[str, Any]
):
    """Notify clients about discovered insight"""
    
    await ws_manager.broadcast_to_audit(
        audit_id,
        EventType.INSIGHT_DISCOVERED,
        {
            'type': insight_type,
            'data': insight_data,
            'importance': insight_data.get('importance', 'medium')
        }
    )


async def notify_audit_completed(
    ws_manager: WebSocketManager,
    audit_id: str,
    overall_score: float,
    key_findings: List[str]
):
    """Notify clients that audit is completed"""
    
    await ws_manager.broadcast_to_audit(
        audit_id,
        EventType.AUDIT_COMPLETED,
        {
            'overall_score': overall_score,
            'key_findings': key_findings,
            'completed_at': datetime.now().isoformat()
        }
    )