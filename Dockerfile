# Based on a template from https://docs.docker.com/guides/angular/containerize/#step-2-configure-the-dockerfile
# =========================================
# Stage 1: Build the Application
# =========================================

ARG NODE_VERSION=22-alpine3.21
ARG NGINX_VERSION=mainline-alpine-perl

FROM node:${NODE_VERSION} AS builder

# Set the working directory inside the container
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy the rest of the application source code into the container
COPY . .

# Build the application
RUN npm run build


# =========================================
# Stage 2: Prepare Nginx to Serve Static Files
# =========================================

FROM nginxinc/nginx-unprivileged:${NGINX_VERSION} AS runner

# Use a built-in non-root user for security best practices
USER nginx

# Copy the build output from the build stage
COPY --from=builder /app/dist/angular-mod-updater/browser /usr/share/nginx/html

# Copy the Nginx configuration file
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 8080
EXPOSE 8080

# Start Nginx directly with custom config
ENTRYPOINT ["nginx", "-c", "/etc/nginx/nginx.conf"]
CMD ["-g", "daemon off;"]
