import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { AlertTriangle, Check, X } from "lucide-react-native";
import { guiBaoCaoViPham } from "../lib/api";

export type LoaiBaoCao = "mach" | "moc" | "comment";

export interface DoiTuongBaoCao {
  target_type: LoaiBaoCao;
  target_id: number;
  tieuDe?: string;
}

interface Props {
  hienThi: boolean;
  doiTuong: DoiTuongBaoCao | null;
  onDong: () => void;
  onThanhCong?: () => void;
}

const DANH_SACH_LY_DO: {
  key: "phim_hang" | "cam_ket_loi_nhuan" | "lua_dao" | "link_nhom_kin" | "spam" | "khac";
  nhan: string;
  moTa: string;
}[] = [
  {
    key: "phim_hang",
    nhan: "Phím hàng, lôi kéo mua bán",
    moTa: "Hô hào mua bán mã cổ phiếu, hô giá mục tiêu không có phân tích.",
  },
  {
    key: "cam_ket_loi_nhuan",
    nhan: "Cam kết lợi nhuận, bao lỗ",
    moTa: "Hứa hẹn tỉ lệ thắng 100%, bao cháy tài khoản, cam kết sinh lời.",
  },
  {
    key: "lua_dao",
    nhan: "Lừa đảo, mời uỷ thác, room VIP",
    moTa: "Thu phí hội viên, uỷ thác đầu tư, mời gọi sang sàn lừa đảo.",
  },
  {
    key: "link_nhom_kin",
    nhan: "Dẫn link nhóm kín (Zalo, Telegram)",
    moTa: "Chèn link hoặc mã QR kéo vào các nhóm riêng tư.",
  },
  {
    key: "spam",
    nhan: "Spam, quảng cáo rác",
    moTa: "Đăng lặp đi lặp lại, nội dung vô nghĩa hoặc bán hàng không liên quan.",
  },
  {
    key: "khac",
    nhan: "Lý do khác",
    moTa: "Vi phạm quy tắc ứng xử, xúc phạm cá nhân hoặc nội dung không phù hợp.",
  },
];

export function BaoCaoModal({ hienThi, doiTuong, onDong, onThanhCong }: Props) {
  const [lyDoChon, setLyDoChon] = useState<
    "phim_hang" | "cam_ket_loi_nhuan" | "lua_dao" | "link_nhom_kin" | "spam" | "khac"
  >("phim_hang");
  const [ghiChu, setGhiChu] = useState("");
  const [dangGui, setDangGui] = useState(false);

  if (!doiTuong) return null;

  const handleGuiBaoCao = async () => {
    setDangGui(true);
    try {
      const res = await guiBaoCaoViPham({
        target_type: doiTuong.target_type,
        target_id: doiTuong.target_id,
        ly_do: lyDoChon,
        ghi_chu: ghiChu.trim(),
      });
      if (res) {
        Alert.alert(
          "Đã gửi báo cáo",
          "Cảm ơn bạn đã hỗ trợ giữ gìn môi trường thảo luận trong sạch. Đội ngũ mod sẽ xem xét sớm nhất."
        );
        setGhiChu("");
        onThanhCong?.();
        onDong();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gửi báo cáo thất bại.";
      Alert.alert("Lỗi", msg);
    } finally {
      setDangGui(false);
    }
  };

  const getTenDoiTuong = () => {
    if (doiTuong.tieuDe) return doiTuong.tieuDe;
    switch (doiTuong.target_type) {
      case "mach":
        return `Mạch #${doiTuong.target_id}`;
      case "moc":
        return `Mốc #${doiTuong.target_id}`;
      case "comment":
        return `Bình luận #${doiTuong.target_id}`;
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
              <AlertTriangle size={18} color="#ef4444" />
              <Text style={styles.headerTitle}>Báo cáo vi phạm</Text>
            </View>
            <TouchableOpacity onPress={onDong} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subHeader}>
            Đối tượng: <Text style={styles.highlightText}>{getTenDoiTuong()}</Text>
          </Text>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>CHỌN LÝ DO VI PHẠM</Text>

            {DANH_SACH_LY_DO.map((item) => {
              const daChon = lyDoChon === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.reasonItem, daChon && styles.reasonItemActive]}
                  onPress={() => setLyDoChon(item.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radioCircle, daChon && styles.radioCircleActive]}>
                    {daChon && <Check size={12} color="#ffffff" />}
                  </View>
                  <View style={styles.reasonTextContainer}>
                    <Text style={[styles.reasonTitle, daChon && styles.reasonTitleActive]}>
                      {item.nhan}
                    </Text>
                    <Text style={styles.reasonDesc}>{item.moTa}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>GHI CHÚ THÊM (TUỲ CHỌN)</Text>
            <TextInput
              style={styles.inputGhiChu}
              placeholder="Mô tả cụ thể hơn để giúp mod xử lý nhanh hơn..."
              placeholderTextColor="#71717a"
              value={ghiChu}
              onChangeText={setGhiChu}
              maxLength={500}
              multiline
              numberOfLines={3}
            />
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onDong}>
              <Text style={styles.cancelBtnText}>Huỷ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, dangGui && styles.btnDisabled]}
              onPress={handleGuiBaoCao}
              disabled={dangGui}
            >
              {dangGui ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Gửi báo cáo</Text>
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
    maxHeight: "85%",
    borderTopWidth: 1,
    borderTopColor: "#27272a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
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
    color: "#60a5fa",
    fontWeight: "600",
  },
  contentScroll: {
    maxHeight: 400,
  },
  sectionLabel: {
    color: "#71717a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#27272a",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  reasonItemActive: {
    borderColor: "#ef4444",
    backgroundColor: "#2a1e20",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#52525b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginRight: 10,
  },
  radioCircleActive: {
    borderColor: "#ef4444",
    backgroundColor: "#ef4444",
  },
  reasonTextContainer: {
    flex: 1,
  },
  reasonTitle: {
    color: "#e4e4e7",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  reasonTitleActive: {
    color: "#f87171",
  },
  reasonDesc: {
    color: "#a1a1aa",
    fontSize: 12,
    lineHeight: 16,
  },
  inputGhiChu: {
    backgroundColor: "#27272a",
    borderRadius: 10,
    padding: 12,
    color: "#f4f4f5",
    fontSize: 13,
    textAlignVertical: "top",
    minHeight: 70,
    marginBottom: 14,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 10,
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
    fontWeight: "600",
  },
  submitBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 110,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
