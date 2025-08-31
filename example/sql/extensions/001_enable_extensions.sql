-- Enable required PostgreSQL extensions
-- Order matters for dependencies

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Advanced indexing
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- JSON validation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PostGIS for location data (optional)
-- CREATE EXTENSION IF NOT EXISTS "postgis";

-- Time-series data support
-- CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Row-level security helpers
CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- Full-text search
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Statistics and monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Verify extensions are loaded
SELECT 
    extname,
    extversion,
    extnamespace::regnamespace as schema
FROM pg_extension
WHERE extname NOT IN ('plpgsql')
ORDER BY extname;