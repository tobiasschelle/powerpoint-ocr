/*
  # Fix Layout Regions Insert Policy

  ## Overview
  Fixes the INSERT policy for detected_layout_regions table to include proper
  WITH CHECK clause for permission verification.

  ## Changes Made

  1. Drop existing INSERT policy
  2. Create new INSERT policy with WITH CHECK clause that verifies:
     - User is authenticated
     - Slide belongs to conversion owned by user's session

  ## Security
  - Ensures users can only insert layout regions for their own conversions
  - Uses session_id for ownership verification
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can insert layout regions for own conversions" ON detected_layout_regions;

-- Create new policy with proper WITH CHECK clause
CREATE POLICY "Users can insert layout regions for own conversions"
  ON detected_layout_regions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM slides
      JOIN conversions ON slides.conversion_id = conversions.id
      WHERE slides.id = detected_layout_regions.slide_id
      AND conversions.session_id = current_setting('app.session_id', true)
    )
  );
