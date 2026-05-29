#!/usr/bin/env bash
# check-rls.sh — CI RLS assertion script for BarberFlow
#
# Purpose: Assert that every table in the public schema has Row Level Security enabled.
#          Exits 1 if any table is missing RLS (fail CI). Exits 0 if all tables pass.
#
# Usage:
#   ./scripts/check-rls.sh
#
# Prerequisites:
#   - supabase CLI installed and linked to a project (supabase link --project-ref <ref>)
#   - Or DATABASE_URL set for direct psql access
#
# Exit codes:
#   0 — All public tables have RLS enabled
#   1 — One or more public tables are missing RLS (CI fails)
#   2 — Could not query the database (connection error or supabase not linked)
#
# Security: No credentials are hardcoded. Supabase CLI uses linked project auth.
#           DATABASE_URL is read from the environment, never echoed to stdout.
#
# References:
#   tests/ci_rls_check.sql — Full SQL with both queries
#   CLAUDE.md — "CI must assert zero tables with rowsecurity = false"

set -euo pipefail

echo "BarberFlow RLS CI Check"
echo "========================"

# Run the COUNT query via supabase CLI
# supabase db query uses the linked project's database connection
COUNT=$(supabase db query "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;" --output plain 2>/dev/null | tail -1 | tr -d ' \r') || true

# Validate the result is numeric
if [[ -z "$COUNT" ]] || ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Could not query database — is supabase linked?"
  echo "       Run: supabase link --project-ref <your-project-ref>"
  echo "       Or set DATABASE_URL and use: psql \$DATABASE_URL -f tests/ci_rls_check.sql"
  exit 2
fi

if [[ "$COUNT" != "0" ]]; then
  echo "FAIL: $COUNT table(s) in public schema have RLS disabled"
  echo ""
  echo "Run the following to see which tables are affected:"
  echo "  supabase db query \"SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;\" --output plain"
  echo ""
  echo "Fix: Add 'ALTER TABLE public.<tablename> ENABLE ROW LEVEL SECURITY;' to your migration."
  exit 1
fi

echo "PASS: All public tables have RLS enabled ($COUNT tables checked)"
exit 0
