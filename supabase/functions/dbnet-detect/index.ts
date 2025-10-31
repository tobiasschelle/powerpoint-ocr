import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DBNetBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  polygon?: number[][];
  rotation_angle?: number;
}

interface DBNetPolygon {
  points: number[][];
  confidence: number;
}

interface DBNetRotatedRect {
  center_x: number;
  center_y: number;
  width: number;
  height: number;
  angle: number;
  confidence: number;
}

interface DBNetServiceResponse {
  boxes: DBNetBox[];
  polygons: DBNetPolygon[];
  rotated_rects: DBNetRotatedRect[];
  processing_time_ms: number;
  image_width: number;
  image_height: number;
}

interface RequestPayload {
  base64Data: string;
  mimeType: string;
  imageWidth: number;
  imageHeight: number;
  detDbThresh?: number;
  detDbBoxThresh?: number;
  detDbUnclipRatio?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const dbnetServiceUrl = Deno.env.get("DBNET_SERVICE_URL") || Deno.env.get("DBNET_URL");

    if (!dbnetServiceUrl) {
      console.log("⚠️ DBNET_SERVICE_URL not configured, returning empty detection");
      return new Response(
        JSON.stringify({
          boxes: [],
          polygons: [],
          rotated_rects: [],
          processing_time_ms: 0,
          image_width: 0,
          image_height: 0,
          message: "DBNet service not configured",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const {
      base64Data,
      mimeType,
      imageWidth,
      imageHeight,
      detDbThresh = 0.3,
      detDbBoxThresh = 0.5,
      detDbUnclipRatio = 1.8,
    }: RequestPayload = await req.json();

    console.log(`DBNet detection request: ${imageWidth}x${imageHeight}`);
    console.log(`Parameters: thresh=${detDbThresh}, box_thresh=${detDbBoxThresh}, unclip=${detDbUnclipRatio}`);

    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${dbnetServiceUrl}/detect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64Data,
          mime_type: mimeType,
          width: imageWidth,
          height: imageHeight,
          det_db_thresh: detDbThresh,
          det_db_box_thresh: detDbBoxThresh,
          det_db_unclip_ratio: detDbUnclipRatio,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`DBNet service returned ${response.status}`);
        throw new Error(`DBNet service error: ${response.status}`);
      }

      const result: DBNetServiceResponse = await response.json();
      const totalTime = Date.now() - startTime;

      console.log(`✓ DBNet detection completed: ${result.boxes.length} boxes in ${totalTime}ms`);

      return new Response(
        JSON.stringify({
          boxes: result.boxes,
          polygons: result.polygons,
          rotatedRects: result.rotated_rects,
          processingTimeMs: totalTime,
          imageWidth: result.image_width,
          imageHeight: result.image_height,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);

      const isTimeout = fetchError instanceof Error && fetchError.name === "AbortError";
      const errorMsg = isTimeout
        ? "DBNet service timeout"
        : `DBNet service error: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`;

      console.error(errorMsg);

      return new Response(
        JSON.stringify({
          boxes: [],
          polygons: [],
          rotatedRects: [],
          processingTimeMs: Date.now() - startTime,
          imageWidth,
          imageHeight,
          error: errorMsg,
          message: "Falling back to empty detection",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    console.error("DBNet edge function error:", error);

    return new Response(
      JSON.stringify({
        boxes: [],
        polygons: [],
        rotatedRects: [],
        processingTimeMs: 0,
        imageWidth: 0,
        imageHeight: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
