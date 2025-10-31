"""
CRAFT Text Detection Service
FastAPI wrapper for CRAFT text detection to run locally alongside the main application.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import io
import numpy as np
from PIL import Image
from typing import List, Optional
import time

# Import CRAFT detector
try:
    from craft_text_detector import Craft
    CRAFT_AVAILABLE = True
except ImportError:
    CRAFT_AVAILABLE = False
    print("WARNING: craft-text-detector not installed. Install with:")
    print("pip install craft-text-detector")

app = FastAPI(title="CRAFT Text Detection Service", version="1.0.0")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize CRAFT model (lazy loading)
craft_model = None


class DetectionRequest(BaseModel):
    image: str  # base64 encoded image
    mime_type: str = "image/jpeg"
    width: int
    height: int


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float
    confidence: float
    text: Optional[str] = None


class DetectionResponse(BaseModel):
    boxes: List[BoundingBox]
    processing_time_ms: float
    image_width: int
    image_height: int


def load_craft_model():
    """Lazy load CRAFT model on first request"""
    global craft_model
    if craft_model is None and CRAFT_AVAILABLE:
        print("Loading CRAFT model...")
        craft_model = Craft(
            output_dir=None,  # Don't save output files
            crop_type="poly",
            cuda=False,  # Use CPU by default
            long_size=1280  # Max image dimension for processing
        )
        print("CRAFT model loaded successfully")
    return craft_model


def base64_to_image(base64_string: str) -> Image.Image:
    """Convert base64 string to PIL Image"""
    try:
        # Remove data URL prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]

        image_data = base64.b64decode(base64_string)
        image = Image.open(io.BytesIO(image_data))
        return image.convert('RGB')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")


def process_craft_predictions(prediction_result, image_width: int, image_height: int) -> List[BoundingBox]:
    """Convert CRAFT prediction result to bounding boxes"""
    boxes = []

    if not prediction_result or 'boxes' not in prediction_result:
        return boxes

    for box_data in prediction_result['boxes']:
        # CRAFT returns polygon points, convert to bounding box
        if isinstance(box_data, dict) and 'points' in box_data:
            points = box_data['points']
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]

            x = min(xs)
            y = min(ys)
            width = max(xs) - x
            height = max(ys) - y

            boxes.append(BoundingBox(
                x=x,
                y=y,
                width=width,
                height=height,
                confidence=box_data.get('confidence', 0.9),
                text=box_data.get('text')
            ))
        elif isinstance(box_data, (list, tuple)) and len(box_data) >= 4:
            # Handle different box formats
            x, y, w, h = box_data[:4]
            confidence = box_data[4] if len(box_data) > 4 else 0.9

            boxes.append(BoundingBox(
                x=float(x),
                y=float(y),
                width=float(w),
                height=float(h),
                confidence=float(confidence)
            ))

    return boxes


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "CRAFT Text Detection",
        "status": "running",
        "craft_available": CRAFT_AVAILABLE,
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "craft_available": CRAFT_AVAILABLE,
        "model_loaded": craft_model is not None
    }


@app.post("/detect", response_model=DetectionResponse)
async def detect_text(request: DetectionRequest):
    """
    Detect text regions in an image using CRAFT

    Args:
        request: Detection request with base64 image and dimensions

    Returns:
        DetectionResponse with detected bounding boxes
    """
    if not CRAFT_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="CRAFT text detector not available. Install with: pip install craft-text-detector"
        )

    start_time = time.time()

    try:
        # Load model if not already loaded
        craft = load_craft_model()
        if craft is None:
            raise HTTPException(status_code=500, detail="Failed to load CRAFT model")

        # Convert base64 to image
        image = base64_to_image(request.image)

        # Resize if needed to match expected dimensions
        if image.size != (request.width, request.height):
            image = image.resize((request.width, request.height), Image.Resampling.LANCZOS)

        # Convert PIL Image to numpy array for CRAFT
        image_array = np.array(image)

        # Run CRAFT detection
        prediction_result = craft.detect_text(image_array)

        # Convert predictions to bounding boxes
        boxes = process_craft_predictions(prediction_result, request.width, request.height)

        processing_time = (time.time() - start_time) * 1000

        return DetectionResponse(
            boxes=boxes,
            processing_time_ms=processing_time,
            image_width=request.width,
            image_height=request.height
        )

    except HTTPException:
        raise
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        print(f"Error during detection: {str(e)}")

        # Return empty result instead of failing
        return DetectionResponse(
            boxes=[],
            processing_time_ms=processing_time,
            image_width=request.width,
            image_height=request.height
        )


if __name__ == "__main__":
    import uvicorn
    print("Starting CRAFT Text Detection Service...")
    print(f"CRAFT Available: {CRAFT_AVAILABLE}")
    if not CRAFT_AVAILABLE:
        print("\nTo install CRAFT, run:")
        print("pip install craft-text-detector")

    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
