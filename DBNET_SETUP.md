# DBNet Text Detection Setup Guide

Complete guide for deploying and using DBNet++ text detection in the PowerPoint OCR system.

## Overview

DBNet++ provides superior text detection for document OCR compared to CRAFT:
- **97.4% F1-score** on document datasets (vs ~95% for CRAFT)
- **Faster inference** with comparable accuracy
- **Better scale handling** for varying font sizes in presentations
- **Simpler deployment** using PaddleOCR toolkit
- **Tighter bounding boxes** for accurate PowerPoint placement

## Quick Start

### Option 1: Local Development (Fastest)

```bash
# 1. Start DBNet service
cd dbnet-service
./start-dbnet.sh  # Linux/Mac
# or
start-dbnet.bat   # Windows

# Service runs on http://localhost:8090
```

### Option 2: Docker (Recommended for Testing)

```bash
cd dbnet-service

# Build and run
docker build -t dbnet-service .
docker run -d -p 8090:8090 --name dbnet dbnet-service

# Check health
curl http://localhost:8090/health
```

### Option 3: Production Deployment (Railway)

See [Production Deployment](#production-deployment-railway) section below.

## System Requirements

### Minimum Requirements
- Python 3.8+
- 2GB RAM
- 1GB disk space (for models)

### Recommended for Production
- Python 3.10+
- 4GB RAM
- 2 CPU cores
- SSD storage

## Detailed Setup

### 1. Local Python Service

#### Installation

```bash
cd dbnet-service

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt
```

#### First Run (Model Download)

The first time you run DBNet, PaddleOCR will download detection models (~8MB):

```bash
python main.py
```

Expected output:
```
Starting DBNet Text Detection Service...
PaddleOCR Available: True
Loading PaddleOCR (DBNet++) model...
Downloading: detection model...
PaddleOCR model loaded successfully
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8090
```

#### Testing

```bash
# Health check
curl http://localhost:8090/health

# Expected response:
# {
#   "status": "healthy",
#   "paddleocr_available": true,
#   "model_loaded": true,
#   "algorithm": "DBNet++"
# }
```

### 2. Configure Supabase Edge Function

For your Supabase-hosted edge functions to communicate with DBNet service:

#### For Local Development

**Note:** Supabase edge functions run in the cloud and cannot directly access `localhost`.

You have two options:

**Option A: Use Supabase Local Development** (Recommended for testing)

```bash
# 1. Start DBNet service locally
cd dbnet-service && python main.py

# 2. In another terminal, start local Supabase functions
cd /path/to/project
supabase functions serve --env-file .env

# 3. Set local environment variable
# Create .env.local file:
echo "DBNET_SERVICE_URL=http://host.docker.internal:8090" > supabase/functions/.env.local
```

**Option B: Use ngrok for Testing** (Quick temporary solution)

```bash
# 1. Start DBNet service
cd dbnet-service && python main.py

# 2. In another terminal, expose with ngrok
ngrok http 8090

# 3. Copy the ngrok URL (e.g., https://abc123.ngrok.io)

# 4. Set Supabase secret
supabase secrets set DBNET_SERVICE_URL=https://abc123.ngrok.io
```

#### For Production

Deploy DBNet to a cloud platform and configure the secret:

```bash
# After deploying to Railway/Render/etc (see below)
supabase secrets set DBNET_SERVICE_URL=https://your-dbnet-service.railway.app
```

### 3. Enable DBNet in Application

1. Start your application (`npm run dev`)
2. Click the Settings icon (⚙️) in the top-right corner
3. Turn ON "Hybrid Detection"
4. Turn ON "Use DBNet" toggle
5. Optionally enable "DBNet-Primary Mode" for best results
6. Upload a PowerPoint file to test

**Settings Modes:**

- **Claude-Only**: Fast, AI-only detection (no DBNet needed)
- **Hybrid**: Combines Claude and DBNet detections (requires DBNet service)
- **DBNet-Primary**: Uses DBNet for placement, Claude for text (best accuracy)

## Production Deployment (Railway)

Railway provides easy deployment with automatic HTTPS and scaling.

### Step 1: Prepare Repository

```bash
# Commit DBNet service
git add dbnet-service/
git commit -m "Add DBNet detection service"
git push origin main
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Configure deployment:
   - **Root Directory**: `dbnet-service`
   - **Start Command**: `python main.py`
   - **Port**: `8090`

Railway will auto-detect the Dockerfile and deploy.

### Step 3: Get Service URL

After deployment completes:
1. Click on your deployed service
2. Go to "Settings" → "Networking"
3. Copy the public URL (e.g., `dbnet-service-production-xxxx.up.railway.app`)

### Step 4: Configure Supabase

```bash
# Set the secret
supabase secrets set DBNET_SERVICE_URL=https://your-railway-url.up.railway.app

# Verify it's set
supabase secrets list
```

### Step 5: Test End-to-End

1. Open your application
2. Enable DBNet in Settings
3. Upload a test PowerPoint
4. Check console logs for DBNet detection messages

Expected console output:
```
=== DBNET TEXT DETECTION ===
Image dimensions: 1920px × 1080px
Parameters: thresh=0.3, box_thresh=0.5, unclip=1.8
DBNet detection completed: 25 boxes in 243ms
=== DBNET DETECTION COMPLETE ===
```

## Alternative Deployment Platforms

### Render

```yaml
# render.yaml
services:
  - type: web
    name: dbnet-service
    env: docker
    dockerfilePath: ./dbnet-service/Dockerfile
    plan: starter
    port: 8090
```

Deploy:
```bash
# Connect repo to Render, it will auto-deploy
# Get service URL from Render dashboard
supabase secrets set DBNET_SERVICE_URL=https://your-service.onrender.com
```

### Google Cloud Run

```bash
cd dbnet-service

# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/dbnet-service

# Deploy
gcloud run deploy dbnet-service \
  --image gcr.io/PROJECT_ID/dbnet-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8090

# Get service URL
gcloud run services describe dbnet-service --format='value(status.url)'

# Configure Supabase
supabase secrets set DBNET_SERVICE_URL=https://your-service.run.app
```

### Fly.io

```bash
cd dbnet-service

# Create app
fly launch --name dbnet-service --no-deploy

# Edit fly.toml to set port to 8090

# Deploy
fly deploy

# Get URL
fly info

# Configure Supabase
supabase secrets set DBNET_SERVICE_URL=https://dbnet-service.fly.dev
```

## Configuration Parameters

### Detection Thresholds

Adjust these in the frontend for fine-tuning:

**`detDbThresh`** (default: 0.3)
- Range: 0.1 - 0.5
- Lower = more sensitive (detects more text)
- Higher = more selective (fewer false positives)
- **Recommended for PowerPoint**: 0.3-0.4

**`detDbBoxThresh`** (default: 0.5)
- Range: 0.3 - 0.7
- Minimum confidence for keeping a detection
- **Recommended**: 0.5 for balanced results

**`detDbUnclipRatio`** (default: 1.8)
- Range: 1.5 - 2.5
- Controls bounding box expansion
- Lower = tighter boxes
- **Recommended for documents**: 1.6-2.0

### Line Merging Parameters

These control how word-level detections are merged into lines:

**Rotation Threshold** (default: 0.8°)
- Max angle difference for merging boxes
- Keep low for straight text lines

**Overlap Threshold** (default: 0.6)
- Min vertical overlap ratio (60%)
- Higher = stricter line alignment

**Gap Multiplier** (default: 0.6)
- Max horizontal gap as multiple of char width
- Lower = requires closer spacing

## Performance Optimization

### Speed Improvements

1. **Reduce Image Size**: Images are automatically limited to 1280px on short side
2. **Batch Processing**: Process multiple slides in parallel (already implemented)
3. **GPU Acceleration**: Enable if available (requires CUDA)

```python
# In main.py, change:
ocr_model = PaddleOCR(
    use_gpu=True,  # Enable GPU
    # ... other params
)
```

### Memory Optimization

For lower memory usage:

```python
# Reduce batch size or image limits
det_limit_side_len=960  # Instead of 1280
```

## Troubleshooting

### Service Won't Start

**Error: `ModuleNotFoundError: No module named 'paddleocr'`**

```bash
pip install paddleocr paddlepaddle
```

**Error: `ImportError: libGL.so.1: cannot open shared object file`**

```bash
# Linux
sudo apt-get install libgl1-mesa-glx

# Docker: Add to Dockerfile
RUN apt-get update && apt-get install -y libgl1-mesa-glx
```

### Model Download Fails

**Error: Connection timeout during model download**

Pre-download models:

```bash
python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=False, lang='en', rec=False, show_log=False)"
```

### Edge Function Can't Reach Service

**Error: `DBNet service timeout`**

1. Check service is running: `curl http://your-service-url/health`
2. Verify `DBNET_SERVICE_URL` secret is set correctly
3. Check firewall/security groups allow traffic
4. Ensure URL uses HTTPS (not HTTP) for production

