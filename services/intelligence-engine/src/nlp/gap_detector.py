"""Content gap detection between brand and competitors."""

from typing import List, Dict, Set, Tuple
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import LatentDirichletAllocation
from src.models.schemas import ContentGap, Entity


class GapDetector:
    """Detect content gaps and missing topics."""
    
    def __init__(self):
        # TF-IDF for keyword extraction
        self.tfidf = TfidfVectorizer(
            max_features=100,
            stop_words='english',
            ngram_range=(1, 3),
            min_df=0.1,
            max_df=0.9
        )
        
        # Topic modeling
        self.lda = LatentDirichletAllocation(
            n_components=10,
            random_state=42,
            max_iter=10
        )
        
        # Gap type definitions
        self.gap_types = {
            "MISSING_TOPIC": "Topic not covered but competitors address",
            "WEAK_COVERAGE": "Topic mentioned but not thoroughly covered",
            "COMPETITOR_ADVANTAGE": "Competitor has stronger presence",
            "OUTDATED_INFO": "Information is outdated compared to competitors",
            "MISSING_FEATURE": "Product feature not mentioned",
            "CITATION_GAP": "Lacks authoritative citations"
        }
        
        # Priority weights
        self.priority_weights = {
            "search_volume": 0.3,
            "competitor_coverage": 0.3,
            "business_impact": 0.2,
            "ease_of_fix": 0.2
        }
    
    def detect(
        self,
        prompt: str,
        brand_response: str,
        competitor_responses: List[str],
        entities: List[Entity]
    ) -> List[ContentGap]:
        """Detect content gaps."""
        gaps = []
        
        # Detect missing topics
        missing_topics = self._detect_missing_topics(
            brand_response, 
            competitor_responses
        )
        gaps.extend(missing_topics)
        
        # Detect weak coverage
        weak_coverage = self._detect_weak_coverage(
            prompt,
            brand_response,
            competitor_responses
        )
        gaps.extend(weak_coverage)
        
        # Detect competitor advantages
        competitor_advantages = self._detect_competitor_advantages(
            brand_response,
            competitor_responses,
            entities
        )
        gaps.extend(competitor_advantages)
        
        # Detect missing features
        feature_gaps = self._detect_feature_gaps(
            brand_response,
            competitor_responses
        )
        gaps.extend(feature_gaps)
        
        # Sort by priority
        gaps.sort(key=lambda x: x.priority, reverse=True)
        
        return gaps[:10]  # Return top 10 gaps
    
    def _detect_missing_topics(
        self,
        brand_response: str,
        competitor_responses: List[str]
    ) -> List[ContentGap]:
        """Detect topics present in competitor responses but missing in brand."""
        if not competitor_responses:
            return []
        
        gaps = []
        
        # Extract topics from all responses
        all_texts = [brand_response] + competitor_responses
        
        try:
            # Fit TF-IDF
            tfidf_matrix = self.tfidf.fit_transform(all_texts)
            feature_names = self.tfidf.get_feature_names_out()
            
            # Get brand topics
            brand_tfidf = tfidf_matrix[0].toarray().flatten()
            brand_topics = set(
                feature_names[i] 
                for i in np.where(brand_tfidf > 0.1)[0]
            )
            
            # Get competitor topics
            competitor_topics = set()
            for i in range(1, len(all_texts)):
                comp_tfidf = tfidf_matrix[i].toarray().flatten()
                comp_topics = set(
                    feature_names[j]
                    for j in np.where(comp_tfidf > 0.1)[0]
                )
                competitor_topics.update(comp_topics)
            
            # Find missing topics
            missing = competitor_topics - brand_topics
            
            # Create gaps for significant missing topics
            for topic in list(missing)[:5]:  # Top 5 missing topics
                gap = ContentGap(
                    type="MISSING_TOPIC",
                    description=f"Topic '{topic}' not covered but present in competitor responses",
                    priority=self._calculate_priority(topic, competitor_responses),
                    query_examples=[f"Tell me about {topic}", f"What is {topic}?"],
                    competitor_advantage=0.8,
                    estimated_impact=0.7
                )
                gaps.append(gap)
        
        except Exception:
            # If TF-IDF fails, fall back to simple keyword comparison
            gaps.extend(self._simple_topic_comparison(brand_response, competitor_responses))
        
        return gaps
    
    def _detect_weak_coverage(
        self,
        prompt: str,
        brand_response: str,
        competitor_responses: List[str]
    ) -> List[ContentGap]:
        """Detect topics with weak coverage."""
        gaps = []
        
        # Extract key concepts from prompt
        prompt_keywords = self._extract_keywords(prompt)
        
        # Measure coverage depth
        brand_coverage = self._measure_coverage_depth(brand_response, prompt_keywords)
        
        if competitor_responses:
            competitor_coverage = max(
                self._measure_coverage_depth(resp, prompt_keywords)
                for resp in competitor_responses
            )
        else:
            competitor_coverage = 0
        
        # Check if brand coverage is weak
        if brand_coverage < 0.5 and competitor_coverage > brand_coverage:
            gap = ContentGap(
                type="WEAK_COVERAGE",
                description=f"Weak coverage of query topics compared to competitors",
                priority=7,
                query_examples=[prompt],
                competitor_advantage=competitor_coverage - brand_coverage,
                estimated_impact=0.6
            )
            gaps.append(gap)
        
        return gaps
    
    def _detect_competitor_advantages(
        self,
        brand_response: str,
        competitor_responses: List[str],
        entities: List[Entity]
    ) -> List[ContentGap]:
        """Detect areas where competitors have advantages."""
        gaps = []
        
        if not competitor_responses:
            return gaps
        
        # Count entity mentions
        brand_entities = self._count_entity_mentions(brand_response, entities)
        
        # Find competitor advantages
        for comp_response in competitor_responses:
            comp_entities = self._count_entity_mentions(comp_response, entities)
            
            # Find entities mentioned more by competitor
            for entity, comp_count in comp_entities.items():
                brand_count = brand_entities.get(entity, 0)
                
                if comp_count > brand_count * 1.5:  # 50% more mentions
                    gap = ContentGap(
                        type="COMPETITOR_ADVANTAGE",
                        description=f"Competitor has stronger coverage of '{entity}'",
                        priority=6,
                        query_examples=[f"Tell me about {entity}"],
                        competitor_advantage=(comp_count - brand_count) / max(comp_count, 1),
                        estimated_impact=0.5
                    )
                    gaps.append(gap)
        
        return gaps[:3]  # Top 3 competitor advantages
    
    def _detect_feature_gaps(
        self,
        brand_response: str,
        competitor_responses: List[str]
    ) -> List[ContentGap]:
        """Detect missing product features."""
        gaps = []
        
        # Common feature keywords
        feature_keywords = [
            'integration', 'api', 'automation', 'dashboard', 'analytics',
            'reporting', 'real-time', 'customization', 'security', 'compliance',
            'scalability', 'performance', 'support', 'pricing', 'deployment'
        ]
        
        # Check brand response for features
        brand_features = set()
        brand_lower = brand_response.lower()
        for feature in feature_keywords:
            if feature in brand_lower:
                brand_features.add(feature)
        
        # Check competitor responses
        if competitor_responses:
            competitor_features = set()
            for resp in competitor_responses:
                resp_lower = resp.lower()
                for feature in feature_keywords:
                    if feature in resp_lower:
                        competitor_features.add(feature)
            
            # Find missing features
            missing_features = competitor_features - brand_features
            
            for feature in list(missing_features)[:3]:
                gap = ContentGap(
                    type="MISSING_FEATURE",
                    description=f"Feature '{feature}' not mentioned but competitors highlight it",
                    priority=5,
                    query_examples=[
                        f"Does the product support {feature}?",
                        f"Tell me about {feature} capabilities"
                    ],
                    competitor_advantage=0.7,
                    estimated_impact=0.6
                )
                gaps.append(gap)
        
        return gaps
    
    def _extract_keywords(self, text: str) -> Set[str]:
        """Extract keywords from text."""
        words = text.lower().split()
        # Remove common words
        stop_words = {'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but'}
        keywords = {w.strip('.,!?";') for w in words if w not in stop_words and len(w) > 2}
        return keywords
    
    def _measure_coverage_depth(self, text: str, keywords: Set[str]) -> float:
        """Measure how deeply keywords are covered."""
        if not keywords:
            return 1.0
        
        text_lower = text.lower()
        covered = 0
        total_mentions = 0
        
        for keyword in keywords:
            count = text_lower.count(keyword)
            if count > 0:
                covered += 1
                total_mentions += min(count, 3)  # Cap at 3 mentions
        
        coverage_ratio = covered / len(keywords)
        depth_ratio = total_mentions / (len(keywords) * 2)  # Expect 2 mentions per keyword
        
        return 0.6 * coverage_ratio + 0.4 * min(depth_ratio, 1.0)
    
    def _count_entity_mentions(self, text: str, entities: List[Entity]) -> Dict[str, int]:
        """Count entity mentions in text."""
        text_lower = text.lower()
        entity_counts = {}
        
        for entity in entities:
            entity_lower = entity.text.lower()
            count = text_lower.count(entity_lower)
            if count > 0:
                entity_counts[entity.text] = count
        
        return entity_counts
    
    def _calculate_priority(self, topic: str, competitor_responses: List[str]) -> int:
        """Calculate priority score for a gap."""
        # Simple priority calculation
        competitor_mentions = sum(
            1 for resp in competitor_responses 
            if topic.lower() in resp.lower()
        )
        
        if competitor_mentions >= len(competitor_responses) * 0.8:
            return 9  # Very high priority
        elif competitor_mentions >= len(competitor_responses) * 0.5:
            return 7  # High priority
        elif competitor_mentions >= len(competitor_responses) * 0.3:
            return 5  # Medium priority
        else:
            return 3  # Low priority
    
    def _simple_topic_comparison(
        self,
        brand_response: str,
        competitor_responses: List[str]
    ) -> List[ContentGap]:
        """Simple fallback topic comparison."""
        gaps = []
        
        brand_keywords = self._extract_keywords(brand_response)
        competitor_keywords = set()
        
        for resp in competitor_responses:
            competitor_keywords.update(self._extract_keywords(resp))
        
        missing = competitor_keywords - brand_keywords
        
        for keyword in list(missing)[:3]:
            gap = ContentGap(
                type="MISSING_TOPIC",
                description=f"Keyword '{keyword}' missing from brand response",
                priority=5,
                query_examples=[f"Information about {keyword}"],
                competitor_advantage=0.5,
                estimated_impact=0.4
            )
            gaps.append(gap)
        
        return gaps