FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY services/llm/package*.json ./services/llm/
COPY shared/package*.json ./shared/ 2>/dev/null || true

# Install dependencies
WORKDIR /app/services/llm
RUN npm install

# Copy source code
COPY services/llm/src ./src
COPY services/llm/tsconfig.json ./
COPY shared /app/shared

# Build TypeScript
RUN npm run build

EXPOSE 5002

CMD ["npm", "start"]
