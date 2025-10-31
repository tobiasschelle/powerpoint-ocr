import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CraftBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  text?: string;
}

interface CraftResponse {
  boxes: CraftBox[];
  processingTimeMs: number;
  imageWidth: number;
  imageHeight: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const craftServiceUrl = Deno.env.get("CRAFT_URL") ||
                           Deno.env.get("CRAFT_SERVICE_URL") ||
                           "http://keras-craft-production.up.railway.app:8500";

    if (!craftServiceUrl) {
      console.warn("CRAFT_URL or CRAFT_SERVICE_URL not configured, returning empty detection");
      return new Response(
        JSON.stringify({
          boxes: [],
          processingTimeMs: 0,
          message: "CRAFT service not configured"
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

    const { base64Data, mimeType, imageWidth, imageHeight } = await req.json();

    if (!base64Data || !imageWidth || !imageHeight) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: base64Data, imageWidth, imageHeight" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log(`Proxying CRAFT detection request: ${imageWidth}x${imageHeight}px to ${craftServiceUrl}`);

    const startTime = Date.now();

    // Add https:// if no protocol specified
    let normalizedUrl = craftServiceUrl;
    if (!craftServiceUrl.startsWith('http://') && !craftServiceUrl.startsWith('https://')) {
      normalizedUrl = `https://${craftServiceUrl}`;
    }

    // Ensure URL ends with /detect for FastAPI service
    const serviceUrl = normalizedUrl.endsWith('/detect')
      ? normalizedUrl
      : `${normalizedUrl.replace(/\/$/, '')}/detect`;

    // Set a timeout to prevent long waits
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const craftResponse = await fetch(serviceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64Data,
          mime_type: mimeType || "image/jpeg",
          width: imageWidth,
          height: imageHeight,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!craftResponse.ok) {
        const errorText = await craftResponse.text();
        console.error(`CRAFT service error: ${craftResponse.status} - ${errorText}`);

        return new Response(
          JSON.stringify({
            boxes: [],
            processingTimeMs: Date.now() - startTime,
            error: `CRAFT service returned ${craftResponse.status}`,
            message: "Falling back to empty detection"
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

      const craftData = await craftResponse.json();
      const processingTimeMs = Date.now() - startTime;

      // Handle both snake_case (FastAPI) and camelCase response formats
      const rawBoxes = craftData.boxes || [];
      const boxes: CraftBox[] = rawBoxes.map((box: any) => ({
        x: box.x || 0,
        y: box.y || 0,
        width: box.width || 0,
        height: box.height || 0,
        confidence: box.confidence || 0,
        text: box.text,
      }));

      console.log(`CRAFT detection completed: ${boxes.length} boxes in ${processingTimeMs}ms`);

      const response: CraftResponse = {
        boxes,
        processingTimeMs,
        imageWidth,
        imageHeight,
      };

      return new Response(
        JSON.stringify(response),
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

      const isTimeout = fetchError instanceof Error && fetchError.name === 'AbortError';
      const errorMsg = isTimeout
        ? "CRAFT service timeout (30s) - service may not be running"
        : (fetchError instanceof Error ? fetchError.message : "Network error");

      console.error(`CRAFT service fetch error: ${errorMsg}`);

      return new Response(
        JSON.stringify({
          boxes: [],
          processingTimeMs: Date.now() - startTime,
          error: errorMsg,
          message: "Falling back to empty detection"
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
    console.error("Error in craft-detect function:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return new Response(
      JSON.stringify({ 
        boxes: [],
        processingTimeMs: 0,
        error: errorMessage,
        type: error instanceof Error ? error.constructor.name : "UnknownError"
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