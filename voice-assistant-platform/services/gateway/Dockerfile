FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY services/gateway/package*.json ./services/gateway/
COPY shared/package*.json ./shared/

# Install dependencies
WORKDIR /app/services/gateway
RUN npm install

# Copy source code
COPY services/gateway/src ./src
COPY services/gateway/tsconfig.json ./
COPY shared /app/shared

# Build TypeScript
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
