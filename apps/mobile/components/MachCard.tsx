import React from "react";
import { Image, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { MessageSquare, GitCommit, ArrowBigUp, ArrowBigDown, Share2 } from "lucide-react-native";
import type { MachTomTatOut } from "@gikky/api-client";

import { API_BASE_URL } from "../lib/config";

interface Props {
  mach: MachTomTatOut;
  onVote?: (machId: number, huong: number) => void;
}

export function MachCard({ mach, onVote }: Props) {
  const router = useRouter();

  const handlePress = () => {
    router.push(`/mach/${mach.id}`);
  };

  const tacGia = mach.author?.display_name || mach.author?.username || "Ẩn danh";
  const subSlug = mach.sub?.slug || "chung";
  const ngayTao = new Date(mach.published_at || mach.created_at).toLocaleDateString("vi-VN", {
    month: "numeric",
    day: "numeric",
  });

  const coAnh = !!mach.xem_truoc?.anh;
  const anhData = mach.xem_truoc?.anh;
  const soAnh = mach.xem_truoc?.so_anh || 0;
  const conLai = soAnh - 1;

  let imgUri = "";
  if (anhData) {
    const rawUrl = anhData.url_thumb || anhData.url;
    imgUri = rawUrl.startsWith("http") ? rawUrl : `${API_BASE_URL}${rawUrl}`;
  }

  const handleShare = async (e: any) => {
    e?.stopPropagation?.();
    try {
      await Share.share({
        message: `${mach.title} - Xem trên gikky.net: https://gikky.net/m/${mach.slug}`,
        url: `https://gikky.net/m/${mach.slug}`,
      });
    } catch {
      // Bỏ qua lỗi huỷ chia sẻ
    }
  };

  const handleBamSub = (e: any) => {
    e?.stopPropagation?.();
    if (mach.sub?.slug) {
      router.push(`/s/${mach.sub.slug}` as any);
    }
  };

  const handleBamTacGia = (e: any) => {
    e?.stopPropagation?.();
    if (mach.author?.username) {
      router.push(`/u/${mach.author.username}` as any);
    }
  };

  return (
    <TouchableOpacity activeOpacity={0.8} style={styles.card} onPress={handlePress}>
      {/* Hàng trên: Sub + Tác giả + Ngày */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.subBadge}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={handleBamSub}
        >
          <Text style={styles.subText}>s/{subSlug}</Text>
        </TouchableOpacity>
        <Text style={styles.metaDot}>•</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={handleBamTacGia}
        >
          <Text style={styles.authorText}>u/{tacGia}</Text>
        </TouchableOpacity>
        <Text style={styles.metaDot}>•</Text>
        <Text style={styles.timeText}>{ngayTao}</Text>
      </View>

      {/* Tiêu đề */}
      <Text style={styles.title}>{mach.title}</Text>

      {/* Ảnh xem trước (như Web) */}
      {coAnh && imgUri ? (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imgUri }}
            style={styles.previewImage}
            resizeMode="cover"
          />
          {conLai > 0 ? (
            <View style={styles.moreImagesBadge}>
              <Text style={styles.moreImagesText}>+{conLai}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Xem trước nội dung (Trích) */}
      {mach.xem_truoc?.trich ? (
        <Text
          style={[styles.preview, coAnh && styles.previewWithImage]}
          numberOfLines={coAnh ? 2 : 3}
        >
          {mach.xem_truoc.trich
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')}
        </Text>
      ) : null}

      {/* Hàng dưới: Số mốc + Bình luận + Chia sẻ + Điểm */}
      <View style={styles.footer}>
        <View style={styles.statsGroup}>
          <View style={styles.statBadge}>
            <GitCommit size={15} color="#3b82f6" />
            <Text style={styles.statText}>{mach.entry_count} mốc</Text>
          </View>

          <View style={styles.statBadge}>
            <MessageSquare size={15} color="#9ca3af" />
            <Text style={styles.statText}>{mach.comment_count}</Text>
          </View>

          <TouchableOpacity
            style={styles.statBadge}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handleShare}
          >
            <Share2 size={15} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Khối Vote */}
        <View style={styles.voteBox}>
          <TouchableOpacity
            style={styles.voteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={(e) => {
              (e as any)?.stopPropagation?.();
              onVote?.(mach.id, 1);
            }}
          >
            <ArrowBigUp size={18} color="#6b7280" />
          </TouchableOpacity>

          <Text style={styles.voteScore}>{mach.diem}</Text>

          <TouchableOpacity
            style={styles.voteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={(e) => {
              (e as any)?.stopPropagation?.();
              onVote?.(mach.id, -1);
            }}
          >
            <ArrowBigDown size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2d2d2d",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  subBadge: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
  },
  metaDot: {
    color: "#6b7280",
    marginHorizontal: 6,
  },
  authorText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  timeText: {
    color: "#6b7280",
    fontSize: 12,
  },
  title: {
    color: "#f3f4f6",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 6,
  },
  preview: {
    color: "#9ca3af",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  previewWithImage: {
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: 190,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 10,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  moreImagesBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  moreImagesText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
    paddingTop: 10,
  },
  statsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "500",
  },
  voteBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  voteBtn: {
    padding: 2,
  },
    voteScore: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
    minWidth: 20,
    textAlign: "center",
  },
} as const);
