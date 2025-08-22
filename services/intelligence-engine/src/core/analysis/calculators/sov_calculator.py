"""Share of Voice (SOV) calculation with robust normalization and validation."""

from typing import List, Dict, Set, Optional, Tuple
from datetime import datetime
from collections import defaultdict
import re
from src.models.schemas import BrandMention, Entity


class SOVCalculator:
    """Calculate Share of Voice metrics with brand normalization and validation."""
    
    def __init__(
        self,
        enable_fuzzy_matching: bool = True,
        rounding_precision: int = 1
    ):
        """
        Initialize SOV Calculator with configurable parameters.
        
        Args:
            enable_fuzzy_matching: Enable fuzzy brand name matching
            rounding_precision: Decimal places for percentage rounding
        """
        
        # Configuration
        self.enable_fuzzy_matching = enable_fuzzy_matching
        self.rounding_precision = rounding_precision
        
        # Sentiment weight configuration (normalized labels)
        self.sentiment_weights = {
            "positive": 1.5,
            "neutral": 1.0,
            "negative": 0.5
        }
        
        # Brand normalization cache
        self._normalized_cache = {}
    
    def _normalize_brand_name(self, brand_name: str) -> str:
        """
        Normalize brand name for consistent matching.
        
        Args:
            brand_name: Original brand name
            
        Returns:
            Normalized brand name
        """
        if not brand_name:
            return ""
        
        # Check cache
        if brand_name in self._normalized_cache:
            return self._normalized_cache[brand_name]
        
        # Convert to lowercase
        normalized = brand_name.lower().strip()
        
        # Remove common suffixes
        suffixes = [".com", ".ai", ".io", " ai", " inc", " corp", " ltd", " llc"]
        for suffix in suffixes:
            if normalized.endswith(suffix):
                normalized = normalized[:-len(suffix)].strip()
        
        # Remove special characters but keep spaces
        normalized = re.sub(r'[^\w\s-]', '', normalized)
        
        # Normalize whitespace
        normalized = ' '.join(normalized.split())
        
        # Cache result
        self._normalized_cache[brand_name] = normalized
        
        return normalized
    
    def _are_brands_matching(self, brand1: str, brand2: str) -> bool:
        """
        Check if two brand names match (with optional fuzzy matching).
        
        Args:
            brand1: First brand name
            brand2: Second brand name
            
        Returns:
            True if brands match
        """
        norm1 = self._normalize_brand_name(brand1)
        norm2 = self._normalize_brand_name(brand2)
        
        # Exact match
        if norm1 == norm2:
            return True
        
        if not self.enable_fuzzy_matching:
            return False
        
        # Check if one contains the other (for variations)
        if len(norm1) > 2 and len(norm2) > 2:
            if norm1 in norm2 or norm2 in norm1:
                return True
        
        # Check without spaces (e.g., "rank my brand" vs "rankmybrand")
        norm1_no_space = norm1.replace(' ', '')
        norm2_no_space = norm2.replace(' ', '')
        if norm1_no_space == norm2_no_space:
            return True
        
        return False
    
    def _count_brand_entities(
        self,
        entities: List[Entity],
        target_brand: Optional[str] = None
    ) -> Dict[str, int]:
        """
        Count brand and competitor mentions from entities.
        
        Args:
            entities: List of entities
            target_brand: Optional target brand to track separately
            
        Returns:
            Dictionary of normalized brand names to counts
        """
        brand_counts = defaultdict(int)
        
        if not entities:
            return dict(brand_counts)
        
        for entity in entities:
            # Validate entity
            if not entity or not hasattr(entity, 'type'):
                continue
            
            if entity.type in ["BRAND", "COMPETITOR"]:
                # Get confidence weight if available
                confidence = getattr(entity, 'confidence', 1.0)
                if confidence < 0.3:  # Skip very low confidence entities
                    continue
                
                normalized = self._normalize_brand_name(entity.text)
                if normalized:
                    # Weight by confidence (optional)
                    brand_counts[normalized] += 1  # Or use confidence as weight
        
        return dict(brand_counts)
    
    def calculate(
        self,
        brand_mentions: Optional[List[BrandMention]],
        all_entities: Optional[List[Entity]],
        target_brand: Optional[str] = None
    ) -> float:
        """
        Calculate Share of Voice with validation and normalization.
        
        Args:
            brand_mentions: Mentions of the target brand
            all_entities: All entities detected in response
            target_brand: Optional explicit target brand name
            
        Returns:
            Share of Voice percentage (0-100)
        """
        # Validate inputs
        if not all_entities:
            return 0.0
        
        brand_mentions = brand_mentions or []
        
        # Count all brand entities
        brand_entity_counts = self._count_brand_entities(all_entities)
        
        if not brand_entity_counts:
            return 0.0
        
        # Determine target brand
        if target_brand:
            target_normalized = self._normalize_brand_name(target_brand)
        elif brand_mentions:
            # Infer from first brand mention
            target_normalized = self._normalize_brand_name(brand_mentions[0].brand_name)
        else:
            return 0.0
        
        # Count target brand mentions (use entity counts for consistency)
        target_count = 0
        for brand, count in brand_entity_counts.items():
            if self._are_brands_matching(brand, target_normalized):
                target_count += count
        
        # Calculate total mentions
        total_mentions = sum(brand_entity_counts.values())
        
        if total_mentions == 0:
            return 0.0
        
        # Calculate SOV
        sov = (target_count / total_mentions) * 100
        
        # Round and clamp
        return round(min(100.0, max(0.0, sov)), self.rounding_precision)
    
    def calculate_category_sov(
        self,
        brand_name: str,
        entities: Optional[List[Entity]],
        categories: Optional[Dict[str, List[str]]] = None
    ) -> Dict[str, float]:
        """
        Calculate SOV by category with validation.
        
        Args:
            brand_name: Target brand name
            entities: All entities in responses
            categories: Optional brand categories (e.g., from customer context)
        
        Returns:
            SOV by category
        """
        if not entities or not brand_name:
            return {}
        
        # If no categories provided, create a single "all_brands" category from detected entities
        if not categories:
            # Extract all unique brand names from entities
            all_brands = set()
            for entity in entities:
                if entity and hasattr(entity, 'type') and entity.type in ["BRAND", "COMPETITOR"]:
                    all_brands.add(self._normalize_brand_name(entity.text))
            
            if not all_brands:
                return {}
            
            # Create a single category with all detected brands
            categories = {"all_competitors": list(all_brands)}
        
        category_sov = {}
        brand_normalized = self._normalize_brand_name(brand_name)
        
        # Count entities
        brand_counts = self._count_brand_entities(entities)
        
        for category, category_brands in categories.items():
            # Normalize category brands
            category_normalized = [self._normalize_brand_name(b) for b in category_brands]
            
            # Check if target brand is in this category
            brand_in_category = False
            for cat_brand in category_normalized:
                if self._are_brands_matching(brand_normalized, cat_brand):
                    brand_in_category = True
                    break
            
            if not brand_in_category:
                # Add the brand to the category for calculation if not present
                category_normalized.append(brand_normalized)
            
            # Count mentions in this category
            category_total = 0
            target_total = 0
            
            for brand, count in brand_counts.items():
                for cat_brand in category_normalized:
                    if self._are_brands_matching(brand, cat_brand):
                        category_total += count
                        if self._are_brands_matching(brand, brand_normalized):
                            target_total += count
                        break
            
            if category_total > 0:
                sov = (target_total / category_total) * 100
                category_sov[category] = round(sov, self.rounding_precision)
            else:
                category_sov[category] = 0.0
        
        return category_sov
    
    def calculate_sentiment_weighted_sov(
        self,
        brand_mentions: Optional[List[BrandMention]],
        all_brand_mentions: Optional[List[BrandMention]]
    ) -> float:
        """
        Calculate sentiment-weighted Share of Voice with proper label normalization.
        
        Positive mentions count more than neutral, which count more than negative.
        
        Args:
            brand_mentions: Target brand mentions
            all_brand_mentions: All brand mentions
            
        Returns:
            Sentiment-weighted SOV percentage
        """
        if not all_brand_mentions:
            return 0.0
        
        brand_mentions = brand_mentions or []
        
        # Calculate weighted mentions for target brand
        target_weighted = 0.0
        for mention in brand_mentions:
            if mention and hasattr(mention, 'sentiment_label'):
                # Normalize sentiment label
                sentiment = (mention.sentiment_label or "neutral").lower()
                weight = self.sentiment_weights.get(sentiment, 1.0)
                # Also consider confidence if available
                confidence = getattr(mention, 'confidence', 1.0)
                target_weighted += weight * confidence
        
        # Calculate weighted mentions for all brands
        total_weighted = 0.0
        for mention in all_brand_mentions:
            if mention and hasattr(mention, 'sentiment_label'):
                sentiment = (mention.sentiment_label or "neutral").lower()
                weight = self.sentiment_weights.get(sentiment, 1.0)
                confidence = getattr(mention, 'confidence', 1.0)
                total_weighted += weight * confidence
        
        if total_weighted == 0:
            return 0.0
        
        sov = (target_weighted / total_weighted) * 100
        return round(min(100.0, max(0.0, sov)), self.rounding_precision)
    
    def calculate_competitive_sov(
        self,
        brand_name: str,
        competitor_names: Optional[List[str]],
        entities: Optional[List[Entity]]
    ) -> Dict:
        """
        Calculate competitive Share of Voice analysis with normalization.
        
        Args:
            brand_name: Target brand
            competitor_names: Optional list of competitor names (auto-detected if None)
            entities: All entities
        
        Returns:
            Competitive SOV analysis
        """
        if not entities:
            return {
                "brand_sov": 0.0,
                "competitor_sov": {},
                "rank": 1,
                "total_mentions": 0,
                "brand_mentions": 0,
                "is_leader": False
            }
        
        brand_normalized = self._normalize_brand_name(brand_name)
        
        # If no competitor names provided, extract from entities
        if not competitor_names:
            competitor_names = []
            for entity in entities:
                if entity and hasattr(entity, 'type') and entity.type in ["BRAND", "COMPETITOR"]:
                    normalized = self._normalize_brand_name(entity.text)
                    # Don't include the target brand as a competitor
                    if not self._are_brands_matching(normalized, brand_normalized):
                        competitor_names.append(entity.text)
        
        competitors_normalized = [self._normalize_brand_name(c) for c in competitor_names]
        
        # Count all brand mentions
        all_brand_counts = self._count_brand_entities(entities)
        
        # Filter to only brands of interest
        relevant_counts = {}
        brand_total = 0
        
        for brand, count in all_brand_counts.items():
            # Check if it's the target brand
            if self._are_brands_matching(brand, brand_normalized):
                brand_total += count
                if brand_normalized not in relevant_counts:
                    relevant_counts[brand_normalized] = 0
                relevant_counts[brand_normalized] += count
            else:
                # Check if it's a competitor
                for comp in competitors_normalized:
                    if self._are_brands_matching(brand, comp):
                        if comp not in relevant_counts:
                            relevant_counts[comp] = 0
                        relevant_counts[comp] += count
                        break
        
        total_mentions = sum(relevant_counts.values())
        
        if total_mentions == 0:
            return {
                "brand_sov": 0.0,
                "competitor_sov": {},
                "rank": 1,
                "total_mentions": 0,
                "brand_mentions": 0,
                "is_leader": True
            }
        
        # Calculate SOV for each
        sov_scores = {}
        for brand, count in relevant_counts.items():
            sov = (count / total_mentions) * 100
            sov_scores[brand] = round(sov, self.rounding_precision)
        
        # Get brand SOV
        brand_sov = sov_scores.get(brand_normalized, 0.0)
        
        # Rank brands by SOV
        ranked = sorted(sov_scores.items(), key=lambda x: x[1], reverse=True)
        brand_rank = next(
            (i + 1 for i, (b, _) in enumerate(ranked) if b == brand_normalized),
            len(ranked) + 1
        )
        
        # Determine leader
        leader = ranked[0] if ranked else (None, 0.0)
        is_leader = (leader[0] == brand_normalized) if leader[0] else False
        
        return {
            "brand_sov": brand_sov,
            "competitor_sov": {
                k: v for k, v in sov_scores.items() 
                if k != brand_normalized
            },
            "rank": brand_rank,
            "total_mentions": total_mentions,
            "brand_mentions": brand_total,
            "is_leader": is_leader,
            "leader": leader[0],
            "leader_sov": leader[1],
            "gap_to_leader": round(leader[1] - brand_sov, self.rounding_precision) if not is_leader else 0.0
        }
    
    def analyze_sov_trend(
        self,
        historical_sov: List[Tuple[datetime, float]]
    ) -> Dict:
        """
        Analyze SOV trend over time using datetime objects.
        
        Args:
            historical_sov: List of (datetime, sov) tuples
        
        Returns:
            Trend analysis with comprehensive metrics
        """
        if not historical_sov:
            return {
                "trend": "no_data",
                "change": 0.0,
                "change_percentage": 0.0,
                "average": 0.0,
                "current": 0.0,
                "volatility": 0.0
            }
        
        if len(historical_sov) < 2:
            sov_value = historical_sov[0][1] if historical_sov else 0.0
            return {
                "trend": "insufficient_data",
                "change": 0.0,
                "change_percentage": 0.0,
                "average": round(sov_value, self.rounding_precision),
                "current": round(sov_value, self.rounding_precision),
                "peak": round(sov_value, self.rounding_precision),
                "trough": round(sov_value, self.rounding_precision),
                "volatility": 0.0,
                "data_points": 1
            }
        
        # Sort by date
        sorted_sov = sorted(historical_sov, key=lambda x: x[0])
        
        # Extract values
        sov_values = [s[1] for s in sorted_sov]
        first_sov = sov_values[0]
        last_sov = sov_values[-1]
        
        # Calculate metrics
        average_sov = sum(sov_values) / len(sov_values)
        change = last_sov - first_sov
        change_percentage = (change / first_sov * 100) if first_sov > 0 else 0.0
        
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
        
        # Calculate volatility (average absolute change)
        if len(sov_values) > 2:
            differences = [
                abs(sov_values[i] - sov_values[i-1])
                for i in range(1, len(sov_values))
            ]
            volatility = sum(differences) / len(differences)
        else:
            volatility = abs(change)
        
        # Calculate time span
        time_span = sorted_sov[-1][0] - sorted_sov[0][0]
        days_span = time_span.total_seconds() / 86400
        
        return {
            "trend": trend,
            "change": round(change, self.rounding_precision),
            "change_percentage": round(change_percentage, self.rounding_precision),
            "average": round(average_sov, self.rounding_precision),
            "current": round(last_sov, self.rounding_precision),
            "peak": round(max(sov_values), self.rounding_precision),
            "trough": round(min(sov_values), self.rounding_precision),
            "volatility": round(volatility, self.rounding_precision),
            "data_points": len(sov_values),
            "days_span": round(days_span, 1)
        }
    
    def recommend_sov_improvements(
        self,
        current_sov: float,
        competitor_sov: Optional[Dict[str, float]] = None,
        target_sov: float = 30.0
    ) -> List[Dict]:
        """
        Recommend improvements to increase SOV with validation.
        
        Args:
            current_sov: Current brand SOV
            competitor_sov: Optional competitor SOV scores
            target_sov: Target SOV to achieve (default 30%)
        
        Returns:
            List of prioritized recommendations
        """
        recommendations = []
        competitor_sov = competitor_sov or {}
        
        # Validate current SOV
        current_sov = max(0.0, min(100.0, current_sov))
        
        # Find leader if competitors exist
        leader_name = None
        leader_sov = 0.0
        if competitor_sov:
            leader = max(competitor_sov.items(), key=lambda x: x[1])
            leader_name, leader_sov = leader
        
        # Critical: Very low SOV
        if current_sov < 5:
            recommendations.append({
                "priority": "critical",
                "action": "Establish brand presence",
                "description": "Brand has minimal share of voice. Need immediate action to establish presence in AI responses.",
                "specific_actions": [
                    "Create authoritative brand content",
                    "Optimize for brand-related queries",
                    "Build citations and references"
                ],
                "potential_gain": min(15.0, target_sov - current_sov),
                "effort": "high",
                "timeframe": "3-6 months"
            })
        
        # High priority: Behind leader
        if leader_name and current_sov < leader_sov:
            gap = leader_sov - current_sov
            recommendations.append({
                "priority": "high",
                "action": f"Close competitive gap with {leader_name}",
                "description": f"Competitor {leader_name} has {gap:.1f}% higher SOV. Analyze and counter their strategy.",
                "specific_actions": [
                    f"Analyze {leader_name}'s content strategy",
                    "Identify and target gap keywords",
                    "Improve brand differentiation"
                ],
                "potential_gain": min(gap * 0.5, 10.0),  # Realistic gain
                "effort": "medium",
                "timeframe": "2-3 months"
            })
        
        # Medium: Below target
        if current_sov < target_sov:
            recommendations.append({
                "priority": "medium",
                "action": "Improve content relevance",
                "description": f"Current SOV ({current_sov:.1f}%) is below target ({target_sov}%). Focus on relevance and quality.",
                "specific_actions": [
                    "Enhance content comprehensiveness",
                    "Improve topical authority",
                    "Increase brand mention density"
                ],
                "potential_gain": min(10.0, target_sov - current_sov),
                "effort": "medium",
                "timeframe": "1-2 months"
            })
        
        # Competitive market
        if len(competitor_sov) > 5 and current_sov < 20:
            recommendations.append({
                "priority": "medium",
                "action": "Differentiate in crowded market",
                "description": f"Market has {len(competitor_sov)} active competitors. Need strong differentiation.",
                "specific_actions": [
                    "Focus on unique value propositions",
                    "Target niche segments",
                    "Build thought leadership"
                ],
                "potential_gain": 8.0,
                "effort": "high",
                "timeframe": "3-4 months"
            })
        
        # Maintain leadership
        if leader_name is None or (leader_sov > 0 and current_sov >= leader_sov):
            recommendations.append({
                "priority": "low",
                "action": "Maintain and expand leadership",
                "description": "Currently leading in SOV. Focus on maintaining position and expanding gap.",
                "specific_actions": [
                    "Monitor competitor activities",
                    "Expand to adjacent topics",
                    "Strengthen brand authority"
                ],
                "potential_gain": 5.0,
                "effort": "low",
                "timeframe": "ongoing"
            })
        
        # Sort by potential gain and priority
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        recommendations.sort(
            key=lambda x: (priority_order.get(x["priority"], 99), -x["potential_gain"])
        )
        
        return recommendations
    
    def get_brand_summary(
        self,
        brand_name: str,
        entities: Optional[List[Entity]],
        brand_mentions: Optional[List[BrandMention]] = None,
        categories: Optional[Dict[str, List[str]]] = None
    ) -> Dict:
        """
        Get comprehensive brand SOV summary.
        
        Args:
            brand_name: Target brand
            entities: All entities
            brand_mentions: Optional brand mentions for sentiment
            
        Returns:
            Comprehensive brand summary
        """
        if not entities:
            return {
                "brand": brand_name,
                "total_mentions": 0,
                "basic_sov": 0.0,
                "sentiment_weighted_sov": 0.0,
                "category_sov": {},
                "dominant_sentiment": "neutral"
            }
        
        # Basic SOV
        basic_sov = self.calculate(brand_mentions, entities, brand_name)
        
        # Category SOV (with optional categories from context)
        category_sov = self.calculate_category_sov(brand_name, entities, categories)
        
        # Sentiment analysis if brand mentions provided
        sentiment_weighted = 0.0
        dominant_sentiment = "neutral"
        
        if brand_mentions:
            # Get all brand mentions for sentiment weighting
            all_brand_mentions = [
                BrandMention(
                    response_id="",
                    brand_id="",
                    brand_name=e.text,
                    mention_text=e.text,
                    sentiment_score=0.0,
                    sentiment_label="neutral",
                    confidence=getattr(e, 'confidence', 1.0),
                    position=0,
                    context="",
                    platform=""
                )
                for e in entities
                if e and hasattr(e, 'type') and e.type in ["BRAND", "COMPETITOR"]
            ]
            
            sentiment_weighted = self.calculate_sentiment_weighted_sov(
                brand_mentions,
                all_brand_mentions or brand_mentions
            )
            
            # Determine dominant sentiment
            sentiment_counts = defaultdict(int)
            for mention in brand_mentions:
                if mention and hasattr(mention, 'sentiment_label'):
                    sentiment = (mention.sentiment_label or "neutral").lower()
                    sentiment_counts[sentiment] += 1
            
            if sentiment_counts:
                dominant_sentiment = max(sentiment_counts.items(), key=lambda x: x[1])[0]
        
        # Count brand entities
        brand_counts = self._count_brand_entities(entities)
        total_mentions = sum(brand_counts.values())
        
        return {
            "brand": brand_name,
            "normalized_brand": self._normalize_brand_name(brand_name),
            "total_mentions": total_mentions,
            "basic_sov": basic_sov,
            "sentiment_weighted_sov": round(sentiment_weighted, self.rounding_precision),
            "category_sov": category_sov,
            "dominant_sentiment": dominant_sentiment,
            "has_presence": basic_sov > 0
        }