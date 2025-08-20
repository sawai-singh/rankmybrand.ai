#!/usr/bin/env bash

# ==============================================================================
# RankMyBrand Production Orchestrator v3.0
# ==============================================================================
# Enterprise-grade launch system with monitoring, health checks, and auto-recovery
# ==============================================================================

set -euo pipefail  # Exit on error, undefined variables, and pipe failures
IFS=$'\n\t'       # Set Internal Field Separator for better security

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Configuration
readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_DIR="${PROJECT_ROOT}/logs"
readonly PID_DIR="${PROJECT_ROOT}/.pids"
readonly STATE_DIR="${PROJECT_ROOT}/.state"
readonly METRICS_DIR="${PROJECT_ROOT}/.metrics"
readonly CONFIG_DIR="${PROJECT_ROOT}/config"

# Service Ports
readonly REDIS_PORT=6379
readonly POSTGRES_PORT=5432
readonly API_GATEWAY_PORT=4000
readonly FRONTEND_PORT=3003
readonly DASHBOARD_PORT=3000
readonly INTELLIGENCE_PORT=8002
readonly PROMETHEUS_PORT=9090
readonly GRAFANA_PORT=3006
readonly ALERTMANAGER_PORT=9093

# Timeouts and Retries
readonly SERVICE_START_TIMEOUT=30
readonly HEALTH_CHECK_INTERVAL=5
readonly MAX_RETRIES=3
readonly RETRY_DELAY=2

# Service Health Endpoints (using functions instead of associative arrays for compatibility)
get_health_endpoint() {
    case "$1" in
        "api-gateway") echo "http://localhost:${API_GATEWAY_PORT}/health" ;;
        "frontend") echo "http://localhost:${FRONTEND_PORT}" ;;
        "dashboard") echo "http://localhost:${DASHBOARD_PORT}" ;;
        "intelligence-engine") echo "http://localhost:${INTELLIGENCE_PORT}/health" ;;
        "prometheus") echo "http://localhost:${PROMETHEUS_PORT}/-/healthy" ;;
        "grafana") echo "http://localhost:${GRAFANA_PORT}/api/health" ;;
    esac
}

# Service status tracking
SERVICE_STATUS_FILE="${STATE_DIR}/.service_status"
readonly LOCK_FILE="${STATE_DIR}/.launch.lock"

# ==============================================================================
# Utility Functions
# ==============================================================================

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        INFO)  echo -e "${BLUE}[${timestamp}]${NC} ${message}" ;;
        SUCCESS) echo -e "${GREEN}[${timestamp}] ✓${NC} ${message}" ;;
        WARNING) echo -e "${YELLOW}[${timestamp}] ⚠${NC} ${message}" ;;
        ERROR) echo -e "${RED}[${timestamp}] ✗${NC} ${message}" ;;
        DEBUG) [[ "${DEBUG:-0}" == "1" ]] && echo -e "${CYAN}[${timestamp}]${NC} ${message}" ;;
    esac
    
    # Also log to file
    echo "[${timestamp}] [${level}] ${message}" >> "${LOG_DIR}/orchestrator.log"
}

create_directories() {
    local dirs=("$LOG_DIR" "$PID_DIR" "$STATE_DIR" "$METRICS_DIR" "$CONFIG_DIR")
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log DEBUG "Created directory: $dir"
        fi
    done
}

acquire_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local lock_pid=$(cat "$LOCK_FILE")
        if kill -0 "$lock_pid" 2>/dev/null; then
            log ERROR "Another instance is already running (PID: $lock_pid)"
            exit 1
        else
            log WARNING "Removing stale lock file"
            rm -f "$LOCK_FILE"
        fi
    fi
    echo $$ > "$LOCK_FILE"
    log DEBUG "Lock acquired (PID: $$)"
}

release_lock() {
    rm -f "$LOCK_FILE"
    log DEBUG "Lock released"
}

