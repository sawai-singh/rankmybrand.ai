"""GEO score calculation."""

from typing import Dict, Optional
from datetime import datetime, timedelta


class GEOCalculator:
    """Calculate GEO (Generative Engine Optimization) scores."""
    
    def __init__(self):
        # Weight configuration for GEO score components
        self.weights = {
            "citation_frequency": 0.35,
            "sentiment": 0.25,
            "relevance": 0.20,
            "position": 0.10,
            "authority": 0.10
        }
        
        # Recency decay parameters
        self.recency_half_life_days = 30  # Score halves every 30 days
    
    def calculate(
        self,
        citation_frequency: float,
        sentiment_score: float,
        relevance_score: float,
        authority_score: float,
        position_weight: float,
        response_date: Optional[datetime] = None
    ) -> float:
        """
        Calculate GEO score from components.
        
        Args:
            citation_frequency: How often brand is cited (0-100)
            sentiment_score: Sentiment (-1 to 1, converted to 0-1)
            relevance_score: Query-answer relevance (0-1)
            authority_score: Domain authority of sources (0-1)
            position_weight: Position in results (0-1)
            response_date: When response was collected
        
        Returns:
            GEO score (0-100)
        """
        # Normalize inputs
        citation_freq_normalized = min(citation_frequency / 10, 1.0)  # Cap at 10 citations
        sentiment_normalized = (sentiment_score + 1) / 2  # Convert -1,1 to 0,1
        
        # Calculate weighted score
        raw_score = (
            self.weights["citation_frequency"] * citation_freq_normalized +
            self.weights["sentiment"] * sentiment_normalized +
            self.weights["relevance"] * relevance_score +
            self.weights["position"] * position_weight +
            self.weights["authority"] * authority_score
        )
        
        # Apply recency weight if date provided
        if response_date:
            recency_weight = self._calculate_recency_weight(response_date)
            raw_score *= recency_weight
        
        # Convert to 0-100 scale
        geo_score = raw_score * 100
        
        # Ensure score is within bounds
        return max(0, min(100, geo_score))
    
    def _calculate_recency_weight(self, response_date: datetime) -> float:
        """Calculate recency weight using exponential decay."""
        now = datetime.utcnow()
        days_old = (now - response_date).days
        
        # Exponential decay formula
        decay_rate = 0.693 / self.recency_half_life_days  # ln(2) / half_life
        weight = pow(2, -days_old / self.recency_half_life_days)
        
        # Don't let weight go below 0.1 (10% of original value)
        return max(weight, 0.1)
    
    def calculate_trend(self, scores: list[tuple[datetime, float]]) -> Dict:
        """
        Calculate GEO score trend over time.
        
        Args:
            scores: List of (datetime, score) tuples
        
        Returns:
            Trend analysis dictionary
        """
        if len(scores) < 2:
            return {
                "trend": "insufficient_data",
                "change": 0.0,
                "velocity": 0.0,
                "acceleration": 0.0
            }
        
        # Sort by date
        scores.sort(key=lambda x: x[0])
        
        # Calculate changes
        first_score = scores[0][1]
        last_score = scores[-1][1]
        change = last_score - first_score
        
        # Calculate velocity (rate of change)
        time_diff = (scores[-1][0] - scores[0][0]).days
        velocity = change / max(time_diff, 1)
        
        # Calculate acceleration if enough data points
        acceleration = 0.0
        if len(scores) >= 3:
            mid_point = len(scores) // 2
            first_half_velocity = (scores[mid_point][1] - scores[0][1]) / max((scores[mid_point][0] - scores[0][0]).days, 1)
            second_half_velocity = (scores[-1][1] - scores[mid_point][1]) / max((scores[-1][0] - scores[mid_point][0]).days, 1)
            acceleration = second_half_velocity - first_half_velocity
        
        # Determine trend
        if abs(change) < 1:
            trend = "stable"
        elif change > 0:
            if acceleration > 0:
                trend = "improving_accelerating"
            elif acceleration < -0.1:
                trend = "improving_decelerating"
            else:
                trend = "improving"
        else:
            if acceleration < 0:
                trend = "declining_accelerating"
            elif acceleration > 0.1:
                trend = "declining_decelerating"
            else:
                trend = "declining"
        
        return {
            "trend": trend,
            "change": change,
            "velocity": velocity,
            "acceleration": acceleration,
            "first_score": first_score,
            "last_score": last_score,
            "average_score": sum(s[1] for s in scores) / len(scores)
        }
    
    def calculate_competitive_score(
        self,
        brand_score: float,
        competitor_scores: list[float]
    ) -> Dict:
        """
        Calculate competitive GEO score.
        
        Args:
            brand_score: Brand's GEO score
            competitor_scores: List of competitor GEO scores
        
        Returns:
            Competitive analysis dictionary
        """
        if not competitor_scores:
            return {
                "relative_score": brand_score,
                "rank": 1,
                "percentile": 100.0,
                "gap_to_leader": 0.0,
                "competitive_index": 1.0
            }
        
        all_scores = [brand_score] + competitor_scores
        all_scores.sort(reverse=True)
        
        rank = all_scores.index(brand_score) + 1
        percentile = (len(all_scores) - rank) / len(all_scores) * 100
        gap_to_leader = all_scores[0] - brand_score
        
        # Competitive index (1.0 = average, >1.0 = above average)
        avg_competitor_score = sum(competitor_scores) / len(competitor_scores)
        competitive_index = brand_score / max(avg_competitor_score, 1)
        
        return {
            "relative_score": brand_score,
            "rank": rank,
            "total_competitors": len(competitor_scores),
            "percentile": percentile,
            "gap_to_leader": gap_to_leader,
            "competitive_index": competitive_index,
            "average_competitor_score": avg_competitor_score,
            "max_competitor_score": max(competitor_scores),
            "min_competitor_score": min(competitor_scores)
        }
    
    def recommend_improvements(self, component_scores: Dict[str, float]) -> list[Dict]:
        """
        Recommend improvements based on component scores.
        
        Args:
            component_scores: Dictionary of component scores
        
        Returns:
            List of improvement recommendations
        """
        recommendations = []
        
        # Check each component
        if component_scores.get("citation_frequency", 0) < 0.5:
            recommendations.append({
                "component": "citation_frequency",
                "priority": "high",
                "recommendation": "Increase brand mentions and citations in content",
                "potential_impact": self.weights["citation_frequency"] * (1 - component_scores.get("citation_frequency", 0))
            })
        
        if component_scores.get("sentiment", 0.5) < 0.6:
            recommendations.append({
                "component": "sentiment",
                "priority": "high",
                "recommendation": "Improve brand sentiment through positive messaging",
                "potential_impact": self.weights["sentiment"] * (1 - component_scores.get("sentiment", 0.5))
            })
        
        if component_scores.get("relevance", 0) < 0.7:
            recommendations.append({
                "component": "relevance",
                "priority": "medium",
                "recommendation": "Ensure content directly addresses user queries",
                "potential_impact": self.weights["relevance"] * (1 - component_scores.get("relevance", 0))
            })
        
        if component_scores.get("authority", 0) < 0.6:
            recommendations.append({
                "component": "authority",
                "priority": "medium",
                "recommendation": "Get cited by more authoritative sources",
                "potential_impact": self.weights["authority"] * (1 - component_scores.get("authority", 0))
            })
        
        if component_scores.get("position", 0) < 0.5:
            recommendations.append({
                "component": "position",
                "priority": "low",
                "recommendation": "Optimize for featured snippets and top positions",
                "potential_impact": self.weights["position"] * (1 - component_scores.get("position", 0))
            })
        
        # Sort by potential impact
        recommendations.sort(key=lambda x: x["potential_impact"], reverse=True)
        
        return recommendations