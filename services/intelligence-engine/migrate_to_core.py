#!/usr/bin/env python3
"""
Migration script to update imports from old structure to new core structure
Run this to automatically update all Python files
"""

import os
import re
from pathlib import Path


# Define import mappings
IMPORT_MAPPINGS = {
    # Response processing
    r'from processors\.response_processor import': 'from core.analysis.response_analyzer import UnifiedResponseAnalyzer as',
    r'from src\.processors\.response_processor import': 'from src.core.analysis.response_analyzer import UnifiedResponseAnalyzer as',
    r'from \.\.processors\.response_processor import': 'from ..core.analysis.response_analyzer import UnifiedResponseAnalyzer as',
    
    # GEO calculators
    r'from processors\.geo_calculator import': 'from core.analysis.calculators.geo_calculator import',
    r'from processors\.geo_calculator_real import': 'from core.analysis.calculators.geo_calculator import',
    r'from src\.processors\.geo_calculator import': 'from src.core.analysis.calculators.geo_calculator import',
    r'from src\.processors\.geo_calculator_real import': 'from src.core.analysis.calculators.geo_calculator import',
    r'from \.\.processors\.geo_calculator import': 'from ..core.analysis.calculators.geo_calculator import',
    r'from \.\.processors\.geo_calculator_real import': 'from ..core.analysis.calculators.geo_calculator import',
    
    # SOV calculator
    r'from processors\.sov_calculator import': 'from core.analysis.calculators.sov_calculator import',
    r'from src\.processors\.sov_calculator import': 'from src.core.analysis.calculators.sov_calculator import',
    r'from \.\.processors\.sov_calculator import': 'from ..core.analysis.calculators.sov_calculator import',
    
    # NLP components
    r'from nlp\.llm_entity_detector import': 'from core.analysis.components.entity_detector import',
    r'from nlp\.llm_sentiment_analyzer import': 'from core.analysis.components.sentiment_analyzer import',
    r'from nlp\.llm_relevance_scorer import': 'from core.analysis.components.relevance_scorer import',
    r'from nlp\.llm_gap_detector import': 'from core.analysis.components.gap_detector import',
    r'from src\.nlp\.llm_entity_detector import': 'from src.core.analysis.components.entity_detector import',
    r'from src\.nlp\.llm_sentiment_analyzer import': 'from src.core.analysis.components.sentiment_analyzer import',
    r'from src\.nlp\.llm_relevance_scorer import': 'from src.core.analysis.components.relevance_scorer import',
    r'from src\.nlp\.llm_gap_detector import': 'from src.core.analysis.components.gap_detector import',
    
    # AI visibility components (update to use core)
    r'from \.response_analyzer import': 'from core.analysis.response_analyzer import',
    r'from services\.ai_visibility\.response_analyzer import': 'from core.analysis.response_analyzer import',
    r'from src\.services\.ai_visibility\.response_analyzer import': 'from src.core.analysis.response_analyzer import',
}

# Class name mappings
CLASS_MAPPINGS = {
    'ResponseProcessor': 'UnifiedResponseAnalyzer',
    'RealGEOCalculator': 'GEOCalculator',
    'LLMEntityDetector': 'EntityDetector',
    'LLMSentimentAnalyzer': 'SentimentAnalyzer',
    'LLMRelevanceScorer': 'RelevanceScorer',
    'LLMGapDetector': 'GapDetector',
    'LLMResponseAnalyzer': 'UnifiedResponseAnalyzer',
}


def update_imports_in_file(filepath: Path) -> bool:
    """Update imports in a single Python file"""
    
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        original_content = content
        
        # Apply import mappings
        for old_import, new_import in IMPORT_MAPPINGS.items():
            content = re.sub(old_import, new_import, content)
        
        # Apply class name mappings
        for old_class, new_class in CLASS_MAPPINGS.items():
            # Update class instantiation
            content = re.sub(rf'\b{old_class}\(', f'{new_class}(', content)
            # Update type hints
            content = re.sub(rf': {old_class}\b', f': {new_class}', content)
            content = re.sub(rf'\[{old_class}\]', f'[{new_class}]', content)
        
        # Write back if changed
        if content != original_content:
            with open(filepath, 'w') as f:
                f.write(content)
            return True
        
        return False
        
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False


def migrate_directory(root_dir: str):
    """Migrate all Python files in directory"""
    
    root_path = Path(root_dir)
    updated_files = []
    
    # Find all Python files
    python_files = list(root_path.rglob('*.py'))
    
    print(f"Found {len(python_files)} Python files to check")
    
    for filepath in python_files:
        # Skip migration script itself
        if filepath.name == 'migrate_to_core.py':
            continue
        
        # Skip files in old directories that will be removed
        if any(part in filepath.parts for part in ['processors', 'nlp'] if part != 'core'):
            continue
        
        if update_imports_in_file(filepath):
            updated_files.append(filepath)
            print(f"✓ Updated: {filepath.relative_to(root_path)}")
    
    print(f"\nMigration complete! Updated {len(updated_files)} files")
    
    if updated_files:
        print("\nUpdated files:")
        for f in updated_files:
            print(f"  - {f.relative_to(root_path)}")


def create_compatibility_shims():
    """Create backward compatibility shims in old locations"""
    
    shims = [
        ('processors/response_processor.py', '''# Backward compatibility shim
from ..core.analysis.response_analyzer import UnifiedResponseAnalyzer as ResponseProcessor
from ..core.analysis.response_analyzer import UnifiedResponseAnalyzer
'''),
        ('processors/geo_calculator.py', '''# Backward compatibility shim
from ..core.analysis.calculators.geo_calculator import GEOCalculator
'''),
        ('processors/geo_calculator_real.py', '''# Backward compatibility shim
from ..core.analysis.calculators.geo_calculator import GEOCalculator as RealGEOCalculator
'''),
        ('nlp/llm_entity_detector.py', '''# Backward compatibility shim
from ..core.analysis.components.entity_detector import EntityDetector as LLMEntityDetector
'''),
        ('nlp/llm_sentiment_analyzer.py', '''# Backward compatibility shim
from ..core.analysis.components.sentiment_analyzer import SentimentAnalyzer as LLMSentimentAnalyzer
'''),
        ('nlp/llm_relevance_scorer.py', '''# Backward compatibility shim
from ..core.analysis.components.relevance_scorer import RelevanceScorer as LLMRelevanceScorer
'''),
        ('nlp/llm_gap_detector.py', '''# Backward compatibility shim
from ..core.analysis.components.gap_detector import GapDetector as LLMGapDetector
'''),
    ]
    
    base_dir = Path('/Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine/src')
    
    for rel_path, content in shims:
        filepath = base_dir / rel_path
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        # Only create if doesn't exist
        if not filepath.exists():
            with open(filepath, 'w') as f:
                f.write(content)
            print(f"Created compatibility shim: {rel_path}")


if __name__ == "__main__":
    import sys
    
    # Default to intelligence-engine src directory
    if len(sys.argv) > 1:
        root_dir = sys.argv[1]
    else:
        root_dir = '/Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine/src'
    
    print(f"Starting migration in: {root_dir}")
    print("=" * 50)
    
    # Run migration
    migrate_directory(root_dir)
    
    print("\n" + "=" * 50)
    print("Creating backward compatibility shims...")
    create_compatibility_shims()
    
    print("\n" + "=" * 50)
    print("Migration complete!")
    print("\nNext steps:")
    print("1. Move NLP component files to core/analysis/components/")
    print("2. Update ai_visibility service to use core components")
    print("3. Test the migrated code")
    print("4. Remove old directories after verification")