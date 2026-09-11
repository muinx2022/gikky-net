import React from "react";
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { X } from "lucide-react-native";

interface Props {
  anhUrl: string | null;
  onDong: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export function LightboxModal({ anhUrl, onDong }: Props) {
  if (!anhUrl) return null;

  return (
    <Modal
      visible={!!anhUrl}
      transparent
      animationType="fade"
      onRequestClose={onDong}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="black" />
        <TouchableWithoutFeedback onPress={onDong}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <SafeAreaView style={styles.safeArea}>
          {/* Nút đóng */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onDong}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={24} color="#ffffff" />
          </TouchableOpacity>

          {/* Khung ảnh */}
          <View style={styles.imageWrap} pointerEvents="box-none">
            <Image
              source={{ uri: anhUrl }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  safeArea: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    right: 20,
    zIndex: 50,
    backgroundColor: "rgba(39, 39, 42, 0.8)",
    borderRadius: 20,
    padding: 8,
  },
  imageWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.82,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
