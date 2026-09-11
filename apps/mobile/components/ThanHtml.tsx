import React from "react";
import {
  Image,
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { API_BASE_URL } from "../lib/config";

interface Props {
  body: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  numberOfLines?: number;
}

/** Giải mã các thực thể HTML cơ bản */
function giaiMaHtml(str: string): string {
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&apos;/gi, "'");
}

type InlineToken =
  | { loai: "text"; text: string }
  | { loai: "strong"; text: string }
  | { loai: "em"; text: string }
  | { loai: "code"; text: string }
  | { loai: "a"; text: string; href?: string }
  | { loai: "br" };

/** Tách các thẻ inline trong 1 đoạn văn bản */
function phanTichInline(raw: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // Bắt các cặp thẻ inline thông dụng
  const regex = /<(strong|b|em|i|code|a)\b([^>]*)>([\s\S]*?)<\/\1>|<(br)\s*\/?>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = raw.slice(lastIndex, match.index);
      if (textChunk) {
        tokens.push({ loai: "text", text: giaiMaHtml(textChunk) });
      }
    }

    if (match[4]) {
      tokens.push({ loai: "br" });
    } else {
      const tag = (match[1] || "").toLowerCase();
      const attrs = match[2] || "";
      const inner = match[3] || "";

      let href: string | undefined;
      if (tag === "a") {
        const mHref = attrs.match(/href=["']([^"']*)["']/i);
        if (mHref) href = mHref[1];
      }

      const kieu =
        tag === "b" ? "strong" : tag === "i" ? "em" : (tag as "strong" | "em" | "code" | "a");

      tokens.push({
        loai: kieu,
        text: giaiMaHtml(inner.replace(/<[^>]+>/g, "")),
        href,
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < raw.length) {
    const remaining = raw.slice(lastIndex);
    if (remaining) {
      tokens.push({ loai: "text", text: giaiMaHtml(remaining) });
    }
  }

  return tokens;
}

type BlockItem =
  | { kieu: "p"; html: string }
  | { kieu: "h"; level: number; html: string }
  | { kieu: "trich"; html: string }
  | { kieu: "ul"; items: string[] }
  | { kieu: "ol"; items: string[] }
  | { kieu: "img"; src: string; alt?: string };

/** Phân tách HTML thành các khối (Block elements) */
function phanTichKhoi(html: string): BlockItem[] {
  const blocks: BlockItem[] = [];
  if (!html || !html.trim()) return blocks;

  // Nếu không chứa bất kỳ thẻ html nào, coi như chuỗi văn bản thường
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    const lines = html.split(/\n\n+/);
    for (const line of lines) {
      if (line.trim()) {
        blocks.push({ kieu: "p", html: line.trim() });
      }
    }
    return blocks;
  }

  // Regex bắt các khối HTML cấp cao nhất
  const blockRegex =
    /<(p|h[1-6]|blockquote|ul|ol|figure)\b[^>]*>([\s\S]*?)<\/\1>|<img\b([^>]*?)\/?>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(html)) !== null) {
    // Đoạn text ở giữa các block (nếu có)
    if (match.index > lastIndex) {
      const mid = html.slice(lastIndex, match.index).trim();
      if (mid && mid !== "<br>" && mid !== "<br/>") {
        const cleanMid = mid.replace(/^<br\s*\/?>|<br\s*\/?>$/gi, "").trim();
        if (cleanMid) {
          blocks.push({ kieu: "p", html: cleanMid });
        }
      }
    }

    if (match[3] !== undefined) {
      // Thẻ <img> tự đóng
      const imgAttrs = match[3];
      const mSrc = imgAttrs.match(/src=["']([^"']*)["']/i);
      const mAlt = imgAttrs.match(/alt=["']([^"']*)["']/i);
      if (mSrc && mSrc[1]) {
        blocks.push({
          kieu: "img",
          src: mSrc[1],
          alt: mAlt ? mAlt[1] : undefined,
        });
      }
    } else {
      const tag = (match[1] || "").toLowerCase();
      const content = match[2] || "";

      if (tag.startsWith("h")) {
        const level = parseInt(tag[1], 10) || 2;
        blocks.push({ kieu: "h", level, html: content });
      } else if (tag === "blockquote") {
        blocks.push({ kieu: "trich", html: content });
      } else if (tag === "ul" || tag === "ol") {
        const liMatches = content.match(/<li\b[^>]*>([\s\S]*?)<\/li>/gi);
        const items = (liMatches || []).map((li) => li.replace(/<\/?li\b[^>]*>/gi, "").trim());
        blocks.push({ kieu: tag as "ul" | "ol", items });
      } else if (tag === "figure") {
        // Có thể chứa thẻ <img> bên trong
        const mSrc = content.match(/<img\b[^>]*src=["']([^"']*)["']/i);
        const mAlt = content.match(/<img\b[^>]*alt=["']([^"']*)["']/i);
        if (mSrc && mSrc[1]) {
          blocks.push({
            kieu: "img",
            src: mSrc[1],
            alt: mAlt ? mAlt[1] : undefined,
          });
        }
      } else {
        // Tag <p> - kiểm tra nếu bên trong có chứa thẻ <img>
        const mImg = content.match(/<img\b([^>]*?)\/?>/i);
        if (mImg) {
          const imgAttrs = mImg[1];
          const mSrc = imgAttrs.match(/src=["']([^"']*)["']/i);
          const mAlt = imgAttrs.match(/alt=["']([^"']*)["']/i);
          if (mSrc && mSrc[1]) {
            blocks.push({
              kieu: "img",
              src: mSrc[1],
              alt: mAlt ? mAlt[1] : undefined,
            });
          }
          const conLai = content.replace(/<img\b[^>]*\/?>/gi, "").trim();
          if (conLai) {
            blocks.push({ kieu: "p", html: conLai });
          }
        } else {
          blocks.push({ kieu: "p", html: content });
        }
      }
    }

    lastIndex = blockRegex.lastIndex;
  }

  // Đoạn đuôi còn lại
  if (lastIndex < html.length) {
    const rest = html.slice(lastIndex).trim();
    if (rest) {
      blocks.push({ kieu: "p", html: rest });
    }
  }

  return blocks;
}

