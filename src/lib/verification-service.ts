import { VerificationResult, MissingElement, PositioningError, StylingDifference } from '../types';

export async function verifyConversion(
  originalImageBlob: Blob,
  generatedImageBlob: Blob,
  slideNumber: number
): Promise<VerificationResult> {
  console.log(`Verifying conversion for slide ${slideNumber}...`);

  const originalBase64 = await blobToBase64(originalImageBlob);
  const generatedBase64 = await blobToBase64(generatedImageBlob);

  const originalData = originalBase64.split(',')[1];
  const generatedData = generatedBase64.split(',')[1];

  const prompt = createVerificationPrompt();

  try {
    throw new Error('Verification service is not currently implemented. Edge function needed.');
  } catch (error) {
    console.error('Verification error:', error);
    throw new Error(`Failed to verify conversion: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function createVerificationPrompt(): string {
  return `Compare these two slide images carefully. The first is the ORIGINAL slide, and the second is the GENERATED slide created from AI analysis.

Your task is to identify:

1. MISSING ELEMENTS:
   - Any shapes, text, arrows, connectors, or other visual elements present in the original but missing from the generated version
   - For each missing element, describe what it is and approximately where it should be

2. POSITIONING ERRORS:
   - Elements that exist in both but are positioned incorrectly in the generated version
   - Measure approximate distance of the positioning error
   - Focus on significant misalignments (>10% of slide dimensions)

3. STYLING DIFFERENCES:
   - Color mismatches (fill colors, border colors, text colors)
   - Size differences (shapes too large/small, text too big/small)
   - Line style differences (solid vs dashed, arrow heads missing/wrong type)
   - Font differences
   - Border width differences
   - Classify severity as 'low', 'medium', or 'high'

4. OVERALL SIMILARITY:
   - Provide an overall similarity score from 0-100
   - 90-100: Excellent match with minor differences
   - 70-89: Good match with some noticeable differences
   - 50-69: Fair match with significant differences
   - 0-49: Poor match with major elements missing or wrong

5. SUGGESTIONS:
   - Provide specific, actionable suggestions to improve the conversion
   - Focus on the most critical issues first

Return your analysis as a JSON object with this structure:
{
  "overallSimilarityScore": 85,
  "verificationPassed": true,
  "missingElements": [
    {
      "elementType": "connector",
      "description": "Blue curved arrow connecting 'Traffic Management' to 'Public participation'",
      "approximatePosition": {"x": 500, "y": 400},
      "confidence": 90
    }
  ],
  "positioningErrors": [
    {
      "elementType": "text",
      "expectedPosition": {"x": 100, "y": 200},
      "actualPosition": {"x": 120, "y": 210},
      "errorDistance": 22.4
    }
  ],
  "stylingDifferences": [
    {
      "elementType": "shape",
      "property": "fillColor",
      "expectedValue": "4472C4",
      "actualValue": "5583D5",
      "severity": "low"
    }
  ],
  "suggestions": [
    "Add missing curved connector between 'Traffic Management' and central circle",
    "Adjust position of 'Data privacy' text box 20 pixels left",
    "Change arrow head style from 'triangle' to 'stealth' on connector from box 1 to box 3"
  ]
}

IMPORTANT:
- Be thorough but focus on visually significant differences
- Ignore very minor variations in positioning (<5 pixels) or color shades
- Prioritize structural elements (shapes, connectors) over minor styling
- If the overall layout and content match well, score should be 80+
- Return ONLY valid JSON, no additional text or explanations`;
}

function parseVerificationResponse(responseText: string): VerificationResult {
  try {
    let cleanedText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in verification response');
      return createDefaultVerificationResult();
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const missingElements: MissingElement[] = (parsed.missingElements || []).map((elem: any) => ({
      element_type: elem.elementType || 'shape',
      description: elem.description || '',
      approximate_position: elem.approximatePosition ? {
        x: elem.approximatePosition.x || 0,
        y: elem.approximatePosition.y || 0,
      } : undefined,
      confidence: elem.confidence || 50,
    }));

    const positioningErrors: PositioningError[] = (parsed.positioningErrors || []).map((err: any) => ({
      element_type: err.elementType || 'unknown',
      expected_position: {
        x: err.expectedPosition?.x || 0,
        y: err.expectedPosition?.y || 0,
      },
      actual_position: {
        x: err.actualPosition?.x || 0,
        y: err.actualPosition?.y || 0,
      },
      error_distance: err.errorDistance || 0,
    }));

    const stylingDifferences: StylingDifference[] = (parsed.stylingDifferences || []).map((diff: any) => ({
      element_type: diff.elementType || 'unknown',
      property: diff.property || '',
      expected_value: diff.expectedValue || '',
      actual_value: diff.actualValue || '',
      severity: diff.severity || 'low',
    }));

    const suggestions: string[] = parsed.suggestions || [];

    return {
      overall_similarity_score: parsed.overallSimilarityScore || 50,
      missing_elements: missingElements,
      positioning_errors: positioningErrors,
      styling_differences: stylingDifferences,
      verification_passed: parsed.verificationPassed !== false,
      suggestions: suggestions,
    };
  } catch (error) {
    console.error('Error parsing verification response:', error);
    console.log('Raw response:', responseText);
    return createDefaultVerificationResult();
  }
}

function createDefaultVerificationResult(): VerificationResult {
  return {
    overall_similarity_score: 50,
    missing_elements: [],
    positioning_errors: [],
    styling_differences: [],
    verification_passed: false,
    suggestions: ['Verification failed - manual review recommended'],
  };
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

export async function convertPptxToImage(_pptxBlob: Blob, slideIndex: number): Promise<Blob> {
  console.log(`Converting PPTX slide ${slideIndex} to image for verification...`);

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#CCCCCC';
      ctx.font = '48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Generated Slide Preview', canvas.width / 2, canvas.height / 2);
    }

    canvas.toBlob((blob) => {
      resolve(blob || new Blob());
    }, 'image/png');
  });
}
