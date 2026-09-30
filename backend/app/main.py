from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

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


# The built React app (npm run build). Every non-file path is an app page, so it gets index.html.
if DIST.exists():
    app.mount('/assets', StaticFiles(directory=DIST / 'assets'), name='assets')

    @app.get('/{path:path}', include_in_schema=False)
    async def spa(path: str):
        if path.startswith('api/'):
            raise HTTPException(404)
        f = (DIST / path).resolve()
        if path and f.is_file() and f.is_relative_to(DIST):
            return FileResponse(f)
        return FileResponse(DIST / 'index.html')
