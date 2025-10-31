import { AIAnalysisResult, DetectedTextElement } from '../types';
import { validatePixelCoordinates, validateInchCoordinates, clampToSlideBounds, logCoordinateDebugInfo } from './coordinate-validator';
import { detectLayoutRegions } from './layout-detector';
import { performRegionBasedOCR } from './region-ocr';
import { normalizeCoordinates, validateLayoutPlacement, alignElementsWithinRegions } from './layout-placement';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-slide`;

export async function analyzeSlideImage(
  imageBlob: Blob,
  imageWidth: number,
  imageHeight: number
): Promise<AIAnalysisResult> {
  console.log('\n=== STARTING SLIDE ANALYSIS ===');
  console.log(`Slide image dimensions: ${imageWidth}px × ${imageHeight}px`);
  console.log(`Image size: ${(imageBlob.size / 1024).toFixed(2)} KB`);

  const mimeType = await detectImageMimeType(imageBlob);
  console.log(`Image format: ${mimeType}`);

  const base64Image = await blobToBase64(imageBlob);
  const base64Data = base64Image.split(',')[1];

  const textResult = await analyzeText(base64Data, mimeType, imageWidth, imageHeight);
  console.log('Text detection complete');
  console.log(`- Text elements detected: ${textResult.textElements.length}`);
  console.log(`- Tables detected: ${textResult.tables.length}`);
  console.log('=== ANALYSIS COMPLETE ===\n');

  return textResult;
}

export async function analyzeSlideImageWithLayoutDetection(
  imageBlob: Blob,
  imageWidth: number,
  imageHeight: number
): Promise<{ analysis: AIAnalysisResult; regions: any[] }> {
  console.log('\n=== STARTING LAYOUT-BASED SLIDE ANALYSIS ===');
  console.log(`Slide image dimensions: ${imageWidth}px × ${imageHeight}px`);
  console.log(`Image size: ${(imageBlob.size / 1024).toFixed(2)} KB`);

  const layoutResult = await detectLayoutRegions(imageBlob, imageWidth, imageHeight);
  console.log(`Detected ${layoutResult.regions.length} layout regions`);

  let textElements: DetectedTextElement[] = [];

  if (layoutResult.regions.length > 0) {
    textElements = await performRegionBasedOCR(
      imageBlob,
      layoutResult.regions,
      imageWidth,
      imageHeight
    );

    textElements = normalizeCoordinates(textElements, layoutResult.regions);

    textElements = alignElementsWithinRegions(textElements, layoutResult.regions);

    const validation = validateLayoutPlacement(textElements, layoutResult.regions);
    if (!validation.isValid) {
      console.warn('Layout placement validation warnings:');
      validation.warnings.forEach(w => console.warn(`  - ${w}`));
    }
  } else {
    console.warn('No layout regions detected, falling back to direct text detection');
    const fallbackResult = await analyzeSlideImage(imageBlob, imageWidth, imageHeight);
    textElements = fallbackResult.textElements;
  }

  console.log(`Final text elements: ${textElements.length}`);
  console.log('=== LAYOUT-BASED ANALYSIS COMPLETE ===\n');

  return {
    analysis: { textElements, tables: [] },
    regions: layoutResult.regions
  };
}

async function analyzeText(
  base64Data: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  imageWidth: number,
  imageHeight: number
): Promise<AIAnalysisResult> {
  const startTime = Date.now();
  const prompt = createTextDetectionPrompt(imageWidth, imageHeight);

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        base64Data,
        mimeType,
        imageWidth,
        imageHeight,
        prompt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API request failed with status ${response.status}`);
    }

    const { responseText } = await response.json();

    const processingTime = Date.now() - startTime;
    console.log(`Text analysis completed in ${processingTime}ms`);

    return parseTextResponse(responseText, imageWidth, imageHeight);
  } catch (error) {
    console.error('Text analysis error:', error);
    return { textElements: [], tables: [] };
  }
}

