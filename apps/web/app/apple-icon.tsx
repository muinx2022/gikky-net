import { ImageResponse } from "next/og";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

function docAppleIconBase64(): string {
  const duongDan = [
    join(process.cwd(), "public", "apple-icon.png"),
    join(process.cwd(), "apps", "web", "public", "apple-icon.png"),
    join(__dirname, "..", "..", "public", "apple-icon.png"),
  ];
  for (const p of duongDan) {
    if (existsSync(p)) return readFileSync(p).toString("base64");
  }
  return "";
}

const appleIconDataUrl = `data:image/png;base64,${docAppleIconBase64()}`;

export default function AppleIcon() {
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
          src={appleIconDataUrl}
          alt=""
          width="180"
          height="180"
          style={{ width: "180px", height: "180px" }}
        />
      </div>
    ),
    { ...size }
  );
}
