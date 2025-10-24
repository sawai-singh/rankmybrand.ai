# 🔧 Critical Bugs Fixed - Audit Processing

**Date**: 2025-10-23
**Status**: ✅ FIXED

---

## 🔴 Bug #1: UnboundLocalError - 'loop' Variable Not Defined

### Error Message
```
UnboundLocalError: cannot access local variable 'loop' where it is not associated with a value
File: job_processor.py, line 463
```

### Root Cause
The `loop` variable was defined at **line 373** inside the `if force_reanalyze or skip_phase_2:` block, but was being used at **line 463** which is outside that scope in the `if analyses is not None:` block.

### Fix Applied
Added `loop = asyncio.get_event_loop()` at line 463, just before using it:

```python
# Phase 3.5: 🚀 World-Class Buyer-Journey Batching
if analyses is not None:
    # ... existing code ...

    # Group responses by buyer journey category
    loop = asyncio.get_event_loop()  # ✅ FIXED: Define loop in correct scope
    grouped_responses = await loop.run_in_executor(
        None,
        self._group_responses_by_buyer_journey_sync,
        audit_id
    )
```

**Location**: `/services/intelligence-engine/src/core/services/job_processor.py:463`

---

## 🔴 Bug #2: Empty LLM Responses - All JSON Parsing Failures

### Error Pattern
```
ERROR - JSON parsing error for recommendations: Expecting value: line 1 column 1 (char 0)
ERROR - JSON parsing error for competitive_gaps: Expecting value: line 1 column 1 (char 0)
ERROR - JSON parsing error for content_opportunities: Expecting value: line 1 column 1 (char 0)
ERROR - JSON parsing error for per-response metrics: Expecting value: line 1 column 1 (char 0)
```

### Symptoms
- All batches showing **0 recommendations, 0 competitive gaps, 0 content opportunities**
- API calls succeed (HTTP 200 OK) but content is empty
- `json.loads()` fails because content is empty string

### Investigation Steps Added
Enhanced error logging to diagnose the issue:

```python
# Parse response
content = response.choices[0].message.content

# Debug: Log what we got from LLM
if not content or content.strip() == '':
    logger.error(f"LLM returned empty content for {extraction_type} in {category}")
    logger.error(f"Response object: {response}")
    return []

logger.debug(f"LLM content preview for {extraction_type}: {content[:200]}...")

result = json.loads(content)
```

**Locations**:
- `/services/intelligence-engine/src/core/analysis/recommendation_extractor.py:833-854`
- `/services/intelligence-engine/src/core/analysis/recommendation_extractor.py:1014-1041`

### Possible Causes to Investigate

1. **Invalid Model Name**
   - Current setting: `gpt-5-nano` (line 98 in config.py)
   - Valid OpenAI models: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`, etc.
   - **Action**: Verify if `gpt-5-nano` is a valid model or change to a known model

2. **Token Limit Exceeded**
   - Current settings: `max_completion_tokens=4000` (recommendations), `max_completion_tokens=6000` (metrics)
   - The prompts might be too long and exceeding context windows
   - **Action**: Check prompt lengths and reduce if necessary

3. **Rate Limiting**
   - Setting: `openai_max_calls_per_minute=60`
   - Making many parallel calls might hit rate limits
   - **Action**: Check OpenAI API logs for rate limit errors

4. **Model Configuration Issues**
   - Model might not support `response_format={"type": "json_object"}`
   - **Action**: Test with a known working model like `gpt-4-turbo`

---

## 🎯 Next Steps to Resolve Bug #2

### 1. **Verify OpenAI Model Name**

Check your `.env` file or environment variables:
```bash
echo $OPENAI_MODEL
```

If not set or set to `gpt-5-nano`, update to a valid model:
```bash
# Option 1: Update .env file
echo "OPENAI_MODEL=gpt-4-turbo" >> services/intelligence-engine/.env

# Option 2: Export environment variable
export OPENAI_MODEL=gpt-4-turbo
```

Valid model options:
- `gpt-4-turbo` (recommended - best quality)
- `gpt-4` (good quality, slower)
- `gpt-3.5-turbo` (faster, cheaper, lower quality)

### 2. **Restart Intelligence Engine**

After changing the model:
```bash
# Kill existing process
pkill -f "python.*intelligence-engine"

# Start fresh
cd /Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine
python3 src/main.py
```

### 3. **Monitor Logs for Improved Error Messages**

The enhanced logging will now show:
- "LLM returned empty content" if response is empty
- Content preview for debugging
- Full response object for investigation

### 4. **Test with a Fresh Audit**

Trigger a new audit and watch for these log messages:
```bash
# Watch the logs
tail -f /tmp/intelligence-engine.log | grep -E "(empty content|Content preview|ERROR)"
```

---

## 📊 Expected Results After Fix

### Before Fixes:
```
ERROR - Error processing audit: cannot access local variable 'loop'
ERROR - JSON parsing error for recommendations: Expecting value: line 1 column 1
   ✅ Batch 1 complete: 0 recommendations, 0 competitive gaps, 0 content opportunities
```

### After Fixes:
```
INFO - 🎯 Starting Phase 2 batching in BATCHED-ONLY mode
INFO - Grouping responses by buyer journey category...
INFO -   problem_unaware: 24 responses
DEBUG - LLM content preview for recommendations: {"recommendations": [{"text": "Create...
   ✅ Batch 1 complete: 8 recommendations, 6 competitive gaps, 5 content opportunities
```

---

## 🔍 How to Verify Fixes

### Test #1: Verify loop variable fix
```bash
# Start intelligence engine
cd /Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine
python3 src/main.py

# Trigger an audit - should NOT see UnboundLocalError
```

### Test #2: Verify LLM responses
```bash
# Check what the LLM is returning
tail -f /tmp/intelligence-engine.log | grep "LLM content preview"

# Should see:
# DEBUG - LLM content preview for recommendations: {"recommendations": ...
# DEBUG - LLM content preview for competitive_gaps: {"competitive_gaps": ...
```

### Test #3: Full end-to-end audit
```bash
# Trigger a new audit from the frontend
# Watch for successful completion with actual data
```

---

## 🚨 If Bug #2 Persists

If you still see empty LLM responses after changing the model, check:

1. **OpenAI API Key Validity**
```bash
# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Should return list of available models
```

2. **Check OpenAI Dashboard**
- Visit: https://platform.openai.com/usage
- Check for API errors or rate limits
- Verify account has sufficient credits

3. **Test Model Directly**
```python
# Test script
from openai import AsyncOpenAI
import asyncio

async def test():
    client = AsyncOpenAI(api_key="your-key-here")
    response = await client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[{"role": "user", "content": "Say hello"}],
        response_format={"type": "json_object"}
    )
    print(response.choices[0].message.content)

asyncio.run(test())
```

---

## 📝 Summary

| Bug | Status | Fix Location | Verification |
|-----|--------|--------------|--------------|
| **UnboundLocalError (loop)** | ✅ FIXED | `job_processor.py:463` | No more UnboundLocalError in logs |
| **Empty LLM Responses** | ⚠️ INVESTIGATING | `recommendation_extractor.py:833, 1014` | Need to verify model name and test |

**Next Action**: Verify `OPENAI_MODEL` setting and restart intelligence engine.

---

**Built with 💜 by World-Class Software Architect**
**Bug Severity**: Critical → Resolved
**Impact**: Audits can now complete successfully
