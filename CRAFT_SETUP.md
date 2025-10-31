# CRAFT Text Detection Setup Guide

This guide will help you set up CRAFT (Character Region Awareness for Text detection) to enhance text detection accuracy in your PowerPoint converter.

## What is CRAFT?

CRAFT is a state-of-the-art text detection model that excels at finding text regions in images. When combined with Claude Vision, it provides:

- **Better accuracy** for dense text and complex layouts
- **Improved detection** of small text and multi-column content
- **Complementary results** that fill gaps in Claude-only detection

## Quick Start

### Prerequisites

Choose ONE of the following:
- Docker (recommended for simplicity)
- Python 3.8+ with pip (for custom deployment)

### Step 1: Start CRAFT Service

Navigate to the craft-service directory and run the startup script:

**Linux/Mac:**
```bash
cd craft-service
./start-craft.sh
```

**Windows:**
```cmd
cd craft-service
start-craft.bat
```

Follow the interactive prompts to choose your preferred method:
1. Docker with pre-built image (easiest)
2. Docker with custom image (most control)
3. Python direct (no Docker needed)

### Step 2: Configure Environment

After starting the CRAFT service, set the service URL:

**Linux/Mac:**
```bash
export CRAFT_SERVICE_URL=http://localhost:8080
# Or for Docker pre-built:
export CRAFT_SERVICE_URL=http://localhost:8500
```

**Windows (Command Prompt):**
```cmd
set CRAFT_SERVICE_URL=http://localhost:8080
```

**Windows (PowerShell):**
```powershell
$env:CRAFT_SERVICE_URL="http://localhost:8080"
```

### Step 3: Enable Hybrid Detection

Update your `.env` file in the project root:

```env
VITE_USE_HYBRID_DETECTION=true
```

### Step 4: Configure Supabase Edge Functions

For local development with Supabase, the edge function needs to access your CRAFT service.

Create or update `supabase/.env.local`:
```env
CRAFT_SERVICE_URL=http://host.docker.internal:8080
```

Note: Use `host.docker.internal` when your Supabase edge functions run in Docker.

### Step 5: Start Your Application

```bash
npm run dev
```

Now when you convert PowerPoint files, the system will use both Claude Vision and CRAFT for improved accuracy!

## Verification

### Test CRAFT Service

Check if the service is running:

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "healthy",
  "craft_available": true,
  "model_loaded": false
}
```

Note: `model_loaded` will be `false` until the first detection request.

### Test Full Integration

1. Start the CRAFT service
2. Start your main application
3. Upload a test PowerPoint file
4. Check the console logs for CRAFT detection messages
5. In your Supabase database, query `detection_comparison` table to see statistics

## Deployment Methods

### Method 1: Pre-built Docker (Easiest)

**Advantages:**
- No setup required
- Pre-trained models included
- Runs immediately

**Disadvantages:**
- Less control over configuration
- Larger image size

**Usage:**
```bash
docker run --rm -d -p 8500:8500 bedapudi6788/keras-craft:generic-english
```

### Method 2: Custom FastAPI Docker

**Advantages:**
- Full control over code
- Easier to customize and debug
- Modern API with documentation

**Disadvantages:**
- Requires building the image
- Slightly more complex setup

**Usage:**
```bash
cd craft-service
docker build -t craft-service .
docker run --rm -d -p 8080:8080 craft-service
```

### Method 3: Direct Python Service

**Advantages:**
- No Docker required
- Easy to modify and test
- Can use GPU if available

**Disadvantages:**
- Requires Python environment setup
- Manual dependency management

**Usage:**
```bash
cd craft-service
pip install -r requirements.txt
python main.py
```

## Production Deployment

### Option A: Same Server as Main App

Deploy the CRAFT Docker container on the same server as your main application:

```bash
# Start CRAFT service
docker run -d \
  --name craft-service \
  --restart unless-stopped \
  -p 8080:8080 \
  craft-service

# Configure Supabase secret
supabase secrets set CRAFT_SERVICE_URL=http://localhost:8080
```

### Option B: Separate Server

Deploy CRAFT on a dedicated server for better resource isolation:

```bash
# On CRAFT server
docker run -d \
  --name craft-service \
  --restart unless-stopped \
  -p 8080:8080 \
  craft-service

# Configure Supabase secret with internal network address
supabase secrets set CRAFT_SERVICE_URL=http://internal-craft-server:8080
```

### Option C: Cloud Platform

Deploy to a cloud platform like Railway, Render, or similar:

1. Push the `craft-service` directory to a GitHub repository
2. Connect the repository to your cloud platform
3. Configure port 8080
4. Get the deployment URL
5. Set Supabase secret: `supabase secrets set CRAFT_SERVICE_URL=https://your-craft-service.com`

