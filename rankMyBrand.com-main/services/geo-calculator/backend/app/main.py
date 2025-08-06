from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import endpoints
from .config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    docs_url=f"{settings.API_PREFIX}/docs"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    endpoints.router,
    prefix=f"{settings.API_PREFIX}/geo",
    tags=["GEO Analysis"]
)

@app.get("/")
async def root():
    return {
        "message": "RankMyBrand GEO Calculator API",
        "version": settings.VERSION,
        "docs": f"{settings.API_PREFIX}/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
