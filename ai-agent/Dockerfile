# Use Python 3.10 slim image
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /app

# Copy requirements file first to optimize layer caching
COPY requirements.txt .

# Install Python dependencies without storing cache to keep the image small
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire source code into the container
COPY . .

# Expose port 8001
EXPOSE 8001

# Command to run the FastAPI server using Uvicorn with hot-reload enabled
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]