"""Configuration and Feature Flags API endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import logging
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)
router = APIRouter()

# Dynamically determine .env file path
ENV_FILE_PATH = os.path.join(os.getcwd(), '.env')


class FeatureFlagUpdate(BaseModel):
    """Feature flag update model."""
    enabled: bool


@router.get("/feature-flags")
async def get_feature_flags():
    """
    Get all feature flags with current values.

    Returns:
        dict: Feature flags configuration
    """
    try:
        # Read current environment values
        use_batched = os.getenv('USE_BATCHED_ANALYSIS_ONLY', 'true').lower() in ('true', '1', 'yes')
        enable_warnings = os.getenv('ENABLE_PHASE1_DEPRECATION_WARNINGS', 'true').lower() in ('true', '1', 'yes')

        return {
            "success": True,
            "flags": {
                "USE_BATCHED_ANALYSIS_ONLY": use_batched,
                "ENABLE_PHASE1_DEPRECATION_WARNINGS": enable_warnings
            },
            "metadata": {
                "source": "environment_variables",
                "env_file": ENV_FILE_PATH
            }
        }
    except Exception as e:
        logger.error(f"Error fetching feature flags: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/feature-flags/{flag_key}")
async def update_feature_flag(flag_key: str, update: FeatureFlagUpdate):
    """
    Update a specific feature flag.

    Note: This updates the in-memory value but does NOT persist to .env file.
    For persistent changes, edit the .env file directly and restart the service.

    Args:
        flag_key: The feature flag key to update
        update: The new value

    Returns:
        dict: Update confirmation
    """
    try:
        valid_flags = ['USE_BATCHED_ANALYSIS_ONLY', 'ENABLE_PHASE1_DEPRECATION_WARNINGS']

        if flag_key not in valid_flags:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid flag key. Must be one of: {valid_flags}"
            )

        # Update environment variable (in-memory only)
        os.environ[flag_key] = 'true' if update.enabled else 'false'

        logger.info(f"[Feature Flag] Updated {flag_key} to {update.enabled} (in-memory)")

        return {
            "success": True,
            "message": f"Feature flag {flag_key} updated to {update.enabled}",
            "flag": {
                "key": flag_key,
                "enabled": update.enabled,
                "persistent": False,
                "note": "This is an in-memory change. For persistent changes, edit .env file and restart service."
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating feature flag {flag_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/feature-flags/{flag_key}/persist")
async def persist_feature_flag(flag_key: str, update: FeatureFlagUpdate):
    """
    Update and persist a feature flag to the .env file.

    Args:
        flag_key: The feature flag key to update
        update: The new value

    Returns:
        dict: Update confirmation
    """
    try:
        valid_flags = ['USE_BATCHED_ANALYSIS_ONLY', 'ENABLE_PHASE1_DEPRECATION_WARNINGS']

        if flag_key not in valid_flags:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid flag key. Must be one of: {valid_flags}"
            )

        value_str = 'true' if update.enabled else 'false'
        backup_path = f"{ENV_FILE_PATH}.backup"

        # Read current .env file
        try:
            with open(ENV_FILE_PATH, 'r') as f:
                lines = f.readlines()
        except FileNotFoundError:
            lines = []

        # Create backup before modification
        try:
            if os.path.exists(ENV_FILE_PATH):
                shutil.copy2(ENV_FILE_PATH, backup_path)
                logger.info(f"[Feature Flag] Created backup: {backup_path}")
        except Exception as backup_error:
            logger.warning(f"Failed to create backup: {backup_error}")

        # Update or add the flag
        flag_found = False
        new_lines = []

        for line in lines:
            if line.strip().startswith(flag_key):
                new_lines.append(f"{flag_key}={value_str}\n")
                flag_found = True
            else:
                new_lines.append(line)

        # If flag not found, add it
        if not flag_found:
            new_lines.append(f"\n# Feature Flags\n{flag_key}={value_str}\n")

        # Write back to .env file with error handling
        try:
            with open(ENV_FILE_PATH, 'w') as f:
                f.writelines(new_lines)
        except Exception as write_error:
            # Restore backup on write failure
            if os.path.exists(backup_path):
                shutil.copy2(backup_path, ENV_FILE_PATH)
                logger.error(f"Write failed, restored from backup: {write_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to write .env file. Backup restored. Error: {str(write_error)}"
            )

        # Also update in-memory
        os.environ[flag_key] = value_str

        logger.info(f"[Feature Flag] Persisted {flag_key}={value_str} to {ENV_FILE_PATH}")

        return {
            "success": True,
            "message": f"Feature flag {flag_key} updated and persisted to .env file",
            "flag": {
                "key": flag_key,
                "enabled": update.enabled,
                "persistent": True,
                "file": ENV_FILE_PATH,
                "backup": backup_path,
                "note": "Service restart required for changes to fully take effect"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error persisting feature flag {flag_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
