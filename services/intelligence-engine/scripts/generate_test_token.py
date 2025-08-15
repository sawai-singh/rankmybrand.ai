#!/usr/bin/env python3
"""
Generate a test JWT token for API authentication
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.api.auth import auth_handler
import json

# Generate a test token
token = auth_handler.create_token(
    customer_id="test-customer-123",
    brand_id="test-brand-456",
    user_id="test-user-789",
    additional_claims={
        "role": "admin",
        "permissions": ["read", "write"]
    }
)

print("🔐 JWT Token Generated Successfully!")
print("=" * 60)
print(f"Token: {token}")
print("=" * 60)
print("\n📋 How to use this token:")
print("1. In curl:")
print(f'   curl -H "Authorization: Bearer {token}" \\')
print('        http://localhost:8002/api/analysis/health')
print("\n2. In Postman/Insomnia:")
print("   - Add to Headers")
print("   - Key: Authorization")
print(f"   - Value: Bearer {token}")
print("\n3. In JavaScript:")
print("   ```javascript")
print("   fetch('http://localhost:8002/api/analysis/process', {")
print("     headers: {")
print(f"       'Authorization': 'Bearer {token}'")
print("     }")
print("   });")
print("   ```")
print("\n⏰ Token expires in 24 hours")