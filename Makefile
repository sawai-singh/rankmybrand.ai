# Makefile for RankMyBrand.ai Platform Management
.PHONY: help build up down restart logs status clean test deploy

# Default target
help:
	@echo "RankMyBrand.ai Platform Management Commands"
	@echo "==========================================="
	@echo "make build      - Build all Docker images"
	@echo "make up         - Start all services"
	@echo "make down       - Stop all services"
	@echo "make restart    - Restart all services"
	@echo "make logs       - View logs for all services"
	@echo "make status     - Check status of all services"
	@echo "make clean      - Clean up containers and volumes"
	@echo "make test       - Run integration tests"
	@echo "make deploy     - Full deployment (build + up + test)"
	@echo ""
	@echo "Service-specific commands:"
	@echo "make logs-geo   - View GEO Calculator logs"
	@echo "make logs-api   - View API Gateway logs"
	@echo "make shell-geo  - Access GEO Calculator shell"
	@echo ""

# Build all Docker images
build:
	@echo "🔨 Building all Docker images..."
	docker-compose build --parallel

# Start all services
up:
	@echo "🚀 Starting RankMyBrand.ai platform..."
	docker-compose up -d
	@echo "⏳ Waiting for services to be healthy..."
	@sleep 10
	@make status
	@echo ""
	@echo "✅ Platform is ready!"
	@echo "📍 Access points:"
	@echo "   Frontend:    http://localhost:3003"
	@echo "   Dashboard:   http://localhost:3000"
	@echo "   API Gateway: http://localhost:4000"
	@echo "   Prometheus:  http://localhost:9090"
	@echo "   Grafana:     http://localhost:3005"

# Stop all services
down:
	@echo "🛑 Stopping all services..."
	docker-compose down

# Restart all services
restart:
	@echo "🔄 Restarting all services..."
	docker-compose restart

# View logs for all services
logs:
	docker-compose logs -f --tail=100

# Check status of all services
status:
	@echo "📊 Service Status:"
	@echo "=================="
	@docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "🏥 Health Checks:"
	@echo "=================="
	@curl -s -o /dev/null -w "API Gateway:    %{http_code}\n" http://localhost:4000/health || echo "API Gateway:    ❌"
	@curl -s -o /dev/null -w "GEO Calculator: %{http_code}\n" http://localhost:8000/health || echo "GEO Calculator: ❌"
	@curl -s -o /dev/null -w "Intelligence:   %{http_code}\n" http://localhost:8002/health || echo "Intelligence:   ❌"
	@curl -s -o /dev/null -w "Action Center:  %{http_code}\n" http://localhost:8082/api/health || echo "Action Center:  ❌"
	@curl -s -o /dev/null -w "WebSocket:      %{http_code}\n" http://localhost:3001/health || echo "WebSocket:      ❌"
	@curl -s -o /dev/null -w "Dashboard:      %{http_code}\n" http://localhost:3000 || echo "Dashboard:      ❌"
	@curl -s -o /dev/null -w "Frontend:       %{http_code}\n" http://localhost:3003 || echo "Frontend:       ❌"

# Clean up containers and volumes
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	docker-compose down -v
	docker system prune -f

# Run integration tests
test:
	@echo "🧪 Running integration tests..."
	@sleep 5
	node test-integration.js

# Full deployment
deploy: build up test
	@echo "🎉 Deployment complete!"

# Service-specific logs
logs-geo:
	docker-compose logs -f geo-calculator

logs-api:
	docker-compose logs -f api-gateway

logs-intel:
	docker-compose logs -f intelligence-engine

logs-action:
	docker-compose logs -f action-center

logs-frontend:
	docker-compose logs -f frontend

# Shell access
shell-geo:
	docker-compose exec geo-calculator /bin/bash

shell-api:
	docker-compose exec api-gateway /bin/sh

shell-redis:
	docker-compose exec redis redis-cli

shell-postgres:
	docker-compose exec postgres psql -U rmb_user -d rankmybrand

# Development helpers
dev-reset:
	@echo "🔄 Resetting development environment..."
	@make down
	@make clean
	@make build
	@make up

# Production deployment
prod-deploy:
	@echo "🚀 Production deployment starting..."
	@cp .env.production .env
	@docker-compose -f docker-compose.yml up -d --build
	@echo "✅ Production deployment complete!"

# Backup database
backup:
	@echo "💾 Backing up database..."
	@mkdir -p backups
	@docker-compose exec postgres pg_dump -U rmb_user rankmybrand > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup complete!"

# Monitor resources
monitor:
	@watch -n 2 'docker stats --no-stream'