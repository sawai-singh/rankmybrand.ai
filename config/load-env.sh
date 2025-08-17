#!/bin/bash
# ========================================================
# Central Environment Loader for RankMyBrand.ai
# ========================================================
# This script loads the central configuration for any service
# Usage: source /path/to/config/load-env.sh

# Get the directory of this script
CONFIG_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Load main .env file
if [ -f "$CONFIG_DIR/.env" ]; then
    export $(grep -v '^#' "$CONFIG_DIR/.env" | xargs)
    echo "✅ Loaded central configuration from $CONFIG_DIR/.env"
else
    echo "❌ Central .env file not found at $CONFIG_DIR/.env"
    exit 1
fi

# Load environment-specific overrides if they exist
if [ -n "$NODE_ENV" ]; then
    ENV_FILE="$CONFIG_DIR/.env.$NODE_ENV"
    if [ -f "$ENV_FILE" ]; then
        export $(grep -v '^#' "$ENV_FILE" | xargs)
        echo "✅ Loaded $NODE_ENV overrides from $ENV_FILE"
    fi
fi

# Load secrets if they exist (never commit these!)
SECRETS_FILE="$CONFIG_DIR/secrets/.env.secrets"
if [ -f "$SECRETS_FILE" ]; then
    export $(grep -v '^#' "$SECRETS_FILE" | xargs)
    echo "✅ Loaded secrets from $SECRETS_FILE"
fi

# Service-specific overrides (if SERVICE_NAME is set)
if [ -n "$SERVICE_NAME" ]; then
    SERVICE_FILE="$CONFIG_DIR/services/$SERVICE_NAME.env"
    if [ -f "$SERVICE_FILE" ]; then
        export $(grep -v '^#' "$SERVICE_FILE" | xargs)
        echo "✅ Loaded service-specific config for $SERVICE_NAME"
    fi
fi

echo "✅ Environment configuration loaded successfully"