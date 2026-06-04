# ------------------------------------------------------------
# Base image
# ------------------------------------------------------------
ARG NODE_VERSION=22.15.0
FROM node:${NODE_VERSION}-alpine

# ------------------------------------------------------------
# App setup
# ------------------------------------------------------------
WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Azure WebApp: Node must listen on port 80
EXPOSE 80

# ------------------------------------------------------------
# Run SSH + Node server
# ------------------------------------------------------------
CMD node app.js