check_prerequisites() {
    local required_commands=("node" "npm" "python3" "redis-cli" "psql" "docker" "curl" "jq")
    local missing_commands=()
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [[ ${#missing_commands[@]} -gt 0 ]]; then
        log ERROR "Missing required commands: ${missing_commands[*]}"
        log INFO "Please install missing dependencies and try again"
        exit 1
    fi
    
    # Check versions
    local node_version=$(node -v | sed 's/v//' | cut -d. -f1)
    if [[ $node_version -lt 18 ]]; then
        log ERROR "Node.js 18+ required (found: $(node -v))"
        exit 1
    fi
    
    local python_version=$(python3 --version | cut -d' ' -f2 | cut -d. -f1,2)
    if [[ $(echo "$python_version < 3.9" | bc) -eq 1 ]]; then
        log ERROR "Python 3.9+ required (found: $python_version)"
        exit 1
    fi
    
    log SUCCESS "All prerequisites met"
}

check_port_availability() {
    local port=$1
    local service=$2
    
    if lsof -Pi ":${port}" -sTCP:LISTEN -t > /dev/null 2>&1; then
        log WARNING "Port ${port} already in use (${service})"
        return 1
    fi
    return 0
}

save_pid() {
    local service=$1
    local pid=$2
    echo "$pid" > "${PID_DIR}/${service}.pid"
    log DEBUG "Saved PID for ${service}: ${pid}"
}

get_pid() {
    local service=$1
    if [[ -f "${PID_DIR}/${service}.pid" ]]; then
        cat "${PID_DIR}/${service}.pid"
    fi
}

is_service_running() {
    local service=$1
    local pid=$(get_pid "$service")
    
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        return 0
    fi
    return 1
}

wait_for_service() {
    local service=$1
    local url=$2
    local timeout=${3:-$SERVICE_START_TIMEOUT}
    local elapsed=0
    
    log INFO "Waiting for ${service} to be ready..."
    
    while [[ $elapsed -lt $timeout ]]; do
        if curl -sf -o /dev/null -w "%{http_code}" "$url" | grep -qE "200|404"; then
            log SUCCESS "${service} is ready"
            echo "${service}:running" >> "$SERVICE_STATUS_FILE"
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done
    
    log ERROR "${service} failed to start within ${timeout} seconds"
    echo "${service}:failed" >> "$SERVICE_STATUS_FILE"
    return 1
}

# ==============================================================================
# Infrastructure Services
# ==============================================================================

start_redis() {
    if redis-cli -p "$REDIS_PORT" ping > /dev/null 2>&1; then
        log SUCCESS "Redis already running on port ${REDIS_PORT}"
        SERVICE_STATUS["redis"]="running"
        return 0
    fi
    
    log INFO "Starting Redis..."
    redis-server --port "$REDIS_PORT" --daemonize yes \
        --logfile "${LOG_DIR}/redis.log" \
        --dir "${STATE_DIR}" \
        --save 60 1 \
        --save 300 10 \
        --save 900 100 > /dev/null 2>&1
    
    sleep 2
    
    if redis-cli -p "$REDIS_PORT" ping > /dev/null 2>&1; then
        log SUCCESS "Redis started on port ${REDIS_PORT}"
        SERVICE_STATUS["redis"]="running"
        
        # Set up Redis monitoring
        redis-cli -p "$REDIS_PORT" CONFIG SET notify-keyspace-events Ex > /dev/null 2>&1
        return 0
    else
        log ERROR "Failed to start Redis"
        SERVICE_STATUS["redis"]="failed"
        return 1
    fi
}

start_postgres() {
    local db_user="${PGUSER:-$USER}"
    
    if psql -U "$db_user" -d postgres -c "SELECT 1" > /dev/null 2>&1; then
        log SUCCESS "PostgreSQL accessible"
        SERVICE_STATUS["postgres"]="running"
        
        # Ensure database exists
        if ! psql -U "$db_user" -lqt | cut -d \| -f 1 | grep -qw rankmybrand; then
            log INFO "Creating database..."
            psql -U "$db_user" -d postgres -c "CREATE DATABASE rankmybrand" > /dev/null 2>&1
            
            if [[ -f "${PROJECT_ROOT}/database/schema.sql" ]]; then
                psql -U "$db_user" -d rankmybrand -f "${PROJECT_ROOT}/database/schema.sql" > /dev/null 2>&1
                log SUCCESS "Database initialized"
            fi
        fi
        return 0
    else
        log ERROR "PostgreSQL not accessible. Please ensure it's running"
        SERVICE_STATUS["postgres"]="failed"
        return 1
    fi
}

# ==============================================================================
# Application Services
# ==============================================================================

build_service() {
    local service=$1
    local path=$2
    
    log INFO "Building ${service}..."
    cd "$path"
    
    # Install dependencies with retry logic
    local retries=0
    while [[ $retries -lt $MAX_RETRIES ]]; do
        if npm install --legacy-peer-deps > "${LOG_DIR}/${service}-build.log" 2>&1; then
            break
        fi
        retries=$((retries + 1))
        log WARNING "npm install failed for ${service}, retry ${retries}/${MAX_RETRIES}"
        sleep $RETRY_DELAY
    done
    
    # Build for production
    if [[ -f "package.json" ]] && grep -q '"build"' package.json; then
        NODE_ENV=production npm run build >> "${LOG_DIR}/${service}-build.log" 2>&1 || true
    fi
    
    log SUCCESS "${service} built"
}

start_api_gateway() {
    if is_service_running "api-gateway"; then
        log WARNING "API Gateway already running"
        return 0
    fi
    
    if ! check_port_availability "$API_GATEWAY_PORT" "API Gateway"; then
        return 1
    fi
    
    log INFO "Starting API Gateway..."
    cd "${PROJECT_ROOT}/api-gateway"
    
    NODE_ENV=production \
    PORT=$API_GATEWAY_PORT \
    REDIS_URL="redis://localhost:${REDIS_PORT}" \
    DATABASE_URL="postgresql://${PGUSER:-$USER}@localhost:${POSTGRES_PORT}/rankmybrand" \
    npm start > "${LOG_DIR}/api-gateway.log" 2>&1 &
    
    local pid=$!
    save_pid "api-gateway" "$pid"
    
    wait_for_service "api-gateway" "${HEALTH_ENDPOINTS[api-gateway]}"
}

start_frontend() {
    if is_service_running "frontend"; then
        log WARNING "Frontend already running"
        return 0
    fi
    
    if ! check_port_availability "$FRONTEND_PORT" "Frontend"; then
        return 1
    fi
    
    log INFO "Starting Frontend..."
    cd "${PROJECT_ROOT}/rankmybrand-frontend"
    
    PORT=$FRONTEND_PORT \
    NEXT_PUBLIC_API_URL="http://localhost:${API_GATEWAY_PORT}" \
    npm start > "${LOG_DIR}/frontend.log" 2>&1 &
    
    local pid=$!
    save_pid "frontend" "$pid"
    
    wait_for_service "frontend" "${HEALTH_ENDPOINTS[frontend]}"
}

start_dashboard() {
    if is_service_running "dashboard"; then
        log WARNING "Dashboard already running"
        return 0
    fi
    
    if ! check_port_availability "$DASHBOARD_PORT" "Dashboard"; then
        return 1
    fi
    
    log INFO "Starting Dashboard..."
    cd "${PROJECT_ROOT}/services/dashboard"
    
    PORT=$DASHBOARD_PORT \
    NEXT_PUBLIC_API_GATEWAY="http://localhost:${API_GATEWAY_PORT}" \
    npm start > "${LOG_DIR}/dashboard.log" 2>&1 &
    
    local pid=$!
    save_pid "dashboard" "$pid"
    
    wait_for_service "dashboard" "${HEALTH_ENDPOINTS[dashboard]}"
}

start_intelligence_engine() {
    if is_service_running "intelligence-engine"; then
        log WARNING "Intelligence Engine already running"
        return 0
    fi
    
    if ! check_port_availability "$INTELLIGENCE_PORT" "Intelligence Engine"; then
        return 1
    fi
    
    log INFO "Starting Intelligence Engine..."
    cd "${PROJECT_ROOT}/services/intelligence-engine"
    
    PYTHONPATH="${PROJECT_ROOT}/services/intelligence-engine" \
    PORT=$INTELLIGENCE_PORT \
    REDIS_URL="redis://localhost:${REDIS_PORT}" \
    python3 src/main.py > "${LOG_DIR}/intelligence-engine.log" 2>&1 &
    
    local pid=$!
    save_pid "intelligence-engine" "$pid"
    
    wait_for_service "intelligence-engine" "${HEALTH_ENDPOINTS[intelligence-engine]}"
}

# ==============================================================================
# Monitoring Stack
# ==============================================================================

start_monitoring() {
    log INFO "Starting monitoring stack..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        log WARNING "Docker not running, skipping monitoring stack"
        return 1
    fi
    
    cd "${PROJECT_ROOT}/monitoring"
    
    # Start monitoring containers
    docker-compose -f docker-compose.monitoring.yml up -d > "${LOG_DIR}/monitoring.log" 2>&1
    
    sleep 5
    
    # Check if services are up
    if curl -sf "http://localhost:${PROMETHEUS_PORT}/-/healthy" > /dev/null 2>&1; then
        log SUCCESS "Prometheus running on port ${PROMETHEUS_PORT}"
        SERVICE_STATUS["prometheus"]="running"
    fi
    
    if curl -sf "http://localhost:${GRAFANA_PORT}/api/health" > /dev/null 2>&1; then
        log SUCCESS "Grafana running on port ${GRAFANA_PORT}"
        SERVICE_STATUS["grafana"]="running"
    fi
    
    return 0
}

# ==============================================================================
# Health Monitoring
# ==============================================================================

monitor_services() {
    while true; do
        for service in "${!HEALTH_ENDPOINTS[@]}"; do
            if [[ "${SERVICE_STATUS[$service]}" == "running" ]]; then
                if ! curl -sf -o /dev/null "${HEALTH_ENDPOINTS[$service]}"; then
                    log WARNING "${service} health check failed, attempting restart..."
                    restart_service "$service"
                fi
            fi
        done
        sleep $HEALTH_CHECK_INTERVAL
    done
}

restart_service() {
    local service=$1
    
    log INFO "Restarting ${service}..."
    stop_service "$service"
    sleep 2
    
    case "$service" in
        "api-gateway") start_api_gateway ;;
        "frontend") start_frontend ;;
        "dashboard") start_dashboard ;;
        "intelligence-engine") start_intelligence_engine ;;
        *) log ERROR "Unknown service: ${service}" ;;
    esac
}

