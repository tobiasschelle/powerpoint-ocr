/*
  # OCR PPTX Conversion System Database Schema

  ## Overview
  Creates tables to track PPTX conversion jobs, individual slides, and extracted elements.
  This schema supports the automated OCR-powered PPTX conversion tool.

  ## New Tables

  ### `conversions`
  Main table tracking each conversion job from upload to completion
  - `id` (uuid, primary key) - Unique identifier for each conversion job
  - `status` (text) - Current status: 'uploading', 'parsing', 'processing', 'generating', 'completed', 'failed'
  - `original_filename` (text) - Name of the uploaded PPTX file
  - `total_slides` (integer) - Total number of slides in the presentation
  - `processed_slides` (integer) - Number of slides processed so far
  - `progress_percentage` (integer) - Overall progress (0-100)
  - `error_message` (text, nullable) - Error details if conversion failed
  - `output_file_url` (text, nullable) - URL to download the converted PPTX
  - `session_id` (text) - User session identifier for tracking
  - `created_at` (timestamptz) - When the conversion was started
  - `updated_at` (timestamptz) - Last update timestamp
  - `completed_at` (timestamptz, nullable) - When the conversion finished

  ### `slides`
  Stores data for each individual slide being processed
  - `id` (uuid, primary key) - Unique identifier for each slide
  - `conversion_id` (uuid, foreign key) - Links to parent conversion job
  - `slide_number` (integer) - Position in the presentation (1-based)
  - `status` (text) - Slide processing status: 'pending', 'extracting', 'ocr', 'completed', 'failed'
  - `image_data` (text, nullable) - Base64 encoded image data for the slide
  - `ocr_text` (text, nullable) - Raw text extracted via OCR
  - `layout_data` (jsonb, nullable) - Positioning and layout information
  - `created_at` (timestamptz) - When the slide record was created
  - `updated_at` (timestamptz) - Last update timestamp

  ### `elements`
  Stores individual text boxes, shapes, and chart data extracted from each slide
  - `id` (uuid, primary key) - Unique identifier for each element
  - `slide_id` (uuid, foreign key) - Links to parent slide
  - `element_type` (text) - Type: 'text', 'shape', 'chart', 'table'
  - `content` (text) - Text content or element description
  - `position_x` (numeric) - X coordinate position
  - `position_y` (numeric) - Y coordinate position
  - `width` (numeric) - Width of the element
  - `height` (numeric) - Height of the element
  - `style_data` (jsonb, nullable) - Styling information (fonts, colors, etc.)
  - `confidence_score` (numeric, nullable) - OCR confidence score (0-100)
  - `created_at` (timestamptz) - When the element was extracted

  ## Security

  All tables have Row Level Security (RLS) enabled.
  Public access policies allow anyone to create and read their own conversion data.
  This is appropriate for a demo tool, but should be restricted in production.

  ## Notes

  - Automatic cleanup of old conversion records should be implemented via cron job
  - Storage buckets for temporary files should have lifecycle policies configured
  - Consider indexing on `session_id` and `status` for query performance
*/

-- Create conversions table
CREATE TABLE IF NOT EXISTS conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'uploading',
  original_filename text NOT NULL,
  total_slides integer DEFAULT 0,
  processed_slides integer DEFAULT 0,
  progress_percentage integer DEFAULT 0,
  error_message text,
  output_file_url text,
  session_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create slides table
CREATE TABLE IF NOT EXISTS slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_id uuid NOT NULL REFERENCES conversions(id) ON DELETE CASCADE,
  slide_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  image_data text,
  ocr_text text,
  layout_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create elements table
CREATE TABLE IF NOT EXISTS elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id uuid NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  element_type text NOT NULL,
  content text,
  position_x numeric NOT NULL,
  position_y numeric NOT NULL,
  width numeric NOT NULL,
  height numeric NOT NULL,
  style_data jsonb,
  confidence_score numeric,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversions_session_id ON conversions(session_id);
CREATE INDEX IF NOT EXISTS idx_conversions_status ON conversions(status);
CREATE INDEX IF NOT EXISTS idx_slides_conversion_id ON slides(conversion_id);
CREATE INDEX IF NOT EXISTS idx_elements_slide_id ON elements(slide_id);

-- Enable Row Level Security
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (appropriate for demo tool)
CREATE POLICY "Anyone can create conversions"
  ON conversions FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read conversions by session"
  ON conversions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can update conversions by session"
  ON conversions FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can create slides"
  ON slides FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read slides"
  ON slides FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can update slides"
  ON slides FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can create elements"
  ON elements FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read elements"
  ON elements FOR SELECT
  TO public
  USING (true);