from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware

from . import api, auth
from .config import DIST
from .db import close, connect


@asynccontextmanager
async def lifespan(app):
    await connect()
    yield
    await close()


app = FastAPI(title='DSA Tracker', lifespan=lifespan, docs_url='/api/docs', openapi_url='/api/openapi.json', redoc_url=None)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.include_router(auth.router)
app.include_router(api.router)


@app.middleware('http')
async def security_headers(request, call_next):
    res = await call_next(request)
    res.headers.update({'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin'})
    return res


# The built React app (npm run build). On Vercel it is served from the CDN. Pages the browser opens directly
# (/today, /roadmap/learn …) get index.html; API routes always win over it.
if DIST.exists():
    app.frontend('/', directory=DIST)