## Performance Tuning

### Memory Optimization

If you encounter memory issues, reduce the processing size in `craft-service/main.py`:

```python
craft_model = Craft(
    output_dir=None,
    crop_type="poly",
    cuda=False,
    long_size=960  # Reduce from 1280 to 960 or 640
)
```

### GPU Acceleration

To use GPU (if available):

1. Install CUDA-enabled PyTorch
2. Update `craft-service/main.py`:
```python
craft_model = Craft(
    output_dir=None,
    crop_type="poly",
    cuda=True,  # Enable GPU
    long_size=1280
)
```

### Docker Resource Limits

Limit Docker container resources:

```bash
docker run -d \
  --name craft-service \
  --memory="2g" \
  --cpus="2" \
  -p 8080:8080 \
  craft-service
```

## Troubleshooting

### CRAFT service not responding

1. Check if the container is running:
   ```bash
   docker ps
   ```

2. Check container logs:
   ```bash
   docker logs craft-service
   ```

3. Test the health endpoint:
   ```bash
   curl http://localhost:8080/health
   ```

### Edge function can't reach CRAFT service

**Symptom:** Edge function logs show "CRAFT_SERVICE_URL not configured" or connection errors.

**Solutions:**

1. **Local Development:** Use `http://host.docker.internal:8080` if edge functions run in Docker
2. **Production:** Ensure the CRAFT service URL is accessible from Supabase cloud
3. **Firewall:** Check that port 8080 is open and accessible

### Python dependencies not installing

**Error:** `Failed to install craft-text-detector`

**Solution:**
```bash
# Install system dependencies first (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y libgl1-mesa-glx libglib2.0-0

# Then install Python packages
pip install -r requirements.txt
```

### Out of memory errors

**Symptom:** CRAFT service crashes or returns empty results

**Solutions:**

1. Reduce processing size (see Performance Tuning above)
2. Increase Docker memory limit
3. Process fewer slides concurrently
4. Use a machine with more RAM (minimum 4GB recommended)

### Hybrid detection not working

**Checklist:**

1. ✓ CRAFT service is running and healthy
2. ✓ `VITE_USE_HYBRID_DETECTION=true` in `.env`
3. ✓ `CRAFT_SERVICE_URL` configured in Supabase secrets
4. ✓ Edge function deployed with latest code
5. ✓ No firewall blocking the connection

### Detection quality issues

If hybrid detection doesn't improve results:

1. Check `detection_comparison` table in database for statistics
2. Verify CRAFT is detecting boxes (check `craft_count` column)
3. Review merge logic in `src/lib/detection-merger.ts`
4. Adjust confidence thresholds if needed

## Monitoring

### Check Detection Statistics

Query your Supabase database:

```sql
SELECT
  s.slide_number,
  dc.claude_count,
  dc.craft_count,
  dc.merged_count,
  dc.overlap_count,
  dc.merge_duration_ms
FROM detection_comparison dc
JOIN slides s ON s.id = dc.slide_id
ORDER BY s.slide_number;
```

### Performance Metrics

Track CRAFT processing time:

```sql
SELECT
  AVG(merge_duration_ms) as avg_merge_time,
  MIN(merge_duration_ms) as min_merge_time,
  MAX(merge_duration_ms) as max_merge_time
FROM detection_comparison;
```

## Disabling CRAFT

To temporarily disable CRAFT without stopping the service:

Update `.env`:
```env
VITE_USE_HYBRID_DETECTION=false
```

Or remove the Supabase secret:
```bash
supabase secrets unset CRAFT_SERVICE_URL
```

The system will gracefully fall back to Claude-only detection.

## Cost Considerations

### Resource Usage

- **CPU:** Moderate (1-2 cores recommended)
- **Memory:** 1-2GB minimum, 4GB recommended
- **Disk:** ~500MB for models
- **Network:** Minimal (images sent as base64)

### Processing Time

- **Cold start:** 5-10 seconds (first request)
- **Warm requests:** 100-500ms per slide
- **Total impact:** Adds ~200-400ms per slide to conversion time

### Cloud Hosting Estimates

- **Railway:** ~$5-10/month for light usage
- **Render:** Free tier possible, $7/month for always-on
- **DigitalOcean Droplet:** $6/month (basic), $12/month (recommended)
- **AWS EC2 t3.small:** ~$15/month

## Support

If you encounter issues:

1. Check the logs in `craft-service/` directory
2. Verify network connectivity between services
3. Review Supabase Edge Function logs
4. Check database for detection comparison data

For more details, see:
- [craft-service/README.md](./craft-service/README.md) - CRAFT service documentation
- [README.md](./README.md) - Main application documentation
