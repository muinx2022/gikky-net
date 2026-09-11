import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { EyeOff, Lock, ShieldAlert, Unlock, X } from "lucide-react-native";
import { modAnBinhLuan, modAnMach, modAnMoc, modKhoaMach } from "../lib/api";

export interface DoiTuongMod {
  loai: "mach" | "moc" | "comment";
  id: number;
  tieuDe?: string;
  dangKhoa?: boolean;
  dangAn?: boolean;
}

interface Props {
  hienThi: boolean;
  doiTuong: DoiTuongMod | null;
  onDong: () => void;
  onThanhCong?: () => void;
}

export function ModActionModal({ hienThi, doiTuong, onDong, onThanhCong }: Props) {
  const [hanhDong, setHanhDong] = useState<"khoa" | "an">("khoa");
  const [lyDo, setLyDo] = useState("");
  const [dangGui, setDangGui] = useState(false);

  if (!doiTuong) return null;

  const coKhoa = doiTuong.loai === "mach";
  const dangKhoa = doiTuong.dangKhoa ?? false;
  const dangAn = doiTuong.dangAn ?? false;

  const handleThucHien = async () => {
    if (!lyDo.trim()) {
      Alert.alert("Thiếu lý do", "Vui lòng nhập lý do mod (sẽ được lưu vào AuditLog).");
      return;
    }

    setDangGui(true);
    try {
      if (doiTuong.loai === "mach") {
        if (hanhDong === "khoa") {
          await modKhoaMach(doiTuong.id, !dangKhoa, lyDo.trim());
          Alert.alert(
            "Thành công",
            `Đã ${!dangKhoa ? "khoá" : "mở khoá"} mạch #${doiTuong.id}.`
          );
        } else {
          await modAnMach(doiTuong.id, !dangAn, lyDo.trim());
          Alert.alert(
            "Thành công",
            `Đã ${!dangAn ? "ẩn" : "bỏ ẩn"} mạch #${doiTuong.id}.`
          );
        }
      } else if (doiTuong.loai === "moc") {
        await modAnMoc(doiTuong.id, !dangAn, lyDo.trim());
        Alert.alert(
          "Thành công",
          `Đã ${!dangAn ? "ẩn" : "bỏ ẩn"} mốc #${doiTuong.id}.`
        );
      } else if (doiTuong.loai === "comment") {
        await modAnBinhLuan(doiTuong.id, !dangAn, lyDo.trim());
        Alert.alert(
          "Thành công",
          `Đã ${!dangAn ? "ẩn" : "bỏ ẩn"} bình luận #${doiTuong.id}.`
        );
      }
      setLyDo("");
      onThanhCong?.();
      onDong();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Thao tác mod không thành công.";
      Alert.alert("Lỗi", msg);
    } finally {
      setDangGui(false);
    }
  };

  const getTenDoiTuong = () => {
    if (doiTuong.tieuDe) return doiTuong.tieuDe;
    switch (doiTuong.loai) {
      case "mach":
        return `Mạch #${doiTuong.id}`;
      case "moc":
        return `Mốc #${doiTuong.id}`;
      case "comment":
        return `Bình luận #${doiTuong.id}`;
    }
  };

  return (
    <Modal visible={hienThi} animationType="slide" transparent onRequestClose={onDong}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={onDong}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={styles.sheetBox}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <ShieldAlert size={18} color="#eab308" />
              <Text style={styles.headerTitle}>Công cụ kiểm duyệt Mod</Text>
            </View>
            <TouchableOpacity onPress={onDong} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subHeader}>
            Đang can thiệp: <Text style={styles.highlightText}>{getTenDoiTuong()}</Text>
          </Text>

          {/* Chọn hành động nếu là Mạch */}
          {coKhoa && (
            <View style={styles.actionSelectRow}>
              <TouchableOpacity
                style={[styles.tabBtn, hanhDong === "khoa" && styles.tabBtnActive]}
                onPress={() => setHanhDong("khoa")}
              >
                {dangKhoa ? (
                  <Unlock size={14} color={hanhDong === "khoa" ? "#facc15" : "#9ca3af"} />
                ) : (
                  <Lock size={14} color={hanhDong === "khoa" ? "#facc15" : "#9ca3af"} />
                )}
                <Text style={[styles.tabBtnText, hanhDong === "khoa" && styles.tabBtnTextActive]}>
                  {dangKhoa ? "Mở khoá" : "Khoá mạch"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, hanhDong === "an" && styles.tabBtnActive]}
                onPress={() => setHanhDong("an")}
              >
                <EyeOff size={14} color={hanhDong === "an" ? "#facc15" : "#9ca3af"} />
                <Text style={[styles.tabBtnText, hanhDong === "an" && styles.tabBtnTextActive]}>
                  {dangAn ? "Bỏ ẩn" : "Ẩn mạch"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Mô tả thao tác */}
          <View style={styles.alertBox}>
            <Text style={styles.alertText}>
              {doiTuong.loai === "mach"
                ? hanhDong === "khoa"
                  ? dangKhoa
                    ? "Mở lại quyền đăng mốc tiếp theo và bình luận cho người dùng."
                    : "Khoá toàn bộ mạch này. Tác giả không thể nối mốc, người dùng không thể bình luận."
                  : dangAn
                    ? "Phục hồi hiển thị bài viết trên feed và trang tìm kiếm."
                    : "Ẩn bài viết khỏi feed công khai và kết quả tìm kiếm."
                : doiTuong.loai === "moc"
                  ? dangAn
                    ? "Bỏ ẩn mốc sự việc này."
                    : "Ẩn mốc sự việc này (để lại placeholder bia mộ cho mốc bị ẩn)."
                  : dangAn
                    ? "Bỏ ẩn bình luận này."
                    : "Ẩn bình luận này (để lại bia mộ nếu có câu trả lời bên dưới)."}
            </Text>
          </View>

          {/* Nhập lý do (AuditLog) */}
          <Text style={styles.sectionLabel}>LÝ DO KIỂM DUYỆT (BẮT BUỘC - LƯU VÀO AUDIT LOG)</Text>
          <TextInput
            style={styles.inputLyDo}
            placeholder="Nhập lý do thực hiện hành động này..."
            placeholderTextColor="#71717a"
            value={lyDo}
            onChangeText={setLyDo}
            multiline
            numberOfLines={3}
          />

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onDong}>
              <Text style={styles.cancelBtnText}>Huỷ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!lyDo.trim() || dangGui) && styles.btnDisabled,
              ]}
              onPress={handleThucHien}
              disabled={!lyDo.trim() || dangGui}
            >
              {dangGui ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Xác nhận Mod</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheetBox: {
    backgroundColor: "#18181b",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#f4f4f5",
    fontSize: 17,
    fontWeight: "700",
  },
  subHeader: {
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 14,
  },
  highlightText: {
    color: "#facc15",
    fontWeight: "600",
  },
  actionSelectRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    backgroundColor: "#27272a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabBtnActive: {
    borderColor: "#eab308",
    backgroundColor: "#2c2817",
  },
  tabBtnText: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "600",
  },
  tabBtnTextActive: {
    color: "#facc15",
  },
  alertBox: {
    backgroundColor: "#27272a",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#eab308",
  },
  alertText: {
    color: "#d4d4d8",
    fontSize: 12,
    lineHeight: 17,
  },
  sectionLabel: {
    color: "#71717a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  inputLyDo: {
    backgroundColor: "#27272a",
    borderRadius: 10,
    padding: 12,
    color: "#f4f4f5",
    fontSize: 13,
    textAlignVertical: "top",
    minHeight: 70,
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: "#a1a1aa",
    fontSize: 14,
    fontWeight: "600",
  },
  submitBtn: {
    backgroundColor: "#eab308",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 110,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
