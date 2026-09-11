import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import {
  ArrowBigDown,
  ArrowBigUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit2,
  Flag,
  Image as ImageIcon,
  MessageCircle,
  ShieldAlert,
  Trash2,
} from "lucide-react-native";
import type { AnhOut, MocOut } from "@gikky/api-client";
import { API_BASE_URL } from "../lib/config";
import { ThanHtml } from "./ThanHtml";

interface Props {
  moc: MocOut;
  onMoBinhLuan: (mocId: number, seq: number) => void;
  onVote?: (mocId: number, huong: number) => void;
  laStaff?: boolean;
  laChuMach?: boolean;
  onBaoCao?: (mocId: number, seq: number) => void;
  onModAction?: (mocId: number, seq: number, dangAn: boolean) => void;
  onXemAnh?: (anhUrl: string) => void;
  onXemLichSu?: (mocId: number, seq: number) => void;
  onSuaMoc?: (moc: MocOut) => void;
  onXoaMoc?: (moc: MocOut) => void;
  thuGon?: boolean;
  coTheThuGon?: boolean;
  onToggleThuGon?: () => void;
  onLayout?: (e: any) => void;
}

export function MocItem({
  moc,
  onMoBinhLuan,
  onVote,
  laStaff = false,
  laChuMach = false,
  onBaoCao,
  onModAction,
  onXemAnh,
  onXemLichSu,
  onSuaMoc,
  onXoaMoc,
  thuGon = false,
  coTheThuGon = false,
  onToggleThuGon,
  onLayout,
}: Props) {
  const ngayDienRa = new Date(moc.occurred_at).toLocaleString("vi-VN", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Cột mốc trái: Node & Line */}
      <View style={styles.timelineCol}>
        <View style={[styles.seqNode, moc.seq === 1 ? styles.rootNode : styles.updateNode]}>
          <Text style={styles.seqText}>{moc.seq}</Text>
        </View>
        <View style={styles.timelineLine} />
      </View>

      {/* Nội dung Mốc bên phải */}
      <View style={styles.contentCol}>
        <View style={styles.card}>
          {/* Header Mốc: Thời gian xảy ra */}
          <View style={styles.cardHeader}>
            <View style={styles.timeTag}>
              <Calendar size={12} color="#9ca3af" />
              <Text style={styles.timeText}>{ngayDienRa}</Text>
            </View>
            {moc.edited_at ? (
              <TouchableOpacity
                onPress={() => onXemLichSu?.(moc.id, moc.seq)}
                disabled={!onXemLichSu}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.editedText}>(đã sửa)</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Thân bài Mốc & Ảnh đính kèm */}
          {thuGon ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onToggleThuGon}
              style={styles.collapsedContentWrap}
            >
              <View style={styles.collapsedBodyBox}>
                <ThanHtml body={moc.body || "(Không có nội dung)"} style={styles.body} />
              </View>
              {/* Lớp phủ mờ đáy kèm nút mở rộng */}
              <View style={styles.fadeOverlay}>
                {moc.anhs && moc.anhs.length > 0 ? (
                  <View style={styles.previewImageBadge}>
                    <ImageIcon size={12} color="#60a5fa" />
                    <Text style={styles.previewImageText}>
                      {moc.anhs.length} ảnh đính kèm
                    </Text>
                  </View>
                ) : null}
                <View style={styles.expandBtn}>
                  <Text style={styles.expandBtnText}>Xem thêm mốc này</Text>
                  <ChevronDown size={14} color="#60a5fa" />
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <>
              <ThanHtml body={moc.body || "(Không có nội dung)"} style={styles.body} />

              {/* Ảnh đính kèm (nếu có) */}
              {moc.anhs && moc.anhs.length > 0 ? (
                <View style={styles.imageGrid}>
                  {moc.anhs.map((anh: AnhOut) => {
                    const anhUrl = anh.url.startsWith("http")
                      ? anh.url
                      : `${API_BASE_URL}${anh.url}`;
                    return (
                      <TouchableOpacity
                        key={anh.id}
                        onPress={() => onXemAnh?.(anhUrl)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: anhUrl }}
                          style={styles.attachedImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {coTheThuGon ? (
                <TouchableOpacity
                  style={styles.collapseBtn}
                  onPress={onToggleThuGon}
                  activeOpacity={0.7}
                >
                  <Text style={styles.collapseBtnText}>Thu gọn</Text>
                  <ChevronUp size={13} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </>
          )}

          {/* Footer Mốc: Vote + Nút Ngăn Kéo Bình Luận */}
          <View style={styles.footer}>
            <View style={styles.voteRow}>
              <TouchableOpacity
                style={styles.voteBtn}
                onPress={() => onVote?.(moc.id, 1)}
              >
                <ArrowBigUp size={16} color="#9ca3af" />
              </TouchableOpacity>
              <Text style={styles.voteScore}>{moc.score}</Text>
              <TouchableOpacity
                style={styles.voteBtn}
                onPress={() => onVote?.(moc.id, -1)}
              >
                <ArrowBigDown size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <View style={styles.rightFooterActions}>
              {/* Nút Ngăn Kéo */}
              <TouchableOpacity
                style={styles.nganKeoBtn}
                onPress={() => onMoBinhLuan(moc.id, moc.seq)}
              >
                <MessageCircle size={14} color="#60a5fa" />
                <Text style={styles.nganKeoText}>
                  Ngăn kéo ({moc.so_binh_luan})
                </Text>
              </TouchableOpacity>

              {/* Nút Sửa mốc (chủ mạch) */}
              {laChuMach && onSuaMoc && (
                <TouchableOpacity
                  style={styles.iconActionBtn}
                  onPress={() => onSuaMoc(moc)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Edit2 size={13} color="#9ca3af" />
                </TouchableOpacity>
              )}

              {/* Nút Xoá mốc (chủ mạch) */}
              {laChuMach && onXoaMoc && (
                <TouchableOpacity
                  style={styles.iconActionBtn}
                  onPress={() => onXoaMoc(moc)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={13} color="#f87171" />
                </TouchableOpacity>
              )}

              {/* Nút Báo cáo */}
              {onBaoCao && (
                <TouchableOpacity
                  style={styles.iconActionBtn}
                  onPress={() => onBaoCao(moc.id, moc.seq)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Flag size={13} color="#71717a" />
                </TouchableOpacity>
              )}

              {/* Nút Mod nếu là staff */}
              {laStaff && onModAction && (
                <TouchableOpacity
                  style={styles.modActionBtn}
                  onPress={() => onModAction(moc.id, moc.seq, (moc as any).trang_thai === "da_an")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <ShieldAlert size={14} color="#eab308" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginBottom: 12,
  },
  timelineCol: {
    width: 32,
    alignItems: "center",
  },
  seqNode: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  rootNode: {
    backgroundColor: "#2563eb",
  },
  updateNode: {
    backgroundColor: "#374151",
    borderWidth: 2,
    borderColor: "#4b5563",
  },
  seqText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#374151",
    marginTop: -2,
  },
  contentCol: {
    flex: 1,
    marginLeft: 8,
  },
  card: {
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  editedText: {
    color: "#6b7280",
    fontSize: 11,
    fontStyle: "italic",
  },
  body: {
    color: "#e5e7eb",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  attachedImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    backgroundColor: "#2d2d2d",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#262626",
    paddingTop: 8,
  },
  voteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  voteBtn: {
    padding: 2,
  },
  voteScore: {
    color: "#d1d5db",
    fontSize: 12,
    fontWeight: "600",
    minWidth: 16,
    textAlign: "center",
  },
  nganKeoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  nganKeoText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
  },
  rightFooterActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "#27272a",
  },
  modActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "#2c2817",
    borderWidth: 1,
    borderColor: "#eab308",
  },
  collapsedContentWrap: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 8,
    marginVertical: 4,
  },
  collapsedBodyBox: {
    maxHeight: 105,
    overflow: "hidden",
  },
  fadeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 75,
    backgroundColor: "rgba(24, 24, 27, 0.94)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 8,
    gap: 6,
  },
  previewImageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  previewImageText: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "500",
  },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#27272a",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  expandBtnText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
  },
  collapseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    marginVertical: 6,
    backgroundColor: "#27272a",
    borderRadius: 6,
    alignSelf: "center",
    paddingHorizontal: 14,
  },
  collapseBtnText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "500",
  },
});
