# Use Node.js version 18
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package management files first to leverage Docker caching
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the entire frontend source code into the container
COPY . .

# Expose port 3000 for the React Development Server
EXPOSE 3000

# Command to start the frontend in development mode
CMD ["npm", "start"]