stop_service() {
    local service=$1
    local pid=$(get_pid "$service")
    
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        log INFO "Stopping ${service} (PID: ${pid})..."
        kill "$pid" 2>/dev/null || true
        
        # Wait for graceful shutdown
        local timeout=10
        while [[ $timeout -gt 0 ]] && kill -0 "$pid" 2>/dev/null; do
            sleep 1
            timeout=$((timeout - 1))
        done
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
        
        rm -f "${PID_DIR}/${service}.pid"
        SERVICE_STATUS["$service"]="stopped"
        log SUCCESS "${service} stopped"
    fi
}

# ==============================================================================
# Metrics Collection
# ==============================================================================

collect_metrics() {
    while true; do
        local timestamp=$(date +%s)
        local metrics_file="${METRICS_DIR}/metrics-${timestamp}.json"
        
        # Collect system metrics
        local cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
        local memory_usage=$(top -l 1 | grep "PhysMem" | awk '{print $2}')
        
        # Collect service metrics
        local active_connections=$(lsof -i :$API_GATEWAY_PORT | grep ESTABLISHED | wc -l)
        
        # Write metrics
        cat > "$metrics_file" <<EOF
{
    "timestamp": ${timestamp},
    "system": {
        "cpu_usage": "${cpu_usage}",
        "memory_usage": "${memory_usage}"
    },
    "services": {
        "api_gateway": {
            "active_connections": ${active_connections},
            "status": "${SERVICE_STATUS[api-gateway]:-unknown}"
        }
    }
}
EOF
        
        # Push to Prometheus if available
        if [[ "${SERVICE_STATUS[prometheus]}" == "running" ]]; then
            curl -sf -X POST "http://localhost:${API_GATEWAY_PORT}/metrics" \
                -H "Content-Type: application/json" \
                -d "@${metrics_file}" > /dev/null 2>&1 || true
        fi
        
        # Clean up old metrics (keep last 100)
        ls -t "${METRICS_DIR}"/metrics-*.json | tail -n +101 | xargs rm -f 2>/dev/null || true
        
        sleep 30
    done
}

