import "dotenv/config";
import { existsSync, mkdirSync } from "fs";

export function getFileNameFromContent(event) {
  if (event.content?.filename) return event.content.filename;
  if (event.content?.body) return event.content.body;

  const timestamp = event.origin_server_ts;
  if (event.content?.info?.mimetype) {
    const mimeTypeParts = event.content.info.mimetype.split("/");
    return timestamp + "." + mimeTypeParts[mimeTypeParts.length - 1];
  }
  return timestamp;
}

export function ensurePathExists(p) {
  if (!existsSync(p)) mkdirSync(p);
}

export function formatTimestamp(ts) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_${hh}_${min}`;
}
