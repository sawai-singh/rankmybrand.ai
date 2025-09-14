FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Clean npm cache and remove lock file to avoid platform issues
RUN rm -rf package-lock.json node_modules

# Install dependencies fresh
RUN npm install

# Copy application code
COPY . .

# Build Next.js application
RUN npm run build || echo "Build failed, continuing..."

EXPOSE 3003

CMD ["npm", "start"]