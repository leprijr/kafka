# Build frontend
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build backend
FROM node:20-slim AS backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY backend/ ./
RUN npm run build

# Runtime
FROM node:20-slim
WORKDIR /app
COPY --from=backend /app/backend/dist ./backend/dist
COPY --from=backend /app/backend/package.json ./backend/package.json
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN cd backend && npm install --omit=dev
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/kafka.db
EXPOSE 8080
CMD ["node", "backend/dist/index.js"]
