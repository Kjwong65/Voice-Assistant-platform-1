FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY services/tts/package*.json ./services/tts/
COPY shared/package*.json ./shared/

# Install dependencies
WORKDIR /app/services/tts
RUN npm install

# Copy source code
COPY services/tts/src ./src
COPY services/tts/tsconfig.json ./
COPY shared /app/shared

# Build TypeScript
RUN npm run build

EXPOSE 5003

CMD ["npm", "start"]
