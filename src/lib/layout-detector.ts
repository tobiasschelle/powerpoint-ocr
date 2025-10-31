const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-layout`;

export interface LayoutRegion {
  type: 'text_box' | 'shape' | 'title' | 'body' | 'diagram' | 'note' | 'header' | 'footer';
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  contains_text: boolean;
  background_color?: string;
  border_color?: string;
  shape_type?: 'rectangle' | 'rounded_rectangle' | 'circle' | 'ellipse' | 'none';
}

export interface LayoutDetectionResult {
  regions: LayoutRegion[];
  imageWidth: number;
  imageHeight: number;
}

export async function detectLayoutRegions(
  imageBlob: Blob,
  imageWidth: number,
  imageHeight: number
): Promise<LayoutDetectionResult> {
  console.log('\n=== LAYOUT DETECTION PHASE ===');
  console.log(`Analyzing layout structure: ${imageWidth}px × ${imageHeight}px`);

  const mimeType = await detectImageMimeType(imageBlob);
  const base64Image = await blobToBase64(imageBlob);
  const base64Data = base64Image.split(',')[1];

  const prompt = createLayoutDetectionPrompt(imageWidth, imageHeight);

  try {
    const startTime = Date.now();

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
    console.log(`Layout detection completed in ${processingTime}ms`);

    const regions = parseLayoutResponse(responseText, imageWidth, imageHeight);

    console.log(`Detected ${regions.length} layout regions`);
    console.log('=== LAYOUT DETECTION COMPLETE ===\n');

    return {
      regions,
      imageWidth,
      imageHeight
    };
  } catch (error) {
    console.error('Layout detection error:', error);
    return { regions: [], imageWidth, imageHeight };
  }
}

function createLayoutDetectionPrompt(imageWidth: number, imageHeight: number): string {
  return `You are a document layout analyzer. Your task is to detect ALL distinct visual regions in this PowerPoint slide that contain or could contain text.

IMAGE SPECIFICATIONS:
- Dimensions: ${imageWidth}px (width) × ${imageHeight}px (height)
- Coordinate system: Origin (0,0) at TOP-LEFT corner
- X axis: increases going RIGHT
- Y axis: increases going DOWN

YOUR TASK:
Identify EVERY distinct layout region including:

1. TEXT CONTAINERS:
   - Title boxes
   - Body text boxes
   - Bullet point sections
   - Notes/callouts
   - Labels and captions

2. SHAPES WITH TEXT:
   - Rectangles (solid or rounded)
   - Circles and ellipses
   - Process boxes
   - Callout bubbles
   - Colored background shapes

3. STRUCTURAL REGIONS:
   - Headers
   - Footers
   - Diagrams
   - Flow chart elements
   - Sidebars

FOR EACH REGION, PROVIDE:
- type: Classification ('text_box', 'shape', 'title', 'body', 'diagram', 'note', 'header', 'footer')
- x: Left edge position in pixels from image left edge
- y: Top edge position in pixels from image top edge
- width: Region width in pixels
- height: Region height in pixels
- contains_text: true if region has visible text, false otherwise
- confidence: 0-100 (your confidence in this region detection)
- background_color: hex color without # (e.g., "FFFF00" for yellow, "FFFFFF" for white, null if transparent/none)
- border_color: hex color without # (e.g., "000000" for black, null if no border)
- shape_type: 'rectangle', 'rounded_rectangle', 'circle', 'ellipse', or 'none'

CRITICAL RULES:
1. Detect the COMPLETE bounding box of each region (including padding/margins)
2. Each region should be DISTINCT - DO NOT return overlapping regions for the same visual element
3. If a shape contains text, return ONLY ONE region for that element (not separate shape + text_box)
4. Measure from the absolute top-left corner (0,0) of the image
5. Avoid detecting the same element twice with slightly different coordinates
6. Prioritize accuracy over completeness - only return regions you're confident about

