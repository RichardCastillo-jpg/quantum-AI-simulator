FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci --no-audit --no-fund
COPY . .
ARG PUBLIC_API_URL
ENV PUBLIC_API_URL=$PUBLIC_API_URL
RUN npm run build
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