function createTextDetectionPrompt(imageWidth: number, imageHeight: number): string {
  return `You are analyzing a PowerPoint slide image to extract ALL text content with PIXEL-PERFECT positioning.

IMAGE COORDINATE SYSTEM:
- Image dimensions: ${imageWidth}px (width) × ${imageHeight}px (height)
- Origin (0, 0) is at the TOP-LEFT corner of the image
- X increases going RIGHT
- Y increases going DOWN
- All measurements must be in PIXELS relative to the top-left corner

CRITICAL MEASUREMENT INSTRUCTIONS:

1. MEASURE FROM THE ABSOLUTE TOP-LEFT OF THE IMAGE (0,0)
   - NOT relative to other elements
   - NOT from the center of the image
   - Use the image's top-left corner as your reference point

2. FOR TEXT IN SHAPES/BOXES (rectangles, rounded rectangles, circles, ovals):
   - x, y = TOP-LEFT corner of the SHAPE's bounding box
   - width, height = FULL dimensions of the SHAPE's bounding box
   - Measure the shape that contains the text, not just the text itself

   Example: If you see a blue rectangle containing "Step 1" text:
   - Find where the rectangle's left edge starts (x coordinate)
   - Find where the rectangle's top edge starts (y coordinate)
   - Measure the full width of the rectangle
   - Measure the full height of the rectangle

3. FOR STANDALONE TEXT (no visible shape/background):
   - x, y = Where the text baseline starts (top-left of text)
   - width, height = Tight bounding box around the text

4. ACCURACY REQUIREMENTS:
   - Measure coordinates as precisely as possible
   - Double-check measurements against known reference points
   - If a shape is at the center of the slide, x should be approximately ${Math.round(imageWidth * 0.4)}-${Math.round(imageWidth * 0.6)}
   - If a shape is at the right side, x should be > ${Math.round(imageWidth * 0.7)}
   - If a shape is at the top, y should be < ${Math.round(imageHeight * 0.3)}
   - If a shape is at the bottom, y should be > ${Math.round(imageHeight * 0.6)}

EXTRACT ALL TEXT:
- Identify EVERY piece of text: titles, headings, labels, body text, diagram text, notes
- For each text element provide:
  * content: exact text (complete, no truncation, preserve line breaks)
  * x: horizontal distance in pixels from the LEFT edge of the image to the LEFT edge of the shape/text
  * y: vertical distance in pixels from the TOP edge of the image to the TOP edge of the shape/text
  * width: horizontal span in pixels of the shape/text
  * height: vertical span in pixels of the shape/text
  * fontFamily: font name (Arial, Calibri, Times New Roman, etc.)
  * fontSize: estimated size in points (8-72pt)
  * fontColor: hex without # ("FFFFFF" for white, "000000" for black)
  * isBold, isItalic, isUnderline: boolean
  * confidence: 0-100 (your confidence in the measurement accuracy)

MEASUREMENT EXAMPLES:

1. Large title "ISO" at the very top-left of the slide:
   → x: 50, y: 40, width: 120, height: 60

2. Text "NOTES (1)" in a yellow box near the top-center:
   → If the yellow box starts at 25% from left and 5% from top:
   → x: ${Math.round(imageWidth * 0.25)}, y: ${Math.round(imageHeight * 0.05)}, width: 500, height: 50

3. Text "ADM.Roman Castro" in a yellow note box at bottom-right:
   → If the box is at 80% from left and 50% from top:
   → x: ${Math.round(imageWidth * 0.8)}, y: ${Math.round(imageHeight * 0.5)}, width: 300, height: 150

4. Process box "XSOAR Recursively Calls Tool for New Events" in the middle-bottom:
   → If centered horizontally at 35% from left, 75% from top:
   → x: ${Math.round(imageWidth * 0.35)}, y: ${Math.round(imageHeight * 0.75)}, width: 250, height: 120

Return ONLY valid JSON (no markdown, no explanations):
{
  "textElements": [
    {
      "content": "text here",
      "x": 150,
      "y": 80,
      "width": 180,
      "height": 30,
      "fontFamily": "Arial",
      "fontSize": 12,
      "fontColor": "000000",
      "isBold": false,
      "isItalic": false,
      "isUnderline": false,
      "confidence": 95
    }
  ]
}`;
}

