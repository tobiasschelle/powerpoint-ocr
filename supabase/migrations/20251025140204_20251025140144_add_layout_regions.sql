/*
  # Add Layout Region Detection Support

  ## Overview
  This migration adds support for storing detected layout regions from slides,
  enabling region-based OCR and improved text placement accuracy.

  ## New Tables

  ### `detected_layout_regions`
  Stores layout regions detected in slide images (text boxes, shapes, diagrams, etc.)
  
  Columns:
  - `id` (uuid, primary key): Unique identifier
  - `slide_id` (uuid, foreign key): Reference to parent slide
  - `region_type` (text): Type of region (text_box, shape, title, body, diagram, note, header, footer)
  - `position_x` (integer): X coordinate in pixels from image top-left
  - `position_y` (integer): Y coordinate in pixels from image top-left
  - `width` (integer): Width in pixels
  - `height` (integer): Height in pixels
  - `confidence_score` (integer): Detection confidence (0-100)
  - `contains_text` (boolean): Whether region contains text
  - `background_color` (text): Hex color code (without #)
  - `border_color` (text): Hex color code (without #)
  - `shape_type` (text): Shape classification (rectangle, rounded_rectangle, circle, ellipse, none)
  - `created_at` (timestamptz): Record creation timestamp
  - `updated_at` (timestamptz): Record update timestamp

  ## Security
  - Enable RLS on `detected_layout_regions` table
  - Add policy for authenticated users to read regions from their conversions
  - Add policy for authenticated users to insert regions for their conversions

  ## Notes
  - Layout regions are detected before OCR to improve text positioning accuracy
  - Each region can contain zero or more text elements
  - Coordinates are stored in pixels for precision, converted to inches during PPTX generation
*/

-- Create detected_layout_regions table
CREATE TABLE IF NOT EXISTS detected_layout_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id uuid NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  region_type text NOT NULL,
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 100,
  height integer NOT NULL DEFAULT 50,
  confidence_score integer DEFAULT 80,
  contains_text boolean DEFAULT true,
  background_color text,
  border_color text,
  shape_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster slide lookups
CREATE INDEX IF NOT EXISTS idx_detected_layout_regions_slide_id 
  ON detected_layout_regions(slide_id);

-- Create index for region type queries
CREATE INDEX IF NOT EXISTS idx_detected_layout_regions_type 
  ON detected_layout_regions(region_type);

-- Enable RLS
ALTER TABLE detected_layout_regions ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read layout regions from their own conversions
CREATE POLICY "Users can read layout regions from own conversions"
  ON detected_layout_regions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM slides
      INNER JOIN conversions ON slides.conversion_id = conversions.id
      WHERE slides.id = detected_layout_regions.slide_id
      AND conversions.session_id = current_setting('app.session_id', true)
    )
  );

-- Policy: Authenticated users can insert layout regions for their conversions
CREATE POLICY "Users can insert layout regions for own conversions"
  ON detected_layout_regions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM slides
      INNER JOIN conversions ON slides.conversion_id = conversions.id
      WHERE slides.id = detected_layout_regions.slide_id
      AND conversions.session_id = current_setting('app.session_id', true)
    )
  );

-- Policy: Authenticated users can update layout regions from their conversions
CREATE POLICY "Users can update layout regions from own conversions"
  ON detected_layout_regions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM slides
      INNER JOIN conversions ON slides.conversion_id = conversions.id
      WHERE slides.id = detected_layout_regions.slide_id
      AND conversions.session_id = current_setting('app.session_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM slides
      INNER JOIN conversions ON slides.conversion_id = conversions.id
      WHERE slides.id = detected_layout_regions.slide_id
      AND conversions.session_id = current_setting('app.session_id', true)
    )
  );

-- Policy: Authenticated users can delete layout regions from their conversions
CREATE POLICY "Users can delete layout regions from own conversions"
  ON detected_layout_regions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM slides
      INNER JOIN conversions ON slides.conversion_id = conversions.id
      WHERE slides.id = detected_layout_regions.slide_id
      AND conversions.session_id = current_setting('app.session_id', true)
    )
  );
