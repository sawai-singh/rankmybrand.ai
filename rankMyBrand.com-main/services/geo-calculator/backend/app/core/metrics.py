import re
import statistics
import hashlib
from typing import Dict, List, Tuple
import numpy as np
from sentence_transformers import SentenceTransformer

# Initialize model once
sentence_model = SentenceTransformer('all-MiniLM-L6-v2')

class MetricsCalculator:
    """Core GEO metrics calculator with honest implementations."""
    
    @staticmethod
    def calculate_statistics_density(content: str) -> Dict:
        """Calculate density and quality of statistics in content."""
        
        # Statistical patterns
        stat_patterns = [
            (r'\b\d+\.?\d*\s*%', 'percentage'),
            (r'\b\d{1,3}(,\d{3})*(\.\d+)?(?!\s*%)', 'number'),
            (r'\b\$\d+\.?\d*[BMK]?\b', 'currency'),
            (r'\b\d+x\b', 'multiplier'),
            (r'\b\d+\/\d+\b', 'fraction'),
            (r'\b(?:increased?|decreased?|grew|fell)\s+by\s+\d+', 'change'),
        ]
        
        statistics_found = []
        for pattern, stat_type in stat_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                statistics_found.append({
                    'value': match.group(),
                    'type': stat_type,
                    'position': match.start()
                })
        
        # Remove duplicates
        unique_stats = {}
        for stat in statistics_found:
            unique_stats[stat['value']] = stat
        
        stat_count = len(unique_stats)
        word_count = len(content.split())
        
        # Calculate metrics
        ideal_density = word_count / 150  # 1 stat per 150 words
        actual_density = stat_count / max(word_count, 1) * 150
        
        # Distribution score
        if stat_count > 0:
            positions = [s['position'] / len(content) for s in unique_stats.values()]
            distribution_score = 1 - (statistics.stdev(positions) if len(positions) > 1 else 0)
        else:
            distribution_score = 0
        
        # Score calculation
        density_ratio = min(actual_density / ideal_density, 2.0) if ideal_density > 0 else 0
        score = (density_ratio * 0.7 + distribution_score * 0.3) * 100
        
        return {
            'score': min(score, 100),
            'count': stat_count,
            'density': actual_density,
            'distribution': distribution_score,
            'examples': list(unique_stats.values())[:5],  # Top 5 examples
            'recommendation': MetricsCalculator._get_statistics_recommendation(score, stat_count, word_count)
        }
    
    @staticmethod
    def calculate_quotation_authority(content: str) -> Dict:
        """Analyze quotations and their authority signals."""
        
        quote_patterns = [
            (r'"([^"]+)"[^"]*?[-–—]\s*([^,\n]+)', 'attributed', 1.0),
            (r'"([^"]+)"[^"]*?according to\s+([^,\n]+)', 'according_to', 0.9),
            (r'([A-Z][^.]+)\s+(?:said|says|stated|notes?)\s*[,:]?\s*"([^"]+)"', 'says_pattern', 0.9),
            (r'"([^"]+)"', 'unattributed', 0.5),
        ]
        
        quotes_found = []
        for pattern, quote_type, weight in quote_patterns:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                if len(match.groups()) == 2:
                    quote_text = match.group(1) if match.group(1) else match.group(2)
                    source = match.group(2) if match.group(1) else match.group(1)
                    if quote_type == 'says_pattern':
                        source, quote_text = match.group(1), match.group(2)
                    quotes_found.append({
                        'text': quote_text[:100] + '...' if len(quote_text) > 100 else quote_text,
                        'source': source,
                        'type': quote_type,
                        'weight': weight
                    })
                else:
                    quotes_found.append({
                        'text': match.group(1)[:100] + '...' if len(match.group(1)) > 100 else match.group(1),
                        'source': 'unattributed',
                        'type': quote_type,
                        'weight': weight
                    })
        
        # Authority scoring
        authority_keywords = {
            'professor': 1.0, 'dr': 1.0, 'phd': 1.0, 'ceo': 0.9,
            'founder': 0.9, 'director': 0.8, 'expert': 0.8,
            'analyst': 0.7, 'researcher': 0.9, 'university': 0.9,
            'institute': 0.8, 'study': 0.8, 'research': 0.8
        }
        
        total_authority_score = 0
        for quote in quotes_found:
            source_lower = quote['source'].lower()
            authority = 0.5  # Base score
            
            for keyword, score in authority_keywords.items():
                if keyword in source_lower:
                    authority = max(authority, score)
            
            quote['authority_score'] = authority
            total_authority_score += quote['weight'] * authority
        
        # Calculate final score
        word_count = len(content.split())
        ideal_quotes = max(1, word_count / 300)  # 1 quote per 300 words
        
        if quotes_found:
            avg_authority = total_authority_score / len(quotes_found)
            quote_density = len(quotes_found) / ideal_quotes
            score = min((avg_authority * quote_density) * 100, 100)
        else:
            score = 0
            avg_authority = 0
        
        return {
            'score': score,
            'count': len(quotes_found),
            'attributed_count': sum(1 for q in quotes_found if q['type'] != 'unattributed'),
            'avg_authority': avg_authority,
            'quotes': quotes_found[:5],  # Top 5 quotes
            'recommendation': MetricsCalculator._get_quotation_recommendation(score, quotes_found)
        }
    
    @staticmethod
    def calculate_fluency_score(content: str) -> Dict:
        """Calculate content fluency for AI readability."""
        
        # Sentence analysis
        sentences = re.split(r'[.!?]+', content)
        sentences = [s.strip() for s in sentences if s.strip() and len(s.strip().split()) > 3]
        
        if len(sentences) < 3:
            return {
                'score': 20.0,
                'sentence_count': len(sentences),
                'recommendation': "Content too short for meaningful fluency analysis. Add more content."
            }
        
        # Sentence metrics
        sentence_lengths = [len(s.split()) for s in sentences]
        avg_length = statistics.mean(sentence_lengths)
        length_variance = statistics.stdev(sentence_lengths) if len(sentences) > 1 else 0
        
        # Paragraph analysis
        paragraphs = [p for p in content.split('\n\n') if p.strip()]
        para_sentence_counts = []
        for para in paragraphs:
            para_sentences = len(re.split(r'[.!?]+', para))
            para_sentence_counts.append(para_sentences)
        
        # Transition words
        transition_words = [
            'however', 'therefore', 'moreover', 'furthermore',
            'additionally', 'consequently', 'nevertheless',
            'meanwhile', 'specifically', 'for example', 'notably'
        ]
        
        transition_count = sum(1 for word in transition_words if word in content.lower())
        
        # Clarity indicators
        clarity_patterns = [
            r'\b(?:first|second|third|finally)\b',
            r'\b(?:step \d+|point \d+)\b',
            r'(?:following|these|above|below)\s+\w+',
        ]
        
        clarity_count = sum(len(re.findall(pattern, content, re.IGNORECASE)) 
                           for pattern in clarity_patterns)
        
        # Score components
        length_score = 1 - abs(avg_length - 20) / 20  # Ideal: 20 words
        variance_score = min(length_variance / 5, 1.0)  # Ideal: std dev of 5
        sentence_variety = (max(0, length_score) + variance_score) / 2
        
        # Paragraph score
        ideal_para_sentences = [3, 4, 5]
        para_scores = [1.0 if count in ideal_para_sentences else 0.5 
                      for count in para_sentence_counts]
        paragraph_score = statistics.mean(para_scores) if para_scores else 0.5
        
        # Transition score
        transition_score = min(transition_count / (len(sentences) / 4), 1.0)
        
        # Clarity score
        clarity_score = min(clarity_count / (len(sentences) / 5), 1.0)
        
        # Final score
        score = (
            sentence_variety * 0.3 +
            paragraph_score * 0.3 +
            transition_score * 0.2 +
            clarity_score * 0.2
        ) * 100
        
        return {
            'score': score,
            'avg_sentence_length': avg_length,
            'sentence_variance': length_variance,
            'paragraph_count': len(paragraphs),
            'transition_density': transition_count / len(sentences),
            'metrics': {
                'sentence_variety': sentence_variety * 100,
                'paragraph_structure': paragraph_score * 100,
                'transitions': transition_score * 100,
                'clarity': clarity_score * 100
            },
            'recommendation': MetricsCalculator._get_fluency_recommendation(score, avg_length, transition_count)
        }
    
    @staticmethod
    def calculate_relevance_score(query: str, content: str) -> Dict:
        """Calculate semantic relevance between query and content."""
        
        # Embedding similarity
        query_embedding = sentence_model.encode(query)
        
        # For long content, use first 1000 chars + last 500 chars
        if len(content) > 1500:
            content_sample = content[:1000] + " ... " + content[-500:]
        else:
            content_sample = content
            
        content_embedding = sentence_model.encode(content_sample)
        
        # Cosine similarity
        similarity = np.dot(query_embedding, content_embedding) / (
            np.linalg.norm(query_embedding) * np.linalg.norm(content_embedding)
        )
        
        # Normalize (similarity usually 0.2-0.8)
        normalized_similarity = max(0, min(1, (similarity - 0.2) / 0.6))
        
        # Keyword overlap
        query_words = set(query.lower().split())
        content_words = set(content.lower().split())
        
        stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were'}
        query_words -= stopwords
        
        if query_words:
            keyword_overlap = len(query_words & content_words) / len(query_words)
        else:
            keyword_overlap = 0
        
        # Entity matching (simple version)
        query_entities = [word for word in query.split() if word[0].isupper()]
        content_entities = [word for word in content.split() if word[0].isupper()]
        
        entity_overlap = 0
        if query_entities:
            matching_entities = sum(1 for entity in query_entities if entity in content_entities)
            entity_overlap = matching_entities / len(query_entities)
        
        # Final score
        score = (
            normalized_similarity * 0.6 +
            keyword_overlap * 0.3 +
            entity_overlap * 0.1
        ) * 100
        
        return {
            'score': score,
            'semantic_similarity': normalized_similarity * 100,
            'keyword_overlap': keyword_overlap * 100,
            'entity_overlap': entity_overlap * 100,
            'recommendation': MetricsCalculator._get_relevance_recommendation(score, keyword_overlap)
        }
    
    @staticmethod
    def _get_statistics_recommendation(score: float, count: int, word_count: int) -> str:
        ideal_count = max(1, word_count // 150)
        if score < 60:
            if count == 0:
                return f"Add {ideal_count} relevant statistics to support your claims"
            elif count < ideal_count:
                return f"Add {ideal_count - count} more statistics for optimal density"
            else:
                return "Distribute statistics more evenly throughout the content"
        elif score < 80:
            return "Good statistical support. Consider adding more recent data"
        else:
            return "Excellent use of statistics and data"
    
    @staticmethod
    def _get_quotation_recommendation(score: float, quotes: List) -> str:
        if score < 60:
            if not quotes:
                return "Add 2-3 expert quotes from authoritative sources"
            unattributed = sum(1 for q in quotes if q['type'] == 'unattributed')
            if unattributed > len(quotes) / 2:
                return "Attribute your quotes to specific experts or sources"
            else:
                return "Include quotes from more authoritative sources (professors, researchers, industry leaders)"
        elif score < 80:
            return "Good use of quotes. Consider adding more variety in sources"
        else:
            return "Excellent use of authoritative quotations"
    
    @staticmethod
    def _get_fluency_recommendation(score: float, avg_length: float, transitions: int) -> str:
        if score < 60:
            issues = []
            if avg_length < 15:
                issues.append("increase sentence length")
            elif avg_length > 25:
                issues.append("use shorter sentences")
            if transitions < 2:
                issues.append("add transition words")
            return f"Improve readability: {', '.join(issues)}"
        elif score < 80:
            return "Good readability. Consider adding more structure markers"
        else:
            return "Excellent readability and structure"
    
    @staticmethod
    def _get_relevance_recommendation(score: float, keyword_overlap: float) -> str:
        if score < 60:
            if keyword_overlap < 0.3:
                return "Include more keywords from your target queries"
            else:
                return "Improve topical focus and semantic relevance"
        elif score < 80:
            return "Good relevance. Consider expanding on key topics"
        else:
            return "Excellent query-content alignment"
