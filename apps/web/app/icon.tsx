import { ImageResponse } from "next/og";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

function docIconBase64(): string {
  const duongDan = [
    join(process.cwd(), "public", "icon.png"),
    join(process.cwd(), "apps", "web", "public", "icon.png"),
    join(__dirname, "..", "..", "public", "icon.png"),
  ];
  for (const p of duongDan) {
    if (existsSync(p)) return readFileSync(p).toString("base64");
  }
  return "";
}

const iconDataUrl = `data:image/png;base64,${docIconBase64()}`;

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconDataUrl}
          alt=""
          width="32"
          height="32"
          style={{ width: "32px", height: "32px" }}
        />
      </div>
    ),
    { ...size }
  );
}
