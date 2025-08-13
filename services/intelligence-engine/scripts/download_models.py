#!/usr/bin/env python3
"""Pre-download NLP models for offline use."""

import os
import sys
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def download_models():
    """Download all required NLP models."""
    
    # Create model cache directory
    cache_dir = Path("/tmp/models")
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info("Downloading NLP models...")
    
    # Download Transformers models
    try:
        logger.info("Downloading sentiment analysis model...")
        from transformers import pipeline
        sentiment_pipeline = pipeline(
            "sentiment-analysis",
            model="cardiffnlp/twitter-roberta-base-sentiment-latest",
            cache_dir=str(cache_dir)
        )
        logger.info("✓ Sentiment model downloaded")
    except Exception as e:
        logger.error(f"Failed to download sentiment model: {e}")
        return False
    
    # Download spaCy model
    try:
        logger.info("Downloading spaCy model...")
        import subprocess
        result = subprocess.run(
            ["python", "-m", "spacy", "download", "en_core_web_sm"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            logger.info("✓ spaCy model downloaded")
        else:
            logger.error(f"spaCy download failed: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"Failed to download spaCy model: {e}")
        return False
    
    # Download Sentence Transformers model
    try:
        logger.info("Downloading sentence embeddings model...")
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(
            'all-MiniLM-L6-v2',
            cache_folder=str(cache_dir)
        )
        logger.info("✓ Sentence transformer model downloaded")
    except Exception as e:
        logger.error(f"Failed to download sentence transformer: {e}")
        return False
    
    # Download NLTK data (for TextRank)
    try:
        logger.info("Downloading NLTK data...")
        import nltk
        nltk_data_dir = cache_dir / "nltk_data"
        nltk_data_dir.mkdir(exist_ok=True)
        nltk.data.path.append(str(nltk_data_dir))
        
        nltk.download('punkt', download_dir=str(nltk_data_dir))
        nltk.download('stopwords', download_dir=str(nltk_data_dir))
        logger.info("✓ NLTK data downloaded")
    except Exception as e:
        logger.error(f"Failed to download NLTK data: {e}")
        # Non-critical, continue
    
    logger.info("All models downloaded successfully!")
    return True


def verify_models():
    """Verify that all models are accessible."""
    logger.info("Verifying model accessibility...")
    
    try:
        # Test sentiment model
        from transformers import pipeline
        sentiment = pipeline(
            "sentiment-analysis",
            model="cardiffnlp/twitter-roberta-base-sentiment-latest"
        )
        result = sentiment("This is a test.")
        logger.info(f"✓ Sentiment model working: {result}")
        
        # Test spaCy
        import spacy
        nlp = spacy.load("en_core_web_sm")
        doc = nlp("This is a test.")
        logger.info(f"✓ spaCy model working: {len(doc)} tokens")
        
        # Test sentence transformers
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer('all-MiniLM-L6-v2')
        embeddings = model.encode(["This is a test."])
        logger.info(f"✓ Sentence transformer working: embedding shape {embeddings.shape}")
        
        return True
        
    except Exception as e:
        logger.error(f"Model verification failed: {e}")
        return False


if __name__ == "__main__":
    success = download_models()
    if success:
        verified = verify_models()
        if verified:
            logger.info("All models ready for use!")
            sys.exit(0)
        else:
            logger.error("Model verification failed")
            sys.exit(1)
    else:
        logger.error("Model download failed")
        sys.exit(1)