# Dockerfile
#FROM node:18-alpine
FROM ubi8/nodejs-18
# Create app directory
WORKDIR /opt/app-root/src

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

#RUN ln -s /app/websocket-metrics-app.js /app/app.js
# Create non-root user for security
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser && \
    chown -R appuser:appuser /opt/app-root/src

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

