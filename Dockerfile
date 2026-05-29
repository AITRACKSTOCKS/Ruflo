# Use the official Node.js active LTS image
FROM node:20-alpine

# Install git, npx, and bash (needed for Ruflo commands)
RUN apk add --no-cache git bash

# Set working directory
WORKDIR /usr/src/app

# Copy package descriptors
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files (excluding those in .dockerignore)
COPY . .

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Start the dashboard application
CMD ["npm", "start"]
