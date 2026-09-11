import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Lock, User, AlertCircle, Eye, EyeOff, Mail, X } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";

import { useAuth } from "../context/AuthContext";
import { xinDatLaiMatKhau } from "../lib/api";
import { API_BASE_URL } from "../lib/config";

export default function LoginScreen() {
  const router = useRouter();
  const { dangNhap, dangNhapGoogleOAuth, googleBat } = useAuth();

  const [taiKhoan, setTaiKhoan] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [hienMatKhau, setHienMatKhau] = useState(false);
  const [dangXuLy, setDangXuLy] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  const [hienModalQuenMk, setHienModalQuenMk] = useState(false);
  const [emailQuenMk, setEmailQuenMk] = useState("");
  const [dangGuiEmail, setDangGuiEmail] = useState(false);
  const [thongBaoQuenMk, setThongBaoQuenMk] = useState<{ loai: "loi" | "thanh_cong"; tinNhan: string } | null>(null);

  const handleDangNhap = async () => {
    if (!taiKhoan.trim() || !matKhau) {
      setLoi("Vui lòng điền đầy đủ tài khoản và mật khẩu.");
      return;
    }

    setDangXuLy(true);
    setLoi(null);

    const res = await dangNhap(taiKhoan, matKhau);
    setDangXuLy(false);

    if (res.thanhCong) {
      router.back();
    } else {
      setLoi(res.loi || "Đăng nhập không thành công.");
    }
  };

  const handleDangNhapGoogle = async () => {
    setDangXuLy(true);
    setLoi(null);
    try {
      const res = await dangNhapGoogleOAuth();
      if (res.thanhCong) {
        router.back();
      } else if (res.loi && !res.loi.includes("Đã huỷ")) {
        setLoi(res.loi);
      }
    } finally {
      setDangXuLy(false);
    }
  };

  const handleQuenMatKhau = async () => {
    if (!emailQuenMk.trim()) {
      setThongBaoQuenMk({ loai: "loi", tinNhan: "Vui lòng nhập địa chỉ email của bạn." });
      return;
    }
    setDangGuiEmail(true);
    setThongBaoQuenMk(null);
    const res = await xinDatLaiMatKhau(emailQuenMk);
    setDangGuiEmail(false);
    if (res.thanhCong) {
      setThongBaoQuenMk({
        loai: "thanh_cong",
        tinNhan: res.message || "Đã gửi hướng dẫn khôi phục mật khẩu vào email của bạn.",
      });
    } else {
      setThongBaoQuenMk({
        loai: "loi",
        tinNhan: res.message || "Không thể gửi yêu cầu đặt lại mật khẩu.",
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.formCard}>
        <Text style={styles.headerTitle}>Đăng nhập gikky</Text>
        <Text style={styles.headerSubtitle}>
          Nhập email hoặc tên tài khoản của bạn để tiếp tục
        </Text>

        {loi ? (
          <View style={styles.errorBox}>
            <AlertCircle size={16} color="#ef4444" />
            <Text style={styles.errorText}>{loi}</Text>
          </View>
        ) : null}

        {/* Input Tài khoản */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email hoặc Tên tài khoản</Text>
          <View style={styles.inputWrap}>
            <User size={18} color="#71717a" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="ten_nguoi_dung hoặc ban@example.com"
              placeholderTextColor="#71717a"
              value={taiKhoan}
              onChangeText={setTaiKhoan}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Input Mật khẩu */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mật khẩu</Text>
          <View style={styles.inputWrap}>
            <Lock size={18} color="#71717a" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nhập mật khẩu"
              placeholderTextColor="#71717a"
              value={matKhau}
              onChangeText={setMatKhau}
              secureTextEntry={!hienMatKhau}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setHienMatKhau(!hienMatKhau)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.eyeBtn}
            >
              {hienMatKhau ? (
                <EyeOff size={18} color="#9ca3af" />
              ) : (
                <Eye size={18} color="#9ca3af" />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => {
              setThongBaoQuenMk(null);
              setEmailQuenMk(taiKhoan.includes("@") ? taiKhoan : "");
              setHienModalQuenMk(true);
            }}
          >
            <Text style={styles.forgotBtnText}>Quên mật khẩu?</Text>
          </TouchableOpacity>
        </View>

        {/* Nút Đăng nhập */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleDangNhap}
          disabled={dangXuLy}
        >
          {dangXuLy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitBtnText}>Đăng nhập</Text>
          )}
        </TouchableOpacity>

        {/* Chuyển qua Đăng ký */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Chưa có tài khoản?</Text>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={styles.footerLink}> Đăng ký ngay</Text>
          </TouchableOpacity>
        </View>

        {/* Vạch ngăn cách & Nút Google OAuth (chỉ hiện khi server bật Google) */}
        {googleBat ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleDangNhapGoogle}
              disabled={dangXuLy}
            >
              <Svg width={18} height={18} viewBox="0 0 18 18">
                <Path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
                />
                <Path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z"
                />
                <Path
                  fill="#FBBC05"
                  d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z"
                />
                <Path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"
                />
              </Svg>
              <Text style={styles.googleBtnText}>Tiếp tục với Google</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {/* Nút Huỷ / Đóng */}
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          disabled={dangXuLy}
        >
          <Text style={styles.cancelBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Quên mật khẩu */}
      <Modal
        visible={hienModalQuenMk}
        transparent
        animationType="fade"
        onRequestClose={() => setHienModalQuenMk(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Khôi phục mật khẩu</Text>
              <TouchableOpacity
                onPress={() => setHienModalQuenMk(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Nhập email đã đăng ký. Hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu cho bạn.
            </Text>

            {thongBaoQuenMk ? (
              <View
                style={[
                  styles.modalAlert,
                  thongBaoQuenMk.loai === "loi"
                    ? styles.modalAlertError
                    : styles.modalAlertSuccess,
                ]}
              >
                <Text
                  style={[
                    styles.modalAlertText,
                    thongBaoQuenMk.loai === "loi"
                      ? styles.modalAlertTextError
                      : styles.modalAlertTextSuccess,
                  ]}
                >
                  {thongBaoQuenMk.tinNhan}
                </Text>
              </View>
            ) : null}

            <View style={styles.inputWrap}>
              <Mail size={18} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="ban@example.com"
                placeholderTextColor="#71717a"
                value={emailQuenMk}
                onChangeText={setEmailQuenMk}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setHienModalQuenMk(false)}
                disabled={dangGuiEmail}
              >
                <Text style={styles.modalCancelBtnText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleQuenMatKhau}
                disabled={dangGuiEmail}
              >
                {dangGuiEmail ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Gửi yêu cầu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    padding: 20,
  },
  formCard: {
    backgroundColor: "#18181b",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  headerTitle: {
    color: "#f4f4f5",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  headerSubtitle: {
    color: "#a1a1aa",
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#450a0a",
    borderWidth: 1,
    borderColor: "#991b1b",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: "#d4d4d8",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#27272a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    height: "100%",
  },
  submitBtn: {
    backgroundColor: "#2563eb",
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  eyeBtn: {
    padding: 6,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#27272a",
  },
  dividerText: {
    color: "#71717a",
    fontSize: 12,
    marginHorizontal: 12,
    textTransform: "lowercase",
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    height: 46,
    borderRadius: 8,
    gap: 10,
    marginBottom: 10,
  },
  googleBtnText: {
    color: "#18181b",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: "#a1a1aa",
    fontSize: 14,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: 6,
  },
  forgotBtnText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "500",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 6,
  },
  footerText: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  footerLink: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#18181b",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    color: "#f4f4f5",
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: "#a1a1aa",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalAlert: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
  },
  modalAlertError: {
    backgroundColor: "#450a0a",
    borderColor: "#991b1b",
  },
  modalAlertSuccess: {
    backgroundColor: "#064e3b",
    borderColor: "#059669",
  },
  modalAlertText: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalAlertTextError: {
    color: "#fca5a5",
  },
  modalAlertTextSuccess: {
    color: "#6ee7b7",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelBtnText: {
    color: "#a1a1aa",
    fontSize: 14,
  },
  modalSubmitBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubmitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
