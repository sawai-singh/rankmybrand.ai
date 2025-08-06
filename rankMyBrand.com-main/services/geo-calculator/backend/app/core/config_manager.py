"""
Enterprise configuration management system.
Supports multiple environments, feature flags, and dynamic configuration.
"""

import os
import json
from typing import Dict, Any, Optional
from enum import Enum
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class Environment(str, Enum):
    """Application environments."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class ConfigManager:
    """Manages application configuration across environments."""
    
    def __init__(self, env: Optional[str] = None):
        self.env = Environment(env or os.getenv('APP_ENV', 'development'))
        self._config = {}
        self._feature_flags = {}
        self._load_configuration()
    
    def _load_configuration(self):
        """Load configuration based on environment."""
        # Base configuration
        base_config = {
            'app': {
                'name': 'RankMyBrand GEO Calculator',
                'version': '1.0.0',
                'debug': self.env == Environment.DEVELOPMENT,
            },
            'api': {
                'rate_limit': {
                    'development': 1000,
                    'staging': 500,
                    'production': 100
                }[self.env],
                'timeout': 30,
                'max_batch_size': 50,
            },
            'ai_visibility': {
                'enabled': True,
                'providers': {
                    'perplexity': {
                        'enabled': bool(os.getenv('PERPLEXITY_API_KEY')),
                        'rate_limit': 10,
                        'timeout': 30,
                    },
                    'google_ai': {
                        'enabled': self.env != Environment.PRODUCTION,  # Web scraping
                        'rate_limit': 5,
                        'timeout': 45,
                    },
                    'mock': {
                        'enabled': self.env in [Environment.DEVELOPMENT, Environment.TESTING],
                        'rate_limit': 100,
                    }
                },
                'cache_ttl': {
                    'development': 300,  # 5 minutes
                    'staging': 3600,     # 1 hour
                    'production': 86400  # 24 hours
                }[self.env],
            },
            'job_processing': {
                'enabled': self.env != Environment.TESTING,
                'workers': {
                    'development': 2,
                    'staging': 4,
                    'production': 8
                }[self.env],
                'queue_type': {
                    'development': 'memory',
                    'staging': 'database',
                    'production': 'redis'
                }[self.env],
                'job_retention_days': 7,
            },
            'metrics': {
                'statistics': {
                    'ideal_density_per_words': 150,
                    'min_word_count': 100,
                },
                'quotations': {
                    'ideal_per_words': 300,
                    'authority_keywords': {
                        'professor': 1.0, 'dr': 1.0, 'phd': 1.0,
                        'ceo': 0.9, 'founder': 0.9, 'director': 0.8,
                        'expert': 0.8, 'analyst': 0.7, 'researcher': 0.9,
                        'university': 0.9, 'institute': 0.8, 'study': 0.8
                    }
                },
                'weights': {
                    'statistics': 0.20,
                    'quotation': 0.20,
                    'fluency': 0.15,
                    'relevance': 0.15,
                    'authority': 0.10,
                    'ai_visibility': 0.20
                }
            },
            'security': {
                'cors_origins': {
                    'development': ['http://localhost:3000', 'http://localhost:3001'],
                    'staging': ['https://staging.rankmybrand.ai'],
                    'production': ['https://rankmybrand.ai', 'https://www.rankmybrand.ai']
                }[self.env],
                'api_key_required': self.env == Environment.PRODUCTION,
                'rate_limiting_enabled': self.env != Environment.DEVELOPMENT,
            },
            'monitoring': {
                'logging_level': {
                    'development': 'DEBUG',
                    'staging': 'INFO',
                    'production': 'WARNING'
                }[self.env],
                'metrics_enabled': self.env != Environment.DEVELOPMENT,
                'error_reporting_enabled': self.env == Environment.PRODUCTION,
            }
        }
        
        # Load environment-specific overrides
        self._config = self._deep_merge(base_config, self._load_env_config())
        
        # Load feature flags
        self._load_feature_flags()
        
        logger.info(f"Configuration loaded for environment: {self.env}")
    
    def _load_env_config(self) -> Dict[str, Any]:
        """Load environment-specific configuration file if exists."""
        config_path = Path(f"config/{self.env}.json")
        if config_path.exists():
            try:
                with open(config_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load env config: {e}")
        return {}
    
    def _load_feature_flags(self):
        """Load feature flags for gradual rollout."""
        self._feature_flags = {
            'new_ai_providers': self.env != Environment.PRODUCTION,
            'advanced_metrics': True,
            'batch_processing_v2': self.env == Environment.DEVELOPMENT,
            'real_time_updates': self.env != Environment.PRODUCTION,
            'export_functionality': True,
            'api_v2': self.env == Environment.DEVELOPMENT,
        }
    
    def _deep_merge(self, base: Dict, update: Dict) -> Dict:
        """Deep merge two dictionaries."""
        result = base.copy()
        for key, value in update.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result
    
    def get(self, key_path: str, default: Any = None) -> Any:
        """Get configuration value by dot-notation path."""
        keys = key_path.split('.')
        value = self._config
        
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        
        return value
    
    def get_feature_flag(self, flag_name: str, default: bool = False) -> bool:
        """Get feature flag value."""
        return self._feature_flags.get(flag_name, default)
    
    def update_runtime_config(self, key_path: str, value: Any):
        """Update configuration at runtime (for testing/debugging)."""
        if self.env == Environment.PRODUCTION:
            logger.warning("Runtime config update attempted in production")
            return
        
        keys = key_path.split('.')
        config = self._config
        
        for key in keys[:-1]:
            if key not in config:
                config[key] = {}
            config = config[key]
        
        config[keys[-1]] = value
        logger.info(f"Runtime config updated: {key_path} = {value}")
    
    def get_ai_visibility_config(self) -> Dict[str, Any]:
        """Get AI visibility specific configuration."""
        return {
            'enabled': self.get('ai_visibility.enabled', False),
            'providers': {
                name: config
                for name, config in self.get('ai_visibility.providers', {}).items()
                if config.get('enabled', False)
            },
            'cache_ttl': self.get('ai_visibility.cache_ttl', 3600),
        }
    
    def get_metrics_weights(self) -> Dict[str, float]:
        """Get metrics weights for GEO score calculation."""
        return self.get('metrics.weights', {})
    
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.env == Environment.PRODUCTION
    
    def is_development(self) -> bool:
        """Check if running in development."""
        return self.env == Environment.DEVELOPMENT
    
    def export_config(self) -> Dict[str, Any]:
        """Export current configuration (sanitized)."""
        # Remove sensitive information
        safe_config = self._config.copy()
        # Add more sanitization as needed
        return {
            'environment': self.env,
            'config': safe_config,
            'feature_flags': self._feature_flags
        }


# Global configuration instance
_config_manager = None


def get_config() -> ConfigManager:
    """Get global configuration instance."""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager


def init_config(env: Optional[str] = None):
    """Initialize configuration with specific environment."""
    global _config_manager
    _config_manager = ConfigManager(env)
    return _config_manager