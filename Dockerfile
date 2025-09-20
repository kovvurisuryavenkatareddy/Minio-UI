FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

# Copy source + env file
COPY . .

# If you want to copy .env
COPY .env .env

RUN npm run build

FROM nginx:stable-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]