import { LayoutRegion } from './layout-detector';
import { DetectedTextElement } from '../types';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/region-ocr`;

export interface RegionOCRResult {
  region: LayoutRegion;
  textElements: DetectedTextElement[];
}

export async function performRegionBasedOCR(
  imageBlob: Blob,
  regions: LayoutRegion[],
  imageWidth: number,
  imageHeight: number
): Promise<DetectedTextElement[]> {
  console.log('\n=== REGION-BASED OCR PHASE ===');
  console.log(`Performing OCR on ${regions.length} detected regions`);

  const allTextElements: DetectedTextElement[] = [];

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];

    if (!region.contains_text) {
      console.log(`Region ${i + 1}: Skipping (marked as no text)`);
      continue;
    }

    console.log(`\nRegion ${i + 1}/${regions.length}: ${region.type}`);
    console.log(`  Bounds: (${region.x}, ${region.y}) ${region.width}×${region.height}px`);

    try {
      const elements = await performOCROnRegion(
        imageBlob,
        region,
        imageWidth,
        imageHeight,
        i + 1
      );

      console.log(`  Found ${elements.length} text elements`);
      allTextElements.push(...elements);
    } catch (error) {
      console.error(`  Error processing region ${i + 1}:`, error);
    }
  }

  console.log(`\nTotal text elements extracted: ${allTextElements.length}`);
  console.log('=== REGION-BASED OCR COMPLETE ===\n');

  return allTextElements;
}

async function performOCROnRegion(
  imageBlob: Blob,
  region: LayoutRegion,
  imageWidth: number,
  imageHeight: number,
  regionIndex: number
): Promise<DetectedTextElement[]> {
  const mimeType = await detectImageMimeType(imageBlob);
  const base64Image = await blobToBase64(imageBlob);
  const base64Data = base64Image.split(',')[1];

  const prompt = createRegionOCRPrompt(region, imageWidth, imageHeight, regionIndex);

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

    return parseRegionOCRResponse(responseText, region, imageWidth, imageHeight);
  } catch (error) {
    console.error('Region OCR error:', error);
    return [];
  }
}

function createRegionOCRPrompt(
  region: LayoutRegion,
  imageWidth: number,
  imageHeight: number,
  regionIndex: number
): string {
  return `You are performing OCR within a specific layout region of a PowerPoint slide.

IMAGE CONTEXT:
- Full image size: ${imageWidth}px × ${imageHeight}px
- Coordinate origin: TOP-LEFT corner (0,0)

TARGET REGION #${regionIndex}:
- Type: ${region.type}
- Bounding box: x=${region.x}px, y=${region.y}px, width=${region.width}px, height=${region.height}px
- Background color: ${region.background_color || 'none/transparent'}
- Shape type: ${region.shape_type}

FOCUS AREA:
Look ONLY at the content within this specific region:
- Left edge: ${region.x}px from image left
- Top edge: ${region.y}px from image top
- Right edge: ${region.x + region.width}px from image left
- Bottom edge: ${region.y + region.height}px from image top

YOUR TASK:
Extract ALL text that appears within this region's boundaries. For each distinct text element:

1. CONTENT: The exact text (preserve all text, line breaks, and formatting)

2. POSITION (in absolute pixel coordinates from image origin):
   - x: Distance in pixels from LEFT edge of image to LEFT edge of text
   - y: Distance in pixels from TOP edge of image to TOP edge of text
   - width: Width of text bounding box in pixels
   - height: Height of text bounding box in pixels

3. STYLING:
   - fontFamily: Font name (Arial, Calibri, Times New Roman, etc.)
   - fontSize: Estimated size in points (8-72pt)
   - fontColor: Hex color without # ("000000" for black, "FFFFFF" for white)
   - isBold: true/false
   - isItalic: true/false
   - isUnderline: true/false

4. CONFIDENCE: 0-100 (your confidence in the accuracy)

MEASUREMENT RULES:
- All coordinates are ABSOLUTE from the image's top-left corner (0,0)
- NOT relative to the region's top-left
- The text's x coordinate must be >= ${region.x} and <= ${region.x + region.width}
- The text's y coordinate must be >= ${region.y} and <= ${region.y + region.height}
- If text spans multiple lines within the region, create one element with appropriate height
- Measure the actual text bounding box, not the containing shape

EXAMPLE:
If the region is at (${region.x}, ${region.y}) and contains text "Hello" starting 10px from region's left edge and 5px from region's top edge, with text 80px wide and 20px tall:

{
  "content": "Hello",
  "x": ${region.x + 10},
  "y": ${region.y + 5},
  "width": 80,
  "height": 20,
  "fontFamily": "Arial",
  "fontSize": 14,
  "fontColor": "000000",
  "isBold": false,
  "isItalic": false,
  "isUnderline": false,
  "confidence": 95
}

Return ONLY valid JSON (no markdown, no explanations):
{
  "textElements": [...]
}`;
}

function parseRegionOCRResponse(
  responseText: string,
  region: LayoutRegion,
  imageWidth: number,
  imageHeight: number
): DetectedTextElement[] {
  try {
    let cleanedText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in region OCR response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const textElements: DetectedTextElement[] = (parsed.textElements || []).map((text: any) => {
      const pixelX = Math.max(region.x, Math.min(text.x || region.x, region.x + region.width));
      const pixelY = Math.max(region.y, Math.min(text.y || region.y, region.y + region.height));
      const pixelWidth = Math.max(10, Math.min(text.width || 100, (region.x + region.width) - pixelX));
      const pixelHeight = Math.max(10, Math.min(text.height || 20, (region.y + region.height) - pixelY));

      const posX = pixelsToInches(pixelX, imageWidth, 10);
      const posY = pixelsToInches(pixelY, imageHeight, 5.625);
      const width = pixelsToInches(pixelWidth, imageWidth, 10);
      const height = pixelsToInches(pixelHeight, imageHeight, 5.625);

      const fontSize = Math.max(8, Math.min(72, text.fontSize || 14));

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

    return textElements;
  } catch (error) {
    console.error('Error parsing region OCR response:', error);
    return [];
  }
}

function pixelsToInches(pixels: number, imageSize: number, slideSize: number): number {
  if (imageSize === 0) {
    console.warn('Image size is 0, cannot convert pixels to inches');
    return 0;
  }

  const ratio = pixels / imageSize;
  const inches = ratio * slideSize;

  return inches;
}

async function detectImageMimeType(blob: Blob): Promise<'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> {
  const arrayBuffer = await blob.slice(0, 12).arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  if (
    uint8Array[0] === 0x89 &&
    uint8Array[1] === 0x50 &&
    uint8Array[2] === 0x4E &&
    uint8Array[3] === 0x47
  ) {
    return 'image/png';
  }

  if (
    uint8Array[0] === 0xFF &&
    uint8Array[1] === 0xD8 &&
    uint8Array[2] === 0xFF
  ) {
    return 'image/jpeg';
  }

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

  if (
    uint8Array[0] === 0x47 &&
    uint8Array[1] === 0x49 &&
    uint8Array[2] === 0x46 &&
    uint8Array[3] === 0x38
  ) {
    return 'image/gif';
  }

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
