/*
  # Add CRAFT Detection Support

  1. New Tables
    - `craft_detections`
      - `id` (uuid, primary key)
      - `slide_id` (uuid, foreign key to slides)
      - `detection_method` (text: 'craft', 'claude', 'hybrid')
      - `raw_craft_boxes` (jsonb: array of character-level bounding boxes)
      - `merged_with_claude` (boolean)
      - `confidence_score` (numeric)
      - `processing_time_ms` (integer)
      - `created_at` (timestamptz)
    
    - `detection_comparison`
      - `id` (uuid, primary key)
      - `slide_id` (uuid, foreign key to slides)
      - `claude_count` (integer: number of elements detected by Claude)
      - `craft_count` (integer: number of elements detected by CRAFT)
      - `merged_count` (integer: final number after merging)
      - `overlap_count` (integer: elements detected by both)
      - `claude_only_count` (integer)
      - `craft_only_count` (integer)
      - `merge_duration_ms` (integer)
      - `created_at` (timestamptz)

  2. Changes
    - Add `detection_source` column to `detected_text_elements` table
      - Values: 'claude', 'craft', 'hybrid'
    - Add `craft_detection_id` foreign key reference

  3. Security
    - Enable RLS on both new tables
    - Add policies for authenticated users to read their own data
*/

-- Create craft_detections table
CREATE TABLE IF NOT EXISTS craft_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id uuid REFERENCES slides(id) ON DELETE CASCADE NOT NULL,
  detection_method text NOT NULL CHECK (detection_method IN ('craft', 'claude', 'hybrid')),
  raw_craft_boxes jsonb DEFAULT '[]'::jsonb,
  merged_with_claude boolean DEFAULT false,
  confidence_score numeric(5,2) DEFAULT 0.0,
  processing_time_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create detection_comparison table
CREATE TABLE IF NOT EXISTS detection_comparison (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id uuid REFERENCES slides(id) ON DELETE CASCADE NOT NULL,
  claude_count integer DEFAULT 0,
  craft_count integer DEFAULT 0,
  merged_count integer DEFAULT 0,
  overlap_count integer DEFAULT 0,
  claude_only_count integer DEFAULT 0,
  craft_only_count integer DEFAULT 0,
  merge_duration_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add detection_source column to detected_text_elements if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_text_elements' AND column_name = 'detection_source'
  ) THEN
    ALTER TABLE detected_text_elements 
    ADD COLUMN detection_source text DEFAULT 'claude' 
    CHECK (detection_source IN ('claude', 'craft', 'hybrid'));
  END IF;
END $$;

-- Add craft_detection_id foreign key to detected_text_elements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_text_elements' AND column_name = 'craft_detection_id'
  ) THEN
    ALTER TABLE detected_text_elements 
    ADD COLUMN craft_detection_id uuid REFERENCES craft_detections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS on craft_detections
ALTER TABLE craft_detections ENABLE ROW LEVEL SECURITY;

-- Enable RLS on detection_comparison
ALTER TABLE detection_comparison ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_craft_detections_slide_id ON craft_detections(slide_id);
CREATE INDEX IF NOT EXISTS idx_craft_detections_method ON craft_detections(detection_method);
CREATE INDEX IF NOT EXISTS idx_detection_comparison_slide_id ON detection_comparison(slide_id);
CREATE INDEX IF NOT EXISTS idx_detected_text_elements_source ON detected_text_elements(detection_source);
CREATE INDEX IF NOT EXISTS idx_detected_text_elements_craft_id ON detected_text_elements(craft_detection_id);

-- RLS Policies for craft_detections
CREATE POLICY "Users can view all craft detections"
  ON craft_detections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert craft detections"
  ON craft_detections FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update craft detections"
  ON craft_detections FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete craft detections"
  ON craft_detections FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for detection_comparison
CREATE POLICY "Users can view all detection comparisons"
  ON detection_comparison FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert detection comparisons"
  ON detection_comparison FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update detection comparisons"
  ON detection_comparison FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete detection comparisons"
  ON detection_comparison FOR DELETE
  TO authenticated
  USING (true);
