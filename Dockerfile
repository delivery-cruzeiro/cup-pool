# syntax=docker/dockerfile:1
FROM node:22.22.0-alpine AS dependencies
WORKDIR /app
RUN npm install -g pnpm@11.24.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY vendor/ ./vendor/
ENV CI=true HUSKY=0
RUN --mount=type=cache,id=pnpm-cup-pool,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
FROM dependencies AS build
COPY . .
RUN pnpm run build
RUN node -e "const fs=require('fs');fs.writeFileSync('dist/version.json',JSON.stringify({service:'cup-pool',version:require('./package.json').version}))"
FROM nginx:1.28-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1

FROM build AS verification
RUN node scripts/verify.mjs

FROM production AS final
