# CRAFT Text Detection Service

A local microservice that provides CRAFT (Character Region Awareness for Text detection) text detection capabilities for the PowerPoint converter application.

## Quick Start

### Option 1: Docker (Recommended)

Use the pre-built Docker image:

```bash
docker run --rm -p 8500:8500 bedapudi6788/keras-craft:generic-english
```

Then set the environment variable:
```bash
export CRAFT_SERVICE_URL=http://localhost:8500
```

### Option 2: Custom FastAPI Service

Run the included FastAPI service on port 8080:

```bash
# Install dependencies
cd craft-service
pip install -r requirements.txt

# Run the service
python main.py
```

The service will be available at `http://localhost:8080`

Then set the environment variable:
```bash
export CRAFT_SERVICE_URL=http://localhost:8080
```

### Option 3: Build Custom Docker Image

Build and run your own Docker image:

```bash
cd craft-service
docker build -t craft-service .
docker run --rm -p 8080:8080 craft-service
```

## Configuration

### For Local Development

Update your Supabase local configuration to include the CRAFT service URL.

Create or update `supabase/.env.local`:
```
CRAFT_SERVICE_URL=http://host.docker.internal:8080
```

Note: If running Supabase Edge Functions locally in Docker, use `host.docker.internal` to access localhost services.

### For Production

Set the CRAFT_SERVICE_URL as a Supabase secret:

```bash
supabase secrets set CRAFT_SERVICE_URL=http://your-craft-service-url
```

Or via Supabase Dashboard:
- Project Settings > Edge Functions > Secrets
- Add: `CRAFT_SERVICE_URL` = `http://your-internal-craft-service-url`

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "craft_available": true,
  "model_loaded": true
}
```

### Text Detection

```bash
POST /detect
Content-Type: application/json

{
  "image": "base64_encoded_image_data",
  "mime_type": "image/jpeg",
  "width": 1920,
  "height": 1080
}
```

Response:
```json
{
  "boxes": [
    {
      "x": 100.5,
      "y": 50.2,
      "width": 200.0,
      "height": 30.0,
      "confidence": 0.95,
      "text": null
    }
  ],
  "processing_time_ms": 250.5,
  "image_width": 1920,
  "image_height": 1080
}
```

## Testing

Test the service with curl:

```bash
# Health check
curl http://localhost:8080/health

# Test detection (with a base64 image)
curl -X POST http://localhost:8080/detect \
  -H "Content-Type: application/json" \
  -d '{
    "image": "your_base64_image_here",
    "mime_type": "image/jpeg",
    "width": 800,
    "height": 600
  }'
```

## Architecture

The CRAFT service integrates with the main application through:

1. **Frontend** → Uploads PPTX
2. **Main App** → Calls Supabase Edge Function
3. **Edge Function** → Proxies to CRAFT Service (this service)
4. **CRAFT Service** → Returns text bounding boxes
5. **Edge Function** → Returns results to main app
6. **Main App** → Merges CRAFT + Claude detections

## Performance

- **Cold start**: ~5-10 seconds (model loading)
- **Warm inference**: ~100-500ms per slide image
- **Memory usage**: ~500MB-1GB
- **CPU usage**: Moderate (can use GPU if available)

## Troubleshooting

### CRAFT model not loading

Make sure all dependencies are installed:
```bash
pip install craft-text-detector torch torchvision
```

### Port already in use

Change the port in `main.py`:
```python
uvicorn.run(app, host="0.0.0.0", port=8081)  # Use different port
```

### Docker container can't connect to localhost

If your Supabase Edge Functions run in Docker, use:
- `host.docker.internal:8080` (Mac/Windows)
- `172.17.0.1:8080` (Linux)

### Out of memory errors

Reduce the image processing size in `main.py`:
```python
craft_model = Craft(
    output_dir=None,
    crop_type="poly",
    cuda=False,
    long_size=1024  # Reduce from 1280 to 1024 or 960
)
```

## GPU Support

To enable GPU acceleration (if available):

1. Install CUDA-enabled PyTorch
2. Modify `main.py`:
```python
craft_model = Craft(
    output_dir=None,
    crop_type="poly",
    cuda=True,  # Enable GPU
    long_size=1280
)
```

## License

MIT