# ==============================================================================
# Cleanup and Shutdown
# ==============================================================================

cleanup() {
    log INFO "Shutting down services..."
    
    # Stop health monitoring
    jobs -p | xargs kill 2>/dev/null || true
    
    # Stop application services
    for service in "frontend" "dashboard" "api-gateway" "intelligence-engine"; do
        stop_service "$service"
    done
    
    # Stop monitoring stack
    if [[ "${SERVICE_STATUS[prometheus]}" == "running" ]] || [[ "${SERVICE_STATUS[grafana]}" == "running" ]]; then
        cd "${PROJECT_ROOT}/monitoring"
        docker-compose -f docker-compose.monitoring.yml down > /dev/null 2>&1 || true
        log SUCCESS "Monitoring stack stopped"
    fi
    
    # Stop Redis (optional, usually keep running)
    if [[ "${STOP_REDIS:-0}" == "1" ]]; then
        redis-cli -p "$REDIS_PORT" shutdown > /dev/null 2>&1 || true
        log SUCCESS "Redis stopped"
    fi
    
    release_lock
    log SUCCESS "Cleanup complete"
}

# ==============================================================================
# Main Execution
# ==============================================================================

main() {
    # Set up signal handlers
    trap cleanup EXIT INT TERM
    
    echo -e "${PURPLE}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}${BOLD}        RankMyBrand Production Orchestrator v3.0${NC}"
    echo -e "${PURPLE}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo
    
    # Initialize
    create_directories
    acquire_lock
    
    # Pre-flight checks
    log INFO "Running pre-flight checks..."
    check_prerequisites
    
    # Start infrastructure
    echo
    log INFO "Starting infrastructure services..."
    start_redis || exit 1
    start_postgres || exit 1
    
    # Build services
    echo
    log INFO "Building application services..."
    build_service "api-gateway" "${PROJECT_ROOT}/api-gateway"
    build_service "frontend" "${PROJECT_ROOT}/rankmybrand-frontend"
    build_service "dashboard" "${PROJECT_ROOT}/services/dashboard"
    
    # Start application services
    echo
    log INFO "Starting application services..."
    start_api_gateway || exit 1
    start_intelligence_engine || true  # Non-critical
    start_frontend || exit 1
    start_dashboard || exit 1
    
    # Start monitoring
    echo
    start_monitoring || true  # Non-critical
    
    # Start background tasks
    monitor_services &
    collect_metrics &
    
    # Display status
    echo
    echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}        🚀 RankMyBrand is Running in Production Mode!${NC}"
    echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${BLUE}${BOLD}Service Status:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    for service in "${!SERVICE_STATUS[@]}"; do
        local status="${SERVICE_STATUS[$service]}"
        local status_icon="○"
        local status_color="${RED}"
        
        if [[ "$status" == "running" ]]; then
            status_icon="●"
            status_color="${GREEN}"
        elif [[ "$status" == "starting" ]]; then
            status_icon="◐"
            status_color="${YELLOW}"
        fi
        
        printf "%-20s ${status_color}${status_icon} %s${NC}\n" "$service" "$status"
    done
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    echo -e "${BLUE}${BOLD}Access Points:${NC}"
    echo -e "  Frontend:     ${PURPLE}http://localhost:${FRONTEND_PORT}${NC}"
    echo -e "  Dashboard:    ${PURPLE}http://localhost:${DASHBOARD_PORT}${NC}"
    echo -e "  API Gateway:  ${PURPLE}http://localhost:${API_GATEWAY_PORT}${NC}"
    echo -e "  API Metrics:  ${PURPLE}http://localhost:${API_GATEWAY_PORT}/metrics${NC}"
    
    if [[ "${SERVICE_STATUS[grafana]}" == "running" ]]; then
        echo
        echo -e "${BLUE}${BOLD}Monitoring:${NC}"
        echo -e "  Grafana:      ${PURPLE}http://localhost:${GRAFANA_PORT}${NC} (admin/rankmybrand123)"
        echo -e "  Prometheus:   ${PURPLE}http://localhost:${PROMETHEUS_PORT}${NC}"
        echo -e "  AlertManager: ${PURPLE}http://localhost:${ALERTMANAGER_PORT}${NC}"
    fi
    
    echo
    echo -e "${BLUE}${BOLD}Logs & Metrics:${NC}"
    echo -e "  Logs:         ${LOG_DIR}/"
    echo -e "  Metrics:      ${METRICS_DIR}/"
    echo -e "  PIDs:         ${PID_DIR}/"
    echo
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    echo
    
    # Keep running
    while true; do
        sleep 60
        
        # Log status periodically
        log DEBUG "Health check cycle completed"
    done
}

# Run main function
main "$@"