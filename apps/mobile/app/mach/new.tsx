import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Hash,
  Lock,
  MessageSquareOff,
  Plus,
  Send,
  Trash2,
} from "lucide-react-native";

import { useAuth } from "../../context/AuthContext";
import { layDanhSachSub, taoMachMoi } from "../../lib/api";
import { SoanThaoHtml, chuanHoaHtmlKhiLuu } from "../../components/SoanThaoHtml";

interface FigureItem {
  label: string;
  value: string;
}

export default function TaoMachScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { daDangNhap } = useAuth();

  const [tieuDe, setTieuDe] = useState("");
  const [selectedSub, setSelectedSub] = useState<string>("chung");
  const [noiDungHtml, setNoiDungHtml] = useState("");
  const [dangXuLy, setDangXuLy] = useState(false);

  // Mở rộng tuỳ chọn nâng cao
  const [moNangCao, setMoNangCao] = useState(false);
  const [truongPhai, setTruongPhai] = useState("");
  const [tatBinhLuan, setTatBinhLuan] = useState(false);
  const [riengTu, setRiengTu] = useState(false);

  // Dải số chỉ số (Figures - giống web)
  const [figures, setFigures] = useState<FigureItem[]>([]);

  // Lấy danh sách sub
  const { data: subs = [] } = useQuery({
    queryKey: ["subs"],
    queryFn: layDanhSachSub,
  });

  const themFigure = () => {
    if (figures.length >= 6) {
      Alert.alert("Giới hạn", "Tối đa 6 chỉ số trên một mốc.");
      return;
    }
    setFigures([...figures, { label: "", value: "" }]);
  };

  const suaFigure = (index: number, field: "label" | "value", val: string) => {
    const moi = [...figures];
    moi[index] = { ...moi[index], [field]: val };
    setFigures(moi);
  };

  const xoaFigure = (index: number) => {
    setFigures(figures.filter((_, i) => i !== index));
  };

  const taoMachMutation = useMutation({
    mutationFn: async () => {
      // Chuẩn hoá HTML nếu người dùng gõ plain text
      const bodyFinal = chuanHoaHtmlKhiLuu(noiDungHtml);

      // Lọc các figures hợp lệ
      const figuresFinal = figures
        .filter((f) => f.label.trim() && f.value.trim())
        .map((f) => ({
          label: f.label.trim().substring(0, 24),
          value: f.value.trim().substring(0, 24),
        }));

      return taoMachMoi({
        title: tieuDe.trim(),
        sub: selectedSub,
        body: bodyFinal,
        figures: figuresFinal.length > 0 ? figuresFinal : null,
        tat_binh_luan: tatBinhLuan,
        truong_phai: truongPhai.trim() ? truongPhai.trim() : null,
        rieng_tu: riengTu,
      });
    },
    onSuccess: (machMoi) => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      if (machMoi?.id) {
        router.replace(`/mach/${machMoi.id}`);
      } else {
        router.back();
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Tạo bài viết không thành công.";
      Alert.alert("Lỗi", msg);
    },
  });

  const handleSubmit = async () => {
    if (!daDangNhap) {
      Alert.alert("Yêu cầu đăng nhập", "Bạn cần đăng nhập trước khi tạo mạch.");
      return;
    }

    if (!tieuDe.trim()) {
      Alert.alert("Thiếu tiêu đề", "Vui lòng nhập tiêu đề cho bài viết.");
      return;
    }

    if (!noiDungHtml.trim()) {
      Alert.alert("Thiếu nội dung", "Vui lòng nhập nội dung cho mốc mở đầu.");
      return;
    }

    setDangXuLy(true);
    try {
      await taoMachMutation.mutateAsync();
    } finally {
      setDangXuLy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color="#f4f4f5" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Viết bài mới</Text>
        <TouchableOpacity
          style={[styles.publishHeaderBtn, dangXuLy && styles.btnDisabled]}
          disabled={dangXuLy}
          onPress={handleSubmit}
        >
          {dangXuLy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.publishHeaderText}>Đăng bài</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Chọn Chuyên mục */}
        <Text style={styles.label}>Chuyên mục (Sub)</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subScroll}
        >
          {subs.map((s) => {
            const isSelected = selectedSub === s.slug;
            return (
              <TouchableOpacity
                key={s.slug}
                style={[styles.subChip, isSelected && styles.subChipActive]}
                onPress={() => setSelectedSub(s.slug)}
              >
                <Text
                  style={[
                    styles.subChipText,
                    isSelected && styles.subChipTextActive,
                  ]}
                >
                  s/{s.slug}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Tiêu đề Mạch */}
        <View style={styles.labelRow}>
          <Text style={styles.label}>Tiêu đề Mạch</Text>
          <Text style={styles.charCount}>{tieuDe.length}/300</Text>
        </View>
        <TextInput
          style={styles.inputTitle}
          placeholder="Nhập tiêu đề mạch tóm tắt sự việc..."
          placeholderTextColor="#71717a"
          value={tieuDe}
          onChangeText={setTieuDe}
          maxLength={300}
        />

        {/* Thân bài HTML Editor */}
        <Text style={styles.label}>Nội dung Mốc mở đầu (Mốc #1)</Text>
        <SoanThaoHtml
          giaTri={noiDungHtml}
          onChange={setNoiDungHtml}
          placeholder="Nhận định, diễn biến thị trường, khuyến nghị (hỗ trợ HTML và công cụ trên thanh)..."
          minHeight={180}
        />

        {/* Dải số chỉ số (Figures) như Web */}
        <View style={styles.sectionBox}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Dải số chỉ số (Figures)</Text>
              <Text style={styles.sectionSub}>
                Ví dụ: GIÁ VÀO 27.80 · DỪNG LỖ 26.40 · MỤC TIÊU 32.50
              </Text>
            </View>
            {figures.length < 6 && (
              <TouchableOpacity style={styles.addFigBtn} onPress={themFigure}>
                <Plus size={14} color="#60a5fa" />
                <Text style={styles.addFigText}>Thêm</Text>
              </TouchableOpacity>
            )}
          </View>

          {figures.map((fig, idx) => (
            <View key={idx} style={styles.figRow}>
              <TextInput
                style={[styles.figInput, styles.figLabel]}
                placeholder="Nhãn (VD: VÀO LỆNH)"
                placeholderTextColor="#71717a"
                value={fig.label}
                onChangeText={(t) => suaFigure(idx, "label", t)}
                maxLength={24}
              />
              <TextInput
                style={[styles.figInput, styles.figValue]}
                placeholder="Giá trị (VD: 27.80)"
                placeholderTextColor="#71717a"
                value={fig.value}
                onChangeText={(t) => suaFigure(idx, "value", t)}
                maxLength={24}
              />
              <TouchableOpacity
                style={styles.figDeleteBtn}
                onPress={() => xoaFigure(idx)}
              >
                <Trash2 size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Tuỳ chọn mở rộng (Trường phái, Tắt bình luận, Riêng tư) */}
        <TouchableOpacity
          style={styles.expandToggle}
          onPress={() => setMoNangCao(!moNangCao)}
        >
          <Text style={styles.expandToggleText}>
            {moNangCao ? "Thu gọn tuỳ chọn bổ sung" : "Mở rộng tuỳ chọn bổ sung"}
          </Text>
          {moNangCao ? (
            <ChevronUp size={16} color="#9ca3af" />
          ) : (
            <ChevronDown size={16} color="#9ca3af" />
          )}
        </TouchableOpacity>

        {moNangCao && (
          <View style={styles.expandBox}>
            {/* Trường phái */}
            <Text style={styles.inputSubLabel}>Trường phái phân tích</Text>
            <View style={styles.inputWithIcon}>
              <Hash size={16} color="#71717a" style={styles.inputLeftIcon} />
              <TextInput
                style={styles.innerInput}
                placeholder="VD: trend-following, vĩ-mô, ict..."
                placeholderTextColor="#71717a"
                value={truongPhai}
                onChangeText={setTruongPhai}
                maxLength={40}
              />
            </View>

            {/* Tắt bình luận */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextGroup}>
                <View style={styles.switchTitleRow}>
                  <MessageSquareOff size={15} color="#d4d4d8" />
                  <Text style={styles.switchTitle}>Tắt bình luận</Text>
                </View>
                <Text style={styles.switchDesc}>
                  Không cho phép người khác gửi bình luận vào mạch này.
                </Text>
              </View>
              <Switch
                value={tatBinhLuan}
                onValueChange={setTatBinhLuan}
                trackColor={{ false: "#3f3f46", true: "#3b82f6" }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Riêng tư */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextGroup}>
                <View style={styles.switchTitleRow}>
                  <Lock size={15} color="#d4d4d8" />
                  <Text style={styles.switchTitle}>Bài viết riêng tư</Text>
                </View>
                <Text style={styles.switchDesc}>
                  Chỉ có bạn và ban quản trị nhìn thấy bài viết này.
                </Text>
              </View>
              <Switch
                value={riengTu}
                onValueChange={setRiengTu}
                trackColor={{ false: "#3f3f46", true: "#eab308" }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        )}

        {/* Nút Đăng mạch chính */}
        <TouchableOpacity
          style={[styles.submitBtn, dangXuLy && styles.btnDisabled]}
          disabled={dangXuLy}
          onPress={handleSubmit}
        >
          {dangXuLy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Send size={16} color="#ffffff" />
              <Text style={styles.submitBtnText}>Phát hành Mạch</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#18181b",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  backBtn: {
    padding: 4,
  },
  topBarTitle: {
    color: "#f4f4f5",
    fontSize: 16,
    fontWeight: "700",
  },
  publishHeaderBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  publishHeaderText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: "#e4e4e7",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 10,
  },
  charCount: {
    color: "#71717a",
    fontSize: 12,
  },
  subScroll: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  subChip: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#2e2e2e",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  subChipActive: {
    backgroundColor: "#1e3a8a",
    borderColor: "#3b82f6",
  },
  subChipText: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "monospace",
  },
  subChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  inputTitle: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#2e2e2e",
    borderRadius: 10,
    padding: 12,
    color: "#f3f4f6",
    fontSize: 15,
    marginBottom: 10,
  },
  sectionBox: {
    backgroundColor: "#18181b",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#27272a",
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#f4f4f5",
    fontSize: 14,
    fontWeight: "700",
  },
  sectionSub: {
    color: "#71717a",
    fontSize: 11,
    marginTop: 2,
  },
  addFigBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  addFigText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
  },
  figRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  figInput: {
    backgroundColor: "#27272a",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: "#f4f4f5",
    fontSize: 13,
  },
  figLabel: {
    flex: 1.2,
  },
  figValue: {
    flex: 1,
  },
  figDeleteBtn: {
    padding: 6,
  },
  expandToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
    marginBottom: 10,
  },
  expandToggleText: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
  },
  expandBox: {
    backgroundColor: "#18181b",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#27272a",
    marginBottom: 16,
  },
  inputSubLabel: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#27272a",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  inputLeftIcon: {
    marginRight: 6,
  },
  innerInput: {
    flex: 1,
    color: "#f4f4f5",
    fontSize: 14,
    paddingVertical: 8,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
  },
  switchTextGroup: {
    flex: 1,
    marginRight: 10,
  },
  switchTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  switchTitle: {
    color: "#e4e4e7",
    fontSize: 14,
    fontWeight: "600",
  },
  switchDesc: {
    color: "#71717a",
    fontSize: 12,
    marginTop: 2,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 10,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
