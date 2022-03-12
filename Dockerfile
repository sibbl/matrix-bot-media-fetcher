FROM node:alpine
WORKDIR /home/app
COPY package.json .
COPY package-lock.json .
RUN npm ci
COPY index.js .
CMD [ "node", "index.js" ]