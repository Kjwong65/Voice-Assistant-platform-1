FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY services/asr/package*.json ./services/asr/
COPY shared/package*.json ./shared/

# Install dependencies
WORKDIR /app/services/asr
RUN npm install

# Copy source code
COPY services/asr/src ./src
COPY services/asr/tsconfig.json ./
COPY shared /app/shared

# Build TypeScript
RUN npm run build

EXPOSE 5001

CMD ["npm", "start"]
