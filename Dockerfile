# one-gateway public serve (playground + OpenAI-compatible proxy)
# Build:  docker build -t one-gateway .
# Run:    docker run --rm -p 3005:3005 --env-file .env one-gateway

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3005 \
    ONE_GATEWAY_TRUST_PROXY=true

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3005
CMD ["node", "dist/bin/serve.js"]
