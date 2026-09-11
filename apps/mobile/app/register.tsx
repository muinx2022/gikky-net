import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { AlertCircle, Eye, EyeOff, Lock, Mail, User } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";

export default function RegisterScreen() {
  const router = useRouter();
  const { dangKy } = useAuth();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [xacNhanMatKhau, setXacNhanMatKhau] = useState("");
  const [hienMatKhau, setHienMatKhau] = useState(false);
  const [dangXuLy, setDangXuLy] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  const handleDangKy = async () => {
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    if (!trimmedEmail || !trimmedUsername || !matKhau) {
      setLoi("Vui lòng điền đầy đủ tất cả thông tin.");
      return;
    }

    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      setLoi("Email không hợp lệ.");
      return;
    }

    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      setLoi("Tên tài khoản phải từ 3 đến 30 ký tự.");
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      setLoi("Tên tài khoản chỉ được chứa chữ cái, số, dấu gạch ngang hoặc dấu chấm.");
      return;
    }

    if (matKhau.length < 8) {
      setLoi("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    if (matKhau !== xacNhanMatKhau) {
      setLoi("Xác nhận mật khẩu không trùng khớp.");
      return;
    }

    setDangXuLy(true);
    setLoi(null);

    const res = await dangKy({
      username: trimmedUsername,
      email: trimmedEmail,
      mat_khau: matKhau,
    });

    setDangXuLy(false);

    if (res.thanhCong) {
      router.replace("/");
    } else {
      setLoi(res.loi || "Đăng ký không thành công.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formCard}>
          <Text style={styles.headerTitle}>Đăng ký tài khoản</Text>
          <Text style={styles.headerSubtitle}>
            Tham gia cộng đồng Gikky để theo dõi và ghi chép hành trình đầu tư
          </Text>

          {loi ? (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color="#ef4444" />
              <Text style={styles.errorText}>{loi}</Text>
            </View>
          ) : null}

          {/* Input Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Mail size={18} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="ban@example.com"
                placeholderTextColor="#71717a"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Input Tên tài khoản */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tên tài khoản (username)</Text>
            <View style={styles.inputWrap}>
              <User size={18} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="vidu: nguyenvana"
                placeholderTextColor="#71717a"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Input Mật khẩu */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mật khẩu (tối thiểu 8 ký tự)</Text>
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
          </View>

          {/* Input Xác nhận Mật khẩu */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Xác nhận mật khẩu</Text>
            <View style={styles.inputWrap}>
              <Lock size={18} color="#71717a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nhập lại mật khẩu"
                placeholderTextColor="#71717a"
                value={xacNhanMatKhau}
                onChangeText={setXacNhanMatKhau}
                secureTextEntry={!hienMatKhau}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Nút Đăng ký */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleDangKy}
            disabled={dangXuLy}
          >
            {dangXuLy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>Đăng ký ngay</Text>
            )}
          </TouchableOpacity>

          {/* Chuyển qua Đăng nhập */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Đã có tài khoản?</Text>
            <TouchableOpacity onPress={() => router.push("/login")}>
              <Text style={styles.footerLink}> Đăng nhập</Text>
            </TouchableOpacity>
          </View>

          {/* Nút Quay lại */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => router.back()}
            disabled={dangXuLy}
          >
            <Text style={styles.cancelBtnText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    paddingVertical: 40,
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
    marginBottom: 14,
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
    marginBottom: 14,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  eyeBtn: {
    padding: 6,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
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
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: "#71717a",
    fontSize: 14,
  },
});
