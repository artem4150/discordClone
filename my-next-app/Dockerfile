# frontend/Dockerfile

# 1) Устанавливаем зависимости (production)
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json yarn.lock* ./
RUN npm ci --production

# 2) Собираем приложение
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
# Перед сборкой передаём API_URL, чтобы Next.js вшил его в билд
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

# 3) Запускаем production-сервер Next.js
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Чтобы в рантайме тоже была переменная (некоторые плагины/плагины её читают)
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "run", "start"]
