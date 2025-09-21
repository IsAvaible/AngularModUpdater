# Stage 1: Build the application
FROM node:20.19 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN ls -la && npm run build --prod

# Stage 2: Serve the application with Nginx
FROM nginx:alpine AS production-stage

COPY --from=build /app/dist/angular-mod-updater/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
