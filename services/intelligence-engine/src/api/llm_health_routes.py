"""
LLM Health Check and Status API Routes
Provides real-time health status of all LLM providers
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import asyncio
from src.core.llm_provider_manager import get_llm_manager, LLMProvider
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/llm", tags=["llm"])


@router.get("/health")
async def get_health_status():
    """
    Get health status of all LLM providers
    Shows which APIs are working and their performance metrics
    """
    try:
        manager = get_llm_manager()
        
        # Run health checks for all providers
        tasks = []
        for provider in manager.providers:
            tasks.append(manager.check_provider_health(provider))
            
        await asyncio.gather(*tasks, return_exceptions=True)
        
        # Get system status
        status = manager.get_system_status()
        
        return {
            "success": True,
            "system_health": status["system_health"],
            "summary": {
                "total_providers": status["total_providers"],
                "healthy_providers": status["healthy_providers"],
                "degraded": status["total_providers"] - status["healthy_providers"],
                "health_percentage": round(status["system_health"] * 100, 1)
            },
            "providers": status["providers"],
            "recommendation": _get_health_recommendation(status)
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test")
async def test_providers(prompt: str = "Hello, please respond with 'OK'"):
    """
    Test all available providers with a simple prompt
    """
    try:
        manager = get_llm_manager()
        
        # Get response using fallback mechanism
        response = await manager.query_with_fallback(prompt, use_cache=False)
        
        # Also try to get responses from all providers
        aggregated = await manager.aggregate_responses(prompt, min_providers=1)
        
        return {
            "success": True,
            "primary_response": {
                "provider": response.provider.value,
                "content": response.content,
                "confidence": response.confidence,
                "response_time": response.response_time,
                "cached": response.cached
            },
            "all_responses": aggregated,
            "available_providers": [p.value for p in manager.get_available_providers()]
        }
        
    except Exception as e:
        logger.error(f"Provider test failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_provider_status():
    """
    Get detailed status of each provider including performance metrics
    """
    try:
        manager = get_llm_manager()
        status = manager.get_system_status()
        
        # Add more detailed information
        detailed_status = {
            "operational": status["healthy_providers"] > 0,
            "providers": []
        }
        
        for provider_name, provider_data in status["providers"].items():
            detailed_status["providers"].append({
                "name": provider_name,
                "status": "operational" if provider_data["healthy"] else "down",
                "health_score": provider_data["success_rate"],
                "performance": {
                    "avg_response_time": f"{provider_data['avg_response_time']:.2f}s",
                    "success_rate": f"{provider_data['success_rate'] * 100:.1f}%",
                    "errors": provider_data["error_count"]
                },
                "configuration": {
                    "priority": provider_data["priority"],
                    "weight": provider_data["weight"]
                },
                "last_check": provider_data["last_check"]
            })
            
        # Sort by priority
        detailed_status["providers"].sort(key=lambda x: x["configuration"]["priority"])
        
        # Add recommendations
        if status["healthy_providers"] == 0:
            detailed_status["alert"] = "CRITICAL: No LLM providers available"
            detailed_status["recommendation"] = "Check API keys and network connectivity"
        elif status["healthy_providers"] < status["total_providers"] / 2:
            detailed_status["alert"] = "WARNING: Limited LLM providers available"
            detailed_status["recommendation"] = "Some features may be degraded"
        else:
            detailed_status["alert"] = "OK: System operational"
            detailed_status["recommendation"] = "All systems functioning normally"
            
        return detailed_status
        
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh-health")
async def refresh_health_checks():
    """
    Force refresh health checks for all providers
    """
    try:
        manager = get_llm_manager()
        
        # Run health checks
        results = {}
        for provider in manager.providers:
            is_healthy = await manager.check_provider_health(provider)
            results[provider.value] = {
                "healthy": is_healthy,
                "checked": True
            }
            
        return {
            "success": True,
            "message": "Health checks refreshed",
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Health refresh failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _get_health_recommendation(status: Dict[str, Any]) -> str:
    """Generate health recommendation based on system status"""
    health_pct = status["system_health"] * 100
    
    if health_pct == 100:
        return "All AI providers operational. System at full capacity."
    elif health_pct >= 75:
        return "System operational with minor degradation. Most features available."
    elif health_pct >= 50:
        return "System partially operational. Some features may be slower or unavailable."
    elif health_pct >= 25:
        return "System degraded. Limited AI capabilities available."
    elif health_pct > 0:
        return "System critical. Only basic AI features available."
    else:
        return "System offline. No AI providers available. Check API configurations."