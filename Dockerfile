FROM node:22-alpine
WORKDIR /app

# No dependencies to install — the app is plain Node and the standard library.
COPY package.json ./
COPY lib ./lib
COPY bin ./bin
COPY public ./public
COPY server.js ./

ENV NODE_ENV=production

# DATA_DIR must point at a volume mounted by the host. Railway rejects a
# docker VOLUME instruction outright — volumes there are attached to the
# service, not declared in the image — so this only names the path the mount
# is expected at. The app warns loudly at startup if it finds itself writing
# somewhere the host will throw away.
ENV DATA_DIR=/data

# The host supplies PORT; 3000 is only the fallback the app uses locally.
EXPOSE 3000
CMD ["node", "server.js"]
