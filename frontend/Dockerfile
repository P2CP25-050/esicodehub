FROM node:20-alpine AS builder

WORKDIR /app/frontend

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


FROM node:20-alpine AS runner

WORKDIR /app/frontend

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci

COPY --from=builder /app/frontend/.next ./.next
COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["npm", "start"]
