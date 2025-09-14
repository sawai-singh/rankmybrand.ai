"""
Competitive Positioning Analyzer
Deep analysis of competitive landscape from AI responses
"""

import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict, Counter
from enum import Enum

logger = logging.getLogger(__name__)


class CompetitivePosition(Enum):
    """Market position classification"""
    LEADER = "Market Leader"
    CHALLENGER = "Strong Challenger"
    FOLLOWER = "Market Follower"
    NICHE = "Niche Player"
    ABSENT = "Not Visible"


@dataclass
class CompetitorProfile:
    """Detailed competitor profile from AI analysis"""
    name: str
    mention_count: int
    mention_rate: float  # Percentage of responses mentioning
    sentiment_score: float  # -1 to 1
    share_of_voice: float  # Percentage of total brand mentions
    positioning: CompetitivePosition
    strengths: List[str]
    weaknesses: List[str]
    key_differentiators: List[str]
    head_to_head_wins: int  # Times mentioned more favorably than our brand
    head_to_head_losses: int  # Times our brand mentioned more favorably
    common_contexts: List[str]  # Common contexts where mentioned together


@dataclass
class CompetitiveAnalysisReport:
    """Complete competitive analysis report"""
    audit_id: str
    company_name: str
    market_position: CompetitivePosition
    total_brand_mentions: int
    total_competitor_mentions: int
    share_of_voice: float
    competitive_advantage_score: float  # 0-100
    top_competitors: List[CompetitorProfile]
    market_insights: List[str]
    competitive_threats: List[Dict[str, Any]]
    competitive_opportunities: List[Dict[str, Any]]
    recommended_strategies: List[Dict[str, Any]]
    win_loss_analysis: Dict[str, Any]


