"""Sentiment analysis using RoBERTa model."""

from typing import Dict, List, Optional
import numpy as np
from transformers import pipeline, AutoTokenizer
from cachetools import TTLCache
from src.models.schemas import SentimentResult
from src.config import settings


class SentimentAnalyzer:
    """Analyze sentiment using transformer models."""
    
    def __init__(self):
        # Initialize model pipeline
        self.model = pipeline(
            "sentiment-analysis",
            model=settings.sentiment_model,
            device=-1,  # CPU only to save cost
            truncation=True,
            max_length=settings.max_text_length
        )
        
        # Initialize tokenizer for text preprocessing
        self.tokenizer = AutoTokenizer.from_pretrained(settings.sentiment_model)
        
        # Cache for results (TTL in seconds)
        self.cache = TTLCache(
            maxsize=settings.cache_max_size,
            ttl=settings.cache_ttl_seconds
        )
        
        # Label mapping for the model
        self.label_map = {
            'LABEL_0': 'NEGATIVE',
            'LABEL_1': 'NEUTRAL',
            'LABEL_2': 'POSITIVE',
            'negative': 'NEGATIVE',
            'neutral': 'NEUTRAL',
            'positive': 'POSITIVE'
        }
    
    def analyze(self, text: str) -> SentimentResult:
        """Analyze sentiment of text."""
        # Check cache first
        cache_key = hash(text[:500])  # Use first 500 chars for cache key
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Clean and truncate text
        text = self._preprocess_text(text)
        
        # Get prediction
        try:
            results = self.model(text)
            if results:
                result = results[0]
                sentiment = self._parse_result(result)
                
                # Cache result
                self.cache[cache_key] = sentiment
                return sentiment
        except Exception as e:
            # Return neutral sentiment on error
            return SentimentResult(
                score=0.0,
                label="NEUTRAL",
                confidence=0.0
            )
        
        return SentimentResult(score=0.0, label="NEUTRAL", confidence=0.0)
    
    def analyze_batch(self, texts: List[str]) -> List[SentimentResult]:
        """Analyze sentiment for multiple texts."""
        results = []
        
        # Process in batches
        batch_size = settings.batch_size
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            # Check cache for each text
            batch_to_process = []
            cached_results = {}
            
            for idx, text in enumerate(batch):
                cache_key = hash(text[:500])
                if cache_key in self.cache:
                    cached_results[i + idx] = self.cache[cache_key]
                else:
                    batch_to_process.append((i + idx, text))
            
            # Process uncached texts
            if batch_to_process:
                processed_texts = [self._preprocess_text(t[1]) for t in batch_to_process]
                try:
                    batch_results = self.model(processed_texts)
                    
                    for (orig_idx, orig_text), result in zip(batch_to_process, batch_results):
                        sentiment = self._parse_result(result)
                        # Cache result
                        cache_key = hash(orig_text[:500])
                        self.cache[cache_key] = sentiment
                        cached_results[orig_idx] = sentiment
                except Exception:
                    # Add neutral sentiment for failed items
                    for orig_idx, _ in batch_to_process:
                        cached_results[orig_idx] = SentimentResult(
                            score=0.0,
                            label="NEUTRAL",
                            confidence=0.0
                        )
            
            # Add results in order
            for idx in range(i, min(i + batch_size, len(texts))):
                results.append(cached_results.get(idx, SentimentResult(
                    score=0.0,
                    label="NEUTRAL",
                    confidence=0.0
                )))
        
        return results
    
    def _preprocess_text(self, text: str) -> str:
        """Preprocess text for sentiment analysis."""
        # Remove excessive whitespace
        text = ' '.join(text.split())
        
        # Truncate to max length
        if len(text) > settings.max_text_length:
            # Try to truncate at sentence boundary
            truncated = text[:settings.max_text_length]
            last_period = truncated.rfind('.')
            if last_period > settings.max_text_length * 0.8:
                text = truncated[:last_period + 1]
            else:
                text = truncated
        
        return text
    
    def _parse_result(self, result: Dict) -> SentimentResult:
        """Parse model output to SentimentResult."""
        label = result.get('label', 'NEUTRAL')
        score = result.get('score', 0.0)
        
        # Map label to standard format
        label = self.label_map.get(label.lower(), label.upper())
        
        # Convert to -1 to 1 scale
        if label == 'POSITIVE':
            sentiment_score = score
        elif label == 'NEGATIVE':
            sentiment_score = -score
        else:
            sentiment_score = 0.0
        
        return SentimentResult(
            score=sentiment_score,
            label=label,
            confidence=score
        )
    
    def analyze_aspects(self, text: str, aspects: List[str]) -> Dict[str, SentimentResult]:
        """Analyze sentiment for specific aspects in text."""
        results = {}
        
        for aspect in aspects:
            # Extract sentences mentioning the aspect
            aspect_text = self._extract_aspect_context(text, aspect)
            
            if aspect_text:
                results[aspect] = self.analyze(aspect_text)
            else:
                results[aspect] = SentimentResult(
                    score=0.0,
                    label="NEUTRAL",
                    confidence=0.0
                )
        
        return results
    
    def _extract_aspect_context(self, text: str, aspect: str) -> str:
        """Extract text context around an aspect."""
        sentences = text.split('.')
        aspect_sentences = []
        
        for sentence in sentences:
            if aspect.lower() in sentence.lower():
                aspect_sentences.append(sentence.strip())
        
        return '. '.join(aspect_sentences) if aspect_sentences else ""
    
    def get_sentiment_distribution(self, sentiments: List[SentimentResult]) -> Dict:
        """Calculate sentiment distribution statistics."""
        if not sentiments:
            return {
                "positive_ratio": 0.0,
                "neutral_ratio": 0.0,
                "negative_ratio": 0.0,
                "average_score": 0.0,
                "std_deviation": 0.0
            }
        
        labels = [s.label for s in sentiments]
        scores = [s.score for s in sentiments]
        
        total = len(labels)
        positive = labels.count("POSITIVE")
        neutral = labels.count("NEUTRAL")
        negative = labels.count("NEGATIVE")
        
        return {
            "positive_ratio": positive / total,
            "neutral_ratio": neutral / total,
            "negative_ratio": negative / total,
            "average_score": np.mean(scores),
            "std_deviation": np.std(scores),
            "total_samples": total
        }
    
    def calculate_weighted_sentiment(
        self, 
        sentiments: List[SentimentResult], 
        weights: Optional[List[float]] = None
    ) -> float:
        """Calculate weighted average sentiment."""
        if not sentiments:
            return 0.0
        
        scores = [s.score for s in sentiments]
        
        if weights:
            if len(weights) != len(scores):
                raise ValueError("Weights must match number of sentiments")
            weighted_sum = sum(s * w for s, w in zip(scores, weights))
            total_weight = sum(weights)
            return weighted_sum / total_weight if total_weight > 0 else 0.0
        else:
            return np.mean(scores)