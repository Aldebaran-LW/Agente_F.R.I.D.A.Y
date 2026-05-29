FROM node:20-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY public ./public
ENV PORT=7860
ENV KEEPALIVE_MS=240000
EXPOSE 7860
CMD ["node", "server.mjs"]
