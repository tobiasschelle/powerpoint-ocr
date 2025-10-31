/*
  # Add EMU Coordinates to Text Elements

  ## Overview
  Adds EMU (English Metric Units) coordinate fields to the detected_text_elements table
  to support pixel-perfect text placement in PowerPoint slides.

  ## Changes Made

  1. New Columns Added to `detected_text_elements`:
     - `pixel_x` (integer): Original X coordinate in pixels from OCR
     - `pixel_y` (integer): Original Y coordinate in pixels from OCR
     - `pixel_width` (integer): Original width in pixels from OCR
     - `pixel_height` (integer): Original height in pixels from OCR
     - `emu_x` (bigint): X coordinate in EMUs (English Metric Units)
     - `emu_y` (bigint): Y coordinate in EMUs
     - `emu_width` (bigint): Width in EMUs
     - `emu_height` (bigint): Height in EMUs

  2. New Columns Added to `slides`:
     - `bitmap_width` (integer): Width of exported bitmap used for OCR
     - `bitmap_height` (integer): Height of exported bitmap used for OCR

  ## Notes
  - EMU coordinates allow pixel-perfect positioning in PowerPoint
  - 1 inch = 914,400 EMUs
  - Standard 16:9 slide = 9,144,000 EMUs wide × 5,143,500 EMUs tall
  - Pixel coordinates are preserved for debugging and validation
*/

-- Add pixel coordinate fields to detected_text_elements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_text_elements' AND column_name = 'pixel_x'
  ) THEN
    ALTER TABLE detected_text_elements ADD COLUMN pixel_x integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_text_elements' AND column_name = 'pixel_y'
  ) THEN
    ALTER TABLE detected_text_elements ADD COLUMN pixel_y integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_text_elements' AND column_name = 'pixel_width'
  ) THEN
    ALTER TABLE detected_text_elements ADD COLUMN pixel_width integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_text_elements' AND column_name = 'pixel_height'
  ) THEN
    ALTER TABLE detected_text_elements ADD COLUMN pixel_height integer;
  END IF;
END $$;

-- Add EMU coordinate fields to detected_text_elements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_text_elements' AND column_name = 'emu_x'
  ) THEN
    ALTER TABLE detected_text_elements ADD COLUMN emu_x bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_text_elements' AND column_name = 'emu_y'
  ) THEN
    ALTER TABLE detected_text_elements ADD COLUMN emu_y bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_text_elements' AND column_name = 'emu_width'
  ) THEN
    ALTER TABLE detected_text_elements ADD COLUMN emu_width bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detected_text_elements' AND column_name = 'emu_height'
  ) THEN
    ALTER TABLE detected_text_elements ADD COLUMN emu_height bigint;
  END IF;
END $$;

-- Add bitmap dimensions to slides table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slides' AND column_name = 'bitmap_width'
  ) THEN
    ALTER TABLE slides ADD COLUMN bitmap_width integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slides' AND column_name = 'bitmap_height'
  ) THEN
    ALTER TABLE slides ADD COLUMN bitmap_height integer;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN detected_text_elements.pixel_x IS 'Original X coordinate in pixels from OCR detection';
COMMENT ON COLUMN detected_text_elements.pixel_y IS 'Original Y coordinate in pixels from OCR detection';
COMMENT ON COLUMN detected_text_elements.pixel_width IS 'Original width in pixels from OCR detection';
COMMENT ON COLUMN detected_text_elements.pixel_height IS 'Original height in pixels from OCR detection';
COMMENT ON COLUMN detected_text_elements.emu_x IS 'X coordinate in EMUs (English Metric Units) for PowerPoint';
COMMENT ON COLUMN detected_text_elements.emu_y IS 'Y coordinate in EMUs for PowerPoint';
COMMENT ON COLUMN detected_text_elements.emu_width IS 'Width in EMUs for PowerPoint';
COMMENT ON COLUMN detected_text_elements.emu_height IS 'Height in EMUs for PowerPoint';
COMMENT ON COLUMN slides.bitmap_width IS 'Width of exported bitmap used for OCR';
COMMENT ON COLUMN slides.bitmap_height IS 'Height of exported bitmap used for OCR';
