-- Add API Response Cache Table
-- 1. New Tables
--    - api_response_cache: Stores cached API responses keyed by image hash
-- 2. Security
--    - Enable RLS with policies for authenticated users
-- 3. Indexes
--    - Index on image_hash for fast lookups
--    - Index on expires_at for cache cleanup
-- 4. Notes
--    - Cache entries expire after 30 days by default
--    - Image hash prevents re-analyzing identical slide images

CREATE TABLE IF NOT EXISTS api_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_hash text NOT NULL,
  image_width integer NOT NULL,
  image_height integer NOT NULL,
  prompt_hash text NOT NULL,
  response_data jsonb NOT NULL,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  cache_hit_count integer DEFAULT 0,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  UNIQUE(image_hash, prompt_hash)
);

ALTER TABLE api_response_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cache"
  ON api_response_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cache"
  ON api_response_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cache"
  ON api_response_cache
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_api_cache_image_hash 
  ON api_response_cache(image_hash);

CREATE INDEX IF NOT EXISTS idx_api_cache_expires_at 
  ON api_response_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_api_cache_composite 
  ON api_response_cache(image_hash, prompt_hash);
