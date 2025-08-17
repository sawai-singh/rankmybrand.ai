# 🎯 Centralized Configuration Management

## Overview

This directory contains the **SINGLE SOURCE OF TRUTH** for all environment variables across the RankMyBrand.ai platform. No more scattered `.env` files across services!

## 📁 Structure

```
config/
├── .env                    # Main configuration (development)
├── .env.production         # Production overrides
├── .env.example            # Template with all variables documented
├── secrets/               
│   └── .env.secrets       # Sensitive data (NEVER commit!)
├── services/              # Service-specific overrides (optional)
│   ├── intelligence.env   # Intelligence Engine specific
│   └── crawler.env        # Web Crawler specific
├── config-loader.js       # Node.js configuration loader
├── config_loader.py       # Python configuration loader
└── load-env.sh           # Bash configuration loader
```

## 🚀 Usage

### Node.js Services

```javascript
// At the top of your service entry point
const config = require('../../config/config-loader');

// Load configuration (do this once at startup)
config.load('service-name'); // Optional service name

// Use configuration
const port = config.get('SERVICE_PORT', 3000);
const dbUrl = config.get('POSTGRES_HOST');

// Validate required keys
config.validate(['POSTGRES_HOST', 'REDIS_URL', 'JWT_SECRET']);
```

### Python Services

```python
# At the top of your service entry point
import sys
sys.path.append('../../config')
from config_loader import config_loader

# Load configuration (do this once at startup)
config_loader.load('intelligence-engine')  # Optional service name

# Use configuration
port = config_loader.get_int('SERVICE_PORT', 8000)
db_host = config_loader.get('POSTGRES_HOST')

# Validate required keys
config_loader.validate(['POSTGRES_HOST', 'REDIS_HOST', 'OPENAI_API_KEY'])

# Get database URL
db_url = config_loader.get_database_url()
```

### Bash Scripts

```bash
#!/bin/bash
# Source the configuration
source /path/to/config/load-env.sh

# Use variables directly
echo "Starting service on port $SERVICE_PORT"
```

### Docker Compose

```yaml
services:
  intelligence-engine:
    env_file:
      - ./config/.env
      - ./config/.env.production  # If in production
    environment:
      - SERVICE_NAME=intelligence-engine
```

## 🔑 Configuration Precedence

Configuration is loaded in this order (later overrides earlier):

1. **Main .env** - Base configuration for all services
2. **Environment-specific** - `.env.production`, `.env.staging`, etc.
3. **Secrets** - `.env.secrets` for sensitive data
4. **Service-specific** - Optional per-service overrides

## 📝 Best Practices

### DO's ✅

- Keep all configuration in `/config` directory
- Use the provided loaders instead of `process.env` directly
- Document all new variables in `.env.example`
- Use descriptive variable names with service prefixes
- Validate required configuration at startup

### DON'Ts ❌

- Don't create `.env` files in service directories
- Don't commit `.env.secrets` or actual `.env` files
- Don't hardcode configuration values in code
- Don't duplicate variables across files
- Don't use different variable names for the same value

## 🔐 Security

### Secrets Management

1. Store sensitive data in `secrets/.env.secrets`
2. Add to `.gitignore`: `config/secrets/`
3. Use secret management service in production (AWS Secrets Manager, Vault, etc.)

### Example `.gitignore`

```gitignore
# Configuration
config/.env
config/.env.production
config/secrets/
!config/.env.example
```

## 🔄 Migration Guide

### From Scattered .env Files

1. **Backup existing .env files**
   ```bash
   find . -name ".env*" -type f | xargs -I {} cp {} {}.backup
   ```

2. **Update service entry points**
   ```javascript
   // Old way
   require('dotenv').config();
   
   // New way
   const config = require('../../config/config-loader');
   config.load('my-service');
   ```

3. **Update Docker Compose**
   ```yaml
   # Old way
   env_file: ./services/my-service/.env
   
   # New way
   env_file: ./config/.env
   ```

4. **Remove old .env files**
   ```bash
   # After testing, remove old env files
   rm services/*/.env
   ```

## 📊 Variable Naming Convention

Use this naming pattern for clarity:

```
# Service-specific variables
<SERVICE>_<VARIABLE>

# Examples:
INTELLIGENCE_SERVICE_PORT=8002
CRAWLER_MAX_DEPTH=3
DASHBOARD_SESSION_TIMEOUT=3600

# Shared variables (no prefix)
POSTGRES_HOST=localhost
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret
```

## 🚨 Troubleshooting

### Configuration not loading?

1. Check file paths are correct
2. Ensure `.env` file exists in `/config`
3. Verify file permissions (readable)
4. Check for syntax errors in .env files

### Variable not found?

1. Check variable name spelling
2. Verify load order (service-specific might override)
3. Ensure configuration is loaded before use
4. Check if variable is in correct file

### Docker can't find config?

1. Mount config directory as volume
2. Use relative paths from docker-compose location
3. Ensure files are not in .dockerignore

## 🎉 Benefits

- **Single Source of Truth** - One place for all configuration
- **Reduced Complexity** - No hunting for env files
- **Better Security** - Centralized secrets management
- **Easier Deployment** - Single config directory to manage
- **Consistent Interface** - Same loader API across all languages
- **Environment Management** - Easy switching between dev/staging/prod

## 📚 Examples

### Complete Service Setup

```javascript
// services/my-service/index.js
const express = require('express');
const config = require('../../config/config-loader');

// Load configuration
config.load('my-service');

// Validate required configuration
config.validate([
  'SERVICE_PORT',
  'POSTGRES_HOST',
  'REDIS_URL',
  'JWT_SECRET'
]);

// Use configuration
const app = express();
const port = config.get('SERVICE_PORT', 3000);

// Get service-specific config
const serviceConfig = config.getServiceConfig('my-service');

app.listen(port, () => {
  console.log(`Service running on port ${port}`);
});
```

---

**Remember:** This centralized configuration makes your life easier, your deployments simpler, and your system more maintainable. Use it! 🚀