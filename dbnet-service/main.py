"""
DBNet Text Detection Service
FastAPI wrapper for DBNet++ text detection using PaddleOCR.
Provides tight geometry detection optimized for PowerPoint slide text extraction.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import io
import numpy as np
from PIL import Image
from typing import List, Optional, Tuple
import time
import math

try:
    from paddleocr import PaddleOCR
    PADDLEOCR_AVAILABLE = True
except ImportError:
    PADDLEOCR_AVAILABLE = False
    print("WARNING: PaddleOCR not installed. Install with:")
    print("pip install paddleocr")

app = FastAPI(title="DBNet Text Detection Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ocr_model = None


class DetectionRequest(BaseModel):
    image: str
    mime_type: str = "image/jpeg"
    width: int
    height: int
    det_db_thresh: float = 0.3
    det_db_box_thresh: float = 0.5
    det_db_unclip_ratio: float = 1.8


class Polygon(BaseModel):
    points: List[List[float]]
    confidence: float


class RotatedRect(BaseModel):
    center_x: float
    center_y: float
    width: float
    height: float
    angle: float
    confidence: float


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float
    confidence: float
    polygon: Optional[List[List[float]]] = None
    rotation_angle: Optional[float] = None


class DetectionResponse(BaseModel):
    boxes: List[BoundingBox]
    polygons: List[Polygon]
    rotated_rects: List[RotatedRect]
    processing_time_ms: float
    image_width: int
    image_height: int


def load_paddleocr_model():
    """Lazy load PaddleOCR model on first request"""
    global ocr_model
    if ocr_model is None and PADDLEOCR_AVAILABLE:
        print("Loading PaddleOCR (DBNet++) model...")
        ocr_model = PaddleOCR(
            use_angle_cls=False,
            lang='en',
            det_algorithm='DB',
            rec=False,
            show_log=False,
            use_gpu=False,
            det_limit_side_len=1280,
            det_limit_type='max'
        )
        print("PaddleOCR model loaded successfully")
    return ocr_model


def base64_to_image(base64_string: str) -> Image.Image:
    """Convert base64 string to PIL Image"""
    try:
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]

        image_data = base64.b64decode(base64_string)
        image = Image.open(io.BytesIO(image_data))
        return image.convert('RGB')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")


def polygon_to_rotated_rect(polygon: np.ndarray) -> Tuple[float, float, float, float, float]:
    """
    Convert polygon to rotated rectangle (center_x, center_y, width, height, angle).
    Uses minimum area rectangle fitting.
    """
    try:
        from shapely.geometry import Polygon as ShapelyPolygon

        if len(polygon) < 3:
            center_x = float(np.mean(polygon[:, 0]))
            center_y = float(np.mean(polygon[:, 1]))
            return center_x, center_y, 10.0, 10.0, 0.0

        poly = ShapelyPolygon(polygon)
        min_rect = poly.minimum_rotated_rectangle

        coords = list(min_rect.exterior.coords)[:-1]

        if len(coords) >= 4:
            p1, p2, p3, p4 = coords[:4]

            width1 = math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
            width2 = math.sqrt((p3[0] - p2[0])**2 + (p3[1] - p2[1])**2)

            if width1 > width2:
                width = width1
                height = width2
                angle = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
            else:
                width = width2
                height = width1
                angle = math.atan2(p3[1] - p2[1], p3[0] - p2[0])

            angle_degrees = math.degrees(angle)

            center_x = float(poly.centroid.x)
            center_y = float(poly.centroid.y)

            return center_x, center_y, width, height, angle_degrees

        center_x = float(np.mean(polygon[:, 0]))
        center_y = float(np.mean(polygon[:, 1]))
        width = float(np.max(polygon[:, 0]) - np.min(polygon[:, 0]))
        height = float(np.max(polygon[:, 1]) - np.min(polygon[:, 1]))

        return center_x, center_y, width, height, 0.0

    except Exception as e:
        print(f"Error in polygon_to_rotated_rect: {e}")
        center_x = float(np.mean(polygon[:, 0]))
        center_y = float(np.mean(polygon[:, 1]))
        width = float(np.max(polygon[:, 0]) - np.min(polygon[:, 0]))
        height = float(np.max(polygon[:, 1]) - np.min(polygon[:, 1]))
        return center_x, center_y, width, height, 0.0


def polygon_to_bbox(polygon: np.ndarray) -> Tuple[float, float, float, float]:
    """Convert polygon to axis-aligned bounding box"""
    x_coords = polygon[:, 0]
    y_coords = polygon[:, 1]

    x_min = float(np.min(x_coords))
    y_min = float(np.min(y_coords))
    x_max = float(np.max(x_coords))
    y_max = float(np.max(y_coords))

    return x_min, y_min, x_max - x_min, y_max - y_min


def process_dbnet_detections(
    detection_result: List,
    image_width: int,
    image_height: int
) -> Tuple[List[BoundingBox], List[Polygon], List[RotatedRect]]:
    """Process DBNet detection results into multiple output formats"""
    boxes = []
    polygons = []
    rotated_rects = []

    if not detection_result or len(detection_result) == 0:
        return boxes, polygons, rotated_rects

    for detection in detection_result:
        if detection is None or len(detection) == 0:
            continue

        for item in detection:
            if item is None or len(item) < 1:
                continue

            poly_points = item[0] if isinstance(item, (list, tuple)) else item

            if not isinstance(poly_points, (list, np.ndarray)):
                continue

            poly_array = np.array(poly_points, dtype=np.float32)

            if poly_array.shape[0] < 3 or poly_array.shape[1] != 2:
                continue

            confidence = 0.9

            polygon_list = poly_array.tolist()
            polygons.append(Polygon(
                points=polygon_list,
                confidence=confidence
            ))

            cx, cy, w, h, angle = polygon_to_rotated_rect(poly_array)
            rotated_rects.append(RotatedRect(
                center_x=cx,
                center_y=cy,
                width=w,
                height=h,
                angle=angle,
                confidence=confidence
            ))

            x, y, width, height = polygon_to_bbox(poly_array)
            boxes.append(BoundingBox(
                x=x,
                y=y,
                width=width,
                height=height,
                confidence=confidence,
                polygon=polygon_list,
                rotation_angle=angle
            ))

    return boxes, polygons, rotated_rects


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "DBNet Text Detection",
        "status": "running",
        "paddleocr_available": PADDLEOCR_AVAILABLE,
        "version": "1.0.0",
        "algorithm": "DBNet++"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "paddleocr_available": PADDLEOCR_AVAILABLE,
        "model_loaded": ocr_model is not None,
        "algorithm": "DBNet++"
    }


@app.post("/detect", response_model=DetectionResponse)
async def detect_text(request: DetectionRequest):
    """
    Detect text regions in an image using DBNet++

    Args:
        request: Detection request with base64 image and parameters

    Returns:
        DetectionResponse with bounding boxes, polygons, and rotated rectangles
    """
    if not PADDLEOCR_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="PaddleOCR not available. Install with: pip install paddleocr"
        )

    start_time = time.time()

    try:
        ocr = load_paddleocr_model()
        if ocr is None:
            raise HTTPException(status_code=500, detail="Failed to load PaddleOCR model")

        image = base64_to_image(request.image)

        if image.size != (request.width, request.height):
            image = image.resize((request.width, request.height), Image.Resampling.LANCZOS)

        image_array = np.array(image)

        ocr.text_detector.det_db_thresh = request.det_db_thresh
        ocr.text_detector.det_db_box_thresh = request.det_db_box_thresh
        ocr.text_detector.det_db_unclip_ratio = request.det_db_unclip_ratio

        result = ocr.ocr(image_array, det=True, rec=False, cls=False)

        boxes, polygons, rotated_rects = process_dbnet_detections(
            result,
            request.width,
            request.height
        )

        processing_time = (time.time() - start_time) * 1000

        return DetectionResponse(
            boxes=boxes,
            polygons=polygons,
            rotated_rects=rotated_rects,
            processing_time_ms=processing_time,
            image_width=request.width,
            image_height=request.height
        )

    except HTTPException:
        raise
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        print(f"Error during detection: {str(e)}")

        return DetectionResponse(
            boxes=[],
            polygons=[],
            rotated_rects=[],
            processing_time_ms=processing_time,
            image_width=request.width,
            image_height=request.height
        )


if __name__ == "__main__":
    import uvicorn
    print("Starting DBNet Text Detection Service...")
    print(f"PaddleOCR Available: {PADDLEOCR_AVAILABLE}")
    if not PADDLEOCR_AVAILABLE:
        print("\nTo install PaddleOCR, run:")
        print("pip install paddleocr")

    uvicorn.run(app, host="0.0.0.0", port=8090, log_level="info")
