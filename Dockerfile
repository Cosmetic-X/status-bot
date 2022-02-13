# Pull nodejs
FROM node:17.5.0

# Copy application files
COPY . .

# Install npm packages
RUN npm install

# Start the application
CMD ["npm", "start"]