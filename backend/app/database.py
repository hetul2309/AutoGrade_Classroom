from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

def get_async_db_url(url: str) -> str:
    """Normalize postgres:// and postgresql:// to postgresql+asyncpg:// for SQLAlchemy async engine and sanitize query params."""
    if not url:
        return url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    # Clean query parameters for asyncpg (asyncpg requires ssl=require instead of sslmode=require and rejects channel_binding)
    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
    parsed = urlparse(url)
    if parsed.query:
        qs = parse_qs(parsed.query)
        if "sslmode" in qs:
            qs["ssl"] = qs.pop("sslmode")
        qs.pop("channel_binding", None)
        new_query = urlencode(qs, doseq=True)
        url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment
        ))
    return url


# Create async engine
db_url = get_async_db_url(settings.DATABASE_URL)
engine = create_async_engine(
    db_url,
    echo=settings.ENVIRONMENT == "development",  # log SQL in dev
    pool_pre_ping=True,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields a DB session and closes it after the request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
