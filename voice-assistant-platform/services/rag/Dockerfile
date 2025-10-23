FROM node:20-alpine

WORKDIR /app

# Install dependencies for PDF processing
RUN apk add --no-cache python3 make g++

# Copy package files
COPY services/rag/package*.json ./services/rag/
COPY shared/package*.json ./shared/

# Install dependencies
WORKDIR /app/services/rag
RUN npm install

# Copy source code
COPY services/rag/src ./src
COPY services/rag/tsconfig.json ./
COPY shared /app/shared

# Create uploads directory
RUN mkdir -p /app/uploads

# Build TypeScript
RUN npm run build

EXPOSE 5004

CMD ["npm", "start"]
