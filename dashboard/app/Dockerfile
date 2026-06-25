# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/node_mapper.js ./node_mapper.js
COPY --from=build /app/safety_guardian.js ./safety_guardian.js
COPY --from=build /app/telemetry_logger.js ./telemetry_logger.js

EXPOSE 3000
CMD ["node", "server.js"]