EXAMPLE OUTPUT FOR REFERENCE:
A yellow sticky note at top-right (80% from left, 10% from top, 200px wide, 150px tall):
{
  "type": "note",
  "x": ${Math.round(imageWidth * 0.8)},
  "y": ${Math.round(imageHeight * 0.1)},
  "width": 200,
  "height": 150,
  "contains_text": true,
  "confidence": 95,
  "background_color": "FFFF00",
  "border_color": "FFD700",
  "shape_type": "rectangle"
}

Return ONLY valid JSON (no markdown, no explanations):
{
  "regions": [...]
}`;
}

function parseLayoutResponse(
  responseText: string,
  imageWidth: number,
  imageHeight: number
): LayoutRegion[] {
  try {
    let cleanedText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in layout response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const regions = (parsed.regions || []).map((region: any) => {
      const x = Math.max(0, Math.min(region.x || 0, imageWidth));
      const y = Math.max(0, Math.min(region.y || 0, imageHeight));
      const width = Math.max(10, Math.min(region.width || 100, imageWidth - x));
      const height = Math.max(10, Math.min(region.height || 50, imageHeight - y));

      return {
        type: region.type || 'text_box',
        x,
        y,
        width,
        height,
        confidence: region.confidence || 80,
        contains_text: region.contains_text !== false,
        background_color: region.background_color,
        border_color: region.border_color,
        shape_type: region.shape_type || 'none'
      };
    });

    console.log(`Parsed ${regions.length} layout regions (before deduplication)`);

    const deduplicated = deduplicateRegions(regions);

    console.log(`After deduplication: ${deduplicated.length} unique regions`);
    deduplicated.forEach((region: LayoutRegion, idx: number) => {
      console.log(`  Region ${idx + 1}: ${region.type} at (${region.x}, ${region.y}) ${region.width}×${region.height}px`);
    });

    return deduplicated;
  } catch (error) {
    console.error('Error parsing layout response:', error);
    return [];
  }
}

function deduplicateRegions(regions: LayoutRegion[]): LayoutRegion[] {
  if (regions.length === 0) return [];

  console.log('\n=== DEDUPLICATING LAYOUT REGIONS ===');

  const filtered: LayoutRegion[] = [];
  const toRemove = new Set<number>();

  for (let i = 0; i < regions.length; i++) {
    if (toRemove.has(i)) continue;

    for (let j = i + 1; j < regions.length; j++) {
      if (toRemove.has(j)) continue;

      const iou = calculateRegionIoU(regions[i], regions[j]);

      if (iou > 0.7) {
        const largerRegion = (regions[i].width * regions[i].height) >= (regions[j].width * regions[j].height) ? i : j;
        const smallerRegion = largerRegion === i ? j : i;

        console.log(`  Removing duplicate region ${smallerRegion + 1} (IoU: ${iou.toFixed(3)} with region ${largerRegion + 1})`);
        toRemove.add(smallerRegion);
      }
    }
  }

  for (let i = 0; i < regions.length; i++) {
    if (!toRemove.has(i)) {
      filtered.push(regions[i]);
    }
  }

  console.log(`Removed ${toRemove.size} duplicate regions`);
  console.log('=== DEDUPLICATION COMPLETE ===\n');

  return filtered;
}

function calculateRegionIoU(region1: LayoutRegion, region2: LayoutRegion): number {
  const x1 = Math.max(region1.x, region2.x);
  const y1 = Math.max(region1.y, region2.y);
  const x2 = Math.min(region1.x + region1.width, region2.x + region2.width);
  const y2 = Math.min(region1.y + region1.height, region2.y + region2.height);

  if (x2 <= x1 || y2 <= y1) {
    return 0;
  }

  const intersectionArea = (x2 - x1) * (y2 - y1);
  const region1Area = region1.width * region1.height;
  const region2Area = region2.width * region2.height;
  const unionArea = region1Area + region2Area - intersectionArea;

  if (unionArea === 0) return 0;

  return intersectionArea / unionArea;
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
