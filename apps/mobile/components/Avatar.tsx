import React from "react";
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Camera, User } from "lucide-react-native";
import { API_BASE_URL } from "../lib/config";

interface Props {
  url?: string | null;
  ten?: string | null;
  size?: number;
  coTheSua?: boolean;
  onSua?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({
  url,
  ten,
  size = 40,
  coTheSua = false,
  onSua,
  style,
}: Props) {
  const getFullUrl = (rawUrl?: string | null) => {
    if (!rawUrl) return null;
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      return rawUrl;
    }
    return `${API_BASE_URL}${rawUrl}`;
  };

  const fullUrl = getFullUrl(url);

  const renderContent = () => {
    if (fullUrl) {
      return (
        <Image
          source={{ uri: fullUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      );
    }

    // Nếu không có ảnh, lấy chữ cái đầu của tên
    const kyTuDau = ten ? ten.trim().charAt(0).toUpperCase() : null;

    return (
      <View
        style={[
          styles.placeholder,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        {kyTuDau ? (
          <Text style={[styles.initialText, { fontSize: size * 0.42 }]}>
            {kyTuDau}
          </Text>
        ) : (
          <User size={size * 0.5} color="#9ca3af" />
        )}
      </View>
    );
  };

  return (
    <View style={[styles.wrapper, { width: size, height: size }, style]}>
      {renderContent()}

      {coTheSua && (
        <TouchableOpacity
          style={[
            styles.editBadge,
            {
              width: Math.max(size * 0.35, 22),
              height: Math.max(size * 0.35, 22),
              borderRadius: Math.max(size * 0.35, 22) / 2,
            },
          ]}
          onPress={onSua}
          activeOpacity={0.8}
        >
          <Camera size={Math.max(size * 0.2, 12)} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  placeholder: {
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  initialText: {
    color: "#60a5fa",
    fontWeight: "700",
  },
  editBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#18181b",
    elevation: 3,
  },
});
