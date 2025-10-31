import { DetectedTextElement } from '../types';
import { DBNetBox } from './dbnet-detector';
import { convertDBNetBoxToCoordinates } from './dbnet-primary-detector';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/region-ocr`;

interface DBNetRegionOCRResult {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  confidence: number;
}

export async function performOCROnDBNetRegions(
  imageBlob: Blob,
  dbnetBoxes: DBNetBox[],
  imageWidth: number,
  imageHeight: number
): Promise<DetectedTextElement[]> {
  console.log('\n=== DBNET-REGION OCR PHASE ===');
  console.log(`Performing Claude OCR on ${dbnetBoxes.length} DBNet-detected regions`);

  const textElements: DetectedTextElement[] = [];

  for (let i = 0; i < dbnetBoxes.length; i++) {
    const box = dbnetBoxes[i];

    console.log(`\nRegion ${i + 1}/${dbnetBoxes.length}:`);
    console.log(`  DBNet box: (${box.x.toFixed(0)}, ${box.y.toFixed(0)}) ${box.width.toFixed(0)}×${box.height.toFixed(0)}px`);
    console.log(`  Confidence: ${(box.confidence * 100).toFixed(1)}%`);
    if (box.rotation_angle !== undefined) {
      console.log(`  Rotation: ${box.rotation_angle.toFixed(2)}°`);
    }

    try {
      const ocrResult = await performOCROnSingleDBNetBox(
        imageBlob,
        box,
        imageWidth,
        imageHeight,
        i + 1
      );

      const coordinates = convertDBNetBoxToCoordinates(box, imageWidth, imageHeight);

      const element: DetectedTextElement = {
        content: ocrResult.content,
        position_x: coordinates.x,
        position_y: coordinates.y,
        width: coordinates.width,
        height: coordinates.height,
        font_family: ocrResult.fontFamily,
        font_size: ocrResult.fontSize,
        font_color: ocrResult.fontColor,
        is_bold: ocrResult.isBold,
        is_italic: ocrResult.isItalic,
        is_underline: ocrResult.isUnderline,
        align: 'left',
        vertical_align: 'top',
        confidence_score: Math.round(ocrResult.confidence),
        detection_source: 'dbnet_primary',
      };

      if (element.content && element.content.trim().length > 0) {
        textElements.push(element);
        console.log(`  ✓ Extracted: "${element.content.substring(0, 40)}${element.content.length > 40 ? '...' : ''}"`);
      } else {
        console.warn(`  ⚠ No text extracted from region ${i + 1}`);
      }
    } catch (error) {
      console.error(`  ✗ Error processing region ${i + 1}:`, error);
    }
  }

  console.log(`\n✓ Successfully extracted text from ${textElements.length}/${dbnetBoxes.length} regions`);
  console.log('=== DBNET-REGION OCR COMPLETE ===\n');

  return textElements;
}

async function performOCROnSingleDBNetBox(
  imageBlob: Blob,
  box: DBNetBox,
  imageWidth: number,
  imageHeight: number,
  regionIndex: number
): Promise<DBNetRegionOCRResult> {
  const mimeType = await detectImageMimeType(imageBlob);
  const base64Image = await blobToBase64(imageBlob);
  const base64Data = base64Image.split(',')[1];

  const prompt = createDBNetRegionOCRPrompt(box, imageWidth, imageHeight, regionIndex);

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

    return parseDBNetRegionOCRResponse(responseText);
  } catch (error) {
    console.error('DBNet region OCR error:', error);
    return {
      content: `[Region ${regionIndex}]`,
      fontFamily: 'Arial',
      fontSize: 12,
      fontColor: '000000',
      isBold: false,
      isItalic: false,
      isUnderline: false,
      confidence: 0,
    };
  }
}

function createDBNetRegionOCRPrompt(
  box: DBNetBox,
  imageWidth: number,
  imageHeight: number,
  regionIndex: number
): string {
  const rotationInfo = box.rotation_angle !== undefined
    ? `\n- Text rotation: ${box.rotation_angle.toFixed(2)}° from horizontal`
    : '';

  return `You are performing OCR (text extraction) on a specific text region that has been detected by DBNet++ text detector.

IMAGE CONTEXT:
- Full image size: ${imageWidth}px × ${imageHeight}px
- Coordinate origin: TOP-LEFT corner (0,0)

TARGET REGION #${regionIndex} (detected by DBNet++):
- Bounding box: x=${box.x.toFixed(0)}px, y=${box.y.toFixed(0)}px, width=${box.width.toFixed(0)}px, height=${box.height.toFixed(0)}px
- Detection confidence: ${(box.confidence * 100).toFixed(1)}%
- Left edge: ${box.x.toFixed(0)}px from image left
- Top edge: ${box.y.toFixed(0)}px from image top
- Right edge: ${(box.x + box.width).toFixed(0)}px from image left
- Bottom edge: ${(box.y + box.height).toFixed(0)}px from image top${rotationInfo}

YOUR TASK:
Extract the text content from ONLY this specific region. DO NOT provide coordinates - they are already known.

Provide the following information ONLY:

1. CONTENT: The exact text visible in this region
   - Extract all text precisely as it appears
   - Preserve line breaks if text spans multiple lines
   - Include all visible characters
   - If no text is visible, return empty string ""

2. FONT PROPERTIES:
   - fontFamily: Font name (Arial, Calibri, Times New Roman, Helvetica, etc.)
   - fontSize: Estimated font size in points (8-72pt)
   - fontColor: Hex color without # (e.g., "000000" for black, "FFFFFF" for white)

3. TEXT STYLING:
   - isBold: true if text appears bold, false otherwise
   - isItalic: true if text appears italic/slanted, false otherwise
   - isUnderline: true if text has underline, false otherwise

4. CONFIDENCE: Your confidence (0-100) in the accuracy of the text extraction

CRITICAL RULES:
- Focus ONLY on the specified region - ignore text outside this bounding box
- DO NOT provide any coordinate information (x, y, width, height) - we already have precise coordinates
- If the region contains multiple words or lines, extract all of them as a single content string
- If you cannot read the text clearly, make your best effort and lower the confidence score
- If the region appears to be a non-text element (icon, image, etc.), return empty content with low confidence

Return ONLY valid JSON (no markdown, no explanations):
{
  "content": "extracted text here",
  "fontFamily": "Arial",
  "fontSize": 14,
  "fontColor": "000000",
  "isBold": false,
  "isItalic": false,
  "isUnderline": false,
  "confidence": 95
}`;
}

function parseDBNetRegionOCRResponse(responseText: string): DBNetRegionOCRResult {
  try {
    let cleanedText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in DBNet region OCR response');
      return createDefaultOCRResult();
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      content: parsed.content || '',
      fontFamily: parsed.fontFamily || 'Arial',
      fontSize: Math.max(8, Math.min(72, parsed.fontSize || 12)),
      fontColor: parsed.fontColor || '000000',
      isBold: parsed.isBold || false,
      isItalic: parsed.isItalic || false,
      isUnderline: parsed.isUnderline || false,
      confidence: Math.max(0, Math.min(100, parsed.confidence || 80)),
    };
  } catch (error) {
    console.error('Error parsing DBNet region OCR response:', error);
    return createDefaultOCRResult();
  }
}

function createDefaultOCRResult(): DBNetRegionOCRResult {
  return {
    content: '',
    fontFamily: 'Arial',
    fontSize: 12,
    fontColor: '000000',
    isBold: false,
    isItalic: false,
    isUnderline: false,
    confidence: 0,
  };
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
