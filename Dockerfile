FROM node:18-slim

# Install sharp dependencies
RUN apt-get update && apt-get install -y libvips-dev

WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application
COPY . .

# Use the port Hugging Face expects
ENV PORT=7860
EXPOSE 7860

CMD ["node", "server/app.js"]
