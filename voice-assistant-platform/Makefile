.PHONY: help install build dev dev-services stop clean test lint format typecheck db-migrate db-seed logs

help:
	@echo "Voice Assistant Platform - Available Commands:"
	@echo ""
	@echo "  make install      - Install all dependencies"
	@echo "  make build        - Build all services"
	@echo "  make dev          - Start all services in development mode"
	@echo "  make dev-services - Start infrastructure only (DB, Redis, etc.)"
	@echo "  make stop         - Stop all services"
	@echo "  make clean        - Clean all build artifacts and node_modules"
	@echo "  make test         - Run all tests"
	@echo "  make lint         - Run ESLint"
	@echo "  make format       - Format code with Prettier"
	@echo "  make typecheck    - Run TypeScript type checking"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-seed      - Seed database with sample data"
	@echo "  make logs         - View logs from all services"

install:
	@echo "📦 Installing dependencies..."
	npm install

build:
	@echo "🏗️  Building all services..."
	npm run build

dev:
	@echo "🚀 Starting development environment..."
	docker-compose up

dev-services:
	@echo "🗄️  Starting infrastructure services only..."
	docker-compose up postgres redis jaeger prometheus

stop:
	@echo "🛑 Stopping all services..."
	docker-compose down

clean:
	@echo "🧹 Cleaning build artifacts..."
	npm run clean
	docker-compose down -v
	rm -rf dist/ .next/

test:
	@echo "🧪 Running tests..."
	npm run test

lint:
	@echo "🔍 Running ESLint..."
	npm run lint

format:
	@echo "✨ Formatting code..."
	npm run format

typecheck:
	@echo "📘 Type checking..."
	npm run typecheck

db-migrate:
	@echo "🗄️  Running database migrations..."
	docker-compose exec postgres psql -U postgres -d voice_assistant -f /docker-entrypoint-initdb.d/init.sql

db-seed:
	@echo "🌱 Seeding database..."
	npm run db:seed

logs:
	@echo "📋 Viewing logs..."
	docker-compose logs -f

# Quick health check
health:
	@echo "🏥 Checking service health..."
	@echo "Gateway:"; curl -s http://localhost:3000/health || echo "❌ Down"
	@echo "ASR:"; curl -s http://localhost:5001/health || echo "❌ Down"
	@echo "LLM:"; curl -s http://localhost:5002/health || echo "❌ Down"
	@echo "TTS:"; curl -s http://localhost:5003/health || echo "❌ Down"
	@echo "RAG:"; curl -s http://localhost:5004/health || echo "❌ Down"
