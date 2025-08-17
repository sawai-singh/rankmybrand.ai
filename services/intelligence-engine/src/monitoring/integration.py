"""Integration utilities for metrics collection across the application."""

import asyncio
import time
from functools import wraps
from typing import Callable, Any, Dict
from datetime import datetime

from .metrics import metrics_collector


class LLMMetricsCollector:
    """Specialized metrics collector for LLM operations."""
    
    @staticmethod
    def track_api_call(provider: str, model: str):
        """Decorator to track LLM API calls."""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                start_time = time.time()
                status = 'success'
                
                try:
                    result = await func(*args, **kwargs)
                    return result
                except Exception as e:
                    status = 'error'
                    # Record specific error type
                    metrics_collector.record_processing_error(
                        error_type=f"llm_api_{type(e).__name__.lower()}",
                        component='llm_provider'
                    )
                    raise
                finally:
                    # Record API call
                    metrics_collector.record_llm_api_call(
                        provider=provider,
                        model=model,
                        status=status
                    )
                    
                    # Record processing time
                    duration = time.time() - start_time
                    metrics_collector.record_nlp_inference(
                        model=f"{provider}_{model}",
                        duration=duration
                    )
            
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                start_time = time.time()
                status = 'success'
                
                try:
                    result = func(*args, **kwargs)
                    return result
                except Exception as e:
                    status = 'error'
                    # Record specific error type
                    metrics_collector.record_processing_error(
                        error_type=f"llm_api_{type(e).__name__.lower()}",
                        component='llm_provider'
                    )
                    raise
                finally:
                    # Record API call
                    metrics_collector.record_llm_api_call(
                        provider=provider,
                        model=model,
                        status=status
                    )
                    
                    # Record processing time
                    duration = time.time() - start_time
                    metrics_collector.record_nlp_inference(
                        model=f"{provider}_{model}",
                        duration=duration
                    )
            
            # Return appropriate wrapper based on function type
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper
        
        return decorator


class DatabaseMetricsCollector:
    """Specialized metrics collector for database operations."""
    
    @staticmethod
    def track_operation(table: str, operation: str = 'query'):
        """Decorator to track database operations."""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                start_time = time.time()
                
                try:
                    result = await func(*args, **kwargs)
                    return result
                except Exception as e:
                    # Record database error
                    error_type = f"{operation}_{type(e).__name__.lower()}"
                    metrics_collector.record_db_error(
                        table=table,
                        error_type=error_type
                    )
                    raise
            
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                start_time = time.time()
                
                try:
                    result = func(*args, **kwargs)
                    return result
                except Exception as e:
                    # Record database error
                    error_type = f"{operation}_{type(e).__name__.lower()}"
                    metrics_collector.record_db_error(
                        table=table,
                        error_type=error_type
                    )
                    raise
            
            # Return appropriate wrapper based on function type
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper
        
        return decorator


class CacheMetricsCollector:
    """Specialized metrics collector for cache operations."""
    
    def __init__(self):
        self.hit_count = 0
        self.miss_count = 0
    
    def record_hit(self):
        """Record cache hit."""
        self.hit_count += 1
        metrics_collector.record_cache_operation('get', 'hit')
        self._update_hit_ratio()
    
    def record_miss(self):
        """Record cache miss."""
        self.miss_count += 1
        metrics_collector.record_cache_operation('get', 'miss')
        self._update_hit_ratio()
    
    def record_set(self, success: bool = True):
        """Record cache set operation."""
        status = 'success' if success else 'error'
        metrics_collector.record_cache_operation('set', status)
    
    def record_delete(self, success: bool = True):
        """Record cache delete operation."""
        status = 'success' if success else 'error'
        metrics_collector.record_cache_operation('delete', status)
    
    def _update_hit_ratio(self):
        """Update cache hit ratio."""
        total = self.hit_count + self.miss_count
        if total > 0:
            ratio = self.hit_count / total
            metrics_collector.set_cache_hit_ratio(ratio)


