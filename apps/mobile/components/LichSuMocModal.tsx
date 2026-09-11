import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { History, X } from "lucide-react-native";
import type { MocRevisionOut } from "@gikky/api-client";

import { layLichSuSuaMoc } from "../lib/api";
import { ThanHtml } from "./ThanHtml";

interface Props {
  hienThi: boolean;
  mocId: number | null;
  seq?: number;
  onDong: () => void;
}

export function LichSuMocModal({ hienThi, mocId, seq, onDong }: Props) {
  const [dangTai, setDangTai] = useState(false);
  const [danhSach, setDanhSach] = useState<MocRevisionOut[]>([]);
  const [loi, setLoi] = useState<string | null>(null);

  useEffect(() => {
    if (!hienThi || !mocId) {
      setDanhSach([]);
      setLoi(null);
      return;
    }

    let cancel = false;
    setDangTai(true);
    setLoi(null);

    layLichSuSuaMoc(mocId)
      .then((res) => {
        if (cancel) return;
        if (res && res.items) {
          setDanhSach(res.items);
        } else {
          setDanhSach([]);
        }
      })
      .catch((err) => {
        if (cancel) return;
        setLoi(err instanceof Error ? err.message : "Không tải được lịch sử sửa đổi.");
      })
      .finally(() => {
        if (!cancel) setDangTai(false);
      });

    return () => {
      cancel = true;
    };
  }, [hienThi, mocId]);

  return (
    <Modal
      visible={hienThi}
      transparent
      animationType="fade"
      onRequestClose={onDong}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <History size={18} color="#60a5fa" />
              <Text style={styles.title}>
                Lịch sử sửa đổi {seq ? `Mốc #${seq}` : ""}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onDong}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          {dangTai ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="small" color="#60a5fa" />
              <Text style={styles.loadingText}>Đang nạp các bản ghi cũ...</Text>
            </View>
          ) : loi ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{loi}</Text>
            </View>
          ) : danhSach.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>Chưa có bản ghi lịch sử nào được lưu lại.</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollArea}>
              {danhSach.map((banGhi, index) => {
                const thoiGian = new Date(banGhi.revised_at).toLocaleString("vi-VN", {
                  day: "numeric",
                  month: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <View key={index} style={styles.revisionItem}>
                    <View style={styles.revHeader}>
                      <Text style={styles.revLabel}>Bản sửa #{danhSach.length - index}</Text>
                      <Text style={styles.revTime}>{thoiGian}</Text>
                    </View>
                    <View style={styles.revBody}>
                      <ThanHtml body={banGhi.body || "(Trống)"} />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onDong}>
            <Text style={styles.closeBtnText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    maxHeight: "80%",
    padding: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#f4f4f5",
    fontSize: 16,
    fontWeight: "700",
  },
  centerBox: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
  },
  emptyText: {
    color: "#71717a",
    fontSize: 13,
  },
  scrollArea: {
    marginVertical: 6,
  },
  revisionItem: {
    backgroundColor: "#27272a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3f3f46",
    padding: 12,
    marginBottom: 12,
  },
  revHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#3f3f46",
    paddingBottom: 6,
  },
  revLabel: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
  },
  revTime: {
    color: "#9ca3af",
    fontSize: 12,
    fontFamily: "monospace",
  },
  revBody: {
    marginTop: 4,
  },
  closeBtn: {
    backgroundColor: "#27272a",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  closeBtnText: {
    color: "#f4f4f5",
    fontSize: 14,
    fontWeight: "600",
  },
});
