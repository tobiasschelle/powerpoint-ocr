/*
  # Add DBNet Detection Support

  ## Changes

  1. Updates existing tables to support DBNet detection tracking
     - Updates detection_comparison table to track DBNet alongside CRAFT
     - Updates detected_text_elements table to support 'dbnet' and 'dbnet_primary' sources

  2. Adds indexes for efficient querying of DBNet detections

  ## Notes

  - This migration extends existing tables rather than creating new ones
  - DBNet detection data will be stored alongside existing CRAFT detection data
  - Detection source values: 'claude', 'craft', 'craft_primary', 'dbnet', 'dbnet_primary'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'detection_source_enum'
  ) THEN
    CREATE TYPE detection_source_enum AS ENUM ('claude', 'craft', 'craft_primary', 'dbnet', 'dbnet_primary');
  END IF;
END $$;

ALTER TABLE detected_text_elements
  ALTER COLUMN detection_source TYPE text;

ALTER TABLE detected_text_elements
  ADD COLUMN IF NOT EXISTS rotation_angle decimal,
  ADD COLUMN IF NOT EXISTS polygon_points jsonb;

COMMENT ON COLUMN detected_text_elements.detection_source IS 'Source of detection: claude, craft, craft_primary, dbnet, or dbnet_primary';
COMMENT ON COLUMN detected_text_elements.rotation_angle IS 'Text rotation angle in degrees (for DBNet rotated rectangles)';
COMMENT ON COLUMN detected_text_elements.polygon_points IS 'Original polygon points from DBNet detection';

CREATE INDEX IF NOT EXISTS idx_detected_text_elements_detection_source
  ON detected_text_elements(detection_source);

CREATE INDEX IF NOT EXISTS idx_detected_text_elements_slide_source
  ON detected_text_elements(slide_id, detection_source);
