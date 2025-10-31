# CRAFT Service Diagnostic Report

**Date:** 2025-10-28
**Status:** ❌ CRAFT Service Not Available

## Test Results

### 1. Local Docker Service (Port 8500)
- **Status:** ❌ Not Running
- **Test:** `http://localhost:8500/health`
- **Result:** Connection refused
- **Conclusion:** Docker container not started

### 2. Local FastAPI Service (Port 8080)
- **Status:** ❌ Not Running
- **Test:** `http://localhost:8080/health`
- **Result:** Connection refused
- **Conclusion:** FastAPI service not running

### 3. Supabase Edge Function
- **Status:** ⚠️ Responding (but CRAFT backend unavailable)
- **Test:** `POST /functions/v1/craft-detect`
- **Result:**
  ```json
  {
    "boxes": [],
    "processingTimeMs": 54,
    "error": "CRAFT service returned 502",
    "message": "Falling back to empty detection"
  }
  ```
- **Conclusion:** Edge function works, but CRAFT_SERVICE_URL points to unavailable service (502 Bad Gateway)

## Root Cause Analysis

The edge function is configured with a `CRAFT_SERVICE_URL` that returns HTTP 502. This typically means:

1. **CRAFT service was deployed but is now down** (crashed, stopped, or resource limits exceeded)
2. **URL is configured but points to non-existent service**
3. **Service is starting up but not ready yet**

## Impact on Application

✅ **Application Still Works!**
- The system automatically falls back to Claude-only detection
- No crashes or errors in the UI
- Conversions complete successfully
- Only missing: CRAFT's improved text detection accuracy

## Solutions (Choose One)

### Option 1: Use Claude-Only Mode (Recommended for Now)

**Easiest and works well:**

1. Open your application
2. Click the Settings icon (⚙️) in top-right corner
3. Turn **OFF** "Hybrid Detection"
4. Continue using the app normally

**Benefits:**
- Immediate fix
- No infrastructure setup needed
- Claude Vision provides excellent results on its own
- Just fixed the duplicate text issue, so quality is improved

---

### Option 2: Start Local Docker CRAFT Service

**For development/testing:**

```bash
# Pull and run CRAFT Docker image
docker run -d -p 8500:8500 bedapudi6788/keras-craft:generic-english

# Wait ~1 minute for model to load
# Test health:
curl http://localhost:8500/health
```

**Note:** This works for local testing, but Supabase edge functions run in the cloud and can't reach your localhost.

---

### Option 3: Deploy CRAFT to Railway (Production Solution)

**For production use with hybrid detection:**

#### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. It's free for hobby projects

#### Step 2: Deploy CRAFT Service

**Option A: Use Dockerfile**
1. Push `craft-service/` directory to a GitHub repo
2. In Railway: "New Project" → "Deploy from GitHub"
3. Select your repo
4. Railway auto-detects Dockerfile and deploys

**Option B: Use Docker Image**
1. In Railway: "New Project" → "Docker Image"
2. Image: `bedapudi6788/keras-craft:generic-english`
3. Expose port: 8500

#### Step 3: Get Public URL
1. After deployment, Railway provides a URL like:
   - `your-app.up.railway.app`
2. Copy this URL

#### Step 4: Configure Supabase Secret

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref jrpyodkmmzqzogwjrnvh

# Set the CRAFT service URL
supabase secrets set CRAFT_SERVICE_URL=https://your-app.up.railway.app
```

#### Step 5: Enable in App
1. Open Settings UI
2. Turn ON "Hybrid Detection"
3. Turn ON "CRAFT-Primary Mode"
4. Upload a test PowerPoint

---

### Option 4: Start Local FastAPI Service

**For development with more control:**

```bash
cd craft-service

# Install dependencies
pip install -r requirements.txt

# Start service
python main.py

# Service runs on http://localhost:8080
```

**Test it:**
```bash
curl http://localhost:8080/health
```

Again, this only works for local development. For the app to use it, you'd need to run Supabase functions locally:

```bash
# In another terminal
supabase functions serve --env-file .env

# Then update frontend to call localhost edge function
```

---

## Recommended Path

### For Immediate Use:
1. ✅ **Disable CRAFT in Settings UI** (2 clicks)
2. ✅ Use Claude-only mode (works great)
3. ✅ App is fully functional

### For Future (If You Want CRAFT):
1. Deploy CRAFT to Railway (~10 minutes)
2. Set `CRAFT_SERVICE_URL` secret in Supabase
3. Enable CRAFT in Settings UI
4. Get improved text detection accuracy

## Testing Script

I've created a diagnostic script you can run anytime:

```bash
# Run diagnostic
./test-craft-service.py

# Or the bash version
./test-craft.sh
```

These scripts test:
- Local Docker service (port 8500)
- Local FastAPI service (port 8080)
- Supabase edge function connectivity
- Provides clear recommendations

## Additional Resources

- **CRAFT_SETUP.md** - Detailed deployment instructions
- **CRAFT_STATUS.md** - Understanding CRAFT service states
- **DUPLICATE_TEXT_FIX.md** - Recent improvements to Claude detection
- **SETTINGS_UI.md** - How to use the settings panel

## Current Configuration

Based on edge function code, it checks for:
1. `CRAFT_URL` environment variable
2. `CRAFT_SERVICE_URL` environment variable (fallback)

One of these is set but points to a service returning 502.

To check current secret:
```bash
supabase secrets list
```

To unset (force Claude-only):
```bash
supabase secrets unset CRAFT_SERVICE_URL
supabase secrets unset CRAFT_URL
```

## Summary

**Bottom Line:** Your app works perfectly without CRAFT. The Settings UI now lets you toggle CRAFT on/off easily. For most users, Claude-only mode provides excellent results, especially after the duplicate text fix we just implemented.

If you want the absolute best text detection accuracy and don't mind setting up infrastructure, deploy CRAFT to Railway and configure it. Otherwise, you're good to go with Claude-only!
