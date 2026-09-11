import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            itp_support?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: unknown) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

/** Biểu tượng logo Google 4 màu tiêu chuẩn */
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
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
  );
}

/**
 * Google One Tap component cho ứng dụng Gikky Mobile.
 *
 * - Trên nền tảng Web (`Platform.OS === 'web'`):
 *   Tự động nhúng script Google Identity Services (`https://accounts.google.com/gsi/client`),
 *   khởi tạo `window.google.accounts.id.initialize` và gọi `.prompt()`.
 *   Khi người dùng chạm 1 lần, gửi `id_token` JWT lên `/api/mobile/google`.
 *
 * - Trên nền tảng Native (`iOS` / `Android`):
 *   Hiển thị một thẻ nổi dạng Google One Tap tinh tế ở phía dưới màn hình,
 *   cho phép khách chưa đăng nhập 1 chạm tiếp tục với tài khoản Google.
 *   Khi bấm, kích hoạt luồng Google OAuth qua WebBrowser/Custom Tabs an toàn.
 */
export function GoogleOneTap() {
  const insets = useSafeAreaInsets();
  const { daDangNhap, dangTai, googleBat, googleClientId, dangNhapGoogle, dangNhapGoogleOAuth } =
    useAuth();

  const [boQua, setBoQua] = useState(false);
  const [dangXuLy, setDangXuLy] = useState(false);
  const translateY = useRef(new Animated.Value(150)).current;
  const daKhoiTaoWebRef = useRef(false);

  const canBat = !dangTai && !daDangNhap && googleBat && Boolean(googleClientId) && !boQua;

  // Hiệu ứng trượt lên trên Native
  useEffect(() => {
    if (canBat && Platform.OS !== "web") {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 9,
      }).start();
    }
  }, [canBat, translateY]);

  // Khởi tạo Google Identity Services trên Web
  const khoiTaoOneTapWeb = useCallback(() => {
    if (!canBat || !googleClientId || Platform.OS !== "web") return;
    if (typeof window === "undefined" || !window.google?.accounts?.id) return;
    if (daKhoiTaoWebRef.current) return;

    daKhoiTaoWebRef.current = true;

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        if (!response?.credential) return;
        try {
          await dangNhapGoogle(response.credential, googleClientId);
        } catch (loi) {
          console.error("[GoogleOneTap] Đăng nhập một chạm Web thất bại:", loi);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
    });

    window.google.accounts.id.prompt();
  }, [canBat, googleClientId, dangNhapGoogle]);

  useEffect(() => {
    if (Platform.OS !== "web" || !canBat) return;

    if (typeof window !== "undefined" && window.google?.accounts?.id) {
      khoiTaoOneTapWeb();
      return;
    }

    // Nhúng thẻ script nếu chưa có
    const scriptId = "google-gsi-client";
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.id = scriptId;
      scriptTag.src = "https://accounts.google.com/gsi/client";
      scriptTag.async = true;
      scriptTag.defer = true;
      scriptTag.onload = () => khoiTaoOneTapWeb();
      document.head.appendChild(scriptTag);
    } else {
      scriptTag.addEventListener("load", khoiTaoOneTapWeb);
    }

    return () => {
      if (typeof window !== "undefined" && window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, [canBat, khoiTaoOneTapWeb]);

  const handleDongThongBao = () => {
    if (Platform.OS !== "web") {
      Animated.timing(translateY, {
        toValue: 200,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setBoQua(true));
    } else {
      setBoQua(true);
      if (typeof window !== "undefined" && window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    }
  };

  const handleDangNhapNative = async () => {
    setDangXuLy(true);
    try {
      const res = await dangNhapGoogleOAuth();
      if (res.thanhCong) {
        setBoQua(true);
      }
    } finally {
      setDangXuLy(false);
    }
  };

  if (!canBat) return null;

  // Trên Web, GSI dựng UI One Tap bằng iframe riêng của Google
  if (Platform.OS === "web") {
    return null;
  }

  // Trên Native (iOS / Android), hiển thị thẻ One Tap nổi
  return (
    <Animated.View
      style={[
        styles.floatingContainer,
        {
          paddingBottom: Math.max(insets.bottom, 12) + 60, // Né thanh tab bar dưới cùng
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        {/* Nút đóng */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDongThongBao}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Đóng gợi ý đăng nhập"
        >
          <X size={18} color="#71717a" />
        </TouchableOpacity>

        {/* Tiêu đề & Logo */}
        <View style={styles.headerRow}>
          <View style={styles.logoWrap}>
            <GoogleLogo size={22} />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.title}>Đăng nhập nhanh với Google</Text>
            <Text style={styles.subtitle}>
              Tiếp tục tham gia cộng đồng Gikky chỉ với 1 chạm bảo mật.
            </Text>
          </View>
        </View>

        {/* Nút hành động */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={handleDongThongBao}
            disabled={dangXuLy}
          >
            <Text style={styles.dismissBtnText}>Để sau</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.continueBtn}
            onPress={handleDangNhapNative}
            disabled={dangXuLy}
          >
            {dangXuLy ? (
              <ActivityIndicator size="small" color="#18181b" />
            ) : (
              <>
                <GoogleLogo size={16} />
                <Text style={styles.continueBtnText}>Tiếp tục</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  card: {
    backgroundColor: "#1c1c1f",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2e2e34",
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
    padding: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingRight: 24,
  },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: "#f4f4f5",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  subtitle: {
    color: "#a1a1aa",
    fontSize: 12,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  },
  dismissBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  dismissBtnText: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "500",
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 110,
  },
  continueBtnText: {
    color: "#18181b",
    fontSize: 13,
    fontWeight: "700",
  },
});