/** Component hiển thị thân nội dung HTML an toàn cho React Native */
export function ThanHtml({ body, style, containerStyle, numberOfLines }: Props) {
  if (!body) return null;

  const blocks = phanTichKhoi(body);

  if (blocks.length === 0) return null;

  return (
    <View style={[styles.container, containerStyle]}>
      {blocks.map((block, index) => {
        switch (block.kieu) {
          case "h": {
            const tokens = phanTichInline(block.html);
            return (
              <Text
                key={index}
                style={[
                  styles.heading,
                  block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3,
                ]}
                numberOfLines={numberOfLines}
              >
                {tokens.map((t, i) => renderInlineToken(t, i, style))}
              </Text>
            );
          }

          case "trich": {
            const tokens = phanTichInline(block.html.replace(/<\/?p\b[^>]*>/gi, " "));
            return (
              <View key={index} style={styles.blockquote}>
                <Text style={[styles.blockquoteText, style]} numberOfLines={numberOfLines}>
                  {tokens.map((t, i) => renderInlineToken(t, i, style))}
                </Text>
              </View>
            );
          }

          case "ul":
          case "ol": {
            return (
              <View key={index} style={styles.listContainer}>
                {block.items.map((item, idx) => {
                  const tokens = phanTichInline(item);
                  return (
                    <View key={idx} style={styles.listItem}>
                      <Text style={styles.listBullet}>
                        {block.kieu === "ol" ? `${idx + 1}. ` : "• "}
                      </Text>
                      <Text style={[styles.paragraph, style]} numberOfLines={numberOfLines}>
                        {tokens.map((t, i) => renderInlineToken(t, i, style))}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          }

          case "img": {
            const imgUrl = block.src.startsWith("http")
              ? block.src
              : `${API_BASE_URL}${block.src.startsWith("/") ? "" : "/"}${block.src}`;
            return (
              <View key={index} style={styles.imageContainer}>
                <Image
                  source={{ uri: imgUrl }}
                  style={styles.embeddedImage}
                  resizeMode="contain"
                />
                {block.alt ? <Text style={styles.imageCaption}>{block.alt}</Text> : null}
              </View>
            );
          }

          case "p":
          default: {
            const tokens = phanTichInline(block.html);
            return (
              <Text
                key={index}
                style={[styles.paragraph, style]}
                numberOfLines={numberOfLines}
              >
                {tokens.map((t, i) => renderInlineToken(t, i, style))}
              </Text>
            );
          }
        }
      })}
    </View>
  );
}

function renderInlineToken(
  token: InlineToken,
  idx: number,
  baseStyle?: StyleProp<TextStyle>
) {
  switch (token.loai) {
    case "strong":
      return (
        <Text key={idx} style={styles.strong}>
          {token.text}
        </Text>
      );
    case "em":
      return (
        <Text key={idx} style={styles.em}>
          {token.text}
        </Text>
      );
    case "code":
      return (
        <Text key={idx} style={styles.code}>
          {token.text}
        </Text>
      );
    case "a":
      return (
        <Text
          key={idx}
          style={styles.link}
          onPress={() => {
            if (token.href) {
              Linking.openURL(token.href).catch(() => {});
            }
          }}
        >
          {token.text}
        </Text>
      );
    case "br":
      return "\n";
    case "text":
    default:
      return token.text;
  }
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  paragraph: {
    color: "#e4e4e7",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  heading: {
    color: "#f4f4f5",
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
  },
  h1: { fontSize: 18, lineHeight: 26 },
  h2: { fontSize: 16, lineHeight: 24 },
  h3: { fontSize: 15, lineHeight: 22 },
  strong: {
    fontWeight: "700",
    color: "#ffffff",
  },
  em: {
    fontStyle: "italic",
    color: "#e4e4e7",
  },
  code: {
    fontFamily: "monospace",
    backgroundColor: "#27272a",
    color: "#fbbf24",
    paddingHorizontal: 4,
    borderRadius: 3,
    fontSize: 13,
  },
  link: {
    color: "#60a5fa",
    textDecorationLine: "underline",
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
    backgroundColor: "#172033",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 10,
  },
  blockquoteText: {
    color: "#93c5fd",
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 20,
  },
  listContainer: {
    marginBottom: 8,
    paddingLeft: 4,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  listBullet: {
    color: "#60a5fa",
    fontSize: 14,
    lineHeight: 22,
    marginRight: 6,
    minWidth: 14,
  },
  imageContainer: {
    width: "100%",
    marginVertical: 8,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  embeddedImage: {
    width: "100%",
    height: 220,
    backgroundColor: "#27272a",
  },
  imageCaption: {
    color: "#a1a1aa",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 6,
    fontStyle: "italic",
  },
});
