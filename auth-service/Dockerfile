# Stage 1: build with npm
FROM node:20-alpine AS builder
WORKDIR /app

# Копируем только манифесты и ставим зависимости
COPY package*.json ./
RUN npm ci

# Копируем исходники и собираем
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: production image
FROM node:20-alpine AS runner
WORKDIR /app

# Копируем собранный код
COPY --from=builder /app/dist ./dist

# Копируем манифесты и ставим только prod-deps
COPY package*.json ./
RUN npm ci --omit=dev

EXPOSE 3000
CMD ["node", "dist/main.js"]
