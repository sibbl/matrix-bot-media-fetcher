import "dotenv/config";
import {
  MatrixClient,
  SimpleFsStorageProvider,
  AutojoinRoomsMixin,
  AutojoinUpgradedRoomsMixin
} from "matrix-bot-sdk";
import * as sdk from "matrix-js-sdk";
import { writeFileSync } from "fs";
import { join, extname } from "path";
import sanitize from "sanitize-filename";
import { utimes } from "utimes";
import { formatTimestamp, ensurePathExists, getFileNameFromContent } from "./shared.js";

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

const sdkClient = sdk.createClient({ baseUrl: homeserverUrl });

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

  const mxc = event.content.url.replace("mxc://", "");
  const [_, mediaId] = mxc.split("/");
  const eventFilename = getFileNameFromContent(event);
  const ext = extname(eventFilename);
  const prefix = formatTimestamp(event.origin_server_ts);
  const filename = `${prefix}_${mediaId}${ext}`;

  console.info(`Downloading ${cleanRoomId}/${filename}...`);

  const targetFilePath = join(targetDirectory, filename);

  let data = null;
  try {
    // we need to use the sdkClient because the bot-sdk doesn't support authenticated downloads (yet?)
    const downloadUrl = sdkClient.mxcUrlToHttp(
      /*mxcUrl=*/ event.content.url, // the MXC URI to download/thumbnail, typically from an event or profile
      /*width=*/ undefined, // part of the thumbnail API. Use as required.
      /*height=*/ undefined, // part of the thumbnail API. Use as required.
      /*resizeMethod=*/ undefined, // part of the thumbnail API. Use as required.
      /*allowDirectLinks=*/ false, // should generally be left `false`.
      /*allowRedirects=*/ true, // implied supported with authentication
      /*useAuthentication=*/ true // the flag we're after in this example
    );
    const mediaRes = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    data = Buffer.from(await mediaRes.arrayBuffer());
  } catch (e) {
    console.error(
      `Error downloading ${event.content.url} from ${roomId}`,
      e?.toJson?.() || e
    );
    return;
  }

  writeFileSync(targetFilePath, data);
  utimes(targetFilePath, event.origin_server_ts);
}