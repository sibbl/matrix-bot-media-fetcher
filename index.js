import "dotenv/config";
import {
  MatrixClient,
  SimpleFsStorageProvider,
  AutojoinRoomsMixin,
  AutojoinUpgradedRoomsMixin
} from "matrix-bot-sdk";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, basename, extname } from "path";
import sanitize from "sanitize-filename";
import { utimes } from "utimes";

const homeserverUrl = process.env.HOMESERVER_URL;
const accessToken = process.env.ACCESS_TOKEN;

if (!homeserverUrl) throw new Error("Missing OUTPUT_PATH env variable.");
if (!accessToken) throw new Error("Missing ACCESS_TOKEN env variable.");

const msgTypes = (process.env.MSG_TYPES || "")
  .split(",")
  .filter((x) => x)
  .map((x) => x.trim().toLowerCase());

const outputDirectory = process.env.OUTPUT_PATH || "./data/";
const cacheDirectory = join(outputDirectory, ".cache");
ensurePathExists(outputDirectory);
ensurePathExists(cacheDirectory);

const storageProvider = new SimpleFsStorageProvider(
  join(outputDirectory, "bot-cache.json")
);

const client = new MatrixClient(homeserverUrl, accessToken, storageProvider);
AutojoinRoomsMixin.setupOnClient(client);
AutojoinUpgradedRoomsMixin.setupOnClient(client);
client.on("room.message", handleCommand);
client.start().then(() => console.info("Bot started!"));

async function handleCommand(roomId, event) {
  const msgType = event.content?.msgtype;
  if (event.content?.url === undefined) {
    return;
  }
  if (
    msgTypes.length > 0 &&
    msgTypes.includes(msgType?.toLowerCase()) === false
  ) {
    console.warn("Ignoring message due to filterd type: " + msgType);
    return;
  }
  const cleanRoomId = sanitize(roomId.substring(1), { replacement: "_" });
  const targetDirectory = join(outputDirectory, cleanRoomId);
  ensurePathExists(targetDirectory);
  const filename = getFileNameFromContent(event);
  console.info(`Downloading ${cleanRoomId}/${filename}...`);
  const targetFilePath = findUniqueFilename(targetDirectory, filename);
  const { data } = await client.downloadContent(event.content.url);
  writeFileSync(targetFilePath, data);
  utimes(targetFilePath, {
    btime: event.origin_server_ts
  });
}

function getFileNameFromContent(event) {
  if (event.content?.filename) return event.content.filename;
  if (event.content?.body) return event.content.body;

  const timestamp = event.origin_server_ts;
  if (event.content?.info?.mimetype) {
    const mimeTypeParts = event.content.info.mimetype.split("/");
    return timestamp + "." + mimeTypeParts[mimeTypeParts.length - 1];
  }
  return timestamp;
}

function ensurePathExists(p) {
  if (!existsSync(p)) mkdirSync(p);
}

function findUniqueFilename(dir, filename) {
  let fullpath = join(dir, filename);
  if (!existsSync(fullpath)) return fullpath;
  let i = 2;
  const ext = extname(filename);
  const base = basename(filename, ext);
  while (true) {
    filename = base + "_" + i + ext;
    fullpath = join(dir, filename);
    if (!existsSync(fullpath)) return fullpath;
    ++i;
  }
}
