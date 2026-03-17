# Use Node.js version 18
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy dependency files first to leverage Docker caching
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the backend source code
COPY . .

# Expose port 5000
EXPOSE 5000

# Command to start the backend in development mode
CMD ["npm", "run", "dev"]