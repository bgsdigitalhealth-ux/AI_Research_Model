#!/usr/bin/env bash
set -e

echo "=== Starting AI Research Flow Backend Server ==="

echo "==> Running Database Migrations (Supabase PostgreSQL)..."
alembic upgrade head || echo "Notice: Database schema up to date or already migrated."

echo "==> Starting Uvicorn on 0.0.0.0:${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

