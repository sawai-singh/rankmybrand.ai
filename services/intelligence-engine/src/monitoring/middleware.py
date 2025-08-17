"""FastAPI middleware for automatic metrics collection."""

import time
from typing import Callable
from fastapi import Request, Response
from fastapi.routing import Match
from starlette.middleware.base import BaseHTTPMiddleware

from .metrics import metrics_collector


class PrometheusMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for automatic Prometheus metrics collection.
    
    This middleware automatically collects:
    - HTTP request counts by method, route, and status code
    - HTTP request duration by method and route
    - Active connection counts
    - API error rates
    """
    
    def __init__(self, app, enable_health_metrics: bool = True):
        super().__init__(app)
        self.enable_health_metrics = enable_health_metrics
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip metrics collection for the metrics endpoint itself
        if request.url.path == '/metrics':
            return await call_next(request)
        
        start_time = time.time()
        
        # Increment active connections
        metrics_collector.increment_active_connections()
        
        # Get route pattern for better grouping
        route_path = self._get_route_pattern(request)
        
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Record metrics
            metrics_collector.record_http_request(
                method=request.method,
                route=route_path,
                status_code=response.status_code,
                duration=duration
            )
            
            return response
            
        except Exception as e:
            # Record error metrics
            duration = time.time() - start_time
            
            # Determine status code based on exception type
            status_code = getattr(e, 'status_code', 500)
            
            metrics_collector.record_http_request(
                method=request.method,
                route=route_path,
                status_code=status_code,
                duration=duration
            )
            
            raise
            
        finally:
            # Decrement active connections
            metrics_collector.decrement_active_connections()
            
            # Update health metrics periodically
            if self.enable_health_metrics:
                self._update_health_metrics()
    
    def _get_route_pattern(self, request: Request) -> str:
        """Get the route pattern for better metric grouping."""
        try:
            # Try to get the route pattern from FastAPI
            for route in request.app.routes:
                match, _ = route.matches({"type": "http", "path": request.url.path, "method": request.method})
                if match == Match.FULL:
                    return route.path
            
            # Fallback to raw path
            return request.url.path
            
        except Exception:
            # Fallback to raw path on any error
            return request.url.path
    
    def _update_health_metrics(self):
        """Update system health metrics."""
        try:
            import psutil
            import os
            
            process = psutil.Process(os.getpid())
            
            # Memory usage
            memory_info = process.memory_info()
            metrics_collector.set_memory_usage('intelligence-engine', memory_info.rss)
            
            # CPU usage
            cpu_percent = process.cpu_percent()
            metrics_collector.set_cpu_usage('intelligence-engine', cpu_percent)
            
        except Exception:
            # Ignore errors in health metrics collection
            pass


def setup_metrics_middleware(app, enable_health_metrics: bool = True):
    """
    Set up Prometheus metrics middleware for a FastAPI application.
    
    Args:
        app: FastAPI application instance
        enable_health_metrics: Whether to collect system health metrics
    """
    app.add_middleware(PrometheusMiddleware, enable_health_metrics=enable_health_metrics)
    
    # Initialize onboarding funnel if not already done
    metrics_collector._initialize_onboarding_funnel()
    
    return app