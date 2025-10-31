/*
  # AI-Powered Element Detection Schema Update

  ## Overview
  Extends the existing schema to support AI-powered image analysis for detecting shapes, tables, and styled text elements with full visual fidelity.

  ## New Tables

  ### `detected_shapes`
  Stores native shapes detected from slide images including rectangles, circles, and lines
  - `id` (uuid, primary key) - Unique identifier for each shape
  - `slide_id` (uuid, foreign key) - Links to parent slide
  - `shape_type` (text) - Type: 'rectangle', 'circle', 'line', 'ellipse'
  - `position_x` (numeric) - X coordinate in inches
  - `position_y` (numeric) - Y coordinate in inches
  - `width` (numeric) - Width in inches
  - `height` (numeric) - Height in inches
  - `fill_color` (text) - RGB hex color for fill (e.g., 'FF5733')
  - `border_color` (text) - RGB hex color for border
  - `border_width` (numeric) - Border width in points
  - `rotation` (numeric) - Rotation angle in degrees
  - `opacity` (numeric) - Opacity 0-100
  - `confidence_score` (numeric) - AI detection confidence 0-100
  - `created_at` (timestamptz) - When detected

  ### `detected_tables`
  Stores table structures detected from slide images
  - `id` (uuid, primary key) - Unique identifier for each table
  - `slide_id` (uuid, foreign key) - Links to parent slide
  - `position_x` (numeric) - X coordinate in inches
  - `position_y` (numeric) - Y coordinate in inches
  - `width` (numeric) - Total width in inches
  - `height` (numeric) - Total height in inches
  - `row_count` (integer) - Number of rows
  - `column_count` (integer) - Number of columns
  - `has_header` (boolean) - Whether table has header row
  - `border_style` (text) - Border style: 'all', 'outer', 'none'
  - `confidence_score` (numeric) - AI detection confidence 0-100
  - `created_at` (timestamptz) - When detected

  ### `table_cells`
  Stores individual cell data for detected tables
  - `id` (uuid, primary key) - Unique identifier for each cell
  - `table_id` (uuid, foreign key) - Links to parent table
  - `row_index` (integer) - Row position (0-based)
  - `column_index` (integer) - Column position (0-based)
  - `content` (text) - Cell text content
  - `font_size` (numeric) - Font size in points
  - `font_color` (text) - RGB hex color
  - `background_color` (text) - Cell background color
  - `is_bold` (boolean) - Whether text is bold
  - `is_italic` (boolean) - Whether text is italic
  - `align` (text) - Text alignment: 'left', 'center', 'right'
  - `vertical_align` (text) - Vertical alignment: 'top', 'middle', 'bottom'
  - `created_at` (timestamptz) - When detected

  ### `detected_text_elements`
  Stores text blocks with full styling information
  - `id` (uuid, primary key) - Unique identifier for each text element
  - `slide_id` (uuid, foreign key) - Links to parent slide
  - `content` (text) - Text content
  - `position_x` (numeric) - X coordinate in inches
  - `position_y` (numeric) - Y coordinate in inches
  - `width` (numeric) - Width in inches
  - `height` (numeric) - Height in inches
  - `font_family` (text) - Font family name
  - `font_size` (numeric) - Font size in points
  - `font_color` (text) - RGB hex color
  - `is_bold` (boolean) - Whether text is bold
  - `is_italic` (boolean) - Whether text is italic
  - `is_underline` (boolean) - Whether text is underlined
  - `align` (text) - Text alignment: 'left', 'center', 'right'
  - `vertical_align` (text) - Vertical alignment: 'top', 'middle', 'bottom'
  - `confidence_score` (numeric) - AI detection confidence 0-100
  - `created_at` (timestamptz) - When detected

  ### `ai_analysis_results`
  Stores raw AI analysis responses for debugging and refinement
  - `id` (uuid, primary key) - Unique identifier
  - `slide_id` (uuid, foreign key) - Links to parent slide
  - `analysis_type` (text) - Type: 'full', 'text', 'shapes', 'tables'
  - `raw_response` (jsonb) - Complete AI response
  - `processing_time_ms` (integer) - Time taken for analysis
  - `created_at` (timestamptz) - When analyzed

  ## Schema Updates

  Updates to existing `slides` table:
  - Add `image_width` (numeric) - Original image width in pixels
  - Add `image_height` (numeric) - Original image height in pixels
  - Add `ai_analysis_completed` (boolean) - Whether AI analysis is complete

  ## Security

  All new tables have RLS enabled with public access policies for demo purposes.

  ## Indexes

  Added indexes on foreign keys and commonly queried fields for performance.

  ## Important Notes

  1. All coordinate values are stored in inches (PowerPoint's native unit)
  2. Colors are stored as 6-character RGB hex strings without '#' prefix
  3. Confidence scores help identify elements that may need manual review
  4. Raw AI responses enable iterative prompt improvement
*/

