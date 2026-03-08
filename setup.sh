#!/bin/bash
# Compliance Platform — One-Time Setup Script
# Run this after cloning the repo and installing dependencies

set -e

echo "=== Compliance Platform Setup ==="

# 1. Copy env file
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example — update AUTH_SECRET before production use"
else
  echo "  .env already exists, skipping"
fi

# 2. Start Docker services
echo ""
echo "=== Starting Docker services (PostgreSQL + Ollama) ==="
docker compose up -d
echo "  Waiting for PostgreSQL to be ready..."
sleep 5

# 3. Apply database migration
echo ""
echo "=== Applying database schema ==="
export $(grep -v '^#' .env | xargs)
PGPASSWORD=compliance_pass psql -h localhost -U compliance_user -d compliance_db -f src/lib/db/migrations/0000_init.sql
echo "✓ Database schema applied"

# 4. Pull Ollama models
echo ""
echo "=== Pulling Ollama models (this may take a few minutes) ==="
docker exec compliance_ollama ollama pull mistral:7b-instruct &
docker exec compliance_ollama ollama pull nomic-embed-text &
wait
echo "✓ Models pulled"

# 5. Create uploads directory
mkdir -p uploads
echo "✓ uploads/ directory created"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start the development server:"
echo "  npm run dev"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "Next steps:"
echo "  1. Create your first project at /projects/new"
echo "  2. Upload documents at /projects/:id/documents"
echo "  3. Download MAUDE data and run: python tools/maude_ingest.py <file>"
echo "  4. Generate your first draft at /projects/:id/drafts"