class ProcessingMetricsCollector:
    """Specialized metrics collector for AI processing operations."""
    
    @staticmethod
    def track_response_processing(platform: str):
        """Decorator to track AI response processing."""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                start_time = time.time()
                
                # Increment processing count
                metrics_collector.set_processing_count(
                    metrics_collector._active_connections
                )
                
                try:
                    result = await func(*args, **kwargs)
                    
                    # Record successful processing
                    metrics_collector.record_response_processed(
                        platform=platform,
                        status='success'
                    )
                    
                    return result
                    
                except Exception as e:
                    # Record failed processing
                    metrics_collector.record_response_processed(
                        platform=platform,
                        status='error'
                    )
                    
                    # Record specific error
                    metrics_collector.record_processing_error(
                        error_type=type(e).__name__.lower(),
                        component='response_processor'
                    )
                    
                    raise
                    
                finally:
                    # Record processing time
                    duration = time.time() - start_time
                    metrics_collector.record_processing_time(
                        platform=platform,
                        duration=duration
                    )
            
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                start_time = time.time()
                
                # Increment processing count
                metrics_collector.set_processing_count(
                    metrics_collector._active_connections
                )
                
                try:
                    result = func(*args, **kwargs)
                    
                    # Record successful processing
                    metrics_collector.record_response_processed(
                        platform=platform,
                        status='success'
                    )
                    
                    return result
                    
                except Exception as e:
                    # Record failed processing
                    metrics_collector.record_response_processed(
                        platform=platform,
                        status='error'
                    )
                    
                    # Record specific error
                    metrics_collector.record_processing_error(
                        error_type=type(e).__name__.lower(),
                        component='response_processor'
                    )
                    
                    raise
                    
                finally:
                    # Record processing time
                    duration = time.time() - start_time
                    metrics_collector.record_processing_time(
                        platform=platform,
                        duration=duration
                    )
            
            # Return appropriate wrapper based on function type
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper
        
        return decorator


class BusinessMetricsCollector:
    """Specialized metrics collector for business KPIs."""
    
    @staticmethod
    def track_user_journey():
        """Track user through onboarding funnel."""
        return {
            'signup': lambda: metrics_collector.increment_onboarding_stage('signup'),
            'verification': lambda: metrics_collector.increment_onboarding_stage('verification'),
            'profile_setup': lambda: metrics_collector.increment_onboarding_stage('profile_setup'),
            'first_search': lambda: metrics_collector.increment_onboarding_stage('first_search'),
            'subscription': lambda: metrics_collector.increment_onboarding_stage('subscription')
        }
    
    @staticmethod
    def record_subscription_event(event_type: str, from_plan: str = None, to_plan: str = None):
        """Record subscription-related events."""
        if event_type == 'conversion' and from_plan and to_plan:
            metrics_collector.record_subscription_conversion(from_plan, to_plan)
        elif event_type == 'registration':
            metrics_collector.record_user_registration(
                source='web',
                plan_type=to_plan or 'free'
            )


# Global specialized collectors
llm_metrics = LLMMetricsCollector()
db_metrics = DatabaseMetricsCollector()
cache_metrics = CacheMetricsCollector()
processing_metrics = ProcessingMetricsCollector()
business_metrics = BusinessMetricsCollector()


def initialize_metrics():
    """Initialize all metrics with default values."""
    # Initialize onboarding funnel
    stages = ['signup', 'verification', 'profile_setup', 'first_search', 'subscription']
    for stage in stages:
        metrics_collector.update_onboarding_funnel(stage, 0)
    
    # Initialize cache hit rate
    metrics_collector.set_cache_hit_ratio(0.0)
    
    # Initialize active connections
    metrics_collector.set_active_connections(0)
    
    # Initialize processing count
    metrics_collector.set_processing_count(0)


def get_metrics_summary() -> Dict[str, Any]:
    """Get a summary of current metrics for debugging."""
    return {
        'timestamp': datetime.utcnow().isoformat(),
        'active_connections': metrics_collector._active_connections,
        'cache_hit_ratio': cache_metrics.hit_count / max(1, cache_metrics.hit_count + cache_metrics.miss_count),
        'total_cache_operations': cache_metrics.hit_count + cache_metrics.miss_count,
        'service_info': {
            'name': 'intelligence-engine',
            'version': '1.0.0',
            'metrics_enabled': True
        }
    }