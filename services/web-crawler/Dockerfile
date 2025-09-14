FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Clean and install dependencies
RUN rm -rf package-lock.json node_modules && npm install

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build || npx tsc || echo "No build step"

EXPOSE 3002

CMD ["npm", "start"]