#!/usr/bin/env python3
"""
CRAFT Service Diagnostic Tool

This script tests if the CRAFT text detection service is running and accessible.
"""

import sys
import base64
import json
from pathlib import Path

try:
    import requests
    print("✓ requests module available")
except ImportError:
    print("✗ requests module not found")
    print("  Install with: pip install requests")
    sys.exit(1)

# Try importing craft_client
try:
    import craft_client
    print("✓ craft_client module available")
    CRAFT_CLIENT_AVAILABLE = True
except ImportError:
    print("⚠ craft_client not available (optional)")
    print("  Install with: pip install git+https://github.com/notAI-tech/keras-craft")
    CRAFT_CLIENT_AVAILABLE = False

print("\n" + "="*60)
print("CRAFT SERVICE DIAGNOSTIC")
print("="*60)

# Test configurations to try
test_configs = [
    {
        "name": "Local Docker (port 8500)",
        "url": "http://localhost:8500/detect",
        "description": "Docker container running locally"
    },
    {
        "name": "Local FastAPI (port 8080)",
        "url": "http://localhost:8080/detect",
        "description": "FastAPI service running locally"
    },
    {
        "name": "Railway (if configured)",
        "url": None,  # Will prompt user
        "description": "Cloud deployment on Railway.app"
    }
]

def create_test_image():
    """Create a small test image (1x1 white pixel) in base64"""
    # 1x1 white PNG image
    png_bytes = base64.b64decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    )
    return base64.b64encode(png_bytes).decode('utf-8')

def test_craft_service(url, timeout=10):
    """Test if CRAFT service is responding"""
    print(f"\nTesting: {url}")
    print("-" * 60)

    try:
        # Test health endpoint first if available
        health_url = url.replace('/detect', '/health')
        try:
            health_response = requests.get(health_url, timeout=5)
            if health_response.ok:
                print(f"✓ Health check passed: {health_response.status_code}")
                try:
                    health_data = health_response.json()
                    print(f"  Status: {health_data}")
                except:
                    print(f"  Response: {health_response.text[:200]}")
        except requests.exceptions.RequestException:
            print("⚠ No /health endpoint (this is okay)")

        # Test detection endpoint
        test_image = create_test_image()
        payload = {
            "image": test_image,
            "mime_type": "image/png",
            "width": 1,
            "height": 1
        }

        print(f"\nSending detection request...")
        response = requests.post(
            url,
            json=payload,
            timeout=timeout,
            headers={"Content-Type": "application/json"}
        )

        print(f"Status Code: {response.status_code}")

        if response.ok:
            print("✓ CRAFT service is RESPONDING")
            try:
                data = response.json()
                print(f"  Boxes detected: {len(data.get('boxes', []))}")
                print(f"  Response keys: {list(data.keys())}")
                return True
            except json.JSONDecodeError:
                print(f"  Response (non-JSON): {response.text[:200]}")
                return True
        else:
            print(f"✗ Service returned error: {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            return False

    except requests.exceptions.Timeout:
        print(f"✗ Request TIMEOUT (>{timeout}s)")
        print("  Service may be running but too slow, or not responding")
        return False
    except requests.exceptions.ConnectionError as e:
        print(f"✗ Connection FAILED")
        print(f"  Error: {str(e)[:200]}")
        print("  Service is NOT running at this URL")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {type(e).__name__}")
        print(f"  {str(e)[:200]}")
        return False

def test_craft_client(service_url, port=443, use_https=True):
    """Test using craft_client library"""
    if not CRAFT_CLIENT_AVAILABLE:
        return False

    print(f"\nTesting with craft_client library...")
    print("-" * 60)

    try:
        craft_client.configure(service_url, port, use_https)
        print(f"✓ Configured craft_client: {service_url}:{port} (https={use_https})")

        # Create a test image file
        test_image_path = "/tmp/craft_test.png"
        png_bytes = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
        )
        with open(test_image_path, 'wb') as f:
            f.write(png_bytes)

        print(f"Detecting text in test image...")
        result = craft_client.detect([test_image_path])
        print(f"✓ craft_client detection successful")
        print(f"  Result: {result}")
        return True

    except Exception as e:
        print(f"✗ craft_client failed: {type(e).__name__}")
        print(f"  {str(e)[:200]}")
        return False

def main():
    print("\n1. Testing common CRAFT service endpoints...")
    print("="*60)

    service_found = False

    # Test local endpoints
    for config in test_configs[:2]:  # Local configs
        if test_craft_service(config["url"]):
            service_found = True
            print(f"\n✓✓✓ FOUND WORKING SERVICE: {config['name']} ✓✓✓")
            break

    # Ask about Railway deployment
    if not service_found:
        print("\n" + "="*60)
        print("2. Testing Railway deployment (if available)...")
        print("="*60)
        railway_url = input("\nEnter your Railway app URL (or press Enter to skip): ").strip()

        if railway_url:
            # Clean up URL
            railway_url = railway_url.replace('http://', '').replace('https://', '')
            full_url = f"https://{railway_url}/detect"

            if test_craft_service(full_url):
                service_found = True
                print(f"\n✓✓✓ FOUND WORKING SERVICE: Railway ✓✓✓")

                # Test with craft_client if available
                if CRAFT_CLIENT_AVAILABLE:
                    print("\n" + "="*60)
                    print("3. Testing with craft_client library...")
                    print("="*60)
                    test_craft_client(railway_url, 443, True)

    # Final summary
    print("\n" + "="*60)
    print("DIAGNOSTIC SUMMARY")
    print("="*60)

    if service_found:
        print("\n✓✓✓ CRAFT SERVICE IS RUNNING AND ACCESSIBLE ✓✓✓")
        print("\nNext steps:")
        print("1. Note the working URL above")
        print("2. Set it as a Supabase secret:")
        print("   supabase secrets set CRAFT_SERVICE_URL=<your-url>")
        print("3. Enable CRAFT in your app settings UI")
    else:
        print("\n✗✗✗ NO CRAFT SERVICE FOUND ✗✗✗")
        print("\nOptions to fix this:")
        print("\n1. Start local Docker service:")
        print("   docker run -d -p 8500:8500 bedapudi6788/keras-craft:generic-english")
        print("\n2. Start local FastAPI service:")
        print("   cd craft-service && python main.py")
        print("\n3. Deploy to Railway:")
        print("   - See CRAFT_SETUP.md for instructions")
        print("   - Railway provides a public URL for your service")
        print("\n4. Disable CRAFT in app:")
        print("   - Open Settings UI (gear icon)")
        print("   - Turn off 'Hybrid Detection'")
        print("   - App will use Claude-only mode")

if __name__ == "__main__":
    main()
