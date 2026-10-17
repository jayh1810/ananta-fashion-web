# Coolify: set Build Pack = Dockerfile (not Nixpacks).
# Nixpacks downloads nixpkgs from GitHub and this host gets HTTP 429.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BRAND
ARG NEXT_PUBLIC_API_HOST
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_BRAND=$NEXT_PUBLIC_BRAND
ENV NEXT_PUBLIC_API_HOST=$NEXT_PUBLIC_API_HOST
ENV NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Coolify injects PORT at runtime; 3000 is only a fallback
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
