import React from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, MessageSquare, GitCommit, UserCheck } from "lucide-react-native";
import type { ThongBaoOut } from "@gikky/api-client";

import { useAuth } from "../../context/AuthContext";
import { danhDauDocThongBao, layDanhSachThongBao } from "../../lib/api";

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { daDangNhap } = useAuth();

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["thong-bao"],
    queryFn: layDanhSachThongBao,
    enabled: daDangNhap,
  });

  const docHetMutation = useMutation({
    mutationFn: async () => {
      return danhDauDocThongBao(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thong-bao"] });
    },
  });

  if (!daDangNhap) {
    return (
      <View style={styles.centerContainer}>
        <Bell size={48} color="#71717a" />
        <Text style={styles.emptyTitle}>Chưa đăng nhập</Text>
        <Text style={styles.emptyDesc}>
          Đăng nhập tài khoản để nhận thông báo về mốc mới, phản hồi và bình luận.
        </Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.loginBtnText}>Đăng nhập ngay</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const items = data?.items || [];
  const soChuaDoc = data?.so_chua_doc || 0;

  const handlePressThongBao = async (item: ThongBaoOut) => {
    // Đánh dấu đã đọc nếu chưa đọc
    if (!item.read_at) {
      danhDauDocThongBao([item.id]).then(() => {
        queryClient.invalidateQueries({ queryKey: ["thong-bao"] });
      });
    }

    const payload = item.payload as Record<string, any> | undefined;
    const machId = payload?.mach_id || payload?.id;
    if (machId) {
      router.push(`/mach/${machId}`);
    }
  };

  const renderThongBaoText = (item: ThongBaoOut) => {
    const payload = (item.payload as Record<string, any>) || {};
    const actor = payload.actor_display_name || payload.actor_username || "Ai đó";
    const machTitle = payload.mach_title || "một mạch bạn theo dõi";

    switch (item.type) {
      case "moc_moi":
        return `Mốc #${payload.moc_seq || ""} mới: "${machTitle}"`;
      case "binh_luan_moi":
        return `u/${actor} đã bình luận trên "${machTitle}"`;
      case "phan_hoi_binh_luan":
        return `u/${actor} đã trả lời bình luận của bạn`;
      case "theo_doi_moi":
        return `u/${actor} đã bắt đầu theo dõi bạn`;
      default:
        return payload.message || `Thông báo mới từ hệ thống`;
    }
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case "moc_moi":
        return <GitCommit size={18} color="#3b82f6" />;
      case "binh_luan_moi":
      case "phan_hoi_binh_luan":
        return <MessageSquare size={18} color="#10b981" />;
      case "theo_doi_moi":
        return <UserCheck size={18} color="#f59e0b" />;
      default:
        return <Bell size={18} color="#8b5cf6" />;
    }
  };

  const renderItem = ({ item }: { item: ThongBaoOut }) => {
    const chuaDoc = !item.read_at;
    const thoiGian = new Date(item.created_at).toLocaleDateString("vi-VN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <TouchableOpacity
        style={[styles.notiItem, chuaDoc && styles.notiItemUnread]}
        activeOpacity={0.7}
        onPress={() => handlePressThongBao(item)}
      >
        <View style={styles.iconContainer}>{renderIcon(item.type)}</View>

        <View style={styles.contentContainer}>
          <Text style={[styles.notiText, chuaDoc && styles.notiTextUnread]}>
            {renderThongBaoText(item)}
          </Text>
          <Text style={styles.timeText}>{thoiGian}</Text>
        </View>

        {chuaDoc ? <View style={styles.unreadDot} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header thanh công cụ: Số chưa đọc + Nút đọc tất cả */}
      <View style={styles.topBar}>
        <View style={styles.badgeRow}>
          <Text style={styles.topBarTitle}>Hộp thư</Text>
          {soChuaDoc > 0 ? (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>{soChuaDoc} mới</Text>
            </View>
          ) : null}
        </View>

        {soChuaDoc > 0 ? (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={() => docHetMutation.mutate()}
          >
            <CheckCheck size={16} color="#60a5fa" />
            <Text style={styles.markAllText}>Đọc hết</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Danh sách thông báo */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Đang nạp thông báo...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerContainer}>
          <Bell size={40} color="#3f3f46" />
          <Text style={styles.emptyTitle}>Chưa có thông báo nào</Text>
          <Text style={styles.emptyDesc}>
            Khi có ai bình luận hoặc có mốc mới trên mạch bạn theo dõi, thông báo sẽ hiển thị ở đây.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#3b82f6"
            />
          }
        />
      )}
    </View>
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
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topBarTitle: {
    color: "#f4f4f5",
    fontSize: 16,
    fontWeight: "700",
  },
  counterBadge: {
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  counterText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#1e293b",
  },
  markAllText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    padding: 12,
  },
  notiItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  notiItemUnread: {
    backgroundColor: "#1a2234",
    borderColor: "#2563eb44",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  notiText: {
    color: "#d4d4d8",
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 4,
  },
  notiTextUnread: {
    color: "#f4f4f5",
    fontWeight: "600",
  },
  timeText: {
    color: "#71717a",
    fontSize: 11,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3b82f6",
    marginLeft: 8,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  emptyTitle: {
    color: "#f4f4f5",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
  },
  emptyDesc: {
    color: "#71717a",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  loginBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  loginBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingText: {
    color: "#71717a",
    marginTop: 12,
    fontSize: 14,
  },
});
