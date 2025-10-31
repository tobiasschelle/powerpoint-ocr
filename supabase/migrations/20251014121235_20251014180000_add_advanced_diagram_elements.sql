/*
  # Advanced Diagram Elements Support

  ## Overview
  Adds support for advanced diagram elements including arrows, connectors, curved lines,
  line styles, and verification results for quality assurance.

  ## New Tables

  ### `detected_connectors`
  Stores connector elements (arrows, lines connecting shapes)
  - `id` (uuid, primary key) - Unique identifier
  - `slide_id` (uuid, foreign key) - Links to parent slide
  - `connector_type` (text) - Type: 'straight', 'elbow', 'curved'
  - `start_x` (numeric) - Start X coordinate in inches
  - `start_y` (numeric) - Start Y coordinate in inches
  - `end_x` (numeric) - End X coordinate in inches
  - `end_y` (numeric) - End Y coordinate in inches
  - `control_points` (jsonb) - Bezier curve control points [{x, y}]
  - `line_style` (text) - Style: 'solid', 'dash', 'dashDot', 'lgDash', 'dot'
  - `line_color` (text) - RGB hex color
  - `line_width` (numeric) - Line width in points
  - `arrow_head_start` (text) - Start arrow type: 'none', 'triangle', 'arrow', 'diamond', 'oval'
  - `arrow_head_end` (text) - End arrow type
  - `connected_from_shape_id` (uuid) - Source shape reference
  - `connected_to_shape_id` (uuid) - Target shape reference
  - `text_label` (text) - Optional label on connector
  - `confidence_score` (numeric) - AI detection confidence 0-100
  - `created_at` (timestamptz) - When detected

  ### `detected_curved_lines`
  Stores curved line elements separate from connectors
  - `id` (uuid, primary key) - Unique identifier
  - `slide_id` (uuid, foreign key) - Links to parent slide
  - `start_x` (numeric) - Start X coordinate in inches
  - `start_y` (numeric) - Start Y coordinate in inches
  - `end_x` (numeric) - End X coordinate in inches
  - `end_y` (numeric) - End Y coordinate in inches
  - `control_points` (jsonb) - Bezier curve control points [{x, y}]
  - `line_style` (text) - Style: 'solid', 'dash', 'dashDot', 'lgDash', 'dot'
  - `line_color` (text) - RGB hex color
  - `line_width` (numeric) - Line width in points
  - `confidence_score` (numeric) - AI detection confidence 0-100
  - `created_at` (timestamptz) - When detected

  ### `verification_results`
  Stores AI verification comparison results
  - `id` (uuid, primary key) - Unique identifier
  - `slide_id` (uuid, foreign key) - Links to parent slide
  - `original_image_data` (text) - Base64 encoded original image
  - `generated_image_data` (text) - Base64 encoded generated image
  - `overall_similarity_score` (numeric) - Similarity score 0-100
  - `missing_elements` (jsonb) - Array of missing element descriptions
  - `positioning_errors` (jsonb) - Array of positioning error details
  - `styling_differences` (jsonb) - Array of styling difference details
  - `verification_passed` (boolean) - Overall pass/fail status
  - `suggestions` (jsonb) - Array of improvement suggestions
  - `created_at` (timestamptz) - When verified

  ### `shape_relationships`
  Stores relationships between shapes via connectors
  - `id` (uuid, primary key) - Unique identifier
  - `slide_id` (uuid, foreign key) - Links to parent slide
  - `from_shape_id` (uuid) - Source shape ID
  - `to_shape_id` (uuid) - Target shape ID
  - `connector_id` (uuid) - Connector element ID
  - `relationship_type` (text) - Type: 'flow', 'association', 'dependency'
  - `created_at` (timestamptz) - When detected

  ## Schema Updates

  Adds new columns to existing `detected_shapes` table:
  - `line_style` (text) - Line style for shape borders
  - `is_arrow` (boolean) - Whether shape is an arrow
  - `arrow_head_start` (text) - Arrow head at start
  - `arrow_head_end` (text) - Arrow head at end
  - `rounded_corners` (numeric) - Corner radius for rounded rectangles

  ## Security

  All new tables have RLS enabled with public access policies.

  ## Indexes

  Added indexes on foreign keys and commonly queried fields for performance.

  ## Important Notes

  1. Control points are stored as JSON array for curved lines and connectors
  2. Line styles match PowerPoint's native dash patterns
  3. Arrow heads support multiple types for diverse diagram styles
  4. Verification results enable iterative improvement
*/

