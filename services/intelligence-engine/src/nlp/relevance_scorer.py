"""Relevance scoring using sentence embeddings."""

from typing import List, Dict, Tuple
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from cachetools import TTLCache
from src.models.schemas import RelevanceResult
from src.config import settings


class RelevanceScorer:
    """Score relevance between queries and responses."""
    
    def __init__(self):
        # Load sentence transformer model
        self.model = SentenceTransformer(
            settings.embedding_model,
            cache_folder=settings.model_cache_dir
        )
        
        # Cache for embeddings
        self.embedding_cache = TTLCache(
            maxsize=settings.cache_max_size,
            ttl=settings.cache_ttl_seconds
        )
        
        # Keywords for relevance checking
        self.stop_words = self._load_stop_words()
    
    def _load_stop_words(self) -> set:
        """Load stop words for keyword extraction."""
        # Basic English stop words
        return {
            'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 
            'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do',
            'does', 'did', 'will', 'would', 'could', 'should', 'may',
            'might', 'must', 'can', 'this', 'that', 'these', 'those',
            'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'where',
            'when', 'how', 'why', 'all', 'some', 'any', 'both', 'each',
            'few', 'more', 'most', 'other', 'another', 'such', 'only',
            'own', 'same', 'so', 'than', 'too', 'very', 'just', 'but',
            'and', 'or', 'if', 'then', 'else', 'for', 'of', 'with',
            'without', 'about', 'between', 'through', 'during', 'before',
            'after', 'above', 'below', 'from', 'to', 'up', 'down', 'in',
            'out', 'off', 'over', 'under', 'again', 'further', 'also'
        }
    
    def score(self, query: str, response: str) -> RelevanceResult:
        """Score relevance between query and response."""
        # Get embeddings
        query_embedding = self._get_embedding(query)
        response_embedding = self._get_embedding(response)
        
        # Calculate cosine similarity
        similarity = cosine_similarity(
            query_embedding.reshape(1, -1),
            response_embedding.reshape(1, -1)
        )[0][0]
        
        # Extract keywords
        query_keywords = self._extract_keywords(query)
        response_keywords = self._extract_keywords(response)
        
        # Calculate keyword overlap
        keywords_matched = list(query_keywords & response_keywords)
        keyword_coverage = len(keywords_matched) / max(len(query_keywords), 1)
        
        # Calculate response coverage (how much of query is answered)
        response_coverage = self._calculate_coverage(query, response)
        
        # Combined relevance score
        relevance_score = (
            0.5 * similarity +
            0.3 * keyword_coverage +
            0.2 * response_coverage
        )
        
        return RelevanceResult(
            score=float(relevance_score),
            similarity=float(similarity),
            keywords_matched=keywords_matched,
            coverage=float(response_coverage)
        )
    
    def _get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for text with caching."""
        # Check cache
        cache_key = hash(text[:1000])
        if cache_key in self.embedding_cache:
            return self.embedding_cache[cache_key]
        
        # Compute embedding
        embedding = self.model.encode(
            text[:2000],  # Limit text length
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        
        # Cache result
        self.embedding_cache[cache_key] = embedding
        
        return embedding
    
    def _extract_keywords(self, text: str) -> set:
        """Extract keywords from text."""
        # Simple keyword extraction
        words = text.lower().split()
        
        # Remove stop words and short words
        keywords = {
            word.strip('.,!?;:"')
            for word in words
            if word not in self.stop_words and len(word) > 2
        }
        
        return keywords
    
    def _calculate_coverage(self, query: str, response: str) -> float:
        """Calculate how well response covers query topics."""
        # Extract question words
        question_words = {'what', 'where', 'when', 'why', 'how', 'who', 'which'}
        query_lower = query.lower()
        
        # Check if question type is addressed
        question_type = None
        for qword in question_words:
            if qword in query_lower:
                question_type = qword
                break
        
        if not question_type:
            # Not a question, use keyword coverage
            return self._calculate_keyword_coverage(query, response)
        
        # Check if response addresses the question type
        coverage_indicators = {
            'what': ['is', 'are', 'means', 'refers', 'defined'],
            'where': ['located', 'at', 'in', 'place', 'location'],
            'when': ['time', 'date', 'year', 'month', 'day'],
            'why': ['because', 'reason', 'due to', 'since', 'cause'],
            'how': ['by', 'through', 'using', 'method', 'process'],
            'who': ['person', 'people', 'individual', 'organization'],
            'which': ['option', 'choice', 'alternative', 'between']
        }
        
        response_lower = response.lower()
        indicators = coverage_indicators.get(question_type, [])
        
        indicator_found = any(ind in response_lower for ind in indicators)
        keyword_coverage = self._calculate_keyword_coverage(query, response)
        
        return 0.7 * keyword_coverage + 0.3 * (1.0 if indicator_found else 0.0)
    
    def _calculate_keyword_coverage(self, query: str, response: str) -> float:
        """Calculate keyword coverage between query and response."""
        query_keywords = self._extract_keywords(query)
        response_lower = response.lower()
        
        if not query_keywords:
            return 1.0
        
        covered = sum(1 for kw in query_keywords if kw in response_lower)
        return covered / len(query_keywords)
    
    def score_batch(
        self, 
        queries: List[str], 
        responses: List[str]
    ) -> List[RelevanceResult]:
        """Score relevance for multiple query-response pairs."""
        if len(queries) != len(responses):
            raise ValueError("Number of queries must match number of responses")
        
        results = []
        
        # Get embeddings in batch
        query_embeddings = self.model.encode(
            [q[:2000] for q in queries],
            convert_to_numpy=True,
            normalize_embeddings=True,
            batch_size=settings.batch_size
        )
        
        response_embeddings = self.model.encode(
            [r[:2000] for r in responses],
            convert_to_numpy=True,
            normalize_embeddings=True,
            batch_size=settings.batch_size
        )
        
        # Calculate similarities
        for q_emb, r_emb, query, response in zip(
            query_embeddings, response_embeddings, queries, responses
        ):
            similarity = cosine_similarity(
                q_emb.reshape(1, -1),
                r_emb.reshape(1, -1)
            )[0][0]
            
            # Extract keywords
            query_keywords = self._extract_keywords(query)
            response_keywords = self._extract_keywords(response)
            keywords_matched = list(query_keywords & response_keywords)
            keyword_coverage = len(keywords_matched) / max(len(query_keywords), 1)
            
            # Calculate coverage
            response_coverage = self._calculate_coverage(query, response)
            
            # Combined score
            relevance_score = (
                0.5 * similarity +
                0.3 * keyword_coverage +
                0.2 * response_coverage
            )
            
            results.append(RelevanceResult(
                score=float(relevance_score),
                similarity=float(similarity),
                keywords_matched=keywords_matched,
                coverage=float(response_coverage)
            ))
        
        return results
    
    def find_most_relevant(
        self, 
        query: str, 
        responses: List[str], 
        top_k: int = 5
    ) -> List[Tuple[int, float]]:
        """Find most relevant responses to a query."""
        # Get query embedding
        query_embedding = self._get_embedding(query)
        
        # Get response embeddings
        response_embeddings = []
        for response in responses:
            response_embeddings.append(self._get_embedding(response))
        
        response_embeddings = np.array(response_embeddings)
        
        # Calculate similarities
        similarities = cosine_similarity(
            query_embedding.reshape(1, -1),
            response_embeddings
        )[0]
        
        # Get top-k indices
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        
        return [(int(idx), float(similarities[idx])) for idx in top_indices]