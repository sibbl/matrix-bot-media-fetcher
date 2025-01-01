import "dotenv/config";
import { existsSync, writeFileSync } from "fs";
import { join, extname } from "path";
import sanitize from "sanitize-filename";
import { utimes } from "utimes";
import { formatTimestamp, ensurePathExists, getFileNameFromContent } from "./shared.js";

const homeserverUrl = process.env.HOMESERVER_URL;
const accessToken = process.env.ACCESS_TOKEN;
const pageSize = 200;

const outputDirectory = process.env.OUTPUT_PATH || "./data/";
ensurePathExists(outputDirectory);

async function fetchWithRetry(
  url,
  options = {},
  retries = 10,
  backoffMs = 1000
) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`Download failed, retrying in ${backoffMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      backoffMs *= 2;
    }
  }
}

async function downloadRoomMessagesAsync(roomId) {
  const cleanRoomId = sanitize(roomId.substring(1), { replacement: "_" });

  const targetDirectory = join(outputDirectory, cleanRoomId);
  ensurePathExists(targetDirectory);

  let nextBatch = null;

  while (true) {
    const url = new URL(
      `${homeserverUrl}/_matrix/client/r0/rooms/${encodeURIComponent(
        roomId
      )}/messages`
    );
    url.searchParams.set("dir", "b"); // backwards
    url.searchParams.set("limit", pageSize);
    url.searchParams.set(
      "filter",
      JSON.stringify({ types: ["m.room.message"] })
    );
    if (nextBatch) {
      url.searchParams.set("from", nextBatch);
    }

    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      keepalive: false
    });
    const data = await res.json();

    if (!data.chunk?.length) break;

    for (const event of data.chunk) {
      if (event.type === "m.room.message" && event.content?.url) {
        const msgType = event.content.msgtype;
        if (msgType === "m.image" || msgType === "m.file") {
          const mxc = event.content.url.replace("mxc://", "");
          const [server, mediaId] = mxc.split("/");
          const eventFilename = getFileNameFromContent(event);
          const ext = extname(eventFilename);
          const prefix = formatTimestamp(event.origin_server_ts);
          const filename = `${prefix}_${mediaId}${ext}`;
          const targetFilePath = join(targetDirectory, filename);
          const downloadUrl = `${homeserverUrl}/_matrix/client/v1/media/download/${server}/${mediaId}`;

          if (existsSync(targetFilePath)) {
            console.log(
              `Skipping download of ${downloadUrl} to ${targetFilePath} because it already exists`
            );
            continue;
          }

          console.log(`Downloading ${downloadUrl} to ${targetFilePath}...`);
          const mediaRes = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if(mediaRes.status !== 200) {
            console.error("Failed!", mediaRes.status, mediaRes.statusText);
            return;
          }
          const buf = Buffer.from(await mediaRes.arrayBuffer());
          writeFileSync(targetFilePath, buf);
          utimes(targetFilePath, event.origin_server_ts);
        }
      }
    }

    // If no more pages, we're done
    if (!data.end) break;
    nextBatch = data.end;
  }
}

async function main() {
  // 1. Get all rooms the user has joined
  const joinedRoomsUrl = `${homeserverUrl}/_matrix/client/r0/joined_rooms`;
  const joinedRoomsRes = await fetch(joinedRoomsUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const joinedRoomsData = await joinedRoomsRes.json();

  // 2. For each joined room, download all messages
  for (const roomId of joinedRoomsData.joined_rooms) {
    console.log(`Downloading from room: ${roomId}`);
    await downloadRoomMessagesAsync(roomId);
  }
}

main().catch(console.error);
