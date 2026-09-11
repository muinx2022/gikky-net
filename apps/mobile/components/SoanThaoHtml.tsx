import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Bold,
  Code,
  Eye,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  PenTool,
  Quote,
} from "lucide-react-native";

import { ThanHtml } from "./ThanHtml";

interface Props {
  giaTri: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

/** Tự động bọc các đoạn văn thuần thành thẻ <p> nếu chưa có thẻ HTML */
export function chuanHoaHtmlKhiLuu(noiDung: string): string {
  const text = noiDung.trim();
  if (!text) return "";
  // Nếu đã chứa các thẻ HTML cơ bản
  if (/<(p|blockquote|ul|ol|h2|h3|strong|em|div|table)[^>]*>/i.test(text)) {
    return text;
  }
  // Nếu chỉ là plain text thông thường, tách đoạn theo dòng trống
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs
    .map((p) => `<p>${p.trim().replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export function SoanThaoHtml({
  giaTri,
  onChange,
  placeholder = "Viết nội dung (hỗ trợ HTML và công cụ định dạng)...",
  minHeight = 160,
}: Props) {
  const [tab, setTab] = useState<"soan" | "xem_truoc">("soan");
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const apDungDinhDang = (theMo: string, theDong: string, mauMacDinh = "nội dung") => {
    const start = selection.start;
    const end = selection.end;
    let textMoi = "";
    let conTroMoi = start + theMo.length;

    if (start !== end) {
      // Đang bôi đen một đoạn text
      const doanChon = giaTri.substring(start, end);
      textMoi =
        giaTri.substring(0, start) +
        `${theMo}${doanChon}${theDong}` +
        giaTri.substring(end);
      conTroMoi = end + theMo.length + theDong.length;
    } else {
      // Không bôi đen, chèn mẫu
      textMoi =
        giaTri.substring(0, start) +
        `${theMo}${mauMacDinh}${theDong}` +
        giaTri.substring(start);
      conTroMoi = start + theMo.length + mauMacDinh.length + theDong.length;
    }

    onChange(textMoi);
    setSelection({ start: conTroMoi, end: conTroMoi });
  };

  const chènDanhSach = (loai: "ul" | "ol") => {
    const start = selection.start;
    const end = selection.end;
    const doanChon = giaTri.substring(start, end);

    let noiDungDs = "";
    if (doanChon.trim()) {
      noiDungDs = doanChon
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => `  <li>${l.trim()}</li>`)
        .join("\n");
    } else {
      noiDungDs = "  <li>Ý thứ nhất</li>\n  <li>Ý thứ hai</li>";
    }

    const htmlDs = `\n<${loai}>\n${noiDungDs}\n</${loai}>\n`;
    const textMoi =
      giaTri.substring(0, start) + htmlDs + giaTri.substring(end);
    onChange(textMoi);
  };

  const chènLienKet = () => {
    const start = selection.start;
    const end = selection.end;
    const doanChon = giaTri.substring(start, end) || "Liên kết";
    const tag = `<a href="https://example.com">${doanChon}</a>`;
    const textMoi =
      giaTri.substring(0, start) + tag + giaTri.substring(end);
    onChange(textMoi);
  };

  return (
    <View style={styles.container}>
      {/* Header: Chuyển Tab Soạn Thảo / Xem Trước */}
      <View style={styles.tabHeader}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "soan" && styles.tabBtnActive]}
          onPress={() => setTab("soan")}
        >
          <PenTool size={14} color={tab === "soan" ? "#3b82f6" : "#71717a"} />
          <Text
            style={[
              styles.tabBtnText,
              tab === "soan" && styles.tabBtnTextActive,
            ]}
          >
            Soạn thảo HTML
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === "xem_truoc" && styles.tabBtnActive]}
          onPress={() => setTab("xem_truoc")}
        >
          <Eye size={14} color={tab === "xem_truoc" ? "#3b82f6" : "#71717a"} />
          <Text
            style={[
              styles.tabBtnText,
              tab === "xem_truoc" && styles.tabBtnTextActive,
            ]}
          >
            Xem trước
          </Text>
        </TouchableOpacity>
      </View>

      {/* Thanh công cụ định dạng HTML (Toolbar) */}
      {tab === "soan" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.toolbar}
          contentContainerStyle={styles.toolbarContent}
        >
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => apDungDinhDang("<strong>", "</strong>", "chữ đậm")}
            accessibilityLabel="In đậm"
          >
            <Bold size={16} color="#e4e4e7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => apDungDinhDang("<em>", "</em>", "chữ nghiêng")}
            accessibilityLabel="In nghiêng"
          >
            <Italic size={16} color="#e4e4e7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => apDungDinhDang("<h2>", "</h2>\n", "Tiêu đề mục")}
            accessibilityLabel="Tiêu đề H2"
          >
            <Heading2 size={16} color="#e4e4e7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => apDungDinhDang("<h3>", "</h3>\n", "Tiêu đề phụ")}
            accessibilityLabel="Tiêu đề H3"
          >
            <Heading3 size={16} color="#e4e4e7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() =>
              apDungDinhDang(
                "<blockquote>",
                "</blockquote>\n",
                "Trích dẫn nhận định quan trọng..."
              )
            }
            accessibilityLabel="Trích dẫn"
          >
            <Quote size={16} color="#e4e4e7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => chènDanhSach("ul")}
            accessibilityLabel="Danh sách gạch đầu dòng"
          >
            <List size={16} color="#e4e4e7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => chènDanhSach("ol")}
            accessibilityLabel="Danh sách số"
          >
            <ListOrdered size={16} color="#e4e4e7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => apDungDinhDang("<code>", "</code>", "mã_lệnh")}
            accessibilityLabel="Code"
          >
            <Code size={16} color="#e4e4e7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={chènLienKet}
            accessibilityLabel="Chèn liên kết"
          >
            <Link size={16} color="#e4e4e7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => apDungDinhDang("<p>", "</p>\n", "Đoạn văn mới")}
            accessibilityLabel="Đoạn văn"
          >
            <Text style={styles.tagBtnText}>&lt;p&gt;</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Vùng soạn thảo hoặc Xem trước */}
      {tab === "soan" ? (
        <TextInput
          style={[styles.input, { minHeight }]}
          placeholder={placeholder}
          placeholderTextColor="#71717a"
          value={giaTri}
          onChangeText={onChange}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          multiline
          textAlignVertical="top"
        />
      ) : (
        <View style={[styles.previewBox, { minHeight }]}>
          {giaTri.trim() ? (
            <ThanHtml body={chuanHoaHtmlKhiLuu(giaTri)} />
          ) : (
            <Text style={styles.previewEmpty}>
              (Chưa có nội dung để xem trước)
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    overflow: "hidden",
    marginBottom: 16,
  },
  tabHeader: {
    flexDirection: "row",
    backgroundColor: "#18181b",
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 14,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: {
    borderBottomColor: "#3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.06)",
  },
  tabBtnText: {
    color: "#71717a",
    fontSize: 13,
    fontWeight: "600",
  },
  tabBtnTextActive: {
    color: "#60a5fa",
  },
  toolbar: {
    backgroundColor: "#222225",
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  toolbarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  toolBtn: {
    backgroundColor: "#2a2a2e",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 34,
  },
  tagBtnText: {
    color: "#60a5fa",
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    color: "#f4f4f5",
    fontSize: 14,
    lineHeight: 20,
    padding: 14,
  },
  previewBox: {
    padding: 14,
    backgroundColor: "#141416",
  },
  previewEmpty: {
    color: "#71717a",
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 20,
    textAlign: "center",
  },
});
