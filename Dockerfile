FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY apps ./apps
COPY libs ./libs
RUN npm ci
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY nest-cli.json ./

ARG APP_NAME=producer
ENV APP_NAME=${APP_NAME}

CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]
