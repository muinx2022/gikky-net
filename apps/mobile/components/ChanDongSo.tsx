import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CheckCircle2, RotateCcw } from "lucide-react-native";

interface Props {
  status: string;
  closedAt: string | null;
  ketQua: string | null;
  baiHoc?: string | null;
  moLaiDen?: string | null;
  laChuMach?: boolean;
  onMoLaiMach?: () => void;
}

export function ChanDongSo({
  status,
  closedAt,
  ketQua,
  baiHoc,
  moLaiDen,
  laChuMach,
  onMoLaiMach,
}: Props) {
  if (status !== "closed" && !closedAt) {
    return null;
  }

  const conHanMoLai = (() => {
    if (!moLaiDen) return false;
    try {
      return new Date(moLaiDen).getTime() > Date.now();
    } catch {
      return false;
    }
  })();

  const dinhDangNgay = (isoStr: string | null) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${d.getFullYear()}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View style={styles.badge}>
          <CheckCircle2 size={13} color="#f59e0b" />
          <Text style={styles.badgeText}>Mạch đã đóng</Text>
        </View>
        {closedAt ? (
          <Text style={styles.dateText}>ngày {dinhDangNgay(closedAt)}</Text>
        ) : null}
      </View>

      {ketQua ? (
        <View style={styles.ketQuaBox}>
          <Text style={styles.ketQuaText}>{ketQua}</Text>
        </View>
      ) : null}

      {baiHoc ? (
        <View style={styles.baiHocBox}>
          <Text style={styles.baiHocTitle}>📋 Mổ xẻ sau lệnh &amp; Bài học</Text>
          <Text style={styles.baiHocContent}>{baiHoc}</Text>
        </View>
      ) : null}

      {laChuMach && conHanMoLai && onMoLaiMach ? (
        <View style={styles.reopenBox}>
          <TouchableOpacity
            style={styles.reopenBtn}
            onPress={onMoLaiMach}
            activeOpacity={0.8}
          >
            <RotateCcw size={14} color="#60a5fa" />
            <Text style={styles.reopenBtnText}>Mở lại mạch này</Text>
          </TouchableOpacity>
          {moLaiDen ? (
            <Text style={styles.reopenHint}>
              (Hạn mở lại: đến hết {dinhDangNgay(moLaiDen)})
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 24,
    marginHorizontal: 12,
    backgroundColor: "#1c1917",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#44403c",
    padding: 16,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  badgeText: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "700",
  },
  dateText: {
    color: "#a8a29e",
    fontSize: 12,
    fontFamily: "monospace",
  },
  ketQuaBox: {
    backgroundColor: "#292524",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  ketQuaText: {
    color: "#f5f5f4",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  baiHocBox: {
    backgroundColor: "#292524",
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
  },
  baiHocTitle: {
    color: "#fde047",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  baiHocContent: {
    color: "#d6d3d1",
    fontSize: 13,
    lineHeight: 19,
  },
  reopenBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#44403c",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  reopenBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  reopenBtnText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
  },
  reopenHint: {
    color: "#78716c",
    fontSize: 11,
  },
});
