import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          borderRadius: "36px",
          border: "4px solid #1e293b",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: "44px",
            fontWeight: 800,
            letterSpacing: "3px",
            fontFamily: "sans-serif",
          }}
        >
          GIKKY
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100px",
            margin: "12px 0 8px 0",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#d49b42",
            }}
          />
          <div style={{ flex: 1, height: "2px", background: "#d49b42" }} />
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#d49b42",
            }}
          />
          <div style={{ flex: 1, height: "2px", background: "#d49b42" }} />
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#d49b42",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            color: "#94a3b8",
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "2px",
            fontFamily: "sans-serif",
          }}
        >
          .NET
        </div>
      </div>
    ),
    { ...size }
  );
}

