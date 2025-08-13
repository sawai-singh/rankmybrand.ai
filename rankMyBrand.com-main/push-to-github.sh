#!/bin/bash

# Push to GitHub Repository
# Replace YOUR_GITHUB_USERNAME and YOUR_PERSONAL_ACCESS_TOKEN with your actual credentials

echo "Pushing to GitHub..."

# Option 1: Using Personal Access Token (Recommended)
# Uncomment and fill in your credentials:
# For your fork:
git remote set-url origin https://sawai-singh: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@github.com/sawai-singh/rankMyBrand.com.git

# Or if you have access to the original repo, keep this:
# git remote set-url origin https://sawai-singh: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@github.com/Harsh-Agarwals/rankMyBrand.com.git

# Option 2: Using SSH (if you have SSH keys set up)
# Uncomment if using SSH:
# git remote set-url origin git@github.com:Harsh-Agarwals/rankMyBrand.com.git

# Push to main branch
git push -u origin main

echo "Push complete!"