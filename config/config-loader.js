/**
 * Central Configuration Loader for Node.js Services
 * This module loads the centralized configuration for all services
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

class ConfigLoader {
  constructor() {
    this.configDir = __dirname;
    this.loaded = false;
  }

  /**
   * Load all configuration files in order of precedence
   * @param {string} serviceName - Optional service name for specific overrides
   */
  load(serviceName = null) {
    if (this.loaded) {
      console.log('⚠️  Configuration already loaded');
      return;
    }

    // 1. Load main .env file
    const mainEnvPath = path.join(this.configDir, '.env');
    if (fs.existsSync(mainEnvPath)) {
      dotenv.config({ path: mainEnvPath });
      console.log('✅ Loaded central configuration');
    } else {
      console.error('❌ Central .env file not found at', mainEnvPath);
      process.exit(1);
    }

    // 2. Load environment-specific overrides
    const env = process.env.NODE_ENV || 'development';
    const envPath = path.join(this.configDir, `.env.${env}`);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
      console.log(`✅ Loaded ${env} overrides`);
    }

    // 3. Load secrets (if exist)
    const secretsPath = path.join(this.configDir, 'secrets', '.env.secrets');
    if (fs.existsSync(secretsPath)) {
      dotenv.config({ path: secretsPath, override: true });
      console.log('✅ Loaded secrets');
    }

    // 4. Load service-specific overrides
    if (serviceName) {
      const servicePath = path.join(this.configDir, 'services', `${serviceName}.env`);
      if (fs.existsSync(servicePath)) {
        dotenv.config({ path: servicePath, override: true });
        console.log(`✅ Loaded service-specific config for ${serviceName}`);
      }
    }

    this.loaded = true;
    console.log('✅ Configuration loaded successfully');
  }

  /**
   * Get a configuration value with fallback
   * @param {string} key - The configuration key
   * @param {*} defaultValue - Default value if key not found
   */
  get(key, defaultValue = undefined) {
    return process.env[key] || defaultValue;
  }

  /**
   * Validate required configuration keys
   * @param {string[]} requiredKeys - Array of required keys
   */
  validate(requiredKeys) {
    const missing = requiredKeys.filter(key => !process.env[key]);
    if (missing.length > 0) {
      console.error('❌ Missing required configuration:', missing.join(', '));
      process.exit(1);
    }
    console.log('✅ Configuration validation passed');
  }

  /**
   * Get service-specific configuration
   * @param {string} service - Service name
   */
  getServiceConfig(service) {
    const prefix = service.toUpperCase().replace(/-/g, '_');
    const config = {};
    
    // Extract service-specific vars
    Object.keys(process.env).forEach(key => {
      if (key.startsWith(prefix)) {
        const newKey = key.replace(`${prefix}_`, '');
        config[newKey] = process.env[key];
      }
    });

    return config;
  }
}

// Export singleton instance
module.exports = new ConfigLoader();