"""Cost tracking for LLM API usage."""

import asyncio
import time
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class CostTracker:
    """
    Track and monitor LLM API costs.
    
    Features:
    - Per-customer cost tracking
    - Model-specific pricing
    - Alert thresholds
    - Cost reports
    """
    
    # Pricing per 1K tokens (input + output averaged)
    PRICING = {
        'gpt-5-nano-2025-08-07': 0.01,  # $10 per 1M tokens
        'gpt-4': 0.03,  # $30 per 1M tokens
        'gpt-3.5-turbo': 0.0015,  # $1.50 per 1M tokens
        'gpt-3.5-turbo-16k': 0.003,  # $3 per 1M tokens
        'claude-3-opus': 0.015,  # $15 per 1M tokens
        'claude-3-sonnet': 0.003,  # $3 per 1M tokens
        'claude-3-haiku': 0.00025,  # $0.25 per 1M tokens
    }
    
    def __init__(self, postgres_client=None):
        """
        Initialize cost tracker.
        
        Args:
            postgres_client: Optional PostgreSQL client for persistence
        """
        self.postgres = postgres_client
        
        # In-memory tracking
        self.hourly_costs: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
        self.daily_costs: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
        self.monthly_costs: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
        
        # Track token usage
        self.token_usage: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        
        # Timestamps for reset
        self.last_hourly_reset = time.time()
        self.last_daily_reset = time.time()
        self.last_monthly_reset = time.time()
        
        # Alert thresholds
        self.hourly_threshold = 100.0  # $100/hour
        self.daily_threshold = 1000.0  # $1000/day
        self.monthly_threshold = 10000.0  # $10K/month
        
        # Alerts sent (to avoid spam)
        self.alerts_sent: Dict[str, float] = {}
    
    async def track_usage(
        self,
        customer_id: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        Track API usage and calculate cost.
        
        Args:
            customer_id: Customer identifier
            model: Model name (e.g., 'gpt-5-nano-2025-08-07')
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            metadata: Optional metadata (request_id, purpose, etc.)
            
        Returns:
            Cost information and warnings
        """
        # Check for resets
        await self._check_resets()
        
        # Calculate cost
        total_tokens = input_tokens + output_tokens
        cost_per_1k = self.PRICING.get(model, 0.01)  # Default to GPT-4 pricing if unknown
        cost = (total_tokens / 1000) * cost_per_1k
        
        # Update in-memory tracking
        self.hourly_costs[customer_id][model] += cost
        self.daily_costs[customer_id][model] += cost
        self.monthly_costs[customer_id][model] += cost
        
        self.token_usage[customer_id][model] += total_tokens
        
        # Check thresholds
        warnings = []
        hourly_total = sum(self.hourly_costs[customer_id].values())
        daily_total = sum(self.daily_costs[customer_id].values())
        monthly_total = sum(self.monthly_costs[customer_id].values())
        
        if hourly_total > self.hourly_threshold:
            warnings.append(f"Hourly cost threshold exceeded: ${hourly_total:.2f}")
            await self._send_alert(customer_id, "hourly", hourly_total)
        
        if daily_total > self.daily_threshold:
            warnings.append(f"Daily cost threshold exceeded: ${daily_total:.2f}")
            await self._send_alert(customer_id, "daily", daily_total)
        
        if monthly_total > self.monthly_threshold:
            warnings.append(f"Monthly cost threshold exceeded: ${monthly_total:.2f}")
            await self._send_alert(customer_id, "monthly", monthly_total)
        
        # Persist to database if available
        if self.postgres:
            await self._persist_usage(
                customer_id=customer_id,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost=cost,
                metadata=metadata
            )
        
        return {
            "cost": cost,
            "total_tokens": total_tokens,
            "hourly_total": hourly_total,
            "daily_total": daily_total,
            "monthly_total": monthly_total,
            "warnings": warnings
        }
    
    async def _check_resets(self):
        """Check and perform time-based resets."""
        now = time.time()
        
        # Hourly reset
        if now - self.last_hourly_reset > 3600:
            self.hourly_costs.clear()
            self.last_hourly_reset = now
        
        # Daily reset
        if now - self.last_daily_reset > 86400:
            self.daily_costs.clear()
            self.last_daily_reset = now
        
        # Monthly reset (30 days)
        if now - self.last_monthly_reset > 2592000:
            self.monthly_costs.clear()
            self.token_usage.clear()
            self.last_monthly_reset = now
    
    async def _send_alert(self, customer_id: str, period: str, amount: float):
        """Send cost alert (with rate limiting to avoid spam)."""
        alert_key = f"{customer_id}_{period}"
        now = time.time()
        
        # Only send alert once per hour for the same threshold
        if alert_key in self.alerts_sent:
            if now - self.alerts_sent[alert_key] < 3600:
                return
        
        self.alerts_sent[alert_key] = now
        
        logger.warning(
            f"COST ALERT: Customer {customer_id} exceeded {period} threshold: ${amount:.2f}"
        )
        
        # Here you would send actual alerts (email, Slack, etc.)
        # For now, just log it
    
    async def _persist_usage(
        self,
        customer_id: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost: float,
        metadata: Optional[Dict] = None
    ):
        """Persist usage data to PostgreSQL."""
        if not self.postgres or not self.postgres.pool:
            return
        
        try:
            async with self.postgres.acquire() as conn:
                await conn.execute("""
                    INSERT INTO intelligence.api_usage (
                        customer_id, model, input_tokens, output_tokens,
                        total_tokens, cost, metadata, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                """,
                customer_id, model, input_tokens, output_tokens,
                input_tokens + output_tokens, cost, metadata or {}
                )
        except Exception as e:
            logger.error(f"Failed to persist usage data: {e}")
    
    def get_customer_report(self, customer_id: str) -> Dict:
        """
        Get cost report for a customer.
        
        Args:
            customer_id: Customer identifier
            
        Returns:
            Detailed cost report
        """
        return {
            "customer_id": customer_id,
            "hourly": {
                "total": sum(self.hourly_costs[customer_id].values()),
                "by_model": dict(self.hourly_costs[customer_id])
            },
            "daily": {
                "total": sum(self.daily_costs[customer_id].values()),
                "by_model": dict(self.daily_costs[customer_id])
            },
            "monthly": {
                "total": sum(self.monthly_costs[customer_id].values()),
                "by_model": dict(self.monthly_costs[customer_id]),
                "tokens_used": dict(self.token_usage[customer_id])
            },
            "thresholds": {
                "hourly": self.hourly_threshold,
                "daily": self.daily_threshold,
                "monthly": self.monthly_threshold
            }
        }
    
    def get_global_report(self) -> Dict:
        """Get global cost report across all customers."""
        total_hourly = sum(
            sum(costs.values())
            for costs in self.hourly_costs.values()
        )
        total_daily = sum(
            sum(costs.values())
            for costs in self.daily_costs.values()
        )
        total_monthly = sum(
            sum(costs.values())
            for costs in self.monthly_costs.values()
        )
        
        # Top spenders
        monthly_by_customer = {
            customer: sum(costs.values())
            for customer, costs in self.monthly_costs.items()
        }
        top_spenders = sorted(
            monthly_by_customer.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        return {
            "totals": {
                "hourly": total_hourly,
                "daily": total_daily,
                "monthly": total_monthly
            },
            "customer_count": len(self.monthly_costs),
            "top_spenders": [
                {"customer_id": customer, "amount": amount}
                for customer, amount in top_spenders
            ],
            "alerts_sent_count": len(self.alerts_sent)
        }
    
    def set_thresholds(
        self,
        hourly: Optional[float] = None,
        daily: Optional[float] = None,
        monthly: Optional[float] = None
    ):
        """Update alert thresholds."""
        if hourly is not None:
            self.hourly_threshold = hourly
        if daily is not None:
            self.daily_threshold = daily
        if monthly is not None:
            self.monthly_threshold = monthly
    
    async def estimate_request_cost(
        self,
        text: str,
        model: str = "gpt-5-nano-2025-08-07"
    ) -> float:
        """
        Estimate cost for a request before making it.
        
        Args:
            text: Input text
            model: Model to use
            
        Returns:
            Estimated cost in dollars
        """
        # Rough estimation: 1 token ≈ 4 characters
        estimated_tokens = len(text) // 4
        
        # Assume output will be similar length
        total_tokens = estimated_tokens * 2
        
        cost_per_1k = self.PRICING.get(model, 0.01)
        estimated_cost = (total_tokens / 1000) * cost_per_1k
        
        return estimated_cost


# Global instance
cost_tracker = CostTracker()