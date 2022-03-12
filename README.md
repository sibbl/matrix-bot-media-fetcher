# Matrix bot media fetcher

A Matrix bot which downloads all media from the rooms it's invited to.

It will download all kind of content with a URL to the output directory. A folder will be created per room.

It will be tried to keep the original filename received by Matrix, but there might be numeric suffixes added to avoid files being overriden or - if no filename is available - the timestamp of the message will be used.

## Quick start

1. Option A: run via Node.js:
   1. Configure your .env file (see details below)
   1. Run `node index.js`
1. Option B: run via Docker Compose:
   1. Copy/rename `docker-compose.sample.yml` to `docker-compose.yml`
   1. Configure the environment variables in this file (see details below)
   1. Run `docker-compose up` (or append `-d` to run as daemon)

## Configuration

| Variable | Required | Description |
| -- | -- | -- |
| HOMESERVER_URL | Yes | Path to your homeserver. |
| ACCESS_TOKEN | Yes | Access token of your bot user. [Learn how to get an access token](https://t2bot.io/docs/access_tokens/). |
| MSG_TYPES | No | Comma separated list of message types to fetch. Defaults to everything with a URL. Sample value: `m.audio,m.file,m.image,m.video` |
| OUTPUT_PATH | No | Path to output directory. |
