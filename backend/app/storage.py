"""
storage.py
----------
Cloudinary storage integration with local disk fallback.
Handles uploading, downloading, and managing assignment attachments and student notebook submissions.
"""

import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional, Union

import httpx
from app.config import get_settings

logger = logging.getLogger("app.storage")
settings = get_settings()

_cloudinary_initialized = False


def is_cloudinary_configured() -> bool:
    """Returns True if Cloudinary credentials are provided in settings or environment."""
    cloud_name = settings.CLOUDINARY_CLOUD_NAME or os.getenv("CLOUDINARY_CLOUD_NAME", "")
    api_key = settings.CLOUDINARY_API_KEY or os.getenv("CLOUDINARY_API_KEY", "")
    api_secret = settings.CLOUDINARY_API_SECRET or os.getenv("CLOUDINARY_API_SECRET", "")
    cloudinary_url = settings.CLOUDINARY_URL or os.getenv("CLOUDINARY_URL", "")

    return bool(cloudinary_url or (cloud_name and api_key and api_secret))


def init_cloudinary() -> bool:
    """Initializes the Cloudinary SDK if configured."""
    global _cloudinary_initialized
    if _cloudinary_initialized:
        return True

    if not is_cloudinary_configured():
        logger.info("Cloudinary is not configured. Falling back to local filesystem storage.")
        return False

    try:
        import cloudinary
        import cloudinary.uploader
        import cloudinary.api

        cloud_name = settings.CLOUDINARY_CLOUD_NAME or os.getenv("CLOUDINARY_CLOUD_NAME", "")
        api_key = settings.CLOUDINARY_API_KEY or os.getenv("CLOUDINARY_API_KEY", "")
        api_secret = settings.CLOUDINARY_API_SECRET or os.getenv("CLOUDINARY_API_SECRET", "")
        cloudinary_url = settings.CLOUDINARY_URL or os.getenv("CLOUDINARY_URL", "")

        if cloudinary_url:
            cloudinary.config(cloudinary_url=cloudinary_url, secure=True)
        else:
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True,
            )

        _cloudinary_initialized = True
        logger.info("Cloudinary SDK initialized successfully (cloud: %s).", cloud_name or "via URL")
        return True
    except Exception as e:
        logger.error("Failed to initialize Cloudinary SDK: %s", str(e))
        return False


async def upload_file_to_cloudinary(
    file_source: Union[str, Path, bytes],
    folder: str = "autograde",
    public_id: Optional[str] = None,
    resource_type: str = "auto",
) -> Optional[Dict[str, Any]]:
    """
    Uploads a file or bytes to Cloudinary asynchronously in a background thread.
    Returns the Cloudinary response dictionary (containing 'secure_url', 'public_id', etc.),
    or None if Cloudinary is not configured or the upload fails.
    """
    if not init_cloudinary():
        return None

    try:
        import cloudinary.uploader

        upload_options: Dict[str, Any] = {
            "folder": folder,
            "resource_type": resource_type,
            "use_filename": True,
            "unique_filename": True,
            "overwrite": True,
        }
        if public_id:
            upload_options["public_id"] = public_id

        # Run blocking Cloudinary SDK upload in a separate thread
        res = await asyncio.to_thread(
            cloudinary.uploader.upload,
            file_source,
            **upload_options,
        )
        logger.info(
            "Uploaded file to Cloudinary: public_id=%s, url=%s",
            res.get("public_id"),
            res.get("secure_url"),
        )
        return res
    except Exception as e:
        logger.error("Error uploading file to Cloudinary: %s", str(e))
        return None


async def delete_file_from_cloudinary(
    public_id: str,
    resource_type: str = "raw",
) -> bool:
    """Deletes an asset from Cloudinary."""
    if not init_cloudinary() or not public_id:
        return False

    try:
        import cloudinary.uploader

        res = await asyncio.to_thread(
            cloudinary.uploader.destroy,
            public_id,
            resource_type=resource_type,
        )
        logger.info("Deleted file from Cloudinary: %s, result=%s", public_id, res.get("result"))
        return res.get("result") == "ok"
    except Exception as e:
        logger.warning("Failed to delete Cloudinary asset %s: %s", public_id, str(e))
        return False


async def ensure_local_file(
    file_path: Union[str, Path],
    cloudinary_url: Optional[str] = None,
) -> Optional[Path]:
    """
    Ensures the specified file exists on the local filesystem.
    If it is missing locally but a Cloudinary URL is provided, it downloads and caches the file locally.
    Returns the resolved Path if available, or None if the file cannot be retrieved.
    """
    p = Path(file_path)
    if p.exists() and p.is_file():
        return p

    # If missing locally and Cloudinary URL available, download it
    if cloudinary_url and cloudinary_url.startswith("http"):
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            logger.info("Downloading file from Cloudinary (%s) to local cache (%s)...", cloudinary_url, p)
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(cloudinary_url)
                if resp.status_code == 200:
                    p.write_bytes(resp.content)
                    logger.info("Successfully cached file from Cloudinary: %s", p)
                    return p
                else:
                    logger.warning(
                        "Failed to download from Cloudinary: status %d for %s",
                        resp.status_code,
                        cloudinary_url,
                    )
        except Exception as e:
            logger.error("Exception while downloading Cloudinary asset: %s", str(e))

    return None
