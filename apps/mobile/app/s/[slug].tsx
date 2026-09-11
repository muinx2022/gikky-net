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
  Bookmark,
  BookmarkCheck,
  Clock,
  Radio,
} from "lucide-react-native";
import type { MachTomTatOut } from "@gikky/api-client";

import { MachCard } from "../../components/MachCard";
import { useAuth } from "../../context/AuthContext";
import {
  guiVote,
  layChiTietSub,
  layFeedDangDienRa,
  layFeedMoi,
  layThongTinSubCuaToi,
  theoDoiSub,
} from "../../lib/api";

type TabLoai = "moi" | "dang-dien-ra";

export default function SubScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const subSlug = slug || "chung";
  const { daDangNhap } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabLoai>("moi");
  const [hienNutLenDau, setHienNutLenDau] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Chi tiết Sub
  const { data: subDetail, isLoading: dangTaiSub } = useQuery({
    queryKey: ["sub-detail", subSlug],
    queryFn: () => layChiTietSub(subSlug),
    enabled: !!subSlug,
  });

  // Trạng thái theo dõi Sub của viewer
  const { data: subCuaToi } = useQuery({
    queryKey: ["sub-cua-toi", subSlug],
    queryFn: () => layThongTinSubCuaToi(subSlug),
    enabled: !!subSlug && daDangNhap,
  });

  const dangTheoSub = subCuaToi?.following ?? false;

  // Mutation theo dõi Sub
  const followMutation = useMutation({
    mutationFn: async (bat: boolean) => {
      return theoDoiSub(subSlug, bat);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-cua-toi", subSlug] });
    },
  });

  const handleToggleTheoDoi = () => {
    if (!daDangNhap) {
      Alert.alert("Yêu cầu đăng nhập", "Bạn cần đăng nhập để theo dõi chuyên mục này.");
      return;
    }
    followMutation.mutate(!dangTheoSub);
  };

  // Danh sách feed theo Sub
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["feed-sub", subSlug, activeTab],
    queryFn: async ({ pageParam }) => {
      if (activeTab === "dang-dien-ra") {
        return layFeedDangDienRa(pageParam as string | undefined, subSlug);
      }
      return layFeedMoi(pageParam as string | undefined, subSlug);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage?.cursor_ke_tiep || undefined,
  });

  // Vote mạch
  const voteMutation = useMutation({
    mutationFn: async ({ machId, huong }: { machId: number; huong: number }) => {
      return guiVote("moc", machId, huong);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-sub", subSlug] });
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

  return (
    <View style={styles.container}>
      {/* Header Chuyên Mục */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color="#f4f4f5" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.subSlug}>s/{subSlug}</Text>
            {subDetail?.ten ? (
              <Text style={styles.subTen}>{subDetail.ten}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.followBtn,
              dangTheoSub && styles.followBtnActive,
            ]}
            onPress={handleToggleTheoDoi}
          >
            {dangTheoSub ? (
              <BookmarkCheck size={14} color="#60a5fa" />
            ) : (
              <Bookmark size={14} color="#9ca3af" />
            )}
            <Text
              style={[
                styles.followBtnText,
                dangTheoSub && styles.followBtnTextActive,
              ]}
            >
              {dangTheoSub ? "Đang theo" : "Theo dõi"}
            </Text>
          </TouchableOpacity>
        </View>

        {subDetail?.mo_ta ? (
          <Text style={styles.subMoTa} numberOfLines={2}>
            {subDetail.mo_ta}
          </Text>
        ) : null}

        {subDetail ? (
          <Text style={styles.subStats}>
            {subDetail.so_mach} mạch đã đăng
          </Text>
        ) : null}
      </View>

      {/* Thanh điều khiển Tabs: Mới / Đang diễn ra */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "moi" && styles.tabBtnActive]}
          onPress={() => setActiveTab("moi")}
        >
          <Clock size={15} color={activeTab === "moi" ? "#3b82f6" : "#71717a"} />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "moi" && styles.tabBtnTextActive,
            ]}
          >
            Mới
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === "dang-dien-ra" && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab("dang-dien-ra")}
        >
          <Radio
            size={15}
            color={activeTab === "dang-dien-ra" ? "#3b82f6" : "#71717a"}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "dang-dien-ra" && styles.tabBtnTextActive,
            ]}
          >
            Đang diễn ra
          </Text>
        </TouchableOpacity>
      </View>

      {/* Danh sách Feed */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Đang nạp bài viết s/{subSlug}...</Text>
        </View>
      ) : (
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
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={() => refetch()}
              tintColor="#3b82f6"
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#3b82f6" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>Chưa có bài nào trong s/{subSlug}.</Text>
            </View>
          }
        />
      )}

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
  header: {
    backgroundColor: "#18181b",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backBtn: {
    marginRight: 10,
    padding: 4,
  },
  headerTitles: {
    flex: 1,
  },
  subSlug: {
    color: "#60a5fa",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  subTen: {
    color: "#f4f4f5",
    fontSize: 13,
    fontWeight: "500",
  },
  subMoTa: {
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  subStats: {
    color: "#71717a",
    fontSize: 12,
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
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#18181b",
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
    paddingHorizontal: 12,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: {
    borderBottomColor: "#3b82f6",
  },
  tabBtnText: {
    color: "#71717a",
    fontSize: 13,
    fontWeight: "600",
  },
  tabBtnTextActive: {
    color: "#f4f4f5",
  },
  listContent: {
    padding: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    minHeight: 250,
  },
  loadingText: {
    color: "#71717a",
    marginTop: 10,
    fontSize: 14,
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
