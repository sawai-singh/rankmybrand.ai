#!/bin/bash

# RankMyBrand Web Crawler Setup Script

echo "🚀 Setting up RankMyBrand Web Crawler..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. You'll need Docker for production deployment."
else
    echo "✅ Docker detected"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file
if [ ! -f .env ]; then
    echo "📋 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration"
else
    echo "✅ .env file exists"
fi

# Create logs directory
mkdir -p logs
echo "✅ Logs directory created"

# Start PostgreSQL and Redis with Docker
if command -v docker &> /dev/null; then
    echo "🐳 Starting PostgreSQL and Redis..."
    docker-compose up -d postgres redis
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to start..."
    sleep 5
    
    # Run migrations
    echo "🗄️  Running database migrations..."
    npm run db:migrate
else
    echo "⚠️  Skipping Docker services setup. Please ensure PostgreSQL and Redis are running."
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your configuration"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3002/docs for API documentation"
echo ""
echo "Happy crawling! 🕷️"
