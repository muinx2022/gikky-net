import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUp,
  Calendar,
  MessageSquare,
  Quote,
  ShieldCheck,
  User,
  UserCheck,
  UserPlus,
} from "lucide-react-native";
import type { MachTomTatOut } from "@gikky/api-client";

import { Avatar } from "../../components/Avatar";
import { MachCard } from "../../components/MachCard";
import { useAuth } from "../../context/AuthContext";
import {
  guiVote,
  layHoSoNguoiDung,
  layMachCuaUser,
  layThongTinUserCuaToi,
  theoDoiUser,
} from "../../lib/api";

export default function UserProfileScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const tenNguoiDung = username || "";
  const { daDangNhap, nguoiDung } = useAuth();
  const queryClient = useQueryClient();

  const [hienNutLenDau, setHienNutLenDau] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Hồ sơ công khai
  const {
    data: hoSo,
    isLoading: dangTaiHoSo,
    refetch: refetchHoSo,
  } = useQuery({
    queryKey: ["user-profile", tenNguoiDung],
    queryFn: () => layHoSoNguoiDung(tenNguoiDung),
    enabled: !!tenNguoiDung,
  });

  // Trạng thái theo dõi
  const { data: userCuaToi } = useQuery({
    queryKey: ["user-cua-toi", tenNguoiDung],
    queryFn: () => layThongTinUserCuaToi(tenNguoiDung),
    enabled: !!tenNguoiDung && daDangNhap,
  });

  const dangTheoUser = userCuaToi?.following ?? false;
  const laToi =
    userCuaToi?.la_toi ??
    (daDangNhap && nguoiDung?.username === tenNguoiDung);

  // Mutation theo dõi
  const followMutation = useMutation({
    mutationFn: async (bat: boolean) => {
      return theoDoiUser(tenNguoiDung, bat);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-cua-toi", tenNguoiDung] });
    },
  });

  const handleToggleTheoDoi = () => {
    if (!daDangNhap) {
      Alert.alert("Yêu cầu đăng nhập", "Bạn cần đăng nhập để theo dõi tác giả này.");
      return;
    }
    followMutation.mutate(!dangTheoUser);
  };

  // Danh sách mạch của user
  const {
    data,
    isLoading: dangTaiMach,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchMach,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["user-machs", tenNguoiDung],
    queryFn: async ({ pageParam }) => {
      return layMachCuaUser(tenNguoiDung, pageParam as string | undefined);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage?.cursor_ke_tiep || undefined,
    enabled: !!tenNguoiDung,
  });

  // Vote
  const voteMutation = useMutation({
    mutationFn: async ({ machId, huong }: { machId: number; huong: number }) => {
      return guiVote("moc", machId, huong);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-machs", tenNguoiDung] });
    },
  });

  const handleVote = (machId: number, huong: number) => {
    voteMutation.mutate({ machId, huong });
  };

  const allItems: MachTomTatOut[] =
    data?.pages.flatMap((page) => page?.items || []) || [];

  const cuonLenDauTrang = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const ngayThamGia = hoSo?.date_joined
    ? new Date(hoSo.date_joined).toLocaleDateString("vi-VN", {
        month: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color="#f4f4f5" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Hồ sơ u/{tenNguoiDung}</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={allItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <MachCard mach={item} onVote={handleVote} />}
        contentContainerStyle={styles.listContent}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setHienNutLenDau(y > 350);
        }}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetchHoSo();
              refetchMach();
            }}
            tintColor="#3b82f6"
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          dangTaiHoSo ? (
            <View style={styles.headerLoading}>
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
          ) : hoSo ? (
            <View style={styles.profileCard}>
              <View style={styles.profileRow}>
                <Avatar
                  url={hoSo.avatar_url}
                  ten={hoSo.display_name || hoSo.username}
                  size={60}
                />
                <View style={styles.profileMain}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.displayName}>
                      {hoSo.display_name || hoSo.username}
                    </Text>
                    {(hoSo as any).la_staff && (
                      <View style={styles.staffBadge}>
                        <ShieldCheck size={11} color="#eab308" />
                        <Text style={styles.staffBadgeText}>MOD</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.username}>u/{hoSo.username}</Text>
                  {ngayThamGia ? (
                    <View style={styles.joinedRow}>
                      <Calendar size={12} color="#71717a" />
                      <Text style={styles.joinedText}>Tham gia {ngayThamGia}</Text>
                    </View>
                  ) : null}
                </View>

                {!laToi && (
                  <TouchableOpacity
                    style={[
                      styles.followBtn,
                      dangTheoUser && styles.followBtnActive,
                    ]}
                    onPress={handleToggleTheoDoi}
                  >
                    {dangTheoUser ? (
                      <UserCheck size={14} color="#60a5fa" />
                    ) : (
                      <UserPlus size={14} color="#9ca3af" />
                    )}
                    <Text
                      style={[
                        styles.followBtnText,
                        dangTheoUser && styles.followBtnTextActive,
                      ]}
                    >
                      {dangTheoUser ? "Đang theo" : "Theo dõi"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {hoSo.bio ? (
                <Text style={styles.bio}>{hoSo.bio}</Text>
              ) : null}

              {/* Thống kê hoạt động */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{hoSo.so_mach}</Text>
                  <Text style={styles.statLbl}>Mạch</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{hoSo.so_moc}</Text>
                  <Text style={styles.statLbl}>Mốc</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{hoSo.so_binh_luan}</Text>
                  <Text style={styles.statLbl}>Bình luận</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>×{hoSo.duoc_trich}</Text>
                  <Text style={styles.statLbl}>Được trích</Text>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>CÁC MẠCH ĐÃ ĐĂNG</Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !dangTaiMach ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tác giả này chưa đăng mạch nào.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
          ) : null
        }
      />

      {/* Nút mũi tên lên đầu trang */}
      {hienNutLenDau && (
        <TouchableOpacity
          style={styles.scrollToTopBtn}
          activeOpacity={0.8}
          onPress={cuonLenDauTrang}
        >
          <ArrowUp size={20} color="#ffffff" />
        </TouchableOpacity>
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
    backgroundColor: "#18181b",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  topBarTitle: {
    color: "#f4f4f5",
    fontSize: 16,
    fontWeight: "700",
  },
  listContent: {
    padding: 12,
  },
  headerLoading: {
    paddingVertical: 20,
    alignItems: "center",
  },
  profileCard: {
    backgroundColor: "#18181b",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  profileMain: {
    flex: 1,
  },
  displayName: {
    color: "#f4f4f5",
    fontSize: 17,
    fontWeight: "700",
  },
  username: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 1,
  },
  joinedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  joinedText: {
    color: "#71717a",
    fontSize: 12,
  },
  staffBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#2c2817",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#eab308",
  },
  staffBadgeText: {
    color: "#facc15",
    fontSize: 10,
    fontWeight: "800",
  },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#27272a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  followBtnActive: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  followBtnText: {
    color: "#d4d4d8",
    fontSize: 13,
    fontWeight: "600",
  },
  followBtnTextActive: {
    color: "#60a5fa",
  },
  bio: {
    color: "#d4d4d8",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 14,
    paddingVertical: 10,
    backgroundColor: "#27272a",
    borderRadius: 10,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statVal: {
    color: "#f4f4f5",
    fontSize: 16,
    fontWeight: "700",
  },
  statLbl: {
    color: "#71717a",
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#3f3f46",
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 2,
  },
  sectionTitle: {
    color: "#71717a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  emptyText: {
    color: "#71717a",
    fontSize: 14,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  scrollToTopBtn: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
});
