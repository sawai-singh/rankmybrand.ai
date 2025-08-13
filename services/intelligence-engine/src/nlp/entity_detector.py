"""Entity detection using spaCy with custom brand detection."""

import json
import spacy
from typing import List, Dict, Set
from spacy.matcher import Matcher, PhraseMatcher
from src.models.schemas import Entity
from src.config import settings


class EntityDetector:
    """Detect brands, competitors, and other entities."""
    
    def __init__(self):
        # Load spaCy model
        try:
            self.nlp = spacy.load(settings.spacy_model)
        except OSError:
            # Download model if not available
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", settings.spacy_model])
            self.nlp = spacy.load(settings.spacy_model)
        
        # Initialize matchers
        self.matcher = Matcher(self.nlp.vocab)
        self.phrase_matcher = PhraseMatcher(self.nlp.vocab, attr="LOWER")
        
        # Load brand patterns
        self.brand_patterns = self._load_brand_patterns()
        self.competitor_brands = self._load_competitor_brands()
        
        # Add custom patterns
        self._add_custom_patterns()
    
    def _load_brand_patterns(self) -> Dict[str, List[str]]:
        """Load brand name patterns."""
        # In production, load from database or config file
        return {
            "rankmybrand": ["RankMyBrand", "Rank My Brand", "RankMyBrand.ai"],
            "athena": ["AthenaHQ", "Athena HQ", "Athena"],
            "perplexity": ["Perplexity", "Perplexity AI"],
            "openai": ["OpenAI", "ChatGPT", "GPT-4", "GPT-3.5"],
            "anthropic": ["Anthropic", "Claude", "Claude AI"],
            "google": ["Google", "Bard", "Gemini", "SGE"],
            "microsoft": ["Microsoft", "Bing", "Bing Chat", "Copilot"]
        }
    
    def _load_competitor_brands(self) -> Set[str]:
        """Load competitor brand names."""
        return {
            "athena", "perplexity", "jasper", "copy.ai", 
            "writesonic", "rytr", "anyword", "peppertype"
        }
    
    def _add_custom_patterns(self):
        """Add custom matching patterns."""
        # Add brand patterns to phrase matcher
        for brand_key, variations in self.brand_patterns.items():
            patterns = [self.nlp.make_doc(text) for text in variations]
            self.phrase_matcher.add(f"BRAND_{brand_key.upper()}", patterns)
        
        # Add product patterns
        product_patterns = [
            [{"LOWER": "gpt"}, {"TEXT": "-"}, {"LIKE_NUM": True}],
            [{"LOWER": "claude"}, {"LIKE_NUM": True}],
            [{"LOWER": {"IN": ["ai", "ml", "nlp"]}}, {"LOWER": "model"}]
        ]
        
        for idx, pattern in enumerate(product_patterns):
            self.matcher.add(f"PRODUCT_{idx}", [pattern])
    
    def detect(self, text: str) -> List[Entity]:
        """Detect entities in text."""
        entities = []
        
        # Process text with spaCy
        doc = self.nlp(text[:10000])  # Limit text length
        
        # Extract named entities
        for ent in doc.ents:
            if ent.label_ in ["ORG", "PRODUCT", "PERSON"]:
                entity_type = self._classify_entity(ent.text.lower())
                entities.append(Entity(
                    text=ent.text,
                    type=entity_type,
                    confidence=0.8,
                    start_pos=ent.start_char,
                    end_pos=ent.end_char,
                    context=text[max(0, ent.start_char-50):min(len(text), ent.end_char+50)]
                ))
        
        # Find custom patterns with phrase matcher
        phrase_matches = self.phrase_matcher(doc)
        for match_id, start, end in phrase_matches:
            span = doc[start:end]
            match_label = self.nlp.vocab.strings[match_id]
            
            # Determine entity type
            if "BRAND_" in match_label:
                brand_key = match_label.replace("BRAND_", "").lower()
                entity_type = "COMPETITOR" if brand_key in self.competitor_brands else "BRAND"
            else:
                entity_type = "ENTITY"
            
            entities.append(Entity(
                text=span.text,
                type=entity_type,
                confidence=0.95,
                start_pos=span.start_char,
                end_pos=span.end_char,
                context=text[max(0, span.start_char-50):min(len(text), span.end_char+50)]
            ))
        
        # Find custom patterns with matcher
        matches = self.matcher(doc)
        for match_id, start, end in matches:
            span = doc[start:end]
            entities.append(Entity(
                text=span.text,
                type="PRODUCT",
                confidence=0.75,
                start_pos=span.start_char,
                end_pos=span.end_char,
                context=text[max(0, span.start_char-50):min(len(text), span.end_char+50)]
            ))
        
        # Deduplicate entities
        entities = self._deduplicate_entities(entities)
        
        # Sort by position
        entities.sort(key=lambda x: x.start_pos)
        
        return entities
    
    def _classify_entity(self, entity_text: str) -> str:
        """Classify entity type based on text."""
        entity_lower = entity_text.lower()
        
        # Check if it's a known brand
        for brand_key, variations in self.brand_patterns.items():
            if any(entity_lower == v.lower() for v in variations):
                return "COMPETITOR" if brand_key in self.competitor_brands else "BRAND"
        
        # Check for product indicators
        product_keywords = ["gpt", "claude", "model", "api", "platform", "tool", "software"]
        if any(keyword in entity_lower for keyword in product_keywords):
            return "PRODUCT"
        
        # Check for feature indicators
        feature_keywords = ["feature", "function", "capability", "module", "component"]
        if any(keyword in entity_lower for keyword in feature_keywords):
            return "FEATURE"
        
        return "ENTITY"
    
    def _deduplicate_entities(self, entities: List[Entity]) -> List[Entity]:
        """Remove duplicate and overlapping entities."""
        if not entities:
            return []
        
        # Sort by start position and confidence
        entities.sort(key=lambda x: (x.start_pos, -x.confidence))
        
        deduplicated = []
        last_end = -1
        
        for entity in entities:
            # Skip if overlapping with previous entity
            if entity.start_pos >= last_end:
                deduplicated.append(entity)
                last_end = entity.end_pos
        
        return deduplicated
    
    def extract_brand_mentions(self, text: str, brand_name: str) -> List[Dict]:
        """Extract specific brand mentions with context."""
        mentions = []
        doc = self.nlp(text)
        
        # Find all variations of the brand name
        brand_variations = self.brand_patterns.get(brand_name.lower(), [brand_name])
        
        for variation in brand_variations:
            # Case-insensitive search
            import re
            pattern = re.compile(re.escape(variation), re.IGNORECASE)
            
            for match in pattern.finditer(text):
                start = match.start()
                end = match.end()
                
                # Get surrounding sentence
                sentence_start = max(0, text.rfind('.', 0, start) + 1)
                sentence_end = text.find('.', end)
                if sentence_end == -1:
                    sentence_end = len(text)
                
                context = text[sentence_start:sentence_end].strip()
                
                mentions.append({
                    "text": match.group(),
                    "position": start,
                    "context": context,
                    "sentence": context
                })
        
        return mentions
    
    def compare_entities(self, entities1: List[Entity], entities2: List[Entity]) -> Dict:
        """Compare entities between two texts."""
        set1 = {e.text.lower() for e in entities1}
        set2 = {e.text.lower() for e in entities2}
        
        return {
            "common": list(set1 & set2),
            "only_in_first": list(set1 - set2),
            "only_in_second": list(set2 - set1),
            "total_first": len(set1),
            "total_second": len(set2),
            "overlap_ratio": len(set1 & set2) / max(len(set1 | set2), 1)
        }