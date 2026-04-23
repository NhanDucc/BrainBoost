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

# Expose port 80 for the React Development Server
EXPOSE 80

# Set PORT environment variable and start the frontend in development mode
ENV PORT=80
CMD ["npm", "start"]