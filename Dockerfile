# Use official Node.js 20 base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install FFmpeg and required tools
RUN apt-get update && apt-get install -y \
  ffmpeg \
  curl \
  git \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Copy package files first for efficient caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the full project files
COPY . .

# Expose port if your dashboard or APIs run on a port (optional)
EXPOSE 3000

# Default command to start the bot
CMD ["npm", "start"]