-- Add new columns to existing slides table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slides' AND column_name = 'image_width'
  ) THEN
    ALTER TABLE slides ADD COLUMN image_width numeric;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slides' AND column_name = 'image_height'
  ) THEN
    ALTER TABLE slides ADD COLUMN image_height numeric;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slides' AND column_name = 'ai_analysis_completed'
  ) THEN
    ALTER TABLE slides ADD COLUMN ai_analysis_completed boolean DEFAULT false;
  END IF;
END $$;

-- Create detected_shapes table
CREATE TABLE IF NOT EXISTS detected_shapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id uuid NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  shape_type text NOT NULL,
  position_x numeric NOT NULL,
  position_y numeric NOT NULL,
  width numeric NOT NULL,
  height numeric NOT NULL,
  fill_color text,
  border_color text,
  border_width numeric DEFAULT 1,
  rotation numeric DEFAULT 0,
  opacity numeric DEFAULT 100,
  confidence_score numeric,
  created_at timestamptz DEFAULT now()
);

-- Create detected_tables table
CREATE TABLE IF NOT EXISTS detected_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id uuid NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  position_x numeric NOT NULL,
  position_y numeric NOT NULL,
  width numeric NOT NULL,
  height numeric NOT NULL,
  row_count integer NOT NULL,
  column_count integer NOT NULL,
  has_header boolean DEFAULT false,
  border_style text DEFAULT 'all',
  confidence_score numeric,
  created_at timestamptz DEFAULT now()
);

-- Create table_cells table
CREATE TABLE IF NOT EXISTS table_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES detected_tables(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  column_index integer NOT NULL,
  content text DEFAULT '',
  font_size numeric DEFAULT 12,
  font_color text DEFAULT '000000',
  background_color text,
  is_bold boolean DEFAULT false,
  is_italic boolean DEFAULT false,
  align text DEFAULT 'left',
  vertical_align text DEFAULT 'middle',
  created_at timestamptz DEFAULT now()
);

-- Create detected_text_elements table
CREATE TABLE IF NOT EXISTS detected_text_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id uuid NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  content text NOT NULL,
  position_x numeric NOT NULL,
  position_y numeric NOT NULL,
  width numeric NOT NULL,
  height numeric NOT NULL,
  font_family text DEFAULT 'Arial',
  font_size numeric DEFAULT 14,
  font_color text DEFAULT '000000',
  is_bold boolean DEFAULT false,
  is_italic boolean DEFAULT false,
  is_underline boolean DEFAULT false,
  align text DEFAULT 'left',
  vertical_align text DEFAULT 'top',
  confidence_score numeric,
  created_at timestamptz DEFAULT now()
);

-- Create ai_analysis_results table
CREATE TABLE IF NOT EXISTS ai_analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id uuid NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  analysis_type text NOT NULL,
  raw_response jsonb NOT NULL,
  processing_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_detected_shapes_slide_id ON detected_shapes(slide_id);
CREATE INDEX IF NOT EXISTS idx_detected_tables_slide_id ON detected_tables(slide_id);
CREATE INDEX IF NOT EXISTS idx_table_cells_table_id ON table_cells(table_id);
CREATE INDEX IF NOT EXISTS idx_detected_text_elements_slide_id ON detected_text_elements(slide_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_results_slide_id ON ai_analysis_results(slide_id);

-- Enable Row Level Security
ALTER TABLE detected_shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_text_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_results ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Anyone can create detected_shapes"
  ON detected_shapes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read detected_shapes"
  ON detected_shapes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create detected_tables"
  ON detected_tables FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read detected_tables"
  ON detected_tables FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create table_cells"
  ON table_cells FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read table_cells"
  ON table_cells FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create detected_text_elements"
  ON detected_text_elements FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read detected_text_elements"
  ON detected_text_elements FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create ai_analysis_results"
  ON ai_analysis_results FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read ai_analysis_results"
  ON ai_analysis_results FOR SELECT
  TO public
  USING (true);