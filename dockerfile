FROM node:current-alpine
ENV NODE_ENV=production

WORKDIR /app

COPY package.json /app
COPY package-lock.json /app
RUN npm ci && npm cache clean --force
COPY . /app

EXPOSE 8080

CMD ["node", "index.js"]
