import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Edit3, X } from "lucide-react-native";
import type { MocOut } from "@gikky/api-client";

import { SoanThaoHtml, chuanHoaHtmlKhiLuu } from "./SoanThaoHtml";

interface Props {
  hienThi: boolean;
  moc: MocOut | null;
  dangXuLy: boolean;
  onDong: () => void;
  onLuu: (mocId: number, body: string) => Promise<void>;
}

export function SuaMocModal({ hienThi, moc, dangXuLy, onDong, onLuu }: Props) {
  const [noiDung, setNoiDung] = useState("");
  const [loi, setLoi] = useState<string | null>(null);

  useEffect(() => {
    if (moc && hienThi) {
      setNoiDung(moc.body || "");
      setLoi(null);
    }
  }, [moc, hienThi]);

  const handleLuu = async () => {
    if (!moc) return;
    const raw = noiDung.trim();
    if (!raw) {
      setLoi("Nội dung mốc không được để trống.");
      return;
    }

    setLoi(null);
    try {
      const htmlFinal = chuanHoaHtmlKhiLuu(raw);
      await onLuu(moc.id, htmlFinal);
      onDong();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chỉnh sửa mốc không thành công.";
      setLoi(msg);
    }
  };

  return (
    <Modal
      visible={hienThi}
      animationType="slide"
      transparent
      onRequestClose={onDong}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onDong}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.titleRow}>
              <Edit3 size={18} color="#60a5fa" />
              <Text style={styles.modalTitle}>
                Chỉnh sửa {moc ? `Mốc #${moc.seq}` : "Mốc"}
              </Text>
            </View>
            <TouchableOpacity onPress={onDong} disabled={dangXuLy}>
              <X size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {loi ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{loi}</Text>
            </View>
          ) : null}

          {/* Soạn thảo rich text HTML */}
          <View style={{ marginBottom: 16 }}>
            <SoanThaoHtml
              giaTri={noiDung}
              onChange={setNoiDung}
              placeholder="Chỉnh sửa nội dung mốc..."
              minHeight={150}
            />
          </View>

          {/* Nút hành động */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={onDong}
              disabled={dangXuLy}
            >
              <Text style={styles.modalCancelText}>Huỷ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalSubmitBtn,
                (!noiDung.trim() || dangXuLy) && styles.btnDisabled,
              ]}
              disabled={!noiDung.trim() || dangXuLy}
              onPress={handleLuu}
            >
              {dangXuLy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalSubmitText}>Lưu thay đổi</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    padding: 16,
  },
  modalBox: {
    backgroundColor: "#18181b",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#27272a",
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    color: "#f4f4f5",
    fontSize: 17,
    fontWeight: "700",
  },
  errorBox: {
    backgroundColor: "#450a0a",
    borderWidth: 1,
    borderColor: "#991b1b",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    color: "#a1a1aa",
    fontSize: 14,
    fontWeight: "600",
  },
  modalSubmitBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  modalSubmitText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
