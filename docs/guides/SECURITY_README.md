# 🔒 Security & Environment Configuration Guide

## ⚠️ CRITICAL: Files That Should NEVER Be Committed

### Environment Files
- `.env` - Main environment file
- `.env.production` - Production secrets
- `.env.staging` - Staging secrets
- `.env.development` - Development secrets (even these can contain sensitive data)
- `services/*/.env.production` - Service-specific production configs
- Any file matching `*.env.*` pattern (except .env.example)

### Secrets & Keys
- `*.pem` - Private/public keys
- `*.key` - Private keys
- `*.crt` - Certificates
- `*.p12`, `*.pfx` - Certificate stores
- `jwt-secret.txt` - JWT secrets
- `api-keys.txt` - API key storage
- `credentials.json` - Service credentials
- `service-account.json` - Cloud service accounts

### Cloud Provider Files
- `aws-credentials` - AWS credentials
- `gcp-credentials.json` - Google Cloud credentials
- `azure-credentials.json` - Azure credentials
- `.aws/`, `.gcp/`, `.azure/` - Cloud provider config directories

### Docker & Deployment
- `docker-compose.override.yml` - Local overrides with secrets
- `kubernetes/secrets.yaml` - K8s secrets
- `helm/values.production.yaml` - Helm production values
- `terraform.tfvars` - Terraform variables

## ✅ Safe to Commit

### Example/Template Files
- `.env.example` - Template showing required variables
- `.env.template` - Template for environment setup
- `*.example` - Any example files
- `README.md` - Documentation
- `docker-compose.yml` - Base compose without secrets
- `Dockerfile` - Build instructions

## 🛡️ Before Committing to GitHub

### 1. Run Security Check
```bash
./check-sensitive-files.sh
```

### 2. Check Git Status
```bash
git status
git diff --cached  # Review staged changes
```

### 3. Remove Sensitive Files if Found
```bash
# Remove from git but keep locally
git rm --cached .env
git rm --cached services/*/.env.production

# Add to .gitignore
echo ".env" >> .gitignore
echo "*.env.production" >> .gitignore
```

### 4. Use Git Secrets (Recommended)
```bash
# Install git-secrets
brew install git-secrets  # macOS
# or
git clone https://github.com/awslabs/git-secrets.git

# Configure for your repo
git secrets --install
git secrets --register-aws  # For AWS keys
git secrets --add 'sk-[a-zA-Z0-9]{48}'  # OpenAI keys
git secrets --add 'sk-ant-[a-zA-Z0-9]{48}'  # Anthropic keys
```

## 📝 Environment Setup for New Developers

### 1. Copy Example Files
```bash
cp .env.example .env
cp services/api-gateway/.env.example services/api-gateway/.env
# Repeat for all services
```

### 2. Generate Secrets
```bash
# Generate JWT secret
openssl rand -base64 32

# Generate session secret
openssl rand -base64 32

# Generate strong password
openssl rand -base64 24
```

### 3. Request API Keys
Contact the team lead for:
- OpenAI API key
- Anthropic API key
- Database credentials
- Redis password
- Cloud service credentials

## 🚨 If You Accidentally Committed Secrets

### Immediate Actions:
1. **Rotate all exposed secrets immediately**
2. **Remove from history:**
```bash
# Remove file from all commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (coordinate with team)
git push --force --all
git push --force --tags
```

3. **Alternative using BFG:**
```bash
# Install BFG
brew install bfg  # macOS

# Remove secrets
bfg --delete-files .env
bfg --replace-text passwords.txt  # File with patterns to replace

git push --force
```

4. **Notify the team immediately**
5. **Check GitHub's secret scanning alerts**

## 🔐 Best Practices

1. **Always use environment variables** for sensitive data
2. **Never hardcode** secrets in source code
3. **Use secret management tools** in production (AWS Secrets Manager, HashiCorp Vault)
4. **Rotate secrets regularly**
5. **Use different secrets** for dev/staging/production
6. **Enable 2FA** on all service accounts
7. **Audit access logs** regularly
8. **Use least privilege principle** for all credentials

## 📞 Security Contacts

- **Security Lead:** [Contact]
- **DevOps Lead:** [Contact]
- **Emergency:** If secrets are exposed, contact the team immediately

---

**Remember:** Security is everyone's responsibility. When in doubt, ask before committing!