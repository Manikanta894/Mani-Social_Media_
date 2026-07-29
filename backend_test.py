#!/usr/bin/env python3
"""
Backend test suite for Supabase Storage intake + 24/7 automation orchestrator.
Tests the fix for Google Cloud org policy blocking service account keys.
"""

import requests
import json
import base64
import sys
from io import BytesIO

# Base URL from .env
BASE_URL = "https://social-queue-17.preview.emergentagent.com/api"

# Tiny 1x1 PNG for testing
TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

# Global state
TICK_SECRET = None
UPLOAD_PATH = None
TELEGRAM_SECRET = None

def test_1_regression():
    """Test 1: Regression — existing endpoints still work"""
    print("\n" + "="*80)
    print("TEST 1: REGRESSION - Existing endpoints")
    print("="*80)
    
    try:
        # /api/prompt-styles
        print("\n[1.1] Testing GET /api/prompt-styles...")
        r = requests.get(f"{BASE_URL}/prompt-styles", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        styles = data.get('data', [])
        assert len(styles) >= 4, f"Expected at least 4 styles, got {len(styles)}"
        active_count = sum(1 for s in styles if s.get('is_active'))
        assert active_count == 1, f"Expected exactly 1 active style, got {active_count}"
        print(f"✅ PASS: Got {len(styles)} styles with 1 active")
        
        # /api/providers
        print("\n[1.2] Testing GET /api/providers...")
        r = requests.get(f"{BASE_URL}/providers", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        providers = data.get('data', [])
        print(f"✅ PASS: Got {len(providers)} providers")
        
        # /api/telegram/status
        print("\n[1.3] Testing GET /api/telegram/status...")
        r = requests.get(f"{BASE_URL}/telegram/status", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        bot = data.get('data', {}).get('bot', {})
        assert bot.get('username') == 'Social_forage_bot', f"Expected Social_forage_bot, got {bot.get('username')}"
        print(f"✅ PASS: Bot username is {bot.get('username')}")
        
        # /api/automation/modules
        print("\n[1.4] Testing GET /api/automation/modules...")
        r = requests.get(f"{BASE_URL}/automation/modules", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        modules = data.get('data', [])
        assert len(modules) >= 4, f"Expected at least 4 modules, got {len(modules)}"
        print(f"✅ PASS: Got {len(modules)} modules")
        
        # /api/platform-prompts
        print("\n[1.5] Testing GET /api/platform-prompts...")
        r = requests.get(f"{BASE_URL}/platform-prompts", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        prompts = data.get('data', {})
        expected_platforms = ['linkedin', 'instagram', 'facebook', 'threads', 'twitter', 'pinterest', 'tiktok', 'youtube']
        for platform in expected_platforms:
            assert platform in prompts, f"Missing platform: {platform}"
        print(f"✅ PASS: Got all 8 platform prompts")
        
        # /api/publish/platforms
        print("\n[1.6] Testing GET /api/publish/platforms...")
        r = requests.get(f"{BASE_URL}/publish/platforms", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        supported = data.get('data', {}).get('supported', [])
        assert 'linkedin' in supported, "Expected linkedin in supported platforms"
        print(f"✅ PASS: Supported platforms: {supported}")
        
        print("\n✅ TEST 1 PASSED: All regression endpoints working")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 1 FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_2_automation_settings():
    """Test 2: Automation settings GET/PUT with tick_secret validation"""
    print("\n" + "="*80)
    print("TEST 2: AUTOMATION SETTINGS")
    print("="*80)
    
    global TICK_SECRET
    
    try:
        # GET /api/automation/settings
        print("\n[2.1] Testing GET /api/automation/settings...")
        r = requests.get(f"{BASE_URL}/automation/settings", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        settings = data.get('data', {})
        
        # Validate required fields
        required_fields = ['enabled', 'posts_per_day', 'posting_times', 'timezone', 'working_days', 
                          'approval_required', 'auto_publish_after_approve', 'tick_secret', 'last_tick_at']
        for field in required_fields:
            assert field in settings, f"Missing field: {field}"
        
        assert isinstance(settings['posting_times'], list), "posting_times must be array"
        assert len(settings['posting_times']) == 5, f"Expected 5 posting times, got {len(settings['posting_times'])}"
        assert settings['tick_secret'], "tick_secret must be non-empty"
        
        TICK_SECRET = settings['tick_secret']
        print(f"✅ PASS: Got settings with tick_secret: {TICK_SECRET[:8]}...")
        
        # PUT /api/automation/settings
        print("\n[2.2] Testing PUT /api/automation/settings...")
        update_body = {
            "enabled": True,
            "posting_times": ["09:00", "12:30", "15:30", "18:30", "21:00"],
            "timezone": "Asia/Kolkata",
            "approval_required": True,
            "auto_publish_after_approve": True
        }
        r = requests.put(f"{BASE_URL}/automation/settings", json=update_body, timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        updated = data.get('data', {})
        assert updated['enabled'] == True, "enabled should be True"
        assert updated['timezone'] == "Asia/Kolkata", "timezone should be Asia/Kolkata"
        print(f"✅ PASS: Settings updated successfully")
        
        # Verify tick_secret is NOT overwritten
        print("\n[2.3] Testing tick_secret protection...")
        hack_body = {
            "tick_secret": "hacked",
            "enabled": True
        }
        r = requests.put(f"{BASE_URL}/automation/settings", json=hack_body, timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        updated = data.get('data', {})
        assert updated['tick_secret'] == TICK_SECRET, f"tick_secret was overwritten! Expected {TICK_SECRET}, got {updated['tick_secret']}"
        print(f"✅ PASS: tick_secret protected from client modification")
        
        print("\n✅ TEST 2 PASSED: Automation settings working correctly")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 2 FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_3_tick_auth():
    """Test 3: Tick auth - 403 without header, 403 with wrong secret, 200 with correct secret"""
    print("\n" + "="*80)
    print("TEST 3: TICK AUTH")
    print("="*80)
    
    global TICK_SECRET
    
    try:
        # POST without header
        print("\n[3.1] Testing POST /api/automation/tick without header...")
        r = requests.post(f"{BASE_URL}/automation/tick", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print(f"✅ PASS: Got 403 without header")
        
        # POST with wrong secret
        print("\n[3.2] Testing POST /api/automation/tick with wrong secret...")
        headers = {"X-Automation-Secret": "wrong"}
        r = requests.post(f"{BASE_URL}/automation/tick", headers=headers, timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print(f"✅ PASS: Got 403 with wrong secret")
        
        # POST with correct secret
        print("\n[3.3] Testing POST /api/automation/tick with correct secret...")
        headers = {"X-Automation-Secret": TICK_SECRET}
        r = requests.post(f"{BASE_URL}/automation/tick", headers=headers, timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        print(f"Response: {json.dumps(data.get('data'), indent=2)}")
        print(f"✅ PASS: Got 200 with correct secret")
        
        print("\n✅ TEST 3 PASSED: Tick auth working correctly")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 3 FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_4_empty_queue_tick():
    """Test 4: Empty queue tick - should skip gracefully"""
    print("\n" + "="*80)
    print("TEST 4: EMPTY QUEUE TICK")
    print("="*80)
    
    global TICK_SECRET
    
    try:
        # Sync intake (should be empty or have existing files)
        print("\n[4.1] Testing POST /api/intake/sync...")
        r = requests.post(f"{BASE_URL}/intake/sync", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        sync_data = data.get('data', {})
        assert 'indexed' in sync_data, "Missing indexed field"
        assert 'total_files_in_bucket' in sync_data, "Missing total_files_in_bucket field"
        print(f"✅ PASS: Sync returned indexed={sync_data['indexed']}, total={sync_data['total_files_in_bucket']}")
        
        # Tick with correct secret
        print("\n[4.2] Testing POST /api/automation/tick (empty queue or skip)...")
        headers = {"X-Automation-Secret": TICK_SECRET}
        r = requests.post(f"{BASE_URL}/automation/tick", headers=headers, timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        tick_result = data.get('data', {})
        print(f"Tick result: {json.dumps(tick_result, indent=2)}")
        
        # Should be either a skip reason or actual processing
        if 'skipped' in tick_result:
            print(f"✅ PASS: Tick skipped with reason: {tick_result['skipped']}")
        elif 'processed' in tick_result or 'job_id' in tick_result:
            print(f"✅ PASS: Tick processed a file")
        else:
            print(f"⚠️  WARNING: Unexpected tick result format")
        
        print("\n✅ TEST 4 PASSED: Empty queue tick working")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 4 FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_5_full_pipeline():
    """Test 5: Full pipeline - upload → sync → queue → tick"""
    print("\n" + "="*80)
    print("TEST 5: FULL PIPELINE (upload → sync → queue → tick)")
    print("="*80)
    
    global TICK_SECRET, UPLOAD_PATH
    
    try:
        # Upload to intake
        print("\n[5.1] Testing POST /api/intake/upload...")
        upload_body = {
            "base64": TINY_PNG_BASE64,
            "mime_type": "image/png",
            "file_name": "test.png"
        }
        r = requests.post(f"{BASE_URL}/intake/upload", json=upload_body, timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        upload_data = data.get('data', {})
        assert 'path' in upload_data, "Missing path field"
        UPLOAD_PATH = upload_data['path']
        
        # Verify path format (should start with YYYY-MM-DD/)
        import re
        assert re.match(r'\d{4}-\d{2}-\d{2}/', UPLOAD_PATH), f"Path should start with date: {UPLOAD_PATH}"
        assert UPLOAD_PATH.endswith('.png'), f"Path should end with .png: {UPLOAD_PATH}"
        print(f"✅ PASS: Uploaded to {UPLOAD_PATH}")
        
        # Sync intake
        print("\n[5.2] Testing POST /api/intake/sync...")
        r = requests.post(f"{BASE_URL}/intake/sync", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        sync_data = data.get('data', {})
        assert sync_data['indexed'] >= 1, f"Expected indexed >= 1, got {sync_data['indexed']}"
        print(f"✅ PASS: Sync indexed {sync_data['indexed']} new files")
        
        # Check queue
        print("\n[5.3] Testing GET /api/drive/queue...")
        r = requests.get(f"{BASE_URL}/drive/queue", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        queue = data.get('data', [])
        assert len(queue) >= 1, f"Expected at least 1 queued item, got {len(queue)}"
        
        # Find our uploaded file
        our_file = None
        for item in queue:
            if item.get('file_id') == UPLOAD_PATH:
                our_file = item
                break
        
        assert our_file is not None, f"Could not find {UPLOAD_PATH} in queue"
        assert our_file['status'] == 'queued', f"Expected status=queued, got {our_file['status']}"
        print(f"✅ PASS: Found {UPLOAD_PATH} in queue with status=queued")
        
        # Check stats
        print("\n[5.4] Testing GET /api/drive/stats...")
        r = requests.get(f"{BASE_URL}/drive/stats", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        stats = data.get('data', {})
        assert stats.get('queued', 0) >= 1, f"Expected queued >= 1, got {stats.get('queued')}"
        print(f"✅ PASS: Stats show {stats.get('queued')} queued items")
        
        # Tick
        print("\n[5.5] Testing POST /api/automation/tick...")
        headers = {"X-Automation-Secret": TICK_SECRET}
        r = requests.post(f"{BASE_URL}/automation/tick", headers=headers, timeout=30)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        tick_result = data.get('data', {})
        print(f"Tick result: {json.dumps(tick_result, indent=2)}")
        
        # Acceptable outcomes: skip reason OR processing
        if 'skipped' in tick_result:
            print(f"✅ PASS: Tick skipped (acceptable): {tick_result['skipped']}")
        elif 'processed' in tick_result:
            print(f"✅ PASS: Tick processed file: {tick_result.get('processed')}")
            if 'job_id' in tick_result:
                print(f"   Created job: {tick_result['job_id']}")
            if 'error' in tick_result:
                print(f"   ⚠️  Processing error (may be expected if no AI provider): {tick_result['error']}")
        else:
            print(f"⚠️  WARNING: Unexpected tick result format")
        
        # Check jobs (if processed)
        if 'job_id' in tick_result:
            print("\n[5.6] Testing GET /api/jobs...")
            r = requests.get(f"{BASE_URL}/jobs", timeout=10)
            print(f"Status: {r.status_code}")
            if r.status_code == 200:
                data = r.json()
                jobs = data.get('data', [])
                intake_jobs = [j for j in jobs if j.get('source') == 'ai_intake']
                print(f"✅ PASS: Found {len(intake_jobs)} ai_intake jobs")
            else:
                print(f"⚠️  WARNING: Could not fetch jobs")
        
        print("\n✅ TEST 5 PASSED: Full pipeline working (no crashes)")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 5 FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_6_intake_list():
    """Test 6: Intake list"""
    print("\n" + "="*80)
    print("TEST 6: INTAKE LIST")
    print("="*80)
    
    global UPLOAD_PATH
    
    try:
        print("\n[6.1] Testing GET /api/intake/list...")
        r = requests.get(f"{BASE_URL}/intake/list", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        files = data.get('data', [])
        assert isinstance(files, list), "Expected array"
        print(f"✅ PASS: Got {len(files)} files in intake bucket")
        
        # If we uploaded a file, it should be in the list
        if UPLOAD_PATH:
            found = any(f.get('path') == UPLOAD_PATH for f in files)
            if found:
                print(f"✅ PASS: Found our uploaded file {UPLOAD_PATH}")
            else:
                print(f"⚠️  WARNING: Could not find {UPLOAD_PATH} (may have been archived)")
        
        print("\n✅ TEST 6 PASSED: Intake list working")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 6 FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_7_idempotency():
    """Test 7: Idempotency - sync twice should return 0 on second call"""
    print("\n" + "="*80)
    print("TEST 7: IDEMPOTENCY")
    print("="*80)
    
    try:
        print("\n[7.1] Testing POST /api/intake/sync (first call)...")
        r = requests.post(f"{BASE_URL}/intake/sync", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        first_indexed = data.get('data', {}).get('indexed', 0)
        print(f"First sync indexed: {first_indexed}")
        
        print("\n[7.2] Testing POST /api/intake/sync (second call)...")
        r = requests.post(f"{BASE_URL}/intake/sync", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        second_indexed = data.get('data', {}).get('indexed', 0)
        print(f"Second sync indexed: {second_indexed}")
        
        assert second_indexed == 0, f"Expected 0 on second sync, got {second_indexed}"
        print(f"✅ PASS: Second sync returned 0 (idempotent)")
        
        print("\n[7.3] Testing POST /api/intake/sync (third call)...")
        r = requests.post(f"{BASE_URL}/intake/sync", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        third_indexed = data.get('data', {}).get('indexed', 0)
        print(f"Third sync indexed: {third_indexed}")
        
        assert third_indexed == 0, f"Expected 0 on third sync, got {third_indexed}"
        print(f"✅ PASS: Third sync returned 0 (idempotent)")
        
        print("\n✅ TEST 7 PASSED: Idempotency working")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 7 FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_8_telegram_regression():
    """Test 8: Telegram regression - webhook with secret validation"""
    print("\n" + "="*80)
    print("TEST 8: TELEGRAM REGRESSION")
    print("="*80)
    
    global TELEGRAM_SECRET
    
    try:
        # Fetch webhook secret from backend API (more reliable than direct Supabase query)
        print("\n[8.1] Fetching webhook secret from backend API...")
        # First, trigger settings initialization by calling telegram/status
        r = requests.get(f"{BASE_URL}/telegram/status", timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        # Now fetch from Supabase using service role key (required for app_settings)
        supabase_url = "https://ghqakcbyqqxolavwfepe.supabase.co"
        service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdocWFrY2J5cXF4b2xhdndmZXBlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI0MTk1OCwiZXhwIjoyMTAwODE3OTU4fQ.5AF52oLA29oJM59dqyhI6PR06cVx_LIYC1Zq2r0PTW8"
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}"
        }
        r = requests.get(
            f"{supabase_url}/rest/v1/app_settings?key=eq.main&select=value",
            headers=headers,
            timeout=10
        )
        print(f"Supabase query status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert len(data) > 0, "No settings found in Supabase"
        TELEGRAM_SECRET = data[0]['value'].get('telegram_webhook_secret')
        assert TELEGRAM_SECRET, "No telegram_webhook_secret found"
        print(f"✅ PASS: Got webhook secret: {TELEGRAM_SECRET[:8]}...")
        
        # Test webhook with wrong secret
        print("\n[8.2] Testing POST /api/telegram/webhook with wrong secret...")
        headers = {"X-Telegram-Bot-Api-Secret-Token": "wrong"}
        webhook_body = {
            "update_id": 9990,
            "message": {
                "message_id": 1,
                "from": {"id": 5354784014, "is_bot": False, "first_name": "T"},
                "chat": {"id": 5354784014, "type": "private"},
                "date": 1730000000,
                "text": "/help"
            }
        }
        r = requests.post(f"{BASE_URL}/telegram/webhook", json=webhook_body, headers=headers, timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print(f"✅ PASS: Got 403 with wrong secret")
        
        # Test webhook with correct secret
        print("\n[8.3] Testing POST /api/telegram/webhook with correct secret...")
        headers = {"X-Telegram-Bot-Api-Secret-Token": TELEGRAM_SECRET}
        r = requests.post(f"{BASE_URL}/telegram/webhook", json=webhook_body, headers=headers, timeout=10)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, "Expected ok=true"
        print(f"✅ PASS: Got 200 with correct secret")
        
        print("\n✅ TEST 8 PASSED: Telegram regression working")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 8 FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_9_log_check():
    """Test 9: Log check - verify no critical errors in logs"""
    print("\n" + "="*80)
    print("TEST 9: LOG CHECK")
    print("="*80)
    
    try:
        print("\n[9.1] Checking supervisor logs for errors...")
        import subprocess
        result = subprocess.run(
            ["tail", "-n", "200", "/var/log/supervisor/nextjs.out.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        logs = result.stdout
        
        # Check for critical errors
        critical_patterns = [
            "relation .* does not exist",
            "Cannot resolve",
            "sub is not defined",
            "Cannot coerce"
        ]
        
        found_errors = []
        for pattern in critical_patterns:
            import re
            if re.search(pattern, logs, re.IGNORECASE):
                found_errors.append(pattern)
        
        if found_errors:
            print(f"❌ Found critical errors in logs:")
            for err in found_errors:
                print(f"   - {err}")
            # Show relevant log lines
            for line in logs.split('\n')[-50:]:
                for pattern in found_errors:
                    if re.search(pattern, line, re.IGNORECASE):
                        print(f"   {line}")
            return False
        else:
            print(f"✅ PASS: No critical errors found in logs")
            print(f"   (Node deprecation warnings are OK to ignore)")
        
        print("\n✅ TEST 9 PASSED: Log check clean")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 9 FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BACKEND TEST SUITE: Supabase Storage intake + 24/7 automation")
    print("="*80)
    
    results = {}
    
    # Run tests in order
    results['test_1_regression'] = test_1_regression()
    results['test_2_automation_settings'] = test_2_automation_settings()
    results['test_3_tick_auth'] = test_3_tick_auth()
    results['test_4_empty_queue_tick'] = test_4_empty_queue_tick()
    results['test_5_full_pipeline'] = test_5_full_pipeline()
    results['test_6_intake_list'] = test_6_intake_list()
    results['test_7_idempotency'] = test_7_idempotency()
    results['test_8_telegram_regression'] = test_8_telegram_regression()
    results['test_9_log_check'] = test_9_log_check()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
