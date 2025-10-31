# CRAFT Detection Status

## Current Situation

Based on the console logs, your application is **trying to use CRAFT** but the CRAFT service is **not running or not configured**.

### What's Happening:

1. ✅ Hybrid detection is **enabled** (`VITE_USE_HYBRID_DETECTION=true`)
2. ✅ The frontend is **calling** the CRAFT edge function
3. ❌ The CRAFT edge function is **timing out** (504 Gateway Timeout)
4. ❌ CRAFT service is **not running** or **CRAFT_SERVICE_URL not configured**

### Console Evidence:

```
POST https://jrpyodkmmzqzogwjrnvh.supabase.co/functions/v1/craft-detect net::ERR_FAILED 504 (Gateway Timeout)
CRAFT detection error: TypeError: Failed to fetch
⚠ CRAFT detection failed or returned no results: Failed to fetch
Falling back to Claude-only detection
```

The timeout (152 seconds!) suggests the edge function waited a long time before giving up.

## Solution Options

### Option 1: Disable CRAFT (Quick Fix)

If you don't want to use CRAFT right now, simply disable hybrid detection:

**Update `.env`:**
```env
VITE_USE_HYBRID_DETECTION=false
```

Then restart your dev server (`npm run dev`).

This will make your application work exactly as before, using only Claude Vision for text detection.

### Option 2: Start CRAFT Service (Enable Hybrid Detection)

To actually use CRAFT and get improved detection accuracy:

#### Step 1: Start the CRAFT Service

**Option A - Docker (Easiest):**
```bash
docker run --rm -d -p 8500:8500 bedapudi6788/keras-craft:generic-english
```

**Option B - FastAPI (More Control):**
```bash
cd craft-service
pip install -r requirements.txt
python main.py
```

**Option C - Use the Startup Script:**
```bash
cd craft-service
./start-craft.sh  # Linux/Mac
# or
start-craft.bat   # Windows
```

#### Step 2: Configure Supabase Edge Function

The edge function needs to know where to find your CRAFT service. Since you're running Supabase Edge Functions in the cloud, you need to either:

**A) Run CRAFT on a public server:**
- Deploy CRAFT service to a cloud platform (Railway, Render, etc.)
- Get the public URL
- Set Supabase secret: `supabase secrets set CRAFT_SERVICE_URL=https://your-craft-service.com`

**B) Use Supabase local development:**
- Run Supabase functions locally with `supabase functions serve`
- Set local environment variable pointing to localhost CRAFT service
- See CRAFT_SETUP.md for detailed instructions

## Why This Happens

Your Supabase Edge Functions run on Supabase's cloud infrastructure, not on your local machine. When the edge function tries to call the CRAFT service:

1. If `CRAFT_SERVICE_URL` is not set → Returns empty boxes immediately
2. If `CRAFT_SERVICE_URL` points to localhost → Can't reach it (localhost means Supabase's server, not yours)
3. If `CRAFT_SERVICE_URL` points to unreachable service → Times out after 30 seconds

## Current Workaround (Already Implemented)

The good news: Your application **gracefully handles CRAFT failure**!

When CRAFT fails, it:
- ✅ Falls back to Claude-only detection
- ✅ Still completes the conversion successfully
- ✅ Logs helpful messages to the console

So your conversion is working, just without the benefit of hybrid detection.

## Recommendations

### For Development/Testing:

**Use Claude-only mode** (disable CRAFT):
```env
VITE_USE_HYBRID_DETECTION=false
```

This is simpler and Claude Vision alone provides good results.

### For Production/Advanced Use:

**Deploy CRAFT service** and configure it properly:

1. Choose a deployment method (Docker recommended)
2. Deploy to a platform with a public URL
3. Configure `CRAFT_SERVICE_URL` in Supabase secrets
4. Test with a sample conversion

See **CRAFT_SETUP.md** for complete deployment instructions.

## Testing CRAFT Service

If you start the CRAFT service locally, test it with:

```bash
# Health check
curl http://localhost:8080/health

# Expected response:
# {"status":"healthy","craft_available":true,"model_loaded":false}
```

## Need Help?

1. Check CRAFT_SETUP.md for detailed setup instructions
2. Check craft-service/README.md for API documentation
3. Review console logs for specific error messages

## Quick Decision Tree

```
Do you need CRAFT's improved accuracy?
│
├─ No  → Set VITE_USE_HYBRID_DETECTION=false
│         You're done! Claude-only works great.
│
└─ Yes → Need to deploy CRAFT service
          │
          ├─ Just testing locally?
          │  → Run: docker run -p 8500:8500 bedapudi6788/keras-craft:generic-english
          │  → Use Supabase local functions
          │
          └─ Production deployment?
             → Deploy CRAFT to cloud platform
             → Configure CRAFT_SERVICE_URL secret
             → See CRAFT_SETUP.md
```

---

**Current Status: Application works fine in Claude-only mode. CRAFT is optional.**
