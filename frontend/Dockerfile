# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

# Build arg - EasyPanel lo inyecta en tiempo de build
ARG REACT_APP_BACKEND_URL=
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

ARG CACHEBUST=2

COPY package*.json yarn.lock* ./
RUN npm install --legacy-peer-deps && npm install ajv@^8 --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: serve con nginx
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
