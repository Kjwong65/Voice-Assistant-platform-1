FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY services/console/package*.json ./services/console/
COPY shared/package*.json ./shared/

# Install dependencies
WORKDIR /app/services/console
RUN npm install

# Copy source code
COPY services/console/src ./src
COPY services/console/tsconfig.json ./
COPY shared /app/shared

# Build TypeScript
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
