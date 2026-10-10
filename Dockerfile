FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30-alpine
# Read when the container starts, not when the image is built: the nginx image renders
# the template below with these variables, and that is where /config.js comes from.
# The defaults are the addresses of the system contract.
ENV VITE_DEMO_MODE=true \
    VITE_API_URL=http://localhost:8080 \
    VITE_KEYCLOAK_URL=http://localhost:8180 \
    VITE_KEYCLOAK_REALM=store \
    VITE_KEYCLOAK_CLIENT_ID=store-web
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 5173
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:5173/healthz || exit 1
