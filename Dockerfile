# One image: build the React app, then serve it and the API from a single uvicorn process.
FROM node:24-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.14-slim
WORKDIR /app
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/app backend/app
COPY content content
COPY --from=web /web/dist frontend/dist
WORKDIR /app/backend
EXPOSE 8000
# Hosts like Render and Railway pass PORT. MONGODB_URI (and DB_NAME) come from the host's environment settings.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
