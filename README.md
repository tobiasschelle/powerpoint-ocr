# AI-Powered PPTX Text Converter

Transform image-based PowerPoint presentations into editable files with accurate text and table extraction using Claude AI Vision.

## Features

### Core Detection
- **AI-Powered Text Detection**: Uses Claude 3.5 Sonnet Vision API to analyze slide images and extract text elements
- **Hybrid Detection** (Optional): Combines Claude Vision with CRAFT text detection for improved accuracy
- **Text Recognition**: Extracts text with accurate positioning, fonts, sizes, colors, and styling
- **Table Extraction**: Detects and recreates tables with proper cell content, formatting, and borders

### Infrastructure
- **Accurate Positioning**: Maintains visual fidelity by precisely mapping element positions from images to PowerPoint coordinates
- **Database Tracking**: Stores all detected text elements and tables in Supabase for analysis and refinement

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **AI**: Claude 3.5 Sonnet (Vision API)
- **Text Detection** (Optional): CRAFT (Character Region Awareness for Text detection)
- **Database**: Supabase (PostgreSQL)
- **PowerPoint Generation**: PptxGenJS
- **Styling**: Tailwind CSS

## Prerequisites

1. **Supabase Project**: Database is already configured
2. **Claude API Key**: Set `CLAUDE_API_KEY` in Supabase Edge Functions secrets
3. **CRAFT Service** (Optional): For enhanced text detection accuracy with hybrid detection

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Set the Claude API key as a Supabase secret:
```bash
supabase secrets set CLAUDE_API_KEY=your_claude_api_key_here
```

4. **(Optional)** Set up CRAFT text detection service:

   See [craft-service/README.md](./craft-service/README.md) for detailed instructions.

   **Quick Start - Option A (Pre-built Docker):**
   ```bash
   docker run --rm -d -p 8500:8500 bedapudi6788/keras-craft:generic-english
   export CRAFT_SERVICE_URL=http://localhost:8500
   ```

   **Quick Start - Option B (Custom FastAPI):**
   ```bash
   cd craft-service
   pip install -r requirements.txt
   python main.py
   # In another terminal:
   export CRAFT_SERVICE_URL=http://localhost:8080
   ```

   Then enable hybrid detection in `.env`:
   ```
   VITE_USE_HYBRID_DETECTION=true
   ```

5. Run the development server:
```bash
npm run dev
```

6. Build for production:
```bash
npm run build
```

## How It Works

### Detection Modes

The system supports two detection modes:

#### Standard Mode (Claude Only)
Uses Claude Vision API exclusively for text detection with a two-phase layout-aware approach.

#### Hybrid Mode (Claude + CRAFT)
Combines Claude Vision with CRAFT text detection for improved accuracy, especially for dense text and complex layouts.

### Enhanced Layout-Based Detection Pipeline

The system uses a sophisticated two-phase approach for maximum placement accuracy:

1. **Upload**: User uploads a PowerPoint file containing slide images
2. **Parse**: System extracts individual slide images from the PPTX file
3. **Phase 1 - Layout Detection**: Claude Vision API detects layout regions (text boxes, shapes, containers)
   - Identifies all visual regions that contain or could contain text
   - Returns bounding boxes in absolute pixel coordinates
   - Classifies region types (title, body, note, shape, diagram, etc.)
   - Detects background colors, borders, and shape types
4. **Phase 2 - Text Detection**:
   - **Standard Mode**: Claude Vision performs targeted text extraction within each region
   - **Hybrid Mode**: Both Claude Vision and CRAFT detect text, then results are merged for best accuracy
   - Processes each detected layout region separately
   - Extracts text with precise positioning relative to the region
   - Maintains spatial relationships between text and containing shapes
6. **Coordinate Normalization**:
   - Validates all pixel coordinates from Claude
   - Converts pixels to PowerPoint inches (10" x 5.625" slide)
   - Clamps coordinates to region and slide boundaries
   - Aligns elements to region edges for cleaner placement
