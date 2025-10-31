import { DetectedTextElement } from '../types';

const CRAFT_EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/craft-detect`;

export interface CraftBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  text?: string;
}

export interface CraftDetectionResult {
  boxes: CraftBox[];
  processingTimeMs: number;
  imageWidth: number;
  imageHeight: number;
  error?: string;
  message?: string;
}

export async function detectTextWithCRAFT(
  imageBlob: Blob,
  imageWidth: number,
  imageHeight: number
): Promise<CraftDetectionResult> {
  console.log('\n=== CRAFT TEXT DETECTION ===');
  console.log(`Image dimensions: ${imageWidth}px × ${imageHeight}px`);

  try {
    const mimeType = await detectImageMimeType(imageBlob);
    const base64Image = await blobToBase64(imageBlob);
    const base64Data = base64Image.split(',')[1];

    const startTime = Date.now();

    // Add timeout to frontend request as well
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 second timeout (slightly more than backend)

    const response = await fetch(CRAFT_EDGE_FUNCTION_URL, {
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
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `CRAFT API request failed with status ${response.status}`);
    }

    const result: CraftDetectionResult = await response.json();

    const totalTime = Date.now() - startTime;
    console.log(`CRAFT detection completed: ${result.boxes.length} boxes in ${totalTime}ms`);

    if (result.error) {
      console.warn(`CRAFT service warning: ${result.error}`);
    }

    console.log('=== CRAFT DETECTION COMPLETE ===\n');

    return result;
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    const errorMsg = isTimeout
      ? 'CRAFT service timeout - service may not be running or not configured'
      : (error instanceof Error ? error.message : 'Unknown error');

    console.error('CRAFT detection error:', errorMsg);

    if (isTimeout) {
      console.warn('💡 To use CRAFT detection:');
      console.warn('   1. Start the CRAFT service: cd craft-service && ./start-craft.sh');
      console.warn('   2. Configure CRAFT_SERVICE_URL in Supabase Edge Functions');
      console.warn('   3. See CRAFT_SETUP.md for detailed instructions');
    }

    return {
      boxes: [],
      processingTimeMs: 0,
      imageWidth,
      imageHeight,
      error: errorMsg,
    };
  }
}

export function mergeCharacterBoxesToWords(boxes: CraftBox[]): CraftBox[] {
  if (boxes.length === 0) return [];

  console.log(`Merging ${boxes.length} character boxes into words...`);

  const sortedBoxes = [...boxes].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 10) return yDiff;
    return a.x - b.x;
  });

  const words: CraftBox[] = [];
  let currentWord: CraftBox | null = null;

  for (const box of sortedBoxes) {
    if (!currentWord) {
      currentWord = { ...box };
      continue;
    }

    const verticalOverlap = Math.min(currentWord.y + currentWord.height, box.y + box.height)
                          - Math.max(currentWord.y, box.y);
    const avgHeight = (currentWord.height + box.height) / 2;
    const horizontalGap = box.x - (currentWord.x + currentWord.width);

    if (verticalOverlap > avgHeight * 0.5 && horizontalGap < avgHeight * 0.5) {
      const newRight = Math.max(currentWord.x + currentWord.width, box.x + box.width);
      const newBottom = Math.max(currentWord.y + currentWord.height, box.y + box.height);
      currentWord.x = Math.min(currentWord.x, box.x);
      currentWord.y = Math.min(currentWord.y, box.y);
      currentWord.width = newRight - currentWord.x;
      currentWord.height = newBottom - currentWord.y;
      currentWord.confidence = Math.max(currentWord.confidence, box.confidence);
    } else {
      words.push(currentWord);
      currentWord = { ...box };
    }
  }

  if (currentWord) {
    words.push(currentWord);
  }

  console.log(`Merged into ${words.length} word boxes`);

  return words;
}

export function convertCraftBoxesToTextElements(
  boxes: CraftBox[],
  imageWidth: number,
  imageHeight: number
): DetectedTextElement[] {
  console.log(`Converting ${boxes.length} CRAFT boxes to text elements...`);

  const textElements: DetectedTextElement[] = boxes.map((box, index) => {
    const posX = pixelsToInches(box.x, imageWidth, 10);
    const posY = pixelsToInches(box.y, imageHeight, 5.625);
    const width = pixelsToInches(box.width, imageWidth, 10);
    const height = pixelsToInches(box.height, imageHeight, 5.625);

    const estimatedFontSize = Math.round(Math.min(72, Math.max(8, height * 72 * 0.7)));

    return {
      content: box.text || `[Text ${index + 1}]`,
      position_x: posX,
      position_y: posY,
      width,
      height,
      font_family: 'Arial',
      font_size: estimatedFontSize,
      font_color: '000000',
      is_bold: false,
      is_italic: false,
      is_underline: false,
      align: 'left',
      vertical_align: 'top',
      confidence_score: Math.round(box.confidence * 100),
    };
  });

  console.log(`Converted to ${textElements.length} text elements`);

  return textElements;
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
