"""Rate limiting for LLM API calls to prevent cost overruns."""

import asyncio
import time
from collections import defaultdict, deque
from typing import Dict, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class LLMRateLimiter:
    """
    Rate limiter for LLM API calls with per-customer and global limits.
    
    Features:
    - Global rate limiting across all customers
    - Per-customer rate limiting
    - Sliding window algorithm for accurate rate limiting
    - Cost tracking and alerting
    """
    
    def __init__(
        self,
        global_calls_per_minute: int = 60,
        customer_calls_per_minute: int = 10,
        cost_alert_threshold: float = 100.0  # Alert if cost exceeds $100/hour
    ):
        """
        Initialize rate limiter.
        
        Args:
            global_calls_per_minute: Max calls per minute globally
            customer_calls_per_minute: Max calls per minute per customer
            cost_alert_threshold: Cost threshold for alerts ($/hour)
        """
        self.global_limit = global_calls_per_minute
        self.customer_limit = customer_calls_per_minute
        self.cost_alert_threshold = cost_alert_threshold
        
        # Semaphore for global rate limiting
        self.global_semaphore = asyncio.Semaphore(global_calls_per_minute)
        
        # Track call times per customer (sliding window)
        self.customer_calls: Dict[str, deque] = defaultdict(lambda: deque())
        
        # Track costs
        self.hourly_costs: Dict[str, float] = defaultdict(float)
        self.last_cost_reset = time.time()
        
        # Lock for thread-safe operations
        self.lock = asyncio.Lock()
    
    async def acquire(self, customer_id: str, estimated_tokens: int = 1000) -> bool:
        """
        Acquire permission to make an LLM API call.
        
        Args:
            customer_id: Customer making the request
            estimated_tokens: Estimated tokens for cost calculation
            
        Returns:
            True if allowed, False if rate limited
        """
        async with self.lock:
            now = time.time()
            
            # Check and update cost tracking
            if await self._check_cost_limit(customer_id, estimated_tokens):
                logger.warning(f"Customer {customer_id} exceeded cost threshold")
                return False
            
            # Clean old entries from customer's call history
            customer_window = self.customer_calls[customer_id]
            while customer_window and customer_window[0] < now - 60:
                customer_window.popleft()
            
            # Check customer rate limit
            if len(customer_window) >= self.customer_limit:
                wait_time = 60 - (now - customer_window[0])
                logger.info(f"Customer {customer_id} rate limited, wait {wait_time:.1f}s")
                return False
            
            # Try to acquire global semaphore (non-blocking)
            if not self.global_semaphore._value > 0:
                logger.info("Global rate limit reached")
                return False
            
            # Record the call
            customer_window.append(now)
            await self.global_semaphore.acquire()
            
            # Schedule semaphore release after 1 minute
            asyncio.create_task(self._release_after_delay(60))
            
            return True
    
    async def _release_after_delay(self, delay: float):
        """Release semaphore after delay."""
        await asyncio.sleep(delay)
        self.global_semaphore.release()
    
    async def _check_cost_limit(self, customer_id: str, estimated_tokens: int) -> bool:
        """
        Check if customer is within cost limits.
        
        Args:
            customer_id: Customer ID
            estimated_tokens: Estimated tokens for the call
            
        Returns:
            True if cost limit exceeded
        """
        now = time.time()
        
        # Reset hourly costs if needed
        if now - self.last_cost_reset > 3600:  # 1 hour
            self.hourly_costs.clear()
            self.last_cost_reset = now
        
        # Estimate cost (GPT-4 pricing: ~$0.01 per 1K tokens)
        estimated_cost = (estimated_tokens / 1000) * 0.01
        
        # Check if adding this cost would exceed threshold
        current_hourly_cost = self.hourly_costs[customer_id]
        if current_hourly_cost + estimated_cost > self.cost_alert_threshold:
            return True
        
        # Update cost tracking
        self.hourly_costs[customer_id] += estimated_cost
        
        return False
    
    def get_customer_usage(self, customer_id: str) -> Dict:
        """
        Get usage statistics for a customer.
        
        Args:
            customer_id: Customer ID
            
        Returns:
            Usage statistics
        """
        now = time.time()
        customer_window = self.customer_calls[customer_id]
        
        # Clean old entries
        while customer_window and customer_window[0] < now - 60:
            customer_window.popleft()
        
        return {
            "calls_last_minute": len(customer_window),
            "hourly_cost": self.hourly_costs.get(customer_id, 0.0),
            "rate_limit": self.customer_limit,
            "remaining_calls": max(0, self.customer_limit - len(customer_window))
        }
    
    async def wait_if_needed(self, customer_id: str) -> float:
        """
        Calculate wait time if rate limited.
        
        Args:
            customer_id: Customer ID
            
        Returns:
            Wait time in seconds (0 if not rate limited)
        """
        async with self.lock:
            now = time.time()
            customer_window = self.customer_calls[customer_id]
            
            # Clean old entries
            while customer_window and customer_window[0] < now - 60:
                customer_window.popleft()
            
            if len(customer_window) >= self.customer_limit:
                return 60 - (now - customer_window[0])
            
            return 0.0


