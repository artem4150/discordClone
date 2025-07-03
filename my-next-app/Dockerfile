# 1) Устанавливаем ВСЕ зависимости для сборки
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json yarn.lock* ./
RUN npm ci                # без --production, чтобы был next и всё остальное

# 2) Собираем приложение
FROM node:18-alpine AS builder
WORKDIR /app
# Копируем node_modules из deps – они содержат и dev-, и peer- зависимости
COPY --from=deps /app/node_modules ./node_modules
# Копируем весь исходник
COPY . .
# Передаем API_URL и WS_URL, чтобы Next.js вшил их в билд
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG TURN_DOMAIN
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV TURN_DOMAIN=${TURN_DOMAIN}
RUN npm run build

# 3) Собираем облегчённый образ для продакшна
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Нужно положить только то, что нужно на рантайме:
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
 # Копируем и package.json, и package-lock.json, чтобы npm ci мог работать
 COPY --from=builder /app/package.json ./package.json
 COPY --from=builder /app/package-lock.json ./package-lock.json
 # Установим только production-зависимости
 RUN npm ci --omit=dev

# Пробрасываем переменную ещё раз, если кто-то читает её в рантайме
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV TURN_DOMAIN=${TURN_DOMAIN}

EXPOSE 3001
CMD ["npm", "run", "start"]