### Poor Detection Quality

**Too many false positives:**
- Increase `detDbBoxThresh` to 0.6-0.7
- Increase `detDbThresh` to 0.4-0.5

**Missing text:**
- Decrease `detDbThresh` to 0.2-0.3
- Check image resolution is adequate

**Boxes too loose/tight:**
- Adjust `detDbUnclipRatio`:
  - Tighter: 1.5-1.7
  - Looser: 1.9-2.2

## Comparison: DBNet vs CRAFT

| Feature | DBNet++ | CRAFT |
|---------|---------|-------|
| **F1-Score (Documents)** | 97.4% | ~95% |
| **Detection Level** | Word/Line | Character |
| **Speed** | Fast (~200-400ms) | Moderate (~300-500ms) |
| **Bounding Box Quality** | Tight, accurate | Very tight, complex |
| **Scale Handling** | Excellent | Good |
| **Setup Complexity** | Simple (PaddleOCR) | Complex (PyTorch custom) |
| **Best For** | Document text, presentations | Scene text, curved text |
| **Memory Usage** | Moderate (500MB-1GB) | Moderate (600MB-1.2GB) |

**Recommendation:** Use DBNet for PowerPoint slides and structured documents. Use CRAFT only if you need character-level detection or have extremely curved/artistic text.

