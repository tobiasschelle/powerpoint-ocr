# CRAFT-Primary Detection Mode

## Overview

The system now supports a **CRAFT-Primary detection mode** where:
- **CRAFT** (Computer vision) detects precise bounding box coordinates for text placement
- **Claude** (AI) performs OCR to extract text content and styling information

This reverses the original architecture where Claude provided both coordinates and text content.

## Architecture

### Detection Flow

```
1. CRAFT Detection
   └─> Detects character-level bounding boxes with computer vision
   └─> Merges character boxes into word-level regions
   └─> Returns precise pixel coordinates

2. Claude OCR (for each CRAFT region)
   └─> Extracts text content from the detected region
   └─> Identifies font properties (family, size, color)
   └─> Detects styling (bold, italic, underline)
   └─> Returns text data WITHOUT coordinate information

3. Coordinate Conversion
   └─> CRAFT pixel coordinates → PowerPoint inches
   └─> Clamps coordinates to slide bounds
   └─> Validates placement accuracy

4. Element Assembly
   └─> Combines CRAFT coordinates with Claude text
   └─> Creates final DetectedTextElement objects
   └─> Generates clean and annotated PowerPoint files
```

### Key Components

#### 1. `craft-primary-detector.ts`
Main orchestrator for CRAFT-primary detection flow.
- Runs CRAFT detection first
- Sends each CRAFT box to Claude for OCR
- Assembles final text elements with CRAFT placement

#### 2. `craft-region-ocr.ts`
Claude OCR service specialized for text extraction.
- Receives CRAFT bounding boxes as input
- Prompts Claude to extract ONLY text content and styling
- Does NOT ask Claude for coordinate information
- Returns OCR results without spatial data

#### 3. `coordinate-utils.ts`
Utility functions for coordinate conversion.
- `pixelsToInches()`: Converts CRAFT pixel coords to PowerPoint inches
- `inchesToPixels()`: Reverse conversion if needed
- `clampCoordinates()`: Ensures coordinates stay within slide bounds

#### 4. `hybrid-detector.ts` (updated)
Extended to support CRAFT-primary mode.
- New `performCraftPrimaryHybridDetection()` function
- Automatic fallback to Claude-based detection if CRAFT fails
- Maintains backward compatibility with old hybrid mode

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Enable hybrid detection (required for CRAFT-primary)
VITE_USE_HYBRID_DETECTION=true

# Enable CRAFT-primary mode (CRAFT for placement, Claude for text)
VITE_USE_CRAFT_PRIMARY=true
```

### Mode Selection

| `VITE_USE_HYBRID_DETECTION` | `VITE_USE_CRAFT_PRIMARY` | Behavior |
|----------------------------|-------------------------|----------|
| `false` | `false` | Claude-only (coordinates + text) |
| `true` | `false` | Old hybrid (merge Claude & CRAFT coords) |
| `true` | `true` | **CRAFT-primary (CRAFT coords, Claude text)** |

## Benefits of CRAFT-Primary Mode

### Advantages

1. **More Accurate Placement**
   - CRAFT specializes in text detection with computer vision
   - Provides pixel-perfect bounding boxes
   - Better handles rotated, overlapping, or complex layouts

2. **Better Text Content**
   - Claude focuses solely on OCR (its strength)
   - No need to estimate coordinates
   - Can dedicate more tokens to text accuracy

3. **Cleaner Separation of Concerns**
   - CRAFT: Spatial detection (what it's designed for)
   - Claude: Text extraction and understanding (what it excels at)

4. **Improved Performance**
   - Claude prompts are simpler (text-only, no coord instructions)
   - Faster response times for Claude API calls
   - More efficient token usage

### Trade-offs

1. **CRAFT Service Dependency**
   - Requires CRAFT service to be running
   - Falls back to Claude-only if CRAFT unavailable

2. **Sequential Processing**
   - CRAFT detection must complete first
   - Then iterates through regions for Claude OCR
   - May be slower than single Claude call for simple slides

3. **Text-only Focus**
   - Currently optimized for text detection
   - Tables, diagrams, and complex elements may need additional handling

## Fallback Mechanism

The system includes robust fallback handling:

```typescript
if (craftPrimaryResult.craftBoxCount === 0) {
  console.warn('⚠ CRAFT-primary detection returned no results');
  // Automatically falls back to Claude-based detection
  const fallbackResult = await analyzeSlideImageWithLayoutDetection(...);
  return fallbackResult;
}
```

**Fallback triggers:**
- CRAFT service unavailable or timeout
- CRAFT returns no bounding boxes
- CRAFT detection error

**Fallback behavior:**
- Seamlessly switches to Claude-based layout detection
- Uses Claude for both coordinates and text
- Logs warning in console for debugging

## Usage Example

```typescript
import { performCraftPrimaryHybridDetection } from './craft-primary-detector';

const result = await performCraftPrimaryHybridDetection(
  slideImageBlob,
  imageWidth,
  imageHeight
);

console.log(`CRAFT boxes detected: ${result.craftBoxCount}`);
console.log(`Successful OCR: ${result.ocrSuccessCount}`);
console.log(`Final elements: ${result.analysis.textElements.length}`);
```

## Logging and Debugging

Enable detailed logs by checking the console:

```
========================================
=== CRAFT-PRIMARY DETECTION START ===
========================================
Image: 1920px × 1080px
Strategy: CRAFT for placement, Claude for text

--- PHASE 1: CRAFT Bounding Box Detection ---
✓ CRAFT detected 142 character boxes in 1245ms

--- PHASE 2: Merge Character Boxes to Words ---
✓ Merged into 45 word-level bounding boxes

--- PHASE 3: Claude OCR on CRAFT Regions ---
Region 1/45: CRAFT box: (120, 80) 180×30px
  ✓ Extracted: "Hello World"
...
✓ Claude OCR completed: 43/45 regions successfully extracted

========================================
Performance Summary:
  CRAFT Detection: 1245ms
  Claude OCR: 3890ms
  Total: 5135ms

Results Summary:
  CRAFT boxes detected: 142
  Word boxes merged: 45
  Successful OCR: 43
  Final elements: 43
========================================
```

## Testing

To test CRAFT-primary mode:

1. Ensure CRAFT service is running:
   ```bash
   cd craft-service
   ./start-craft.sh
   ```

2. Enable CRAFT-primary in `.env`:
   ```bash
   VITE_USE_HYBRID_DETECTION=true
   VITE_USE_CRAFT_PRIMARY=true
   ```

3. Upload a PowerPoint file and check console logs

4. Compare output slides:
   - Check text box placement accuracy
   - Verify text content extraction quality
   - Review annotated slides for bounding box visualization

## Future Enhancements

Potential improvements for CRAFT-primary mode:

1. **Parallel OCR Processing**
   - Run Claude OCR on multiple CRAFT regions simultaneously
   - Reduce total processing time

2. **Smart Region Filtering**
   - Skip very small CRAFT boxes (likely noise)
   - Merge nearby boxes intelligently

3. **Confidence Thresholds**
   - Only OCR high-confidence CRAFT detections
   - Configurable minimum confidence score

4. **Hybrid Fallback Per-Region**
   - Use Claude coordinates for regions where CRAFT fails
   - Best-of-both-worlds approach

5. **Extended Element Support**
   - Tables, diagrams, and images
   - Shape detection integration
   - Multi-line text handling improvements
