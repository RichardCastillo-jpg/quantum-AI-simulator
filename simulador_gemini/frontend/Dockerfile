FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY public ./public
EXPOSE 4321
CMD ["serve", "-s", "public", "-l", "4321"]
