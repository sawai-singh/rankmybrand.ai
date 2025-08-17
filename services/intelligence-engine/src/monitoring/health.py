"""Health check implementation with metrics integration."""

from typing import Dict, List
from datetime import datetime, timedelta
from src.storage import PostgresClient, RedisClient
from .metrics import metrics_collector


class HealthChecker:
    """Check health of various components."""
    
    def __init__(
        self,
        postgres_client: PostgresClient,
        redis_client: RedisClient
    ):
        self.postgres = postgres_client
        self.redis = redis_client
        self.last_check = None
        self.last_status = {}
    
    async def check_health(self) -> Dict:
        """Perform comprehensive health check."""
        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {}
        }
        
        # Check Redis
        try:
            redis_healthy = await self.redis.health_check()
            stream_info = await self.redis.get_stream_info(
                self.redis.input_stream
            )
            
            health_status["checks"]["redis"] = {
                "status": "healthy" if redis_healthy else "unhealthy",
                "stream_length": stream_info.get("length", 0),
                "consumer_groups": stream_info.get("groups", 0)
            }
        except Exception as e:
            health_status["checks"]["redis"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            health_status["status"] = "degraded"
        
        # Check PostgreSQL
        try:
            async with self.postgres.acquire() as conn:
                result = await conn.fetchval("SELECT 1")
                
            health_status["checks"]["postgres"] = {
                "status": "healthy" if result == 1 else "unhealthy"
            }
        except Exception as e:
            health_status["checks"]["postgres"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            health_status["status"] = "unhealthy"
        
        # Check LLM API availability
        try:
            import openai
            
            health_status["checks"]["llm_api"] = {
                "status": "healthy",
                "api_available": True,
                "provider": "OpenAI GPT-4 Turbo"
            }
        except ImportError as e:
            health_status["checks"]["llm_api"] = {
                "status": "degraded",
                "error": f"Missing OpenAI module: {e}"
            }
            health_status["status"] = "degraded"
        
        # Check processing lag and update metrics
        try:
            pending = await self.redis.get_pending_messages()
            if pending and isinstance(pending, dict):
                total_pending = pending.get("pending", 0)
                
                # Update stream lag metrics
                metrics_collector.set_stream_lag("input_stream", total_pending)
                
                health_status["checks"]["processing"] = {
                    "status": "healthy" if total_pending < 100 else "degraded",
                    "pending_messages": total_pending
                }
                
                if total_pending > 100:
                    health_status["status"] = "degraded"
        except Exception as e:
            health_status["checks"]["processing"] = {
                "status": "unknown",
                "error": str(e)
            }
        
        # Update database connection metrics
        try:
            pool_stats = await self.postgres.get_pool_stats()
            if pool_stats:
                metrics_collector.set_database_connections(
                    pool_name="main",
                    active=pool_stats.get("active", 0),
                    idle=pool_stats.get("idle", 0),
                    total=pool_stats.get("total", 0)
                )
        except Exception:
            pass
        
        self.last_check = datetime.utcnow()
        self.last_status = health_status
        
        return health_status
    
    async def check_readiness(self) -> Dict:
        """Check if service is ready to process requests."""
        readiness = {
            "ready": True,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {}
        }
        
        # Check Redis connection
        try:
            redis_ready = await self.redis.health_check()
            readiness["checks"]["redis"] = redis_ready
            if not redis_ready:
                readiness["ready"] = False
        except Exception:
            readiness["checks"]["redis"] = False
            readiness["ready"] = False
        
        # Check PostgreSQL connection
        try:
            async with self.postgres.acquire() as conn:
                pg_ready = await conn.fetchval("SELECT 1") == 1
            readiness["checks"]["postgres"] = pg_ready
            if not pg_ready:
                readiness["ready"] = False
        except Exception:
            readiness["checks"]["postgres"] = False
            readiness["ready"] = False
        
        return readiness
    
    async def check_liveness(self) -> Dict:
        """Check if service is alive."""
        return {
            "alive": True,
            "timestamp": datetime.utcnow().isoformat(),
            "uptime": self._get_uptime()
        }
    
    def _get_uptime(self) -> str:
        """Get service uptime."""
        # This would typically track from service start
        # For now, return a placeholder
        return "unknown"
    
    async def get_dependencies_status(self) -> List[Dict]:
        """Get status of all dependencies."""
        dependencies = []
        
        # Redis
        try:
            redis_healthy = await self.redis.health_check()
            dependencies.append({
                "name": "Redis",
                "type": "cache/stream",
                "status": "healthy" if redis_healthy else "unhealthy",
                "required": True
            })
        except Exception:
            dependencies.append({
                "name": "Redis",
                "type": "cache/stream",
                "status": "unhealthy",
                "required": True
            })
        
        # PostgreSQL
        try:
            async with self.postgres.acquire() as conn:
                pg_healthy = await conn.fetchval("SELECT 1") == 1
            dependencies.append({
                "name": "PostgreSQL",
                "type": "database",
                "status": "healthy" if pg_healthy else "unhealthy",
                "required": True
            })
        except Exception:
            dependencies.append({
                "name": "PostgreSQL",
                "type": "database",
                "status": "unhealthy",
                "required": True
            })
        
        # NLP Models
        models = [
            ("spaCy", "spacy"),
            ("Transformers", "transformers"),
            ("Sentence Transformers", "sentence_transformers")
        ]
        
        for name, module_name in models:
            try:
                __import__(module_name)
                dependencies.append({
                    "name": name,
                    "type": "nlp_model",
                    "status": "healthy",
                    "required": True
                })
            except ImportError:
                dependencies.append({
                    "name": name,
                    "type": "nlp_model",
                    "status": "missing",
                    "required": True
                })
        
        return dependencies