## Monitoring and Logging

### Check Service Health

```bash
curl https://your-service-url/health
```

### View Detection Logs

```bash
# Railway
railway logs

# Render
# View in dashboard

# Docker
docker logs dbnet
```

### Performance Metrics

Monitor in console logs:
- Detection time per slide
- Number of boxes detected
- Line merging statistics

Example output:
```
DBNet detected 42 text boxes in 256ms
Merging 42 boxes into lines...
Estimated median char width: 11.5px
Merged into 18 line-level boxes
```

## Security Considerations

1. **API Keys**: DBNet service requires no API keys or authentication
2. **Network Security**: Use HTTPS in production
3. **Rate Limiting**: Consider adding rate limits for production
4. **Input Validation**: Already implemented in FastAPI models

## Migration from CRAFT

To switch from CRAFT to DBNet:

1. Deploy DBNet service (see above)
2. Configure `DBNET_SERVICE_URL` secret
3. Enable "Use DBNet" toggle in Settings UI
4. Test with sample presentations
5. Compare results with CRAFT (both detection sources are tracked in database)
6. Once satisfied, optionally remove CRAFT service

**Note:** You can run both CRAFT and DBNet simultaneously and switch between them via Settings UI.

## Cost Estimates

### Railway (Hobby Plan)
- **Free tier**: $5/month credit
- **Estimated cost**: $5-10/month for moderate usage
- Includes: 500 hours/month, HTTPS, automatic deployments

### Render (Free Plan)
- **Free tier**: Available with limitations
- Spins down after inactivity
- **Paid**: $7/month for always-on

### Google Cloud Run
- **Free tier**: 2 million requests/month
- **Estimated cost**: $0-5/month for light usage
- Pay only for actual usage

## Support and Resources

- **DBNet Paper**: https://arxiv.org/abs/1911.08947
- **PaddleOCR Docs**: https://github.com/PaddlePaddle/PaddleOCR
- **Service README**: `dbnet-service/README.md`
- **Issues**: Check project's GitHub issues

## Next Steps

After successful setup:

1. Test with various PowerPoint styles
2. Fine-tune detection parameters for your use case
3. Monitor performance and adjust resources
4. Consider enabling GPU for faster processing
5. Set up monitoring/alerting for production use

---

**Setup complete!** DBNet should now be integrated into your PowerPoint OCR system.