-- Add new columns to existing detected_shapes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_shapes' AND column_name = 'line_style'
  ) THEN
    ALTER TABLE detected_shapes ADD COLUMN line_style text DEFAULT 'solid';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_shapes' AND column_name = 'is_arrow'
  ) THEN
    ALTER TABLE detected_shapes ADD COLUMN is_arrow boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_shapes' AND column_name = 'arrow_head_start'
  ) THEN
    ALTER TABLE detected_shapes ADD COLUMN arrow_head_start text DEFAULT 'none';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_shapes' AND column_name = 'arrow_head_end'
  ) THEN
    ALTER TABLE detected_shapes ADD COLUMN arrow_head_end text DEFAULT 'none';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_shapes' AND column_name = 'rounded_corners'
  ) THEN
    ALTER TABLE detected_shapes ADD COLUMN rounded_corners numeric DEFAULT 0;
  END IF;
END $$;

-- Create detected_connectors table
CREATE TABLE IF NOT EXISTS detected_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id uuid NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  connector_type text NOT NULL DEFAULT 'straight',
  start_x numeric NOT NULL,
  start_y numeric NOT NULL,
  end_x numeric NOT NULL,
  end_y numeric NOT NULL,
  control_points jsonb DEFAULT '[]'::jsonb,
  line_style text DEFAULT 'solid',
  line_color text DEFAULT '000000',
  line_width numeric DEFAULT 1,
  arrow_head_start text DEFAULT 'none',
  arrow_head_end text DEFAULT 'triangle',
  connected_from_shape_id uuid,
  connected_to_shape_id uuid,
  text_label text,
  confidence_score numeric,
  created_at timestamptz DEFAULT now()
);

-- Create detected_curved_lines table
CREATE TABLE IF NOT EXISTS detected_curved_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id uuid NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  start_x numeric NOT NULL,
  start_y numeric NOT NULL,
  end_x numeric NOT NULL,
  end_y numeric NOT NULL,
  control_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  line_style text DEFAULT 'solid',
  line_color text DEFAULT '000000',
  line_width numeric DEFAULT 2,
  confidence_score numeric,
  created_at timestamptz DEFAULT now()
);

-- Create verification_results table
CREATE TABLE IF NOT EXISTS verification_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id uuid NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  original_image_data text,
  generated_image_data text,
  overall_similarity_score numeric NOT NULL,
  missing_elements jsonb DEFAULT '[]'::jsonb,
  positioning_errors jsonb DEFAULT '[]'::jsonb,
  styling_differences jsonb DEFAULT '[]'::jsonb,
  verification_passed boolean NOT NULL DEFAULT false,
  suggestions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create shape_relationships table
CREATE TABLE IF NOT EXISTS shape_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id uuid NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  from_shape_id uuid,
  to_shape_id uuid,
  connector_id uuid REFERENCES detected_connectors(id) ON DELETE CASCADE,
  relationship_type text DEFAULT 'flow',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_detected_connectors_slide_id ON detected_connectors(slide_id);
CREATE INDEX IF NOT EXISTS idx_detected_curved_lines_slide_id ON detected_curved_lines(slide_id);
CREATE INDEX IF NOT EXISTS idx_verification_results_slide_id ON verification_results(slide_id);
CREATE INDEX IF NOT EXISTS idx_shape_relationships_slide_id ON shape_relationships(slide_id);
CREATE INDEX IF NOT EXISTS idx_shape_relationships_from_shape ON shape_relationships(from_shape_id);
CREATE INDEX IF NOT EXISTS idx_shape_relationships_to_shape ON shape_relationships(to_shape_id);
CREATE INDEX IF NOT EXISTS idx_shape_relationships_connector ON shape_relationships(connector_id);

-- Enable Row Level Security
ALTER TABLE detected_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_curved_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE shape_relationships ENABLE ROW LEVEL SECURITY;

-- Create policies for detected_connectors
CREATE POLICY "Anyone can create detected_connectors"
  ON detected_connectors FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read detected_connectors"
  ON detected_connectors FOR SELECT
  TO public
  USING (true);

-- Create policies for detected_curved_lines
CREATE POLICY "Anyone can create detected_curved_lines"
  ON detected_curved_lines FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read detected_curved_lines"
  ON detected_curved_lines FOR SELECT
  TO public
  USING (true);

-- Create policies for verification_results
CREATE POLICY "Anyone can create verification_results"
  ON verification_results FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read verification_results"
  ON verification_results FOR SELECT
  TO public
  USING (true);

-- Create policies for shape_relationships
CREATE POLICY "Anyone can create shape_relationships"
  ON shape_relationships FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read shape_relationships"
  ON shape_relationships FOR SELECT
  TO public
  USING (true);
