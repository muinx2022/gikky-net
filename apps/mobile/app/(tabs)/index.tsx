import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Plus,
  Radio,
  Tag,
  X,
} from "lucide-react-native";
import type { MachTomTatOut } from "@gikky/api-client";

import { MachCard } from "../../components/MachCard";
import { useAuth } from "../../context/AuthContext";
import { guiVote, layDanhSachSub, layFeedDangDienRa, layFeedMoi } from "../../lib/api";

type TabLoai = "moi" | "dang-dien-ra";

export default function FeedScreen() {
  const router = useRouter();
  const { daDangNhap } = useAuth();
  const [tab, setTab] = useState<TabLoai>("moi");
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [moModalSub, setMoModalSub] = useState(false);
  const [hienNutLenDau, setHienNutLenDau] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const queryClient = useQueryClient();

  // Nạp danh sách Sub
  const { data: subs = [] } = useQuery({
    queryKey: ["subs"],
    queryFn: layDanhSachSub,
  });

  const {
    data,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["feed", tab, selectedSub],
    queryFn: async ({ pageParam }) => {
      if (tab === "dang-dien-ra") {
        return layFeedDangDienRa(pageParam, selectedSub || undefined);
      }
      return layFeedMoi(pageParam, selectedSub || undefined);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage?.cursor_ke_tiep ?? undefined,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ id, huong }: { id: number; huong: number }) => {
      return guiVote("moc", id, huong);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const allItems: MachTomTatOut[] =
    data?.pages.flatMap((page) => page?.items || []) || [];

  const handleVote = (machId: number, huong: number) => {
    const mach = allItems.find((m) => m.id === machId);
    if (mach?.moc_1_id) {
      voteMutation.mutate({ id: mach.moc_1_id, huong });
    }
  };

  const handleTaoMachMoi = () => {
    if (!daDangNhap) {
      router.push("/login");
    } else {
      router.push("/mach/new");
    }
  };

  const cuonLenDauTrang = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#3b82f6" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Thanh điều khiển Feed: [Mới | Đang diễn ra] + [Chuyên mục ▾] */}
      <View style={styles.controlBar}>
        <View style={styles.tabGroup}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "moi" && styles.tabBtnActive]}
            onPress={() => setTab("moi")}
          >
            <Clock size={13} color={tab === "moi" ? "#ffffff" : "#a1a1aa"} />
            <Text style={[styles.tabText, tab === "moi" && styles.tabTextActive]}>
              Mới
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, tab === "dang-dien-ra" && styles.tabBtnActive]}
            onPress={() => setTab("dang-dien-ra")}
          >
            <Radio size={13} color={tab === "dang-dien-ra" ? "#ffffff" : "#a1a1aa"} />
            <Text
              style={[styles.tabText, tab === "dang-dien-ra" && styles.tabTextActive]}
            >
              Đang diễn ra
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nút lọc Chuyên mục nhỏ gọn */}
        <TouchableOpacity
          style={[styles.subFilterTrigger, selectedSub !== null && styles.subFilterTriggerActive]}
          onPress={() => setMoModalSub(true)}
        >
          <Tag size={13} color={selectedSub ? "#60a5fa" : "#9ca3af"} />
          <Text
            style={[styles.subFilterTriggerText, selectedSub !== null && styles.subFilterTriggerTextActive]}
            numberOfLines={1}
          >
            {selectedSub ? `s/${selectedSub}` : "Chuyên mục"}
          </Text>
          <ChevronDown size={14} color={selectedSub ? "#60a5fa" : "#71717a"} />
        </TouchableOpacity>
      </View>

      {/* Dải thông báo đang lọc theo chuyên mục (nếu có) */}
      {selectedSub ? (
        <View style={styles.activeSubBanner}>
          <Text style={styles.activeSubText}>
            Đang lọc: <Text style={styles.activeSubSlug}>s/{selectedSub}</Text>
          </Text>
          <TouchableOpacity
            style={styles.clearSubBtn}
            onPress={() => setSelectedSub(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearSubText}>Bỏ lọc</Text>
            <X size={14} color="#60a5fa" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Danh sách Feed */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Đang tải mạch mới...</Text>
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
              onRefresh={() => {
                refetch();
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
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>Chưa có bài nào ở đây.</Text>
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

      {/* Nút FAB Tạo Mạch Mới */}
      <TouchableOpacity
        style={styles.fabBtn}
        activeOpacity={0.85}
        onPress={handleTaoMachMoi}
      >
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Modal Chọn Chuyên Mục (Bottom Sheet) */}
      <Modal
        visible={moModalSub}
        animationType="slide"
        transparent
        onRequestClose={() => setMoModalSub(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setMoModalSub(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn Chuyên mục</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setMoModalSub(false)}
              >
                <X size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList}>
              {/* Lựa chọn Tất cả chuyên mục */}
              <TouchableOpacity
                style={[
                  styles.subItemRow,
                  selectedSub === null && styles.subItemRowActive,
                ]}
                onPress={() => {
                  setSelectedSub(null);
                  setMoModalSub(false);
                }}
              >
                <View style={styles.subItemInfo}>
                  <Text
                    style={[
                      styles.subItemTitle,
                      selectedSub === null && styles.subItemTitleActive,
                    ]}
                  >
                    Tất cả chuyên mục
                  </Text>
                  <Text style={styles.subItemDesc}>
                    Xem mạch từ mọi chủ đề trên gikky.net
                  </Text>
                </View>
                {selectedSub === null ? (
                  <Check size={18} color="#3b82f6" />
                ) : null}
              </TouchableOpacity>

              {/* Từng chuyên mục trong hệ thống */}
              {subs.map((s) => {
                const isSelected = selectedSub === s.slug;
                return (
                  <TouchableOpacity
                    key={s.slug}
                    style={[
                      styles.subItemRow,
                      isSelected && styles.subItemRowActive,
                    ]}
                    onPress={() => {
                      setSelectedSub(s.slug);
                      setMoModalSub(false);
                    }}
                  >
                    <View style={styles.subItemInfo}>
                      <View style={styles.subBadgeWrap}>
                        <Text style={styles.subBadgeSlug}>s/{s.slug}</Text>
                        <Text style={styles.subBadgeName}>{s.ten}</Text>
                      </View>
                    </View>
                    {isSelected ? <Check size={18} color="#3b82f6" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#18181b",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  tabGroup: {
    flexDirection: "row",
    gap: 8,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "#27272a",
  },
  tabBtnActive: {
    backgroundColor: "#2563eb",
  },
  tabText: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  subFilterTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#27272a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    maxWidth: 160,
  },
  subFilterTriggerActive: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  subFilterTriggerText: {
    color: "#d4d4d8",
    fontSize: 12,
    fontWeight: "500",
  },
  subFilterTriggerTextActive: {
    color: "#60a5fa",
    fontWeight: "700",
  },
  activeSubBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#172033",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  activeSubText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  activeSubSlug: {
    color: "#60a5fa",
    fontWeight: "700",
  },
  clearSubBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clearSubText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    padding: 12,
    paddingBottom: 90,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: {
    color: "#71717a",
    marginTop: 12,
    fontSize: 14,
  },
  emptyText: {
    color: "#71717a",
    fontSize: 14,
    fontStyle: "italic",
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  scrollToTopBtn: {
    position: "absolute",
    right: 20,
    bottom: 86,
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
  fabBtn: {
    position: "absolute",
    right: 20,
    bottom: 22,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    backgroundColor: "#18181b",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    borderTopWidth: 1,
    borderTopColor: "#27272a",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  modalTitle: {
    color: "#f4f4f5",
    fontSize: 16,
    fontWeight: "700",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  subItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  subItemRowActive: {
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  subItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  subItemTitle: {
    color: "#e4e4e7",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  subItemTitleActive: {
    color: "#60a5fa",
    fontWeight: "700",
  },
  subBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  subBadgeSlug: {
    color: "#60a5fa",
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "700",
    backgroundColor: "#1e293b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subBadgeName: {
    color: "#f4f4f5",
    fontSize: 14,
    fontWeight: "600",
  },
  subItemDesc: {
    color: "#71717a",
    fontSize: 12,
    lineHeight: 16,
  },
});