class CircuitBreaker:
    """
    Circuit breaker for LLM API calls to handle failures gracefully.
    
    States:
    - CLOSED: Normal operation, requests go through
    - OPEN: Too many failures, requests blocked
    - HALF_OPEN: Testing if service recovered
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception_types: tuple = (Exception,)
    ):
        """
        Initialize circuit breaker.
        
        Args:
            failure_threshold: Number of failures before opening
            recovery_timeout: Seconds before attempting recovery
            expected_exception_types: Exception types to catch
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception_types = expected_exception_types
        
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = "CLOSED"
        self.lock = asyncio.Lock()
    
    async def call(self, func, *args, **kwargs):
        """
        Call function through circuit breaker.
        
        Args:
            func: Async function to call
            *args, **kwargs: Function arguments
            
        Returns:
            Function result
            
        Raises:
            CircuitOpenError: If circuit is open
        """
        async with self.lock:
            # Check state
            if self.state == "OPEN":
                if self._should_attempt_recovery():
                    self.state = "HALF_OPEN"
                    logger.info("Circuit breaker entering HALF_OPEN state")
                else:
                    raise CircuitOpenError("Circuit breaker is OPEN")
        
        try:
            # Attempt the call
            result = await func(*args, **kwargs)
            
            # Success - update state
            async with self.lock:
                if self.state == "HALF_OPEN":
                    self.state = "CLOSED"
                    logger.info("Circuit breaker recovered, entering CLOSED state")
                self.failure_count = 0
                self.last_failure_time = None
            
            return result
            
        except self.expected_exception_types as e:
            # Failure - update state
            async with self.lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.failure_count >= self.failure_threshold:
                    self.state = "OPEN"
                    logger.error(f"Circuit breaker OPEN after {self.failure_count} failures")
                
                # If in HALF_OPEN, immediately go back to OPEN
                if self.state == "HALF_OPEN":
                    self.state = "OPEN"
                    logger.warning("Circuit breaker returning to OPEN from HALF_OPEN")
            
            raise e
    
    def _should_attempt_recovery(self) -> bool:
        """Check if enough time has passed to attempt recovery."""
        if not self.last_failure_time:
            return True
        
        return time.time() - self.last_failure_time >= self.recovery_timeout
    
    def get_state(self) -> Dict:
        """Get circuit breaker state."""
        return {
            "state": self.state,
            "failure_count": self.failure_count,
            "threshold": self.failure_threshold,
            "can_recover": self._should_attempt_recovery() if self.state == "OPEN" else None
        }
    
    def reset(self):
        """Manually reset circuit breaker."""
        self.state = "CLOSED"
        self.failure_count = 0
        self.last_failure_time = None
        logger.info("Circuit breaker manually reset")


class CircuitOpenError(Exception):
    """Exception raised when circuit breaker is open."""
    pass


# Global instances
rate_limiter = LLMRateLimiter()
circuit_breaker = CircuitBreaker()