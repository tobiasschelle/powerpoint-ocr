"""
Line-Level Text Box Merging
Merges word-level detections into stable line-level boxes for PowerPoint placement.
"""
import numpy as np
from typing import List, Tuple
import math


class TextBox:
    """Represents a detected text bounding box with rotation"""
    def __init__(self, x: float, y: float, width: float, height: float,
                 angle: float = 0.0, confidence: float = 1.0, polygon: List = None):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.angle = angle
        self.confidence = confidence
        self.polygon = polygon or []

    @property
    def center_x(self) -> float:
        return self.x + self.width / 2

    @property
    def center_y(self) -> float:
        return self.y + self.height / 2

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def bottom(self) -> float:
        return self.y + self.height

    def __repr__(self):
        return f"TextBox(x={self.x:.1f}, y={self.y:.1f}, w={self.width:.1f}, h={self.height:.1f}, θ={self.angle:.1f}°)"


def normalize_angle(angle: float) -> float:
    """Normalize angle to [-180, 180] range"""
    while angle > 180:
        angle -= 360
    while angle < -180:
        angle += 360
    return angle


def calculate_vertical_overlap(box1: TextBox, box2: TextBox) -> float:
    """Calculate vertical overlap ratio between two boxes"""
    overlap_top = max(box1.y, box2.y)
    overlap_bottom = min(box1.bottom, box2.bottom)
    overlap_height = max(0, overlap_bottom - overlap_top)

    avg_height = (box1.height + box2.height) / 2
    if avg_height == 0:
        return 0

    return overlap_height / avg_height


def calculate_horizontal_gap(box1: TextBox, box2: TextBox) -> float:
    """Calculate horizontal gap between two boxes"""
    if box1.x > box2.x:
        box1, box2 = box2, box1

    gap = box2.x - box1.right
    return max(0, gap)


def estimate_median_char_width(boxes: List[TextBox]) -> float:
    """Estimate median character width from box widths"""
    if not boxes:
        return 10.0

    widths = [box.width for box in boxes]
    widths.sort()

    median_width = widths[len(widths) // 2]

    estimated_char_width = median_width / max(1, median_width / 12)

    return max(8.0, min(20.0, estimated_char_width))


def should_merge_boxes(box1: TextBox, box2: TextBox,
                       rotation_threshold: float = 0.8,
                       overlap_threshold: float = 0.6,
                       gap_multiplier: float = 0.6,
                       median_char_width: float = 12.0) -> bool:
    """
    Determine if two boxes should be merged into a line.

    Args:
        box1: First text box
        box2: Second text box
        rotation_threshold: Max angle difference in degrees (0.8°)
        overlap_threshold: Min vertical overlap ratio (0.6 = 60%)
        gap_multiplier: Max gap as multiple of char width (0.6)
        median_char_width: Estimated character width for gap calculation

    Returns:
        True if boxes should be merged
    """
    angle_diff = abs(normalize_angle(box1.angle - box2.angle))
    if angle_diff > rotation_threshold:
        return False

    vertical_overlap = calculate_vertical_overlap(box1, box2)
    if vertical_overlap < overlap_threshold:
        return False

    horizontal_gap = calculate_horizontal_gap(box1, box2)
    max_gap = gap_multiplier * median_char_width

    if horizontal_gap > max_gap:
        return False

    return True


def merge_two_boxes(box1: TextBox, box2: TextBox) -> TextBox:
    """Merge two boxes into a single box"""
    x_min = min(box1.x, box2.x)
    y_min = min(box1.y, box2.y)
    x_max = max(box1.right, box2.right)
    y_max = max(box1.bottom, box2.bottom)

    avg_angle = (box1.angle + box2.angle) / 2
    max_confidence = max(box1.confidence, box2.confidence)

    merged_polygon = []
    if box1.polygon and box2.polygon:
        merged_polygon = box1.polygon + box2.polygon

    return TextBox(
        x=x_min,
        y=y_min,
        width=x_max - x_min,
        height=y_max - y_min,
        angle=avg_angle,
        confidence=max_confidence,
        polygon=merged_polygon
    )


def merge_boxes_to_lines(
    boxes: List[TextBox],
    rotation_threshold: float = 0.8,
    overlap_threshold: float = 0.6,
    gap_multiplier: float = 0.6
) -> List[TextBox]:
    """
    Merge word-level boxes into line-level boxes.

    Algorithm:
    1. Sort boxes by position (top-to-bottom, left-to-right)
    2. Estimate median character width from box sizes
    3. Iterate through boxes, merging neighbors that satisfy:
       - Similar rotation (Δθ < 0.8°)
       - High vertical overlap (> 60%)
       - Small horizontal gap (< 0.6 × median char width)
    4. Return merged line-level boxes

    Args:
        boxes: List of detected text boxes
        rotation_threshold: Max angle difference for merging (degrees)
        overlap_threshold: Min vertical overlap ratio (0-1)
        gap_multiplier: Max gap as multiple of char width

    Returns:
        List of merged line-level boxes
    """
    if not boxes:
        return []

    sorted_boxes = sorted(boxes, key=lambda b: (b.y, b.x))

    median_char_width = estimate_median_char_width(sorted_boxes)

    print(f"Merging {len(sorted_boxes)} boxes to lines (char_width={median_char_width:.1f}px)")

    merged_lines = []
    current_line = None

    for box in sorted_boxes:
        if current_line is None:
            current_line = box
            continue

        if should_merge_boxes(
            current_line,
            box,
            rotation_threshold=rotation_threshold,
            overlap_threshold=overlap_threshold,
            gap_multiplier=gap_multiplier,
            median_char_width=median_char_width
        ):
            current_line = merge_two_boxes(current_line, box)
        else:
            merged_lines.append(current_line)
            current_line = box

    if current_line is not None:
        merged_lines.append(current_line)

    print(f"Merged into {len(merged_lines)} line-level boxes")

    return merged_lines


def filter_small_boxes(boxes: List[TextBox], min_width: float = 5.0, min_height: float = 5.0) -> List[TextBox]:
    """Filter out boxes that are too small to be meaningful text"""
    return [box for box in boxes if box.width >= min_width and box.height >= min_height]


def filter_low_confidence_boxes(boxes: List[TextBox], min_confidence: float = 0.3) -> List[TextBox]:
    """Filter out boxes with low confidence scores"""
    return [box for box in boxes if box.confidence >= min_confidence]