7. **Database Storage**: All detected regions, text elements, and tables are stored in Supabase
8. **PowerPoint Generation**: Native PowerPoint text objects are created using PptxGenJS with region-aware placement
9. **Download**: User receives fully editable PPTX file with accurate text positioning

## Architecture

### Key Files

#### Core Pipeline
- `src/lib/conversion-service.ts` - Main conversion pipeline orchestration
- `src/lib/claude-vision.ts` - Claude Vision API integration with layout-aware analysis
- `src/lib/pptx-parser.ts` - PPTX file parsing and image extraction
- `src/lib/pptx-generator.ts` - Native PowerPoint text and table generation

#### Layout Detection System
- `src/lib/layout-detector.ts` - Phase 1: Detects layout regions using Claude Vision
- `src/lib/region-ocr.ts` - Performs OCR within detected regions
- `src/lib/layout-placement.ts` - Coordinate normalization, validation, and alignment
- `src/lib/coordinate-validator.ts` - Validates and clamps coordinates to slide bounds

#### Hybrid Detection System (Optional)
- `src/lib/craft-detector.ts` - CRAFT text detection integration
- `src/lib/hybrid-detector.ts` - Combines Claude and CRAFT detections
- `src/lib/detection-merger.ts` - Merges overlapping detections intelligently
- `supabase/functions/craft-detect/` - Supabase Edge Function proxy to CRAFT service
- `craft-service/` - Local CRAFT service (FastAPI or Docker)

#### Supporting Files
- `src/types/index.ts` - TypeScript interfaces for detected elements, regions, and tables

### Database Schema

#### Core Tables
- `conversions` - Tracks conversion jobs
- `slides` - Individual slide data
- `detected_layout_regions` - Layout regions detected in Phase 1
- `detected_text_elements` - Text elements with formatting (includes detection_source field)
- `detected_tables` - Table structures
- `table_cells` - Individual table cells

#### Hybrid Detection Tables (Optional)
- `detection_comparison` - Comparison statistics for Claude vs CRAFT vs merged results
- `craft_detections` - Raw CRAFT detection results for analysis

## Prompt Engineering

### Two-Phase Detection Strategy

#### Phase 1: Layout Region Detection
Prompts Claude Vision to act as a document layout analyzer:
- Identify all distinct visual regions (text boxes, shapes, containers)
- Classify region types (title, body, note, shape, diagram, header, footer)
- Return precise bounding boxes in absolute pixel coordinates
- Detect visual properties (background colors, borders, shape types)
- Provide confidence scores for each detected region

#### Phase 2: Region-Based OCR
For each detected region, prompts Claude Vision to:
- Focus exclusively on text within that specific region's boundaries
- Extract text content with precise positioning
- Maintain spatial relationships between text and container shapes
- Return coordinates in absolute pixels (not relative to region)
- Include full styling details (fonts, colors, sizes, alignment)
- Estimate confidence scores for OCR accuracy

This two-phase approach mirrors the architecture of professional document understanding systems like PubLayNet, where layout detection precedes OCR for improved accuracy.

## Supported Elements

### Fully Supported
- Text elements with full formatting (fonts, sizes, colors, styles, alignment)
- Tables with cell-level styling

### Not Supported
- Shapes (rectangles, circles, lines, arrows, etc.)
- Charts and graphs
- Embedded images
- Gradient fills
- Animations and transitions

## Limitations

- Requires valid Claude API key with sufficient credits (set in Supabase secrets)
- Processing time: ~5-10 seconds per slide for text detection
- Slides with very dense text content may have reduced accuracy
- Does not detect or convert shapes, diagrams, or visual elements

## Future Enhancements

- Embedded image detection and placement
- Shape and diagram support
- Chart recognition and data extraction
- Interactive correction UI for manual adjustments
- Batch processing optimization for large presentations

## Cost Considerations

- Claude Vision API charges per image analyzed
- Recommend testing with small presentations first
- Consider implementing caching for repeated conversions
- Monitor API usage in Anthropic Console

## License

MIT
