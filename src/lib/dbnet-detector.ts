import { DetectedTextElement } from '../types';

const DBNET_EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dbnet-detect`;

export interface DBNetBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  polygon?: number[][];
  rotation_angle?: number;
}

export interface DBNetPolygon {
  points: number[][];
  confidence: number;
}

export interface DBNetRotatedRect {
  center_x: number;
  center_y: number;
  width: number;
  height: number;
  angle: number;
  confidence: number;
}

export interface DBNetDetectionResult {
  boxes: DBNetBox[];
  polygons: DBNetPolygon[];
  rotatedRects: DBNetRotatedRect[];
  processingTimeMs: number;
  imageWidth: number;
  imageHeight: number;
  error?: string;
  message?: string;
}

export async function detectTextWithDBNet(
  imageBlob: Blob,
  imageWidth: number,
  imageHeight: number,
  detDbThresh: number = 0.3,
  detDbBoxThresh: number = 0.5,
  detDbUnclipRatio: number = 1.8
): Promise<DBNetDetectionResult> {
  console.log('\n=== DBNET TEXT DETECTION ===');
  console.log(`Image dimensions: ${imageWidth}px × ${imageHeight}px`);
  console.log(`Parameters: thresh=${detDbThresh}, box_thresh=${detDbBoxThresh}, unclip=${detDbUnclipRatio}`);

  try {
    const mimeType = await detectImageMimeType(imageBlob);
    const base64Image = await blobToBase64(imageBlob);
    const base64Data = base64Image.split(',')[1];

    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    const response = await fetch(DBNET_EDGE_FUNCTION_URL, {
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
        detDbThresh,
        detDbBoxThresh,
        detDbUnclipRatio,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `DBNet API request failed with status ${response.status}`);
    }

    const result: DBNetDetectionResult = await response.json();

    const totalTime = Date.now() - startTime;
    console.log(`DBNet detection completed: ${result.boxes.length} boxes in ${totalTime}ms`);

    if (result.error) {
      console.warn(`DBNet service warning: ${result.error}`);
    }

    console.log('=== DBNET DETECTION COMPLETE ===\n');

    return result;
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    const errorMsg = isTimeout
      ? 'DBNet service timeout - service may not be running or not configured'
      : (error instanceof Error ? error.message : 'Unknown error');

    console.error('DBNet detection error:', errorMsg);

    if (isTimeout) {
      console.warn('💡 To use DBNet detection:');
      console.warn('   1. Start the DBNet service: cd dbnet-service && ./start-dbnet.sh');
      console.warn('   2. Configure DBNET_SERVICE_URL in Supabase Edge Functions');
      console.warn('   3. See DBNET_SETUP.md for detailed instructions');
    }

    return {
      boxes: [],
      polygons: [],
      rotatedRects: [],
      processingTimeMs: 0,
      imageWidth,
      imageHeight,
      error: errorMsg,
    };
  }
}

export function mergeBoxesToLines(
  boxes: DBNetBox[],
  rotationThreshold: number = 0.8,
  overlapThreshold: number = 0.6,
  gapMultiplier: number = 0.6
): DBNetBox[] {
  if (boxes.length === 0) return [];

  console.log(`Merging ${boxes.length} boxes into lines...`);
  console.log(`Parameters: rotation=${rotationThreshold}°, overlap=${overlapThreshold}, gap=${gapMultiplier}`);

  const sortedBoxes = [...boxes].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 10) return yDiff;
    return a.x - b.x;
  });

  const medianCharWidth = estimateMedianCharWidth(sortedBoxes);
  console.log(`Estimated median char width: ${medianCharWidth.toFixed(1)}px`);

  const lines: DBNetBox[] = [];
  let currentLine: DBNetBox | null = null;

  for (const box of sortedBoxes) {
    if (!currentLine) {
      currentLine = { ...box };
      continue;
    }

    const angleDiff = Math.abs(
      normalizeAngle((currentLine.rotation_angle || 0) - (box.rotation_angle || 0))
    );

    if (angleDiff > rotationThreshold) {
      lines.push(currentLine);
      currentLine = { ...box };
      continue;
    }

    const verticalOverlap = calculateVerticalOverlap(currentLine, box);
    const avgHeight = (currentLine.height + box.height) / 2;
    const overlapRatio = verticalOverlap / avgHeight;

    if (overlapRatio < overlapThreshold) {
      lines.push(currentLine);
      currentLine = { ...box };
      continue;
    }

    const horizontalGap = box.x - (currentLine.x + currentLine.width);
    const maxGap = gapMultiplier * medianCharWidth;

    if (horizontalGap > maxGap) {
      lines.push(currentLine);
      currentLine = { ...box };
      continue;
    }

    const newRight = Math.max(currentLine.x + currentLine.width, box.x + box.width);
    const newBottom = Math.max(currentLine.y + currentLine.height, box.y + box.height);
    currentLine.x = Math.min(currentLine.x, box.x);
    currentLine.y = Math.min(currentLine.y, box.y);
    currentLine.width = newRight - currentLine.x;
    currentLine.height = newBottom - currentLine.y;
    currentLine.confidence = Math.max(currentLine.confidence, box.confidence);

    if (currentLine.rotation_angle !== undefined && box.rotation_angle !== undefined) {
      currentLine.rotation_angle = (currentLine.rotation_angle + box.rotation_angle) / 2;
    }

    if (currentLine.polygon && box.polygon) {
      currentLine.polygon = [...currentLine.polygon, ...box.polygon];
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  console.log(`Merged into ${lines.length} line-level boxes`);

  return lines;
}

function normalizeAngle(angle: number): number {
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

function calculateVerticalOverlap(box1: DBNetBox, box2: DBNetBox): number {
  const overlapTop = Math.max(box1.y, box2.y);
  const overlapBottom = Math.min(box1.y + box1.height, box2.y + box2.height);
  return Math.max(0, overlapBottom - overlapTop);
}

function estimateMedianCharWidth(boxes: DBNetBox[]): number {
  if (boxes.length === 0) return 12.0;

  const widths = boxes.map(box => box.width).sort((a, b) => a - b);
  const medianWidth = widths[Math.floor(widths.length / 2)];

  const estimatedCharWidth = medianWidth / Math.max(1, medianWidth / 12);

  return Math.max(8.0, Math.min(20.0, estimatedCharWidth));
}

export function convertDBNetBoxesToTextElements(
  boxes: DBNetBox[],
  imageWidth: number,
  imageHeight: number
): DetectedTextElement[] {
  console.log(`Converting ${boxes.length} DBNet boxes to text elements...`);

  const textElements: DetectedTextElement[] = boxes.map((box, index) => {
    const posX = pixelsToInches(box.x, imageWidth, 10);
    const posY = pixelsToInches(box.y, imageHeight, 5.625);
    const width = pixelsToInches(box.width, imageWidth, 10);
    const height = pixelsToInches(box.height, imageHeight, 5.625);

    const estimatedFontSize = Math.round(Math.min(72, Math.max(8, height * 72 * 0.7)));

    return {
      content: `[Text ${index + 1}]`,
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
      detection_source: 'dbnet',
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
