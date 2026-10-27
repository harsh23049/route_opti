# syntax=docker/dockerfile:1

# 1) C++ engine: build and run its tests so a broken engine never ships
FROM debian:bookworm-slim AS engine
RUN apt-get update \
 && apt-get install -y --no-install-recommends g++ cmake make \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY algorithms ./algorithms
COPY data ./data
RUN cmake -S algorithms -B algorithms/build -DCMAKE_BUILD_TYPE=Release -DROUTE_OPTI_WERROR=ON \
 && cmake --build algorithms/build --parallel \
 && ctest --test-dir algorithms/build --output-on-failure

# 2) Frontend bundle
FROM node:24-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --no-audit --no-fund
COPY frontend frontend
RUN npm run build -w frontend

# 3) Runtime: Express API + engine binary + static UI on one port
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev -w backend --no-audit --no-fund && npm cache clean --force
COPY backend/src backend/src
COPY --from=engine /src/algorithms/build/optimizer_engine algorithms/build/optimizer_engine
COPY --from=frontend /app/frontend/dist frontend/dist

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "backend/src/app.js"]
