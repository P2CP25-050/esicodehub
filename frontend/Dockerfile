FROM node:25-alpine

WORKDIR /app/frontend/

COPY package*.json .

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# Production mode
# RUN npm run build
# CMD ["npm", "start"]
