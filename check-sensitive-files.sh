#!/bin/bash

# Pre-commit check for sensitive files
# This script prevents accidental commits of sensitive data

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Checking for sensitive files...${NC}"

SENSITIVE_FILES=0
WARNINGS=""

# Check for .env files
ENV_FILES=$(git ls-files | grep -E "\.env$|\.env\.|env\.production|env\.staging" | grep -v ".env.example" | grep -v ".env.template")
if [ ! -z "$ENV_FILES" ]; then
    echo -e "${RED}❌ Found .env files in git:${NC}"
    echo "$ENV_FILES"
    SENSITIVE_FILES=$((SENSITIVE_FILES + 1))
    WARNINGS="${WARNINGS}\n  - Environment files detected"
fi

# Check for private keys and certificates
KEY_FILES=$(git ls-files | grep -E "\.(pem|key|crt|p12|pfx)$")
if [ ! -z "$KEY_FILES" ]; then
    echo -e "${RED}❌ Found private keys/certificates in git:${NC}"
    echo "$KEY_FILES"
    SENSITIVE_FILES=$((SENSITIVE_FILES + 1))
    WARNINGS="${WARNINGS}\n  - Private keys/certificates detected"
fi

# Check for AWS/GCP/Azure credentials
CLOUD_CREDS=$(git ls-files | grep -E "aws-credentials|gcp-credentials|azure-credentials|service-account\.json")
if [ ! -z "$CLOUD_CREDS" ]; then
    echo -e "${RED}❌ Found cloud credentials in git:${NC}"
    echo "$CLOUD_CREDS"
    SENSITIVE_FILES=$((SENSITIVE_FILES + 1))
    WARNINGS="${WARNINGS}\n  - Cloud credentials detected"
fi

# Check for hardcoded secrets in staged files
echo -e "${YELLOW}Scanning for hardcoded secrets in staged files...${NC}"
SECRETS_FOUND=0

# Check for potential API keys
if git diff --cached | grep -E "sk-[a-zA-Z0-9]{48}|AIza[0-9A-Za-z-_]{35}|[0-9a-f]{40}" > /dev/null; then
    echo -e "${RED}❌ Potential API keys found in staged changes${NC}"
    SECRETS_FOUND=1
    WARNINGS="${WARNINGS}\n  - Potential API keys in code"
fi

# Check for JWT secrets
if git diff --cached | grep -E "JWT_SECRET|SESSION_SECRET" | grep -v "example" | grep -v "template" > /dev/null; then
    echo -e "${YELLOW}⚠️  JWT/Session secrets found - ensure they're not real values${NC}"
    WARNINGS="${WARNINGS}\n  - JWT/Session secrets referenced"
fi

# Check for database passwords
if git diff --cached | grep -E "DB_PASSWORD|POSTGRES_PASSWORD|MYSQL_PASSWORD" | grep -v "example" | grep -v "template" > /dev/null; then
    echo -e "${YELLOW}⚠️  Database passwords found - ensure they're not real values${NC}"
    WARNINGS="${WARNINGS}\n  - Database passwords referenced"
fi

echo ""
echo -e "${GREEN}========================================${NC}"

if [ $SENSITIVE_FILES -eq 0 ] && [ $SECRETS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ No sensitive files detected${NC}"
    echo -e "${GREEN}Safe to commit!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  SECURITY WARNING${NC}"
    echo -e "${RED}Sensitive data detected:${NC}"
    echo -e "$WARNINGS"
    echo ""
    echo -e "${YELLOW}Actions to take:${NC}"
    echo "1. Remove sensitive files: git rm --cached <file>"
    echo "2. Add to .gitignore: echo '<file>' >> .gitignore"
    echo "3. Use environment variables instead of hardcoded values"
    echo "4. Use .env.example for templates"
    echo ""
    echo -e "${RED}Commit blocked for security reasons.${NC}"
    exit 1
fi