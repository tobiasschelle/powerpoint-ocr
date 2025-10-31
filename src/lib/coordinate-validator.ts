/**
 * Coordinate validation and debugging utilities
 * Helps ensure accurate positioning of text overlays
 */

export interface CoordinateValidation {
  isValid: boolean;
  warnings: string[];
  pixelCoords: { x: number; y: number; width: number; height: number };
  inchCoords: { x: number; y: number; width: number; height: number };
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface SlideDimensions {
  width: number; // inches
  height: number; // inches
}

const STANDARD_SLIDE: SlideDimensions = {
  width: 10,
  height: 5.625
};

/**
 * Validates pixel coordinates from Claude's detection
 */
export function validatePixelCoordinates(
  x: number,
  y: number,
  width: number,
  height: number,
  imageDims: ImageDimensions
): CoordinateValidation {
  const warnings: string[] = [];
  let isValid = true;

  // Check if coordinates are within image bounds
  if (x < 0 || x > imageDims.width) {
    warnings.push(`X coordinate ${x} is outside image width (0-${imageDims.width})`);
    isValid = false;
  }

  if (y < 0 || y > imageDims.height) {
    warnings.push(`Y coordinate ${y} is outside image height (0-${imageDims.height})`);
    isValid = false;
  }

  // Check if dimensions are reasonable
  if (width <= 0 || width > imageDims.width) {
    warnings.push(`Width ${width} is invalid (should be 1-${imageDims.width})`);
    isValid = false;
  }

  if (height <= 0 || height > imageDims.height) {
    warnings.push(`Height ${height} is invalid (should be 1-${imageDims.height})`);
    isValid = false;
  }

  // Check if element extends beyond image bounds
  if (x + width > imageDims.width) {
    warnings.push(`Element extends beyond right edge: ${x} + ${width} = ${x + width} > ${imageDims.width}`);
    isValid = false;
  }

  if (y + height > imageDims.height) {
    warnings.push(`Element extends beyond bottom edge: ${y} + ${height} = ${y + height} > ${imageDims.height}`);
    isValid = false;
  }

  // Check for suspiciously small or large elements
  const minSize = 5; // minimum 5 pixels
  const maxSizeRatio = 0.9; // max 90% of image dimension

  if (width < minSize || height < minSize) {
    warnings.push(`Element is very small (${width}×${height}px), might be detection noise`);
  }

  if (width > imageDims.width * maxSizeRatio || height > imageDims.height * maxSizeRatio) {
    warnings.push(`Element is very large (${width}×${height}px), might cover entire slide`);
  }

  // Convert to inches for validation
  const inchX = (x / imageDims.width) * STANDARD_SLIDE.width;
  const inchY = (y / imageDims.height) * STANDARD_SLIDE.height;
  const inchWidth = (width / imageDims.width) * STANDARD_SLIDE.width;
  const inchHeight = (height / imageDims.height) * STANDARD_SLIDE.height;

  return {
    isValid,
    warnings,
    pixelCoords: { x, y, width, height },
    inchCoords: { x: inchX, y: inchY, width: inchWidth, height: inchHeight }
  };
}

/**
 * Validates converted inch coordinates before rendering
 */
export function validateInchCoordinates(
  x: number,
  y: number,
  width: number,
  height: number
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let isValid = true;

  // Check if coordinates are within slide bounds
  if (x < 0 || x > STANDARD_SLIDE.width) {
    warnings.push(`X position ${x.toFixed(3)}" is outside slide width (0-${STANDARD_SLIDE.width}")`);
    isValid = false;
  }

  if (y < 0 || y > STANDARD_SLIDE.height) {
    warnings.push(`Y position ${y.toFixed(3)}" is outside slide height (0-${STANDARD_SLIDE.height}")`);
    isValid = false;
  }

  if (width <= 0 || width > STANDARD_SLIDE.width) {
    warnings.push(`Width ${width.toFixed(3)}" is invalid (should be 0-${STANDARD_SLIDE.width}")`);
    isValid = false;
  }

  if (height <= 0 || height > STANDARD_SLIDE.height) {
    warnings.push(`Height ${height.toFixed(3)}" is invalid (should be 0-${STANDARD_SLIDE.height}")`);
    isValid = false;
  }

  // Check if element extends beyond slide bounds
  if (x + width > STANDARD_SLIDE.width) {
    warnings.push(`Element extends beyond right edge: ${x.toFixed(3)} + ${width.toFixed(3)} = ${(x + width).toFixed(3)} > ${STANDARD_SLIDE.width}"`);
    isValid = false;
  }

  if (y + height > STANDARD_SLIDE.height) {
    warnings.push(`Element extends beyond bottom edge: ${y.toFixed(3)} + ${height.toFixed(3)} = ${(y + height).toFixed(3)} > ${STANDARD_SLIDE.height}"`);
    isValid = false;
  }

  return { isValid, warnings };
}

/**
 * Clamps coordinates to ensure they fit within bounds
 */
export function clampToSlideBounds(
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  // Clamp position to slide bounds
  const clampedX = Math.max(0, Math.min(x, STANDARD_SLIDE.width));
  const clampedY = Math.max(0, Math.min(y, STANDARD_SLIDE.height));

  // Adjust width/height if element extends beyond bounds
  const maxWidth = STANDARD_SLIDE.width - clampedX;
  const maxHeight = STANDARD_SLIDE.height - clampedY;

  const clampedWidth = Math.max(0.1, Math.min(width, maxWidth));
  const clampedHeight = Math.max(0.1, Math.min(height, maxHeight));

  return {
    x: clampedX,
    y: clampedY,
    width: clampedWidth,
    height: clampedHeight
  };
}

/**
 * Generates a debug grid overlay to help visualize coordinate system
 */
export function generateDebugGrid(slide: any) {
  console.log('Adding debug grid overlay...');

  // Add vertical lines every inch
  for (let x = 0; x <= STANDARD_SLIDE.width; x += 1) {
    slide.addShape('line', {
      x: x,
      y: 0,
      w: 0,
      h: STANDARD_SLIDE.height,
      line: { color: 'CCCCCC', width: 0.5, dashType: 'dash' }
    });

    // Add x-axis labels
    if (x > 0 && x < STANDARD_SLIDE.width) {
      slide.addText(`${x}"`, {
        x: x - 0.15,
        y: 0.05,
        w: 0.3,
        h: 0.2,
        fontSize: 8,
        color: '999999'
      });
    }
  }

  // Add horizontal lines every 0.5 inches
  for (let y = 0; y <= STANDARD_SLIDE.height; y += 0.5) {
    slide.addShape('line', {
      x: 0,
      y: y,
      w: STANDARD_SLIDE.width,
      h: 0,
      line: { color: 'CCCCCC', width: 0.5, dashType: 'dash' }
    });

    // Add y-axis labels
    if (y > 0 && y < STANDARD_SLIDE.height) {
      slide.addText(`${y.toFixed(1)}"`, {
        x: 0.05,
        y: y - 0.1,
        w: 0.4,
        h: 0.2,
        fontSize: 8,
        color: '999999'
      });
    }
  }

  console.log('Debug grid added');
}

/**
 * Logs detailed coordinate information for debugging
 */
export function logCoordinateDebugInfo(
  elementIndex: number,
  content: string,
  pixelCoords: { x: number; y: number; width: number; height: number },
  inchCoords: { x: number; y: number; width: number; height: number },
  imageDims: ImageDimensions
) {
  console.log(`\n=== ELEMENT ${elementIndex} COORDINATES ===`);
  console.log(`Content: "${content.substring(0, 40)}..."`);
  console.log(`\nPixel Coordinates (from Claude):`);
  console.log(`  Position: (${pixelCoords.x}, ${pixelCoords.y})`);
  console.log(`  Size: ${pixelCoords.width} × ${pixelCoords.height} px`);
  console.log(`  % of image: X=${((pixelCoords.x / imageDims.width) * 100).toFixed(1)}%, Y=${((pixelCoords.y / imageDims.height) * 100).toFixed(1)}%`);
  console.log(`\nInch Coordinates (for PowerPoint):`);
  console.log(`  Position: (${inchCoords.x.toFixed(3)}", ${inchCoords.y.toFixed(3)}")`);
  console.log(`  Size: ${inchCoords.width.toFixed(3)}" × ${inchCoords.height.toFixed(3)}"`);
  console.log(`  % of slide: X=${((inchCoords.x / STANDARD_SLIDE.width) * 100).toFixed(1)}%, Y=${((inchCoords.y / STANDARD_SLIDE.height) * 100).toFixed(1)}%`);
  console.log(`===================================\n`);
}
