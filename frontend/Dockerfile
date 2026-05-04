FROM node:20-alpine

WORKDIR /app/frontend/

COPY package*.json .

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# Production mode
# RUN npm run build
# CMD ["npm", "start"]
