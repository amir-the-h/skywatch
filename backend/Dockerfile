FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev
COPY shared/ ../shared/
COPY backend/src/ ./src/
COPY public/airports.json ./airports.json
CMD ["npx", "tsx", "src/server.ts"]
