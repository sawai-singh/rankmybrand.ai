"""Share of Voice (SOV) calculation."""

from typing import List, Dict, Set
from collections import defaultdict
from src.models.schemas import BrandMention, Entity


class SOVCalculator:
    """Calculate Share of Voice metrics."""
    
    def __init__(self):
        # Brand categories for SOV calculation
        self.brand_categories = {
            "seo_tools": ["rankmybrand", "athena", "semrush", "ahrefs", "moz"],
            "ai_writing": ["jasper", "copy.ai", "writesonic", "rytr", "anyword"],
            "ai_platforms": ["openai", "anthropic", "google", "microsoft", "meta"],
            "analytics": ["google analytics", "adobe", "mixpanel", "amplitude"]
        }
    
    def calculate(
        self,
        brand_mentions: List[BrandMention],
        all_entities: List[Entity]
    ) -> float:
        """
        Calculate Share of Voice.
        
        Args:
            brand_mentions: Mentions of the target brand
            all_entities: All entities detected in response
        
        Returns:
            Share of Voice percentage (0-100)
        """
        if not all_entities:
            return 0.0
        
        # Count brand/competitor mentions
        brand_entity_count = defaultdict(int)
        
        for entity in all_entities:
            if entity.type in ["BRAND", "COMPETITOR"]:
                brand_name = entity.text.lower()
                brand_entity_count[brand_name] += 1
        
        # Calculate total mentions
        total_mentions = sum(brand_entity_count.values())
        
        if total_mentions == 0:
            return 0.0
        
        # Count target brand mentions
        target_mentions = len(brand_mentions)
        
        # Calculate SOV
        sov = (target_mentions / total_mentions) * 100
        
        return min(100, sov)  # Cap at 100%
    
    def calculate_category_sov(
        self,
        brand_name: str,
        entities: List[Entity]
    ) -> Dict[str, float]:
        """
        Calculate SOV by category.
        
        Args:
            brand_name: Target brand name
            entities: All entities in responses
        
        Returns:
            SOV by category
        """
        category_sov = {}
        brand_lower = brand_name.lower()
        
        for category, brands in self.brand_categories.items():
            if brand_lower not in brands:
                continue
            
            # Count mentions in this category
            category_mentions = defaultdict(int)
            
            for entity in entities:
                if entity.type in ["BRAND", "COMPETITOR"]:
                    entity_lower = entity.text.lower()
                    if entity_lower in brands:
                        category_mentions[entity_lower] += 1
            
            total = sum(category_mentions.values())
            if total > 0:
                brand_count = category_mentions.get(brand_lower, 0)
                category_sov[category] = (brand_count / total) * 100
            else:
                category_sov[category] = 0.0
        
        return category_sov
    
    def calculate_sentiment_weighted_sov(
        self,
        brand_mentions: List[BrandMention],
        all_brand_mentions: List[BrandMention]
    ) -> float:
        """
        Calculate sentiment-weighted Share of Voice.
        
        Positive mentions count more than neutral, which count more than negative.
        """
        if not all_brand_mentions:
            return 0.0
        
        # Weight by sentiment
        sentiment_weights = {
            "POSITIVE": 1.5,
            "NEUTRAL": 1.0,
            "NEGATIVE": 0.5
        }
        
        # Calculate weighted mentions for target brand
        target_weighted = sum(
            sentiment_weights.get(m.sentiment_label, 1.0)
            for m in brand_mentions
        )
        
        # Calculate weighted mentions for all brands
        total_weighted = sum(
            sentiment_weights.get(m.sentiment_label, 1.0)
            for m in all_brand_mentions
        )
        
        if total_weighted == 0:
            return 0.0
        
        return (target_weighted / total_weighted) * 100
    
    def calculate_competitive_sov(
        self,
        brand_name: str,
        competitor_names: List[str],
        entities: List[Entity]
    ) -> Dict:
        """
        Calculate competitive Share of Voice analysis.
        
        Args:
            brand_name: Target brand
            competitor_names: List of competitor names
            entities: All entities
        
        Returns:
            Competitive SOV analysis
        """
        brand_lower = brand_name.lower()
        competitor_lower = [c.lower() for c in competitor_names]
        
        # Count mentions
        mention_counts = defaultdict(int)
        
        for entity in entities:
            if entity.type in ["BRAND", "COMPETITOR"]:
                entity_lower = entity.text.lower()
                if entity_lower == brand_lower or entity_lower in competitor_lower:
                    mention_counts[entity_lower] += 1
        
        total_mentions = sum(mention_counts.values())
        brand_mentions = mention_counts.get(brand_lower, 0)
        
        if total_mentions == 0:
            return {
                "brand_sov": 0.0,
                "competitor_sov": {},
                "rank": 1,
                "total_mentions": 0,
                "brand_mentions": 0
            }
        
        # Calculate SOV for each
        sov_scores = {}
        for brand, count in mention_counts.items():
            sov_scores[brand] = (count / total_mentions) * 100
        
        # Rank brands by SOV
        ranked = sorted(sov_scores.items(), key=lambda x: x[1], reverse=True)
        brand_rank = next(
            (i + 1 for i, (b, _) in enumerate(ranked) if b == brand_lower),
            len(ranked) + 1
        )
        
        return {
            "brand_sov": sov_scores.get(brand_lower, 0.0),
            "competitor_sov": {
                k: v for k, v in sov_scores.items() 
                if k != brand_lower
            },
            "rank": brand_rank,
            "total_mentions": total_mentions,
            "brand_mentions": brand_mentions,
            "leader": ranked[0][0] if ranked else None,
            "leader_sov": ranked[0][1] if ranked else 0.0
        }
    
    def analyze_sov_trend(
        self,
        historical_sov: List[tuple[str, float]]  # (date, sov)
    ) -> Dict:
        """
        Analyze SOV trend over time.
        
        Args:
            historical_sov: List of (date, sov) tuples
        
        Returns:
            Trend analysis
        """
        if len(historical_sov) < 2:
            return {
                "trend": "insufficient_data",
                "change": 0.0,
                "average": historical_sov[0][1] if historical_sov else 0.0
            }
        
        # Sort by date
        historical_sov.sort(key=lambda x: x[0])
        
        first_sov = historical_sov[0][1]
        last_sov = historical_sov[-1][1]
        average_sov = sum(s[1] for s in historical_sov) / len(historical_sov)
        
        change = last_sov - first_sov
        
        # Determine trend
        if abs(change) < 1:
            trend = "stable"
        elif change > 5:
            trend = "significant_growth"
        elif change > 0:
            trend = "growth"
        elif change < -5:
            trend = "significant_decline"
        else:
            trend = "decline"
        
        # Calculate volatility
        if len(historical_sov) > 2:
            differences = [
                abs(historical_sov[i][1] - historical_sov[i-1][1])
                for i in range(1, len(historical_sov))
            ]
            volatility = sum(differences) / len(differences)
        else:
            volatility = abs(change)
        
        return {
            "trend": trend,
            "change": change,
            "change_percentage": (change / first_sov * 100) if first_sov > 0 else 0,
            "average": average_sov,
            "current": last_sov,
            "peak": max(s[1] for s in historical_sov),
            "trough": min(s[1] for s in historical_sov),
            "volatility": volatility
        }
    
    def recommend_sov_improvements(
        self,
        current_sov: float,
        competitor_sov: Dict[str, float]
    ) -> List[Dict]:
        """
        Recommend improvements to increase SOV.
        
        Args:
            current_sov: Current brand SOV
            competitor_sov: Competitor SOV scores
        
        Returns:
            List of recommendations
        """
        recommendations = []
        
        # Find leader
        if competitor_sov:
            leader = max(competitor_sov.items(), key=lambda x: x[1])
            leader_name, leader_sov = leader
        else:
            leader_name, leader_sov = None, 0
        
        # Recommendations based on position
        if current_sov < 10:
            recommendations.append({
                "priority": "critical",
                "action": "Increase brand visibility",
                "description": "Brand has very low share of voice. Focus on creating more brand-centric content and getting mentioned in AI responses.",
                "potential_gain": 20 - current_sov
            })
        
        if leader_sov and current_sov < leader_sov:
            gap = leader_sov - current_sov
            recommendations.append({
                "priority": "high",
                "action": f"Close gap with {leader_name}",
                "description": f"Competitor {leader_name} has {gap:.1f}% higher SOV. Analyze their content strategy and improve brand positioning.",
                "potential_gain": gap
            })
        
        if current_sov < 30:
            recommendations.append({
                "priority": "medium",
                "action": "Improve content relevance",
                "description": "Ensure brand is mentioned in relevant contexts and answers.",
                "potential_gain": 10
            })
        
        if len(competitor_sov) > 3 and current_sov < 25:
            recommendations.append({
                "priority": "medium",
                "action": "Differentiate from competitors",
                "description": "Too many competitors sharing voice. Focus on unique value propositions.",
                "potential_gain": 15
            })
        
        # Sort by potential gain
        recommendations.sort(key=lambda x: x["potential_gain"], reverse=True)
        
        return recommendations