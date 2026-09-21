FROM node:22-alpine
WORKDIR /app

# No dependencies to install — the app is plain Node and the standard library.
COPY package.json ./
COPY lib ./lib
COPY bin ./bin
COPY public ./public
COPY server.js ./

ENV NODE_ENV=production

# DATA_DIR must be pointed at a mounted volume in production. The default here
# is inside the image, which a container host throws away on every deploy, so
# the app prints a warning at startup if it finds itself in that position.
ENV DATA_DIR=/data
VOLUME ["/data"]

# The host supplies PORT; 3000 is only the fallback the app uses locally.
EXPOSE 3000
CMD ["node", "server.js"]
