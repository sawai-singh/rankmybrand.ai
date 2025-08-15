"""GEO (Generative Engine Optimization) score calculation with robust validation."""

from typing import Dict, List, Tuple, Optional
from datetime import datetime, timezone
import math


class GEOCalculator:
    """
    Calculate GEO (Generative Engine Optimization) scores.
    
    GEO scores range from 0-100 and measure brand visibility/performance in AI responses.
    Higher scores indicate better optimization for generative AI engines.
    
    Score interpretation:
    - 80-100: Excellent visibility and optimization
    - 60-79: Good performance with room for improvement  
    - 40-59: Average performance, significant optimization needed
    - 20-39: Poor visibility, major improvements required
    - 0-19: Critical issues, comprehensive optimization needed
    """
    
    def __init__(
        self,
        weights: Optional[Dict[str, float]] = None,
        citation_cap: int = 10,
        recency_half_life_days: float = 30.0,
        trend_stability_threshold: float = 1.0,
        acceleration_threshold: float = 0.1
    ):
        """
        Initialize GEO calculator with configurable parameters.
        
        Args:
            weights: Component weights (must sum to ~1.0)
            citation_cap: Maximum citations to consider (default 10)
            recency_half_life_days: Days for score to halve (default 30)
            trend_stability_threshold: Change threshold for stable trend (default 1.0)
            acceleration_threshold: Threshold for acceleration detection (default 0.1)
        """
        # Default weight configuration
        self.weights = weights or {
            "citation_frequency": 0.35,
            "sentiment": 0.25,
            "relevance": 0.20,
            "position": 0.10,
            "authority": 0.10
        }
        
        # Validate and normalize weights
        self._validate_and_normalize_weights()
        
        # Configurable parameters
        self.citation_cap = max(1, citation_cap)
        self.recency_half_life_days = max(1.0, recency_half_life_days)
        self.trend_stability_threshold = max(0.0, trend_stability_threshold)
        self.acceleration_threshold = max(0.0, acceleration_threshold)
        
        # Pre-calculate ln(2) for decay
        self.ln2 = math.log(2)
    
    def _validate_and_normalize_weights(self) -> None:
        """Validate weights sum to ~1.0 and normalize if needed."""
        weight_sum = sum(self.weights.values())
        
        # Allow small epsilon for floating point
        epsilon = 0.001
        if abs(weight_sum - 1.0) > epsilon:
            # Normalize weights to sum to 1.0
            if weight_sum > 0:
                for key in self.weights:
                    self.weights[key] /= weight_sum
            else:
                # Reset to equal weights if invalid
                num_components = len(self.weights)
                for key in self.weights:
                    self.weights[key] = 1.0 / num_components if num_components > 0 else 0.2
    
    def set_weights(self, weights: Dict[str, float]) -> None:
        """
        Update component weights.
        
        Args:
            weights: New weight configuration (will be normalized to sum to 1.0)
        """
        self.weights = weights.copy()
        self._validate_and_normalize_weights()
    
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
        Calculate GEO score from components with validation.
        
        Args:
            citation_frequency: How often brand is cited (0+, capped at citation_cap)
            sentiment_score: Sentiment (-1 to 1)
            relevance_score: Query-answer relevance (0-1)
            authority_score: Domain authority of sources (0-1)
            position_weight: Position in results (0-1, 1=top position)
            response_date: When response was collected (for recency weighting)
        
        Returns:
            GEO score (0-100)
        """
        # Validate and clamp inputs
        citation_frequency = max(0.0, citation_frequency) if citation_frequency is not None else 0.0
        sentiment_score = max(-1.0, min(1.0, sentiment_score)) if sentiment_score is not None else 0.0
        relevance_score = max(0.0, min(1.0, relevance_score)) if relevance_score is not None else 0.0
        authority_score = max(0.0, min(1.0, authority_score)) if authority_score is not None else 0.0
        position_weight = max(0.0, min(1.0, position_weight)) if position_weight is not None else 0.0
        
        # Normalize components to [0, 1]
        citation_freq_normalized = min(citation_frequency / self.citation_cap, 1.0)
        sentiment_normalized = (sentiment_score + 1.0) / 2.0  # Convert [-1, 1] to [0, 1]
        
        # Ensure all normalized values are clamped
        citation_freq_normalized = max(0.0, min(1.0, citation_freq_normalized))
        sentiment_normalized = max(0.0, min(1.0, sentiment_normalized))
        
        # Calculate weighted score
        raw_score = (
            self.weights.get("citation_frequency", 0.35) * citation_freq_normalized +
            self.weights.get("sentiment", 0.25) * sentiment_normalized +
            self.weights.get("relevance", 0.20) * relevance_score +
            self.weights.get("position", 0.10) * position_weight +
            self.weights.get("authority", 0.10) * authority_score
        )
        
        # Apply recency weight if date provided
        if response_date:
            recency_weight = self._calculate_recency_weight(response_date)
            raw_score *= recency_weight
        
        # Convert to 0-100 scale and clamp
        geo_score = max(0.0, min(100.0, raw_score * 100))
        
        return round(geo_score, 2)
    
    def _calculate_recency_weight(self, response_date: datetime) -> float:
        """
        Calculate recency weight using exponential decay with fractional days.
        
        Args:
            response_date: Date of response
            
        Returns:
            Weight between 0.1 and 1.0
        """
        # Use timezone-aware datetime
        now = datetime.now(timezone.utc)
        
        # Ensure response_date is timezone-aware
        if response_date.tzinfo is None:
            response_date = response_date.replace(tzinfo=timezone.utc)
        
        # Calculate fractional days difference
        time_diff = now - response_date
        days_old = time_diff.total_seconds() / 86400.0  # Use fractional days
        
        # Handle future dates (clamp to 1.0)
        if days_old < 0:
            return 1.0
        
        # Exponential decay formula: weight = 2^(-days/half_life)
        # Using ln(2) / half_life as decay rate
        weight = math.pow(2, -days_old / self.recency_half_life_days)
        
        # Clamp between 0.1 and 1.0
        return max(0.1, min(1.0, weight))
    
    def calculate_trend(self, scores: List[Tuple[datetime, float]]) -> Dict:
        """
        Calculate GEO score trend over time.
        
        Args:
            scores: List of (datetime, score) tuples
        
        Returns:
            Trend analysis dictionary with metrics
        """
        if not scores:
            return {
                "trend": "no_data",
                "change": 0.0,
                "velocity": 0.0,
                "acceleration": 0.0,
                "span_days": 0.0,
                "data_points": 0
            }
        
        if len(scores) < 2:
            return {
                "trend": "insufficient_data",
                "change": 0.0,
                "velocity": 0.0,
                "acceleration": 0.0,
                "span_days": 0.0,
                "data_points": len(scores),
                "first_score": round(scores[0][1], 2) if scores else 0.0,
                "last_score": round(scores[0][1], 2) if scores else 0.0
            }
        
        # Sort a copy to avoid mutation
        sorted_scores = sorted(scores, key=lambda x: x[0])
        
        # Calculate basic metrics
        first_score = sorted_scores[0][1]
        last_score = sorted_scores[-1][1]
        change = last_score - first_score
        
        # Calculate time span in fractional days
        time_span = sorted_scores[-1][0] - sorted_scores[0][0]
        span_days = time_span.total_seconds() / 86400.0
        
        # Calculate velocity (rate of change per day)
        velocity = change / max(span_days, 0.001)  # Avoid division by zero
        
        # Calculate acceleration if enough data points
        acceleration = 0.0
        if len(sorted_scores) >= 3:
            mid_point = len(sorted_scores) // 2
            
            # First half velocity
            first_half_span = (sorted_scores[mid_point][0] - sorted_scores[0][0]).total_seconds() / 86400.0
            if first_half_span > 0:
                first_half_velocity = (sorted_scores[mid_point][1] - sorted_scores[0][1]) / first_half_span
            else:
                first_half_velocity = 0.0
            
            # Second half velocity
            second_half_span = (sorted_scores[-1][0] - sorted_scores[mid_point][0]).total_seconds() / 86400.0
            if second_half_span > 0:
                second_half_velocity = (sorted_scores[-1][1] - sorted_scores[mid_point][1]) / second_half_span
            else:
                second_half_velocity = 0.0
            
            acceleration = second_half_velocity - first_half_velocity
        
        # Determine trend with configurable thresholds
        if abs(change) < self.trend_stability_threshold:
            trend = "stable"
        elif change > 0:
            if acceleration > self.acceleration_threshold:
                trend = "improving_accelerating"
            elif acceleration < -self.acceleration_threshold:
                trend = "improving_decelerating"
            else:
                trend = "improving"
        else:
            if acceleration < -self.acceleration_threshold:
                trend = "declining_accelerating"
            elif acceleration > self.acceleration_threshold:
                trend = "declining_decelerating"
            else:
                trend = "declining"
        
        # Calculate additional statistics
        all_scores = [s[1] for s in sorted_scores]
        average_score = sum(all_scores) / len(all_scores)
        
        # Variance and standard deviation
        variance = sum((s - average_score) ** 2 for s in all_scores) / len(all_scores)
        std_dev = math.sqrt(variance)
        
        return {
            "trend": trend,
            "change": round(change, 2),
            "velocity": round(velocity, 4),
            "acceleration": round(acceleration, 4),
            "span_days": round(span_days, 2),
            "data_points": len(sorted_scores),
            "first_score": round(first_score, 2),
            "last_score": round(last_score, 2),
            "average_score": round(average_score, 2),
            "std_dev": round(std_dev, 2),
            "min_score": round(min(all_scores), 2),
            "max_score": round(max(all_scores), 2)
        }
    
    def calculate_competitive_score(
        self,
        brand_score: float,
        competitor_scores: List[float]
    ) -> Dict:
        """
        Calculate competitive GEO score with robust ranking.
        
        Args:
            brand_score: Brand's GEO score
            competitor_scores: List of competitor GEO scores
        
        Returns:
            Competitive analysis dictionary
        """
        # Validate inputs
        brand_score = max(0.0, min(100.0, brand_score)) if brand_score is not None else 0.0
        
        # Filter and validate competitor scores
        valid_competitors = [
            max(0.0, min(100.0, s)) 
            for s in competitor_scores 
            if s is not None
        ]
        
        if not valid_competitors:
            return {
                "relative_score": round(brand_score, 2),
                "rank": 1,
                "total_entities": 1,
                "total_competitors": 0,
                "percentile": 100.0,
                "gap_to_leader": 0.0,
                "competitive_index": 1.0,
                "is_leader": True,
                "delta_vs_average": 0.0
            }
        
        # Calculate rank efficiently (handles ties)
        scores_above = sum(1 for s in valid_competitors if s > brand_score)
        rank = scores_above + 1
        
        total_entities = len(valid_competitors) + 1
        percentile = ((total_entities - rank) / total_entities) * 100
        
        # Calculate gaps and indices
        max_score = max(valid_competitors)
        gap_to_leader = max(0.0, max_score - brand_score)
        
        avg_competitor_score = sum(valid_competitors) / len(valid_competitors)
        delta_vs_average = brand_score - avg_competitor_score
        
        # Competitive index with division by zero protection
        competitive_index = brand_score / max(avg_competitor_score, 0.01)
        
        return {
            "relative_score": round(brand_score, 2),
            "rank": rank,
            "total_entities": total_entities,
            "total_competitors": len(valid_competitors),
            "percentile": round(percentile, 1),
            "gap_to_leader": round(gap_to_leader, 2),
            "competitive_index": round(competitive_index, 3),
            "is_leader": rank == 1,
            "delta_vs_average": round(delta_vs_average, 2),
            "average_competitor_score": round(avg_competitor_score, 2),
            "max_competitor_score": round(max_score, 2),
            "min_competitor_score": round(min(valid_competitors), 2)
        }
    
    def recommend_improvements(self, component_scores: Dict[str, float]) -> List[Dict]:
        """
        Recommend improvements based on component scores.
        
        Args:
            component_scores: Dictionary of component scores (normalized to 0-1)
        
        Returns:
            List of improvement recommendations sorted by impact
        """
        recommendations = []
        
        # Validate and get scores with defaults
        citation_freq = max(0.0, min(1.0, component_scores.get("citation_frequency", 0.0)))
        sentiment = max(0.0, min(1.0, component_scores.get("sentiment", 0.5)))
        relevance = max(0.0, min(1.0, component_scores.get("relevance", 0.0)))
        authority = max(0.0, min(1.0, component_scores.get("authority", 0.0)))
        position = max(0.0, min(1.0, component_scores.get("position", 0.0)))
        
        # Check citation frequency
        if citation_freq < 0.5:
            recommendations.append({
                "component": "citation_frequency",
                "current_score": round(citation_freq, 2),
                "target_score": 0.8,
                "priority": "high",
                "recommendation": "Increase brand mentions and citations in content",
                "specific_actions": [
                    "Create more branded content",
                    "Improve SEO for brand terms",
                    "Increase content distribution"
                ],
                "potential_impact": round(self.weights["citation_frequency"] * (0.8 - citation_freq), 3)
            })
        
        # Check sentiment
        if sentiment < 0.6:
            recommendations.append({
                "component": "sentiment",
                "current_score": round(sentiment, 2),
                "target_score": 0.8,
                "priority": "high",
                "recommendation": "Improve brand sentiment through positive messaging",
                "specific_actions": [
                    "Address negative feedback",
                    "Highlight positive reviews",
                    "Improve customer experience"
                ],
                "potential_impact": round(self.weights["sentiment"] * (0.8 - sentiment), 3)
            })
        
        # Check relevance
        if relevance < 0.7:
            recommendations.append({
                "component": "relevance",
                "current_score": round(relevance, 2),
                "target_score": 0.85,
                "priority": "medium",
                "recommendation": "Ensure content directly addresses user queries",
                "specific_actions": [
                    "Optimize for question-based queries",
                    "Improve content comprehensiveness",
                    "Use structured data markup"
                ],
                "potential_impact": round(self.weights["relevance"] * (0.85 - relevance), 3)
            })
        
        # Check authority
        if authority < 0.6:
            recommendations.append({
                "component": "authority",
                "current_score": round(authority, 2),
                "target_score": 0.75,
                "priority": "medium",
                "recommendation": "Get cited by more authoritative sources",
                "specific_actions": [
                    "Build high-quality backlinks",
                    "Partner with authoritative sites",
                    "Create research-backed content"
                ],
                "potential_impact": round(self.weights["authority"] * (0.75 - authority), 3)
            })
        
        # Check position
        if position < 0.5:
            recommendations.append({
                "component": "position",
                "current_score": round(position, 2),
                "target_score": 0.7,
                "priority": "low",
                "recommendation": "Optimize for featured snippets and top positions",
                "specific_actions": [
                    "Format content for featured snippets",
                    "Improve page load speed",
                    "Enhance mobile experience"
                ],
                "potential_impact": round(self.weights["position"] * (0.7 - position), 3)
            })
        
        # Sort by potential impact (descending)
        recommendations.sort(key=lambda x: x["potential_impact"], reverse=True)
        
        # Add rank to recommendations
        for i, rec in enumerate(recommendations, 1):
            rec["rank"] = i
        
        return recommendations
    
    def get_component_breakdown(
        self,
        citation_frequency: float,
        sentiment_score: float,
        relevance_score: float,
        authority_score: float,
        position_weight: float
    ) -> Dict:
        """
        Get detailed breakdown of score components.
        
        Returns:
            Dictionary with component contributions and percentages
        """
        # Validate and normalize inputs
        citation_frequency = max(0.0, citation_frequency) if citation_frequency is not None else 0.0
        sentiment_score = max(-1.0, min(1.0, sentiment_score)) if sentiment_score is not None else 0.0
        relevance_score = max(0.0, min(1.0, relevance_score)) if relevance_score is not None else 0.0
        authority_score = max(0.0, min(1.0, authority_score)) if authority_score is not None else 0.0
        position_weight = max(0.0, min(1.0, position_weight)) if position_weight is not None else 0.0
        
        # Normalize components
        citation_normalized = min(citation_frequency / self.citation_cap, 1.0)
        sentiment_normalized = (sentiment_score + 1.0) / 2.0
        
        # Calculate contributions
        contributions = {
            "citation_frequency": citation_normalized * self.weights["citation_frequency"],
            "sentiment": sentiment_normalized * self.weights["sentiment"],
            "relevance": relevance_score * self.weights["relevance"],
            "authority": authority_score * self.weights["authority"],
            "position": position_weight * self.weights["position"]
        }
        
        total_contribution = sum(contributions.values())
        
        # Calculate percentages
        percentages = {
            k: (v / total_contribution * 100) if total_contribution > 0 else 0.0
            for k, v in contributions.items()
        }
        
        return {
            "raw_scores": {
                "citation_frequency": round(citation_frequency, 2),
                "sentiment": round(sentiment_score, 3),
                "relevance": round(relevance_score, 3),
                "authority": round(authority_score, 3),
                "position": round(position_weight, 3)
            },
            "normalized_scores": {
                "citation_frequency": round(citation_normalized, 3),
                "sentiment": round(sentiment_normalized, 3),
                "relevance": round(relevance_score, 3),
                "authority": round(authority_score, 3),
                "position": round(position_weight, 3)
            },
            "weights": {k: round(v, 3) for k, v in self.weights.items()},
            "contributions": {k: round(v, 4) for k, v in contributions.items()},
            "percentages": {k: round(v, 1) for k, v in percentages.items()},
            "total_score": round(total_contribution * 100, 2)
        }