function parseTextResponse(
  responseText: string,
  imageWidth: number,
  imageHeight: number
): AIAnalysisResult {
  try {
    console.log('Parsing text detection response...');
    let cleanedText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in text response');
      return { textElements: [], tables: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    console.log(`\n=== COORDINATE CONVERSION DEBUG ===`);
    console.log(`Image dimensions: ${imageWidth}px × ${imageHeight}px`);
    console.log(`Slide dimensions: 10" × 5.625"`);
    console.log(`Conversion ratio: X=${(10/imageWidth).toFixed(6)}", Y=${(5.625/imageHeight).toFixed(6)}"`);

    const textElements: DetectedTextElement[] = (parsed.textElements || []).map((text: any, index: number) => {
      // Step 1: Validate raw pixel coordinates from Claude
      const validation = validatePixelCoordinates(
        text.x || 0,
        text.y || 0,
        text.width || 100,
        text.height || 20,
        { width: imageWidth, height: imageHeight }
      );

      if (!validation.isValid) {
        console.warn(`\n⚠ Element ${index + 1} validation issues:`);
        validation.warnings.forEach(w => console.warn(`  - ${w}`));
      }

      // Use validated pixel coordinates
      const pixelX = Math.max(0, Math.min(text.x || 0, imageWidth));
      const pixelY = Math.max(0, Math.min(text.y || 0, imageHeight));
      const pixelWidth = Math.max(10, Math.min(text.width || 100, imageWidth - pixelX));
      const pixelHeight = Math.max(10, Math.min(text.height || 20, imageHeight - pixelY));

      // Step 2: Convert pixels to inches
      let posX = pixelsToInches(pixelX, imageWidth, 10);
      let posY = pixelsToInches(pixelY, imageHeight, 5.625);
      let width = pixelsToInches(pixelWidth, imageWidth, 10);
      let height = pixelsToInches(pixelHeight, imageHeight, 5.625);

      // Step 3: Validate converted inch coordinates
      const inchValidation = validateInchCoordinates(posX, posY, width, height);

      if (!inchValidation.isValid) {
        console.warn(`\n⚠ Element ${index + 1} inch coordinate issues:`);
        inchValidation.warnings.forEach(w => console.warn(`  - ${w}`));

        // Clamp to slide bounds as fallback
        const clamped = clampToSlideBounds(posX, posY, width, height);
        console.warn(`  → Clamping to bounds: (${clamped.x.toFixed(3)}", ${clamped.y.toFixed(3)}") ${clamped.width.toFixed(3)}"×${clamped.height.toFixed(3)}"`);
        posX = clamped.x;
        posY = clamped.y;
        width = clamped.width;
        height = clamped.height;
      }

      const fontSize = Math.max(8, Math.min(72, text.fontSize || 14));

      // Step 4: Log detailed debug info
      logCoordinateDebugInfo(
        index + 1,
        text.content || '',
        { x: pixelX, y: pixelY, width: pixelWidth, height: pixelHeight },
        { x: posX, y: posY, width, height },
        { width: imageWidth, height: imageHeight }
      );

      return {
        content: text.content || '',
        position_x: posX,
        position_y: posY,
        width: width,
        height: height,
        font_family: text.fontFamily || 'Arial',
        font_size: fontSize,
        font_color: text.fontColor || '000000',
        is_bold: text.isBold || false,
        is_italic: text.isItalic || false,
        is_underline: text.isUnderline || false,
        align: 'left',
        vertical_align: 'top',
        confidence_score: text.confidence || 80,
      };
    });

    console.log(`Parsed ${textElements.length} text elements`);
    console.log(`=== END COORDINATE CONVERSION ===\n`);
    return { textElements, tables: [] };
  } catch (error) {
    console.error('Error parsing text response:', error);
    return { textElements: [], tables: [] };
  }
}

/**
 * Converts pixel coordinates to PowerPoint inches with proper scaling
 * PowerPoint uses a coordinate system where (0,0) is top-left
 * Standard 16:9 slide is 10" wide × 5.625" tall
 */
function pixelsToInches(pixels: number, imageSize: number, slideSize: number): number {
  if (imageSize === 0) {
    console.warn('Image size is 0, cannot convert pixels to inches');
    return 0;
  }

  // Direct proportional conversion
  const ratio = pixels / imageSize;
  const inches = ratio * slideSize;

  return inches;
}

async function detectImageMimeType(blob: Blob): Promise<'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> {
  const arrayBuffer = await blob.slice(0, 12).arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Check PNG signature (89 50 4E 47 0D 0A 1A 0A)
  if (
    uint8Array[0] === 0x89 &&
    uint8Array[1] === 0x50 &&
    uint8Array[2] === 0x4E &&
    uint8Array[3] === 0x47
  ) {
    return 'image/png';
  }

  // Check JPEG signature (FF D8 FF)
  if (
    uint8Array[0] === 0xFF &&
    uint8Array[1] === 0xD8 &&
    uint8Array[2] === 0xFF
  ) {
    return 'image/jpeg';
  }

  // Check WebP signature (52 49 46 46 ... 57 45 42 50)
  if (
    uint8Array[0] === 0x52 &&
    uint8Array[1] === 0x49 &&
    uint8Array[2] === 0x46 &&
    uint8Array[3] === 0x46 &&
    uint8Array[8] === 0x57 &&
    uint8Array[9] === 0x45 &&
    uint8Array[10] === 0x42 &&
    uint8Array[11] === 0x50
  ) {
    return 'image/webp';
  }

  // Check GIF signature (47 49 46 38)
  if (
    uint8Array[0] === 0x47 &&
    uint8Array[1] === 0x49 &&
    uint8Array[2] === 0x46 &&
    uint8Array[3] === 0x38
  ) {
    return 'image/gif';
  }

  // Default to JPEG if unknown (most common in PowerPoint)
  console.warn('Unknown image format, defaulting to JPEG');
  return 'image/jpeg';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
