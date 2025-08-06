#!/bin/bash
# Search Intelligence Service Deployment Script
# Production deployment with zero-downtime

set -e

# Configuration
SERVICE_NAME="search-intelligence"
DEPLOYMENT_ENV="${1:-production}"
VERSION="${2:-latest}"
HEALTH_CHECK_URL="http://localhost:3002/health"
METRICS_URL="http://localhost:9090/metrics"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting deployment of ${SERVICE_NAME} ${VERSION} to ${DEPLOYMENT_ENV}${NC}"

# Pre-deployment checks
pre_deployment_checks() {
    echo -e "${YELLOW}Running pre-deployment checks...${NC}"
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}Node.js 18+ required. Current version: $(node -v)${NC}"
        exit 1
    fi
    
    # Check required environment variables
    required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
        "SERPAPI_KEY"
        "VALUESERP_KEY"
        "SCALESERP_KEY"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}Missing required environment variable: $var${NC}"
            exit 1
        fi
    done
    
    # Check disk space
    DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 80 ]; then
        echo -e "${RED}Disk usage is above 80%: ${DISK_USAGE}%${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Pre-deployment checks passed${NC}"
}

# Build application
build_application() {
    echo -e "${YELLOW}Building application...${NC}"
    
    # Install dependencies
    npm ci --production=false
    
    # Run tests
    npm test -- --passWithNoTests
    
    # Type check
    npx tsc --noEmit
    
    # Build TypeScript
    npm run build
    
    # Prune dev dependencies
    npm prune --production
    
    echo -e "${GREEN}Build completed successfully${NC}"
}

# Database migrations
run_migrations() {
    echo -e "${YELLOW}Running database migrations...${NC}"
    
    # Backup database first
    pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
    
    # Run migrations
    npm run migrate
    
    echo -e "${GREEN}Migrations completed${NC}"
}

# Health check
health_check() {
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}Waiting for service to be healthy...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s $HEALTH_CHECK_URL > /dev/null; then
            echo -e "${GREEN}Health check passed${NC}"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts failed, retrying..."
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}Health check failed after $max_attempts attempts${NC}"
    return 1
}

# Zero-downtime deployment
zero_downtime_deploy() {
    echo -e "${YELLOW}Starting zero-downtime deployment...${NC}"
    
    # Start new instance on different port
    NEW_PORT=3003
    export PORT=$NEW_PORT
    
    # Start new instance in background
    npm start &
    NEW_PID=$!
    
    # Wait for new instance to be healthy
    HEALTH_CHECK_URL="http://localhost:$NEW_PORT/health"
    if ! health_check; then
        kill $NEW_PID
        echo -e "${RED}New instance failed health check${NC}"
        exit 1
    fi
    
    # Update load balancer to point to new instance
    update_load_balancer $NEW_PORT
    
    # Gracefully shutdown old instance
    OLD_PID=$(lsof -ti:3002)
    if [ ! -z "$OLD_PID" ]; then
        echo -e "${YELLOW}Gracefully shutting down old instance (PID: $OLD_PID)${NC}"
        kill -TERM $OLD_PID
        
        # Wait for graceful shutdown
        sleep 10
        
        # Force kill if still running
        if kill -0 $OLD_PID 2>/dev/null; then
            kill -KILL $OLD_PID
        fi
    fi
    
    # Move new instance to standard port
    kill $NEW_PID
    export PORT=3002
    
    echo -e "${GREEN}Zero-downtime deployment completed${NC}"
}

# Update load balancer
update_load_balancer() {
    local new_port=$1
    echo -e "${YELLOW}Updating load balancer configuration...${NC}"
    
    # Update nginx configuration
    sudo sed -i "s/localhost:3002/localhost:$new_port/" /etc/nginx/sites-available/search-intelligence
    sudo nginx -t && sudo nginx -s reload
    
    echo -e "${GREEN}Load balancer updated${NC}"
}

# Cache warming
warm_cache() {
    echo -e "${YELLOW}Warming cache...${NC}"
    
    # Run cache warming script
    node scripts/warm-cache.js
    
    echo -e "${GREEN}Cache warming completed${NC}"
}

# Performance validation
validate_performance() {
    echo -e "${YELLOW}Validating performance...${NC}"
    
    # Run performance tests
    npm run test:performance -- --reporter json > perf_results.json
    
    # Check if performance meets SLA
    P95_LATENCY=$(jq '.latency.p95' perf_results.json)
    if (( $(echo "$P95_LATENCY > 5000" | bc -l) )); then
        echo -e "${RED}Performance validation failed: p95 latency ${P95_LATENCY}ms exceeds 5000ms SLA${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Performance validation passed${NC}"
}

# Enable monitoring
enable_monitoring() {
    echo -e "${YELLOW}Enabling monitoring...${NC}"
    
    # Start Prometheus metrics endpoint
    if curl -f -s $METRICS_URL > /dev/null; then
        echo -e "${GREEN}Metrics endpoint is accessible${NC}"
    else
        echo -e "${RED}Metrics endpoint is not accessible${NC}"
        exit 1
    fi
    
    # Send deployment event to monitoring
    curl -X POST http://localhost:9090/api/v1/events \
        -H "Content-Type: application/json" \
        -d "{\"event\": \"deployment\", \"service\": \"$SERVICE_NAME\", \"version\": \"$VERSION\"}"
    
    echo -e "${GREEN}Monitoring enabled${NC}"
}

# Post-deployment validation
post_deployment_validation() {
    echo -e "${YELLOW}Running post-deployment validation...${NC}"
    
    # Test critical endpoints
    endpoints=(
        "/api/search-intelligence/analyze"
        "/api/health"
        "/metrics"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if ! curl -f -s "http://localhost:3002$endpoint" > /dev/null; then
            echo -e "${RED}Endpoint validation failed: $endpoint${NC}"
            exit 1
        fi
    done
    
    # Check error rate
    ERROR_RATE=$(curl -s $METRICS_URL | grep 'search_intel_error_rate' | awk '{print $2}')
    if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
        echo -e "${RED}Error rate is above 5%: ${ERROR_RATE}${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Post-deployment validation passed${NC}"
}

# Rollback function
rollback() {
    echo -e "${RED}Deployment failed, initiating rollback...${NC}"
    
    # Restore from backup
    git checkout HEAD~1
    npm ci --production
    
    # Restore database
    if [ -f backup_*.sql ]; then
        psql $DATABASE_URL < backup_*.sql
    fi
    
    # Restart service
    npm start
    
    echo -e "${YELLOW}Rollback completed${NC}"
}

# Main deployment flow
main() {
    # Set error trap
    trap rollback ERR
    
    # Run deployment steps
    pre_deployment_checks
    build_application
    run_migrations
    
    if [ "$DEPLOYMENT_ENV" == "production" ]; then
        zero_downtime_deploy
    else
        npm start &
        health_check
    fi
    
    warm_cache
    validate_performance
    enable_monitoring
    post_deployment_validation
    
    # Clean up old backups (keep last 5)
    ls -t backup_*.sql | tail -n +6 | xargs -r rm
    
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo -e "${GREEN}Service version: $VERSION${NC}"
    echo -e "${GREEN}Environment: $DEPLOYMENT_ENV${NC}"
    
    # Send success notification
    if [ ! -z "$SLACK_WEBHOOK" ]; then
        curl -X POST $SLACK_WEBHOOK \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"✅ Successfully deployed $SERVICE_NAME $VERSION to $DEPLOYMENT_ENV\"}"
    fi
}

# Run main deployment
main