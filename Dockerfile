# Dockerfile
#FROM node:18-alpine
FROM ubi8/nodejs-18
# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN chmod -R 777 /app/
RUN chmod -R 777 /app/src
RUN chmod -R g+rw /app/src/.npm
RUN npm install

# Bundle app source
COPY . .

#RUN ln -s /app/websocket-metrics-app.js /app/app.js
# Create non-root user for security
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose the application port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health/live || exit 1

# Start the application
#CMD ["node", "app.js"]
CMD ["npm", "start"]

