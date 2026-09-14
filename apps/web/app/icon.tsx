import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "50%",
          border: "1px solid #1e293b",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: "16px",
            fontWeight: 800,
            fontFamily: "sans-serif",
            lineHeight: 1,
            marginTop: "-1px",
          }}
        >
          G
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "18px",
            marginTop: "2px",
          }}
        >
          <div
            style={{
              width: "3px",
              height: "3px",
              borderRadius: "50%",
              background: "#d49b42",
            }}
          />
          <div style={{ flex: 1, height: "1px", background: "#d49b42" }} />
          <div
            style={{
              width: "3px",
              height: "3px",
              borderRadius: "50%",
              background: "#d49b42",
            }}
          />
          <div style={{ flex: 1, height: "1px", background: "#d49b42" }} />
          <div
            style={{
              width: "3px",
              height: "3px",
              borderRadius: "50%",
              background: "#d49b42",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}

