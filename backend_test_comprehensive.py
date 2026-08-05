#!/usr/bin/env python3
"""
Comprehensive backend test suite for multi-slice build verification.
Tests: regression, automation modules, platform prompts, publish endpoints,
drive scaffolding, job lifecycle, telegram handler, and storage upload.
"""

import requests
import json
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://social-queue-17.preview.emergentagent.com')
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

print(f"🔧 Test Configuration:")
print(f"   BASE_URL: {BASE_URL}")
print(f"   SUPABASE_URL: {SUPABASE_URL}")
print()

# Global variables
CURRENT_SECRET = None
ORIGINAL_CAPTION_PROMPT = None
ORIGINAL_LINKEDIN_PROMPT = None
TEST_JOB_ID = None


def test_1_regression_existing_endpoints():
    """Test 1: Regression — existing endpoints still work"""
    print("=" * 80)
    print("TEST 1: Regression — existing endpoints still work")
    print("=" * 80)
    
    try:
        # Test GET /api/prompt-styles
        print("\n📋 Testing GET /api/prompt-styles...")
        response = requests.get(f"{BASE_URL}/api/prompt-styles", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        styles = data.get('data', [])
        print(f"   ✅ Got {len(styles)} styles")
        
        # Verify 4 styles
        if len(styles) != 4:
            print(f"   ❌ FAIL: Expected 4 styles, got {len(styles)}")
            return False
        
        # Verify exactly one is_active
        active_count = sum(1 for s in styles if s.get('is_active'))
        if active_count != 1:
            print(f"   ❌ FAIL: Expected exactly 1 active style, got {active_count}")
            return False
        
        print(f"   ✅ 4 styles with exactly one active")
        
        # Test GET /api/providers
        print("\n📋 Testing GET /api/providers...")
        response = requests.get(f"{BASE_URL}/api/providers", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        providers = data.get('data', [])
        print(f"   ✅ Got {len(providers)} providers (array)")
        
        # Test GET /api/telegram/status
        print("\n📋 Testing GET /api/telegram/status...")
        response = requests.get(f"{BASE_URL}/api/telegram/status", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        status = data.get('data', {})
        bot_username = status.get('bot', {}).get('username')
        webhook_url = status.get('webhook', {}).get('url')
        
        if bot_username != 'Social_forage_bot':
            print(f"   ❌ FAIL: Expected bot.username == 'Social_forage_bot', got '{bot_username}'")
            return False
        
        if not webhook_url or not webhook_url.endswith('/api/telegram/webhook'):
            print(f"   ❌ FAIL: webhook.url should end with '/api/telegram/webhook'")
            return False
        
        print(f"   ✅ bot.username == 'Social_forage_bot'")
        print(f"   ✅ webhook.url ends with /api/telegram/webhook")
        
        print("\n✅ TEST 1 PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 1 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_2_automation_modules():
    """Test 2: Automation modules"""
    global ORIGINAL_CAPTION_PROMPT
    
    print("\n" + "=" * 80)
    print("TEST 2: Automation modules")
    print("=" * 80)
    
    try:
        # Test GET /api/automation/modules
        print("\n📋 Testing GET /api/automation/modules...")
        response = requests.get(f"{BASE_URL}/api/automation/modules", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        modules = data.get('data', [])
        print(f"   ✅ Got {len(modules)} modules")
        
        # Verify 4 modules
        if len(modules) != 4:
            print(f"   ❌ FAIL: Expected 4 modules, got {len(modules)}")
            return False
        
        # Verify module_keys
        expected_keys = {'caption', 'hashtag', 'rewriter', 'image_analyzer'}
        actual_keys = {m['module_key'] for m in modules}
        if expected_keys != actual_keys:
            print(f"   ❌ FAIL: Expected keys {expected_keys}, got {actual_keys}")
            return False
        
        print(f"   ✅ All 4 expected modules present: {actual_keys}")
        
        # Verify each module has required fields
        for mod in modules:
            if not mod.get('display_name'):
                print(f"   ❌ FAIL: Module {mod['module_key']} missing display_name")
                return False
            if not mod.get('prompt_template'):
                print(f"   ❌ FAIL: Module {mod['module_key']} missing prompt_template")
                return False
            if mod.get('enabled') != True:
                print(f"   ❌ FAIL: Module {mod['module_key']} not enabled")
                return False
            if 'settings' not in mod:
                print(f"   ❌ FAIL: Module {mod['module_key']} missing settings")
                return False
        
        print(f"   ✅ All modules have display_name, prompt_template (non-empty), enabled=true, settings object")
        
        # Save original caption prompt
        caption_module = next(m for m in modules if m['module_key'] == 'caption')
        ORIGINAL_CAPTION_PROMPT = caption_module['prompt_template']
        
        # Test PUT /api/automation/module/caption
        print("\n📋 Testing PUT /api/automation/module/caption with {prompt_template: 'TEST'}...")
        response = requests.put(
            f"{BASE_URL}/api/automation/module/caption",
            json={'prompt_template': 'TEST'},
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        print(f"   ✅ PUT successful")
        
        # Verify the change
        print("\n📋 Verifying GET /api/automation/modules shows new prompt_template...")
        response = requests.get(f"{BASE_URL}/api/automation/modules", timeout=10)
        if response.status_code != 200:
            print(f"   ❌ FAIL: GET failed")
            return False
        
        data = response.json()
        modules = data.get('data', [])
        caption_module = next(m for m in modules if m['module_key'] == 'caption')
        
        if caption_module['prompt_template'] != 'TEST':
            print(f"   ❌ FAIL: Expected 'TEST', got '{caption_module['prompt_template']}'")
            return False
        
        print(f"   ✅ prompt_template updated to 'TEST'")
        
        # Restore original prompt
        print("\n📋 Restoring original caption prompt...")
        response = requests.put(
            f"{BASE_URL}/api/automation/module/caption",
            json={'prompt_template': ORIGINAL_CAPTION_PROMPT},
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"   ⚠️  Warning: Could not restore original prompt")
        else:
            print(f"   ✅ Restored original prompt")
        
        # Test toggle disable
        print("\n📋 Testing PUT /api/automation/module/rewriter with {enabled: false}...")
        response = requests.put(
            f"{BASE_URL}/api/automation/module/rewriter",
            json={'enabled': False},
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        print(f"   ✅ Disabled rewriter")
        
        # Re-enable
        print("\n📋 Re-enabling rewriter with {enabled: true}...")
        response = requests.put(
            f"{BASE_URL}/api/automation/module/rewriter",
            json={'enabled': True},
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        print(f"   ✅ Re-enabled rewriter")
        
        print("\n✅ TEST 2 PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 2 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_3_platform_prompts():
    """Test 3: Platform prompts"""
    global ORIGINAL_LINKEDIN_PROMPT
    
    print("\n" + "=" * 80)
    print("TEST 3: Platform prompts")
    print("=" * 80)
    
    try:
        # Test GET /api/platform-prompts
        print("\n📋 Testing GET /api/platform-prompts...")
        response = requests.get(f"{BASE_URL}/api/platform-prompts", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        prompts = data.get('data', {})
        print(f"   ✅ Got platform prompts object")
        
        # Verify all 8 platforms
        expected_platforms = {'linkedin', 'instagram', 'facebook', 'threads', 'twitter', 'pinterest', 'tiktok', 'youtube'}
        actual_platforms = set(prompts.keys())
        
        if expected_platforms != actual_platforms:
            print(f"   ❌ FAIL: Expected platforms {expected_platforms}, got {actual_platforms}")
            return False
        
        print(f"   ✅ All 8 platforms present: {actual_platforms}")
        
        # Verify each has non-empty prompt_template
        for platform, obj in prompts.items():
            if not obj.get('prompt_template'):
                print(f"   ❌ FAIL: Platform {platform} missing prompt_template")
                return False
        
        print(f"   ✅ All platforms have non-empty prompt_template")
        
        # Save original LinkedIn prompt
        ORIGINAL_LINKEDIN_PROMPT = prompts['linkedin']['prompt_template']
        
        # Test PUT /api/platform-prompts/linkedin
        print("\n📋 Testing PUT /api/platform-prompts/linkedin with {prompt_template: 'TEST-LINKEDIN'}...")
        response = requests.put(
            f"{BASE_URL}/api/platform-prompts/linkedin",
            json={'prompt_template': 'TEST-LINKEDIN'},
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        print(f"   ✅ PUT successful")
        
        # Verify the change
        print("\n📋 Verifying GET /api/platform-prompts shows linkedin.prompt_template == 'TEST-LINKEDIN'...")
        response = requests.get(f"{BASE_URL}/api/platform-prompts", timeout=10)
        if response.status_code != 200:
            print(f"   ❌ FAIL: GET failed")
            return False
        
        data = response.json()
        prompts = data.get('data', {})
        
        if prompts['linkedin']['prompt_template'] != 'TEST-LINKEDIN':
            print(f"   ❌ FAIL: Expected 'TEST-LINKEDIN', got '{prompts['linkedin']['prompt_template']}'")
            return False
        
        print(f"   ✅ linkedin.prompt_template == 'TEST-LINKEDIN'")
        
        # Restore original LinkedIn prompt
        print("\n📋 Restoring original LinkedIn prompt...")
        response = requests.put(
            f"{BASE_URL}/api/platform-prompts/linkedin",
            json={'prompt_template': ORIGINAL_LINKEDIN_PROMPT},
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"   ⚠️  Warning: Could not restore original LinkedIn prompt")
        else:
            print(f"   ✅ Restored original LinkedIn prompt")
        
        print("\n✅ TEST 3 PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 3 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_4_publish_endpoints():
    """Test 4: Publish endpoints (shape only, no live posting)"""
    print("\n" + "=" * 80)
    print("TEST 4: Publish endpoints (shape only, no live posting)")
    print("=" * 80)
    
    try:
        # Test GET /api/publish/platforms
        print("\n📋 Testing GET /api/publish/platforms...")
        response = requests.get(f"{BASE_URL}/api/publish/platforms", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        supported = data.get('data', {}).get('supported', [])
        expected_platforms = ["linkedin", "facebook", "instagram"]
        
        if supported != expected_platforms:
            print(f"   ❌ FAIL: Expected {expected_platforms}, got {supported}")
            return False
        
        print(f"   ✅ data.supported == {supported}")
        
        # Test POST /api/publish/sweep
        print("\n📋 Testing POST /api/publish/sweep...")
        response = requests.post(f"{BASE_URL}/api/publish/sweep", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        result = data.get('data', {})
        if 'swept' not in result or not isinstance(result['swept'], (int, float)):
            print(f"   ❌ FAIL: data.swept should be a number")
            return False
        
        if 'results' not in result or not isinstance(result['results'], list):
            print(f"   ❌ FAIL: data.results should be an array")
            return False
        
        print(f"   ✅ data.swept == {result['swept']} (number)")
        print(f"   ✅ data.results is array with {len(result['results'])} items")
        
        # Test POST /api/publish/nonexistent-job-id
        print("\n📋 Testing POST /api/publish/nonexistent-job-id...")
        response = requests.post(f"{BASE_URL}/api/publish/nonexistent-job-id", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 404:
            print(f"   ❌ FAIL: Expected 404, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('error') != 'Job not found':
            print(f"   ❌ FAIL: Expected error 'Job not found', got '{data.get('error')}'")
            return False
        
        print(f"   ✅ 404 'Job not found'")
        
        print("\n✅ TEST 4 PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 4 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_5_drive_scaffolding():
    """Test 5: Drive scaffolding"""
    print("\n" + "=" * 80)
    print("TEST 5: Drive scaffolding")
    print("=" * 80)
    
    try:
        # Test GET /api/drive/status
        print("\n📋 Testing GET /api/drive/status...")
        response = requests.get(f"{BASE_URL}/api/drive/status", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        result = data.get('data', {})
        if result.get('configured') != False:
            print(f"   ❌ FAIL: Expected configured == false, got {result.get('configured')}")
            return False
        
        print(f"   ✅ data.configured == false (no Google creds)")
        
        # Test GET /api/drive/queue
        print("\n📋 Testing GET /api/drive/queue...")
        response = requests.get(f"{BASE_URL}/api/drive/queue", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        result = data.get('data', [])
        if not isinstance(result, list):
            print(f"   ❌ FAIL: Expected data to be array")
            return False
        
        print(f"   ✅ data is [] (array with {len(result)} items)")
        
        # Test GET /api/drive/stats
        print("\n📋 Testing GET /api/drive/stats...")
        response = requests.get(f"{BASE_URL}/api/drive/stats", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        result = data.get('data', {})
        if 'total' not in result:
            print(f"   ❌ FAIL: Expected data.total")
            return False
        
        print(f"   ✅ data has total={result['total']} and status buckets")
        
        # Test POST /api/drive/sync
        print("\n📋 Testing POST /api/drive/sync...")
        response = requests.post(f"{BASE_URL}/api/drive/sync", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        result = data.get('data', {})
        if result.get('indexed') != 0:
            print(f"   ❌ FAIL: Expected indexed == 0 (stub), got {result.get('indexed')}")
            return False
        
        print(f"   ✅ data.indexed == 0 (stub)")
        
        print("\n✅ TEST 5 PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 5 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_6_job_lifecycle():
    """Test 6: Job lifecycle end-to-end with a dummy job"""
    global TEST_JOB_ID
    
    print("\n" + "=" * 80)
    print("TEST 6: Job lifecycle end-to-end with a dummy job")
    print("=" * 80)
    
    try:
        # Create a job
        print("\n📋 Testing POST /api/jobs...")
        job_data = {
            "source": "manual",
            "topic": "test job for backend verification",
            "platform_posts": {
                "linkedin": {
                    "caption": "hello linkedin from test suite",
                    "hashtags": ["#test", "#automation"]
                },
                "facebook": {
                    "caption": "hello facebook from test suite",
                    "hashtags": []
                },
                "instagram": {
                    "caption": "hello instagram from test suite",
                    "hashtags": ["#test"]
                }
            },
            "status": "draft"
        }
        
        response = requests.post(f"{BASE_URL}/api/jobs", json=job_data, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        job = data.get('data', {})
        if not job.get('id'):
            print(f"   ❌ FAIL: Job missing id")
            return False
        
        if not job.get('created_at'):
            print(f"   ❌ FAIL: Job missing created_at")
            return False
        
        TEST_JOB_ID = job['id']
        print(f"   ✅ Created job with id={TEST_JOB_ID}")
        
        # Get the job
        print(f"\n📋 Testing GET /api/jobs/{TEST_JOB_ID}...")
        response = requests.get(f"{BASE_URL}/api/jobs/{TEST_JOB_ID}", timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        retrieved_job = data.get('data', {})
        if retrieved_job.get('id') != TEST_JOB_ID:
            print(f"   ❌ FAIL: Job id mismatch")
            return False
        
        print(f"   ✅ Retrieved job matches")
        
        # Update the job to scheduled
        print(f"\n📋 Testing PUT /api/jobs/{TEST_JOB_ID} with status=scheduled...")
        update_data = {
            "status": "scheduled",
            "scheduled_for": "2020-01-01T00:00:00Z"
        }
        
        response = requests.put(f"{BASE_URL}/api/jobs/{TEST_JOB_ID}", json=update_data, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        print(f"   ✅ Updated job to scheduled")
        
        # Run sweep
        print(f"\n📋 Testing POST /api/publish/sweep (should sweep our job)...")
        response = requests.post(f"{BASE_URL}/api/publish/sweep", timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        result = data.get('data', {})
        swept = result.get('swept', 0)
        results = result.get('results', [])
        
        if swept < 1:
            print(f"   ⚠️  Warning: Expected swept >= 1, got {swept}")
        else:
            print(f"   ✅ swept >= 1 (swept {swept} jobs)")
        
        # Verify results structure
        if len(results) > 0:
            first_result = results[0]
            if 'results' not in first_result:
                print(f"   ❌ FAIL: Result missing 'results' array")
                return False
            
            platform_results = first_result['results']
            for pr in platform_results:
                if 'platform' not in pr:
                    print(f"   ❌ FAIL: Platform result missing 'platform'")
                    return False
                
                if 'ok' not in pr:
                    print(f"   ❌ FAIL: Platform result missing 'ok'")
                    return False
                
                if not pr['ok'] and 'error' not in pr:
                    print(f"   ❌ FAIL: Failed platform result missing 'error'")
                    return False
            
            print(f"   ✅ Results structure valid (each has platform + ok + error if failed)")
        
        # Check job status after sweep
        print(f"\n📋 Checking job status after sweep...")
        response = requests.get(f"{BASE_URL}/api/jobs/{TEST_JOB_ID}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            job = data.get('data', {})
            final_status = job.get('status')
            
            if final_status not in ['published', 'failed']:
                print(f"   ⚠️  Warning: Expected status 'published' or 'failed', got '{final_status}'")
            else:
                print(f"   ✅ Job status is '{final_status}' (expected)")
            
            if 'warnings' in job:
                print(f"   ✅ Job has warnings array (populated: {len(job['warnings'])} items)")
        
        print("\n✅ TEST 6 PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 6 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_7_telegram_handler_resilience():
    """Test 7: Telegram handler resilience & new commands"""
    global CURRENT_SECRET
    
    print("\n" + "=" * 80)
    print("TEST 7: Telegram handler resilience & new commands")
    print("=" * 80)
    
    try:
        # Fetch webhook secret from Supabase
        print("\n📋 Fetching webhook secret from Supabase...")
        url = f"{SUPABASE_URL}/rest/v1/app_settings?key=eq.main&select=value"
        headers = {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"   ❌ FAIL: Could not fetch secret from Supabase")
            return False
        
        data = response.json()
        if not data or len(data) == 0:
            print(f"   ❌ FAIL: No app_settings row found")
            return False
        
        value = data[0].get('value', {})
        CURRENT_SECRET = value.get('telegram_webhook_secret')
        
        if not CURRENT_SECRET:
            print(f"   ❌ FAIL: telegram_webhook_secret not found")
            return False
        
        print(f"   ✅ Retrieved webhook secret: {CURRENT_SECRET[:8]}...{CURRENT_SECRET[-4:]}")
        
        # Test commands
        commands = [
            ("/help", "Help command"),
            ("/today", "Today command"),
            ("/tomorrow", "Tomorrow command"),
            ("/styles", "Styles command"),
            ("/caption astronaut floating in space", "Caption command"),
            ("/hashtag coffee shop", "Hashtag command"),
            ("/rewrite make this friendlier: I need to know NOW", "Rewrite command"),
            ("/publish nonexistent-id", "Publish nonexistent job"),
        ]
        
        for cmd_text, description in commands:
            print(f"\n📋 Testing: {description} ('{cmd_text}')...")
            headers = {'X-Telegram-Bot-Api-Secret-Token': CURRENT_SECRET, 'Content-Type': 'application/json'}
            body = {
                "update_id": int(time.time() * 1000),
                "message": {
                    "message_id": int(time.time()),
                    "from": {
                        "id": 5354784014,
                        "is_bot": False,
                        "first_name": "Test"
                    },
                    "chat": {
                        "id": 5354784014,
                        "type": "private"
                    },
                    "date": int(time.time()),
                    "text": cmd_text
                }
            }
            
            response = requests.post(
                f"{BASE_URL}/api/telegram/webhook",
                headers=headers,
                json=body,
                timeout=10
            )
            print(f"   Status: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
                return False
            
            print(f"   ✅ Handler returned 200")
            time.sleep(0.3)
        
        # Test callback queries
        callbacks = [
            ("approve:nonexistent-id", "Approve nonexistent job"),
            ("postnow:nonexistent-id", "Post now nonexistent job"),
        ]
        
        for callback_data, description in callbacks:
            print(f"\n📋 Testing callback: {description} ('{callback_data}')...")
            headers = {'X-Telegram-Bot-Api-Secret-Token': CURRENT_SECRET, 'Content-Type': 'application/json'}
            body = {
                "update_id": int(time.time() * 1000),
                "callback_query": {
                    "id": f"cb{int(time.time())}",
                    "from": {
                        "id": 5354784014
                    },
                    "message": {
                        "message_id": 1,
                        "chat": {
                            "id": 5354784014
                        }
                    },
                    "data": callback_data
                }
            }
            
            response = requests.post(
                f"{BASE_URL}/api/telegram/webhook",
                headers=headers,
                json=body,
                timeout=10
            )
            print(f"   Status: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
                return False
            
            print(f"   ✅ Handler returned 200 (graceful handling)")
            time.sleep(0.3)
        
        print("\n✅ TEST 7 PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 7 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_8_storage_bucket_upload():
    """Test 8: Storage bucket auto-create + image upload"""
    print("\n" + "=" * 80)
    print("TEST 8: Storage bucket auto-create + image upload")
    print("=" * 80)
    
    try:
        # Test POST /api/upload with tiny 1x1 PNG
        print("\n📋 Testing POST /api/upload with 1x1 PNG...")
        
        # 1x1 PNG base64 (without data:image/png;base64, prefix)
        tiny_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        upload_data = {
            "base64": tiny_png,
            "mime_type": "image/png"
        }
        
        response = requests.post(f"{BASE_URL}/api/upload", json=upload_data, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print(f"   ❌ FAIL: Response not ok")
            return False
        
        result = data.get('data', {})
        url = result.get('url')
        
        if not url:
            print(f"   ❌ FAIL: Missing url in response")
            return False
        
        expected_prefix = "https://ghqakcbyqqxolavwfepe.supabase.co/storage/v1/object/public/post-media/"
        if not url.startswith(expected_prefix):
            print(f"   ❌ FAIL: URL should start with '{expected_prefix}'")
            print(f"   Got: {url}")
            return False
        
        print(f"   ✅ data.url starts with correct prefix")
        print(f"   URL: {url}")
        
        # Verify the uploaded image is accessible
        print(f"\n📋 Verifying uploaded image is accessible...")
        response = requests.head(url, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        content_type = response.headers.get('content-type', '')
        if 'image/png' not in content_type:
            print(f"   ⚠️  Warning: Expected content-type image/png, got '{content_type}'")
        else:
            print(f"   ✅ content-type is image/png")
        
        print("\n✅ TEST 8 PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 8 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("COMPREHENSIVE BACKEND VERIFICATION TEST SUITE")
    print("Multi-slice build: real publishing + AI Automation + calendar + Drive + Telegram")
    print("=" * 80)
    
    results = {}
    
    # Run tests in sequence
    results['Test 1: Regression'] = test_1_regression_existing_endpoints()
    results['Test 2: Automation modules'] = test_2_automation_modules()
    results['Test 3: Platform prompts'] = test_3_platform_prompts()
    results['Test 4: Publish endpoints'] = test_4_publish_endpoints()
    results['Test 5: Drive scaffolding'] = test_5_drive_scaffolding()
    results['Test 6: Job lifecycle'] = test_6_job_lifecycle()
    results['Test 7: Telegram handler'] = test_7_telegram_handler_resilience()
    results['Test 8: Storage upload'] = test_8_storage_bucket_upload()
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Backend verification complete!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1


if __name__ == '__main__':
    exit(main())
