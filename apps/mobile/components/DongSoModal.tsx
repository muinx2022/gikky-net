import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AlertCircle, CheckCircle2, X } from "lucide-react-native";

interface Props {
  hienThi: boolean;
  tieuDeMach: string;
  dangXuLy: boolean;
  onDong: () => void;
  onXacNhan: (ketQua: string, baiHoc: string) => Promise<void>;
}

export function DongSoModal({
  hienThi,
  tieuDeMach,
  dangXuLy,
  onDong,
  onXacNhan,
}: Props) {
  const [ketQua, setKetQua] = useState("");
  const [baiHoc, setBaiHoc] = useState("");
  const [loi, setLoi] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoi(null);
    try {
      await onXacNhan(ketQua.trim(), baiHoc.trim());
      setKetQua("");
      setBaiHoc("");
      onDong();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đóng sổ mạch không thành công.";
      setLoi(msg);
    }
  };

  return (
    <Modal
      visible={hienThi}
      transparent
      animationType="fade"
      onRequestClose={onDong}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <CheckCircle2 size={20} color="#f59e0b" />
              <Text style={styles.title}>Đóng sổ mạch</Text>
            </View>
            <TouchableOpacity
              onPress={onDong}
              disabled={dangXuLy}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.tieuDeMach} numberOfLines={2}>
              {tieuDeMach}
            </Text>

            {/* Lưu ý / Cảnh báo */}
            <View style={styles.warningBox}>
              <AlertCircle size={16} color="#fbbf24" style={styles.warningIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.warningText}>
                  • Sau khi đóng sổ, bạn sẽ <Text style={{ fontWeight: "700" }}>không thể nối thêm mốc</Text> vào mạch này nữa.
                </Text>
                <Text style={styles.warningText}>
                  • Người xem vẫn có thể thảo luận và bình luận bình thường.
                </Text>
                <Text style={styles.warningText}>
                  • Bạn có thể mở lại sổ trong vòng <Text style={{ fontWeight: "700" }}>7 ngày</Text> tới.
                </Text>
              </View>
            </View>

            {loi ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{loi}</Text>
              </View>
            ) : null}

            {/* Nhập kết quả / kết luận */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Kết quả / Dòng kết luận</Text>
              <TextInput
                style={styles.input}
                placeholder="VD: Đạt mục tiêu chốt lời 20% sau 3 tháng..."
                placeholderTextColor="#71717a"
                value={ketQua}
                onChangeText={setKetQua}
                maxLength={300}
                multiline
              />
              <Text style={styles.hint}>Tối đa 300 ký tự. Có thể để trống.</Text>
            </View>

            {/* Nhập bài học rút ra */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>📋 Mổ xẻ sau lệnh &amp; Bài học rút ra</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="VD: Điểm vào lệnh tốt nhưng điểm cắt lỗ đặt quá sát, cần kiên nhẫn hơn với các đợt rung lắc..."
                placeholderTextColor="#71717a"
                value={baiHoc}
                onChangeText={setBaiHoc}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.hint}>Chia sẻ kinh nghiệm quý giá cho người đọc và cho chính bạn trong tương lai.</Text>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onDong}
              disabled={dangXuLy}
            >
              <Text style={styles.cancelBtnText}>Huỷ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={dangXuLy}
            >
              {dangXuLy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Xác nhận đóng sổ</Text>
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
    justifyContent: "center",
    padding: 16,
  },
  card: {
    backgroundColor: "#18181b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    maxHeight: "85%",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#f4f4f5",
    fontSize: 18,
    fontWeight: "700",
  },
  scrollArea: {
    marginVertical: 4,
  },
  tieuDeMach: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  warningBox: {
    flexDirection: "row",
    backgroundColor: "#292524",
    borderWidth: 1,
    borderColor: "#44403c",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  warningIcon: {
    marginTop: 2,
  },
  warningText: {
    color: "#d6d3d1",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  errorBox: {
    backgroundColor: "#450a0a",
    borderWidth: 1,
    borderColor: "#991b1b",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    color: "#d4d4d8",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#27272a",
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 8,
    padding: 10,
    color: "#f4f4f5",
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
  },
  hint: {
    color: "#71717a",
    fontSize: 11,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
    paddingTop: 10,
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
  },
  submitBtn: {
    backgroundColor: "#d97706",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
