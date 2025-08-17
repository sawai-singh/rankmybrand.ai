"""
Central Configuration Loader for Python Services
This module loads the centralized configuration for all services
"""

import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv


class ConfigLoader:
    """Centralized configuration loader for RankMyBrand services"""
    
    def __init__(self):
        self.config_dir = Path(__file__).parent
        self.loaded = False
        
    def load(self, service_name: Optional[str] = None) -> None:
        """
        Load all configuration files in order of precedence
        
        Args:
            service_name: Optional service name for specific overrides
        """
        if self.loaded:
            print("⚠️  Configuration already loaded")
            return
            
        # 1. Load main .env file
        main_env_path = self.config_dir / ".env"
        if main_env_path.exists():
            load_dotenv(main_env_path)
            print("✅ Loaded central configuration")
        else:
            print(f"❌ Central .env file not found at {main_env_path}")
            sys.exit(1)
            
        # 2. Load environment-specific overrides
        env = os.getenv("APP_ENV", "development")
        env_path = self.config_dir / f".env.{env}"
        if env_path.exists():
            load_dotenv(env_path, override=True)
            print(f"✅ Loaded {env} overrides")
            
        # 3. Load secrets (if exist)
        secrets_path = self.config_dir / "secrets" / ".env.secrets"
        if secrets_path.exists():
            load_dotenv(secrets_path, override=True)
            print("✅ Loaded secrets")
            
        # 4. Load service-specific overrides
        if service_name:
            service_path = self.config_dir / "services" / f"{service_name}.env"
            if service_path.exists():
                load_dotenv(service_path, override=True)
                print(f"✅ Loaded service-specific config for {service_name}")
                
        self.loaded = True
        print("✅ Configuration loaded successfully")
        
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration value with fallback
        
        Args:
            key: The configuration key
            default: Default value if key not found
            
        Returns:
            Configuration value or default
        """
        value = os.getenv(key, default)
        
        # Type conversions
        if value is not None:
            # Boolean conversion
            if value.lower() in ('true', 'false'):
                return value.lower() == 'true'
            # Number conversion
            try:
                if '.' in str(value):
                    return float(value)
                return int(value)
            except (ValueError, TypeError):
                pass
                
        return value
        
    def get_int(self, key: str, default: int = 0) -> int:
        """Get configuration value as integer"""
        try:
            return int(os.getenv(key, default))
        except (ValueError, TypeError):
            return default
            
    def get_float(self, key: str, default: float = 0.0) -> float:
        """Get configuration value as float"""
        try:
            return float(os.getenv(key, default))
        except (ValueError, TypeError):
            return default
            
    def get_bool(self, key: str, default: bool = False) -> bool:
        """Get configuration value as boolean"""
        value = os.getenv(key, str(default)).lower()
        return value in ('true', '1', 'yes', 'on')
        
    def validate(self, required_keys: List[str]) -> None:
        """
        Validate required configuration keys
        
        Args:
            required_keys: List of required configuration keys
        """
        missing = [key for key in required_keys if not os.getenv(key)]
        if missing:
            print(f"❌ Missing required configuration: {', '.join(missing)}")
            sys.exit(1)
        print("✅ Configuration validation passed")
        
    def get_service_config(self, service: str) -> Dict[str, Any]:
        """
        Get service-specific configuration
        
        Args:
            service: Service name
            
        Returns:
            Dictionary of service-specific configuration
        """
        prefix = service.upper().replace('-', '_') + '_'
        config = {}
        
        for key, value in os.environ.items():
            if key.startswith(prefix):
                new_key = key.replace(prefix, '')
                config[new_key] = value
                
        return config
        
    def get_database_url(self) -> str:
        """Construct PostgreSQL database URL"""
        host = self.get('POSTGRES_HOST', 'localhost')
        port = self.get('POSTGRES_PORT', 5432)
        db = self.get('POSTGRES_DB', 'rankmybrand')
        user = self.get('POSTGRES_USER', 'postgres')
        password = self.get('POSTGRES_PASSWORD', '')
        
        if password:
            return f"postgresql://{user}:{password}@{host}:{port}/{db}"
        return f"postgresql://{user}@{host}:{port}/{db}"
        
    def get_redis_url(self) -> str:
        """Construct Redis URL"""
        host = self.get('REDIS_HOST', 'localhost')
        port = self.get('REDIS_PORT', 6379)
        db = self.get('REDIS_DB', 0)
        password = self.get('REDIS_PASSWORD', '')
        
        if password:
            return f"redis://:{password}@{host}:{port}/{db}"
        return f"redis://{host}:{port}/{db}"


# Export singleton instance
config_loader = ConfigLoader()