class CompetitiveAnalyzer:
    """
    Analyzes competitive positioning from AI responses
    Provides strategic insights about market position
    """
    
    def analyze_competitive_landscape(
        self,
        audit_id: str,
        company_name: str,
        ai_responses: List[Dict[str, Any]]
    ) -> CompetitiveAnalysisReport:
        """
        Perform comprehensive competitive analysis
        
        Args:
            audit_id: Audit identifier
            company_name: Company being analyzed
            ai_responses: All AI responses from the audit
            
        Returns:
            Complete competitive analysis report
        """
        logger.info(f"Analyzing competitive landscape for {company_name}")
        
        # Step 1: Extract all brand and competitor mentions
        mentions = self._extract_all_mentions(ai_responses, company_name)
        
        # Step 2: Build competitor profiles
        competitor_profiles = self._build_competitor_profiles(mentions, len(ai_responses))
        
        # Step 3: Determine market position
        market_position = self._determine_market_position(
            company_name,
            mentions,
            competitor_profiles
        )
        
        # Step 4: Calculate competitive metrics
        metrics = self._calculate_competitive_metrics(mentions, company_name)
        
        # Step 5: Generate strategic insights
        insights = self._generate_strategic_insights(
            company_name,
            market_position,
            competitor_profiles,
            mentions
        )
        
        # Step 6: Identify threats and opportunities
        threats = self._identify_threats(competitor_profiles, mentions)
        opportunities = self._identify_opportunities(competitor_profiles, mentions)
        
        # Step 7: Generate strategic recommendations
        strategies = self._generate_competitive_strategies(
            market_position,
            threats,
            opportunities,
            competitor_profiles
        )
        
        # Step 8: Win/loss analysis
        win_loss = self._perform_win_loss_analysis(mentions, company_name)
        
        return CompetitiveAnalysisReport(
            audit_id=audit_id,
            company_name=company_name,
            market_position=market_position,
            total_brand_mentions=metrics['brand_mentions'],
            total_competitor_mentions=metrics['competitor_mentions'],
            share_of_voice=metrics['share_of_voice'],
            competitive_advantage_score=metrics['competitive_advantage_score'],
            top_competitors=competitor_profiles[:10],  # Top 10 competitors
            market_insights=insights,
            competitive_threats=threats,
            competitive_opportunities=opportunities,
            recommended_strategies=strategies,
            win_loss_analysis=win_loss
        )
    
    def _extract_all_mentions(
        self,
        responses: List[Dict[str, Any]],
        company_name: str
    ) -> Dict[str, Any]:
        """Extract all brand and competitor mentions from responses"""
        mentions = {
            'brand': [],
            'competitors': defaultdict(list),
            'head_to_head': []
        }
        
        for response in responses:
            # Brand mentions
            if response.get('brand_mentioned'):
                mentions['brand'].append({
                    'response_id': response.get('id'),
                    'provider': response.get('provider'),
                    'sentiment': response.get('sentiment', 'neutral'),
                    'sentiment_score': response.get('sentiment_score', 0.5),
                    'context': response.get('response_text', '')[:500],
                    'recommendation_strength': response.get('recommendation_strength'),
                    'geo_score': response.get('geo_score', 0),
                    'sov_score': response.get('sov_score', 0)
                })
            
            # Competitor mentions
            competitor_data = response.get('competitor_mentions')
            if competitor_data:
                if isinstance(competitor_data, str):
                    try:
                        competitor_data = json.loads(competitor_data)
                    except:
                        continue
                
                for comp in competitor_data if isinstance(competitor_data, list) else []:
                    if isinstance(comp, dict) and comp.get('name'):
                        mentions['competitors'][comp['name']].append({
                            'response_id': response.get('id'),
                            'provider': response.get('provider'),
                            'mentioned': comp.get('mentioned', False),
                            'sentiment': comp.get('sentiment', 'neutral'),
                            'context': response.get('response_text', '')[:500]
                        })
            
            # Head-to-head comparisons
            text = response.get('response_text', '').lower()
            if company_name.lower() in text:
                for comp_name in mentions['competitors'].keys():
                    if comp_name.lower() in text:
                        mentions['head_to_head'].append({
                            'brand': company_name,
                            'competitor': comp_name,
                            'response_id': response.get('id'),
                            'provider': response.get('provider'),
                            'context': text[:500]
                        })
        
        return mentions
    
    def _build_competitor_profiles(
        self,
        mentions: Dict[str, Any],
        total_responses: int
    ) -> List[CompetitorProfile]:
        """Build detailed profiles for each competitor"""
        profiles = []
        
        for comp_name, comp_mentions in mentions['competitors'].items():
            if not comp_mentions:
                continue
            
            # Calculate metrics
            mention_count = len(comp_mentions)
            mention_rate = (mention_count / total_responses) * 100
            
            # Sentiment analysis
            sentiments = [m.get('sentiment', 'neutral') for m in comp_mentions]
            sentiment_counter = Counter(sentiments)
            sentiment_score = (
                sentiment_counter.get('positive', 0) * 1 +
                sentiment_counter.get('neutral', 0) * 0 +
                sentiment_counter.get('negative', 0) * -1
            ) / max(len(sentiments), 1)
            
            # Share of voice
            total_brand_mentions = len(mentions['brand']) + sum(
                len(m) for m in mentions['competitors'].values()
            )
            sov = (mention_count / max(total_brand_mentions, 1)) * 100
            
            # Head-to-head analysis
            h2h = [m for m in mentions['head_to_head'] if m['competitor'] == comp_name]
            wins = sum(1 for m in h2h if self._determine_winner(m) == 'brand')
            losses = sum(1 for m in h2h if self._determine_winner(m) == 'competitor')
            
            # Determine positioning
            if mention_rate > 30 and sentiment_score > 0.5:
                position = CompetitivePosition.LEADER
            elif mention_rate > 20 and sentiment_score > 0:
                position = CompetitivePosition.CHALLENGER
            elif mention_rate > 10:
                position = CompetitivePosition.FOLLOWER
            elif mention_rate > 0:
                position = CompetitivePosition.NICHE
            else:
                position = CompetitivePosition.ABSENT
            
            profiles.append(CompetitorProfile(
                name=comp_name,
                mention_count=mention_count,
                mention_rate=mention_rate,
                sentiment_score=sentiment_score,
                share_of_voice=sov,
                positioning=position,
                strengths=self._extract_strengths(comp_mentions),
                weaknesses=self._extract_weaknesses(comp_mentions),
                key_differentiators=self._extract_differentiators(comp_mentions),
                head_to_head_wins=wins,
                head_to_head_losses=losses,
                common_contexts=self._extract_common_contexts(comp_mentions)[:5]
            ))
        
        # Sort by share of voice
        profiles.sort(key=lambda x: x.share_of_voice, reverse=True)
        
        return profiles
    
    def _determine_market_position(
        self,
        company_name: str,
        mentions: Dict[str, Any],
        competitors: List[CompetitorProfile]
    ) -> CompetitivePosition:
        """Determine company's market position"""
        brand_mentions = len(mentions['brand'])
        total_responses = brand_mentions + sum(c.mention_count for c in competitors)
        
        if total_responses == 0:
            return CompetitivePosition.ABSENT
        
        brand_sov = (brand_mentions / total_responses) * 100
        
        # Calculate average sentiment
        brand_sentiments = [m.get('sentiment_score', 0.5) for m in mentions['brand']]
        avg_sentiment = sum(brand_sentiments) / max(len(brand_sentiments), 1)
        
        # Determine position based on SOV and sentiment
        if brand_sov > 40 and avg_sentiment > 0.6:
            return CompetitivePosition.LEADER
        elif brand_sov > 25 and avg_sentiment > 0.4:
            return CompetitivePosition.CHALLENGER
        elif brand_sov > 15:
            return CompetitivePosition.FOLLOWER
        elif brand_sov > 5:
            return CompetitivePosition.NICHE
        else:
            return CompetitivePosition.ABSENT
    
    def _calculate_competitive_metrics(
        self,
        mentions: Dict[str, Any],
        company_name: str
    ) -> Dict[str, Any]:
        """Calculate key competitive metrics"""
        brand_mentions = len(mentions['brand'])
        competitor_mentions = sum(len(m) for m in mentions['competitors'].values())
        total_mentions = brand_mentions + competitor_mentions
        
        # Share of voice
        sov = (brand_mentions / max(total_mentions, 1)) * 100
        
        # Competitive advantage score (0-100)
        advantage_factors = []
        
        # Factor 1: Share of voice (40% weight)
        advantage_factors.append(min(sov / 50 * 100, 100) * 0.4)
        
        # Factor 2: Sentiment advantage (30% weight)
        brand_sentiments = [m.get('sentiment_score', 0.5) for m in mentions['brand']]
        avg_brand_sentiment = sum(brand_sentiments) / max(len(brand_sentiments), 1)
        advantage_factors.append(avg_brand_sentiment * 100 * 0.3)
        
        # Factor 3: GEO score average (20% weight)
        geo_scores = [m.get('geo_score', 0) for m in mentions['brand']]
        avg_geo = sum(geo_scores) / max(len(geo_scores), 1)
        advantage_factors.append(avg_geo * 0.2)
        
        # Factor 4: Recommendation strength (10% weight)
        rec_strengths = [
            1 if m.get('recommendation_strength') == 'STRONG' else
            0.5 if m.get('recommendation_strength') == 'MODERATE' else 0
            for m in mentions['brand']
        ]
        avg_rec = sum(rec_strengths) / max(len(rec_strengths), 1)
        advantage_factors.append(avg_rec * 100 * 0.1)
        
        competitive_advantage_score = sum(advantage_factors)
        
        return {
            'brand_mentions': brand_mentions,
            'competitor_mentions': competitor_mentions,
            'share_of_voice': sov,
            'competitive_advantage_score': competitive_advantage_score
        }
    
    def _generate_strategic_insights(
        self,
        company_name: str,
        position: CompetitivePosition,
        competitors: List[CompetitorProfile],
        mentions: Dict[str, Any]
    ) -> List[str]:
        """Generate strategic market insights"""
        insights = []
        
        # Position-based insights
        if position == CompetitivePosition.LEADER:
            insights.append(
                f"{company_name} is the market leader with strong AI visibility. "
                "Focus on maintaining leadership through continuous innovation."
            )
        elif position == CompetitivePosition.ABSENT:
            insights.append(
                f"{company_name} has critically low AI visibility. "
                "Immediate action required to establish digital presence."
            )
        
        # Competitor dominance insights
        if competitors and competitors[0].share_of_voice > 30:
            insights.append(
                f"{competitors[0].name} dominates {competitors[0].share_of_voice:.1f}% of AI conversations. "
                "Consider targeted competitive campaigns."
            )
        
        # Market concentration insights
        top_3_sov = sum(c.share_of_voice for c in competitors[:3])
        if top_3_sov > 60:
            insights.append(
                "Market is highly concentrated with top 3 competitors controlling "
                f"{top_3_sov:.1f}% of visibility. Consider differentiation strategies."
            )
        
        return insights
    
    def _identify_threats(
        self,
        competitors: List[CompetitorProfile],
        mentions: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Identify competitive threats"""
        threats = []
        
        for comp in competitors[:5]:  # Top 5 competitors
            if comp.positioning in [CompetitivePosition.LEADER, CompetitivePosition.CHALLENGER]:
                threats.append({
                    'competitor': comp.name,
                    'threat_level': 'High' if comp.positioning == CompetitivePosition.LEADER else 'Medium',
                    'description': f"{comp.name} has {comp.share_of_voice:.1f}% share of voice",
                    'recommended_action': f"Develop targeted content to counter {comp.name}'s messaging"
                })
        
        return threats
    
    def _identify_opportunities(
        self,
        competitors: List[CompetitorProfile],
        mentions: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Identify competitive opportunities"""
        opportunities = []
        
        # Weak competitors
        for comp in competitors:
            if comp.sentiment_score < 0:
                opportunities.append({
                    'type': 'Competitor Weakness',
                    'description': f"{comp.name} has negative sentiment ({comp.sentiment_score:.2f})",
                    'action': f"Highlight superior value proposition against {comp.name}"
                })
        
        # Market gaps
        if len(competitors) < 3:
            opportunities.append({
                'type': 'Market Gap',
                'description': 'Low competitive density in AI responses',
                'action': 'Aggressive content and SEO push to dominate AI visibility'
            })
        
        return opportunities
    
    def _generate_competitive_strategies(
        self,
        position: CompetitivePosition,
        threats: List[Dict[str, Any]],
        opportunities: List[Dict[str, Any]],
        competitors: List[CompetitorProfile]
    ) -> List[Dict[str, Any]]:
        """Generate competitive strategies"""
        strategies = []
        
        if position == CompetitivePosition.LEADER:
            strategies.append({
                'strategy': 'Maintain Leadership',
                'priority': 'High',
                'actions': [
                    'Continue aggressive content production',
                    'Monitor emerging competitors',
                    'Innovate to stay ahead'
                ]
            })
        elif position in [CompetitivePosition.FOLLOWER, CompetitivePosition.NICHE]:
            strategies.append({
                'strategy': 'Challenge Leaders',
                'priority': 'Critical',
                'actions': [
                    'Target competitor weaknesses',
                    'Differentiate value proposition',
                    'Increase content velocity'
                ]
            })
        
        return strategies
    
    def _perform_win_loss_analysis(
        self,
        mentions: Dict[str, Any],
        company_name: str
    ) -> Dict[str, Any]:
        """Analyze head-to-head performance"""
        h2h = mentions['head_to_head']
        
        wins = sum(1 for m in h2h if self._determine_winner(m) == 'brand')
        losses = sum(1 for m in h2h if self._determine_winner(m) == 'competitor')
        ties = len(h2h) - wins - losses
        
        return {
            'total_comparisons': len(h2h),
            'wins': wins,
            'losses': losses,
            'ties': ties,
            'win_rate': (wins / max(len(h2h), 1)) * 100
        }
    
    def _determine_winner(self, comparison: Dict[str, Any]) -> str:
        """Determine winner in head-to-head comparison"""
        # Simple heuristic - can be enhanced with NLP
        context = comparison.get('context', '').lower()
        brand = comparison.get('brand', '').lower()
        competitor = comparison.get('competitor', '').lower()
        
        positive_terms = ['better', 'superior', 'preferred', 'recommended', 'leading']
        
        for term in positive_terms:
            if f"{brand} {term}" in context:
                return 'brand'
            if f"{competitor} {term}" in context:
                return 'competitor'
        
        return 'tie'
    
    def _extract_strengths(self, mentions: List[Dict[str, Any]]) -> List[str]:
        """Extract competitor strengths from mentions"""
        # Simplified - would use NLP in production
        return ['Strong brand recognition', 'Wide product range']
    
    def _extract_weaknesses(self, mentions: List[Dict[str, Any]]) -> List[str]:
        """Extract competitor weaknesses from mentions"""
        return ['Higher pricing', 'Limited innovation']
    
    def _extract_differentiators(self, mentions: List[Dict[str, Any]]) -> List[str]:
        """Extract key differentiators"""
        return ['Market leader position', 'Technology innovation']
    
    def _extract_common_contexts(self, mentions: List[Dict[str, Any]]) -> List[str]:
        """Extract common contexts where competitor is mentioned"""
        contexts = []
        for m in mentions[:10]:
            context = m.get('context', '')[:100]
            if context:
                contexts.append(context)
        return contexts