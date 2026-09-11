import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import {
  AlertCircle,
  Bookmark,
  CheckCircle,
  ChevronRight,
  Edit3,
  ExternalLink,
  Hash,
  Layers,
  LogIn,
  LogOut,
  Server,
  ShieldCheck,
  ThumbsUp,
  Users,
  X,
} from "lucide-react-native";
import { getHealth } from "@gikky/api-client";
import type { MachTomTatOut, NguoiDungTomTatOut, SubChiTietOut } from "@gikky/api-client";

import { Avatar } from "../../components/Avatar";
import { MachCard } from "../../components/MachCard";
import { useAuth } from "../../context/AuthContext";
import {
  capNhatAvatar,
  capNhatHoSoToi,
  guiVote,
  layDanhSachDaVote,
  layDanhSachDangTheo,
  layDanhSachSubDangTheo,
  layDanhSachSubToiLamMod,
  layDanhSachUserDangTheo,
  layHoSoNguoiDung,
  layMachCuaUser,
  xoaAvatarToi,
} from "../../lib/api";
import { API_BASE_URL } from "../../lib/config";

type TabHoSo = "bai-viet" | "da-vote" | "dang-theo" | "chuyen-muc" | "nguoi" | "khu-mod";

export default function ProfileScreen() {
  const router = useRouter();
  const { nguoiDung, daDangNhap, dangTai, dangXuat, taiLaiThongTin } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabHoSo>("bai-viet");
  const [kiemTraStatus, setKiemTraStatus] = useState<string | null>(null);
  const [dangKiemTra, setDangKiemTra] = useState(false);
  const [dangUploadAvatar, setDangUploadAvatar] = useState(false);

  // Modal Sửa Hồ Sơ
  const [moModalSua, setMoModalSua] = useState(false);
  const [tenHienThi, setTenHienThi] = useState("");
  const [tieuSu, setTieuSu] = useState("");
  const [dangLuu, setDangLuu] = useState(false);

  // 1. Chi tiết hồ sơ cá nhân
  const { data: hoSo, refetch: refetchHoSo } = useQuery({
    queryKey: ["ho-so-cua-toi", nguoiDung?.username],
    queryFn: () => (nguoiDung?.username ? layHoSoNguoiDung(nguoiDung.username) : null),
    enabled: !!nguoiDung?.username && daDangNhap,
  });

  // 2. Tab: Bài viết của tôi
  const {
    data: machCuaToiData,
    isLoading: dangTaiMachCuaToi,
    refetch: refetchMachCuaToi,
  } = useQuery({
    queryKey: ["mach-cua-toi", nguoiDung?.username],
    queryFn: () => (nguoiDung?.username ? layMachCuaUser(nguoiDung.username) : null),
    enabled: daDangNhap && activeTab === "bai-viet",
  });

  // 3. Tab: Mạch đã vote
  const {
    data: daVoteData,
    isLoading: dangTaiDaVote,
    refetch: refetchDaVote,
  } = useQuery({
    queryKey: ["tab-da-vote"],
    queryFn: () => layDanhSachDaVote(),
    enabled: daDangNhap && activeTab === "da-vote",
  });

  // 4. Tab: Mạch đang theo
  const {
    data: dangTheoData,
    isLoading: dangTaiDangTheo,
    refetch: refetchDangTheo,
  } = useQuery({
    queryKey: ["tab-dang-theo"],
    queryFn: () => layDanhSachDangTheo(),
    enabled: daDangNhap && activeTab === "dang-theo",
  });

  // 5. Tab: Chuyên mục đang theo
  const {
    data: subDangTheoData,
    isLoading: dangTaiSubDangTheo,
    refetch: refetchSubDangTheo,
  } = useQuery({
    queryKey: ["tab-sub-dang-theo"],
    queryFn: () => layDanhSachSubDangTheo(),
    enabled: daDangNhap && activeTab === "chuyen-muc",
  });

  // 6. Tab: Người dùng đang theo
  const {
    data: userDangTheoData,
    isLoading: dangTaiUserDangTheo,
    refetch: refetchUserDangTheo,
  } = useQuery({
    queryKey: ["tab-user-dang-theo"],
    queryFn: () => layDanhSachUserDangTheo(),
    enabled: daDangNhap && activeTab === "nguoi",
  });

  // 7. Tab: Chuyên mục tôi làm Mod (nếu là staff hoặc có sub mod)
  const { data: subModData, isLoading: dangTaiSubMod } = useQuery({
    queryKey: ["sub-toi-lam-mod"],
    queryFn: () => layDanhSachSubToiLamMod(),
    enabled: daDangNhap && (nguoiDung?.la_staff === true || activeTab === "khu-mod"),
  });

  const voteMutation = useMutation({
    mutationFn: async ({ machId, huong }: { machId: number; huong: number }) => {
      return guiVote("moc", machId, huong);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mach-cua-toi"] });
      queryClient.invalidateQueries({ queryKey: ["tab-da-vote"] });
      queryClient.invalidateQueries({ queryKey: ["tab-dang-theo"] });
    },
  });

  const handleVote = (machId: number, huong: number) => {
    voteMutation.mutate({ machId, huong });
  };

  // Thay đổi Avatar
  const handleChonAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Quyền truy cập", "Cần cấp quyền truy cập thư viện ảnh để đổi avatar.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setDangUploadAvatar(true);
        await capNhatAvatar(
          asset.uri,
          asset.mimeType ?? undefined,
          asset.fileName ?? undefined
        );
        await taiLaiThongTin();
        refetchHoSo();
        Alert.alert("Thành công", "Đã cập nhật ảnh đại diện mới.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Tải ảnh lên không thành công.";
      Alert.alert("Lỗi", msg);
    } finally {
      setDangUploadAvatar(false);
    }
  };

  const handleXoaAvatar = () => {
    Alert.alert(
      "Xoá ảnh đại diện",
      "Bạn có chắc muốn xoá ảnh đại diện hiện tại và quay về mặc định?",
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Xoá",
          style: "destructive",
          onPress: async () => {
            try {
              setDangUploadAvatar(true);
              await xoaAvatarToi();
              await taiLaiThongTin();
              refetchHoSo();
              Alert.alert("Thành công", "Đã xoá ảnh đại diện.");
            } catch {
              Alert.alert("Lỗi", "Không thể xoá ảnh đại diện.");
            } finally {
              setDangUploadAvatar(false);
            }
          },
        },
      ]
    );
  };

  const handleDoiAvatarMenu = () => {
    const coAvatar = !!(hoSo?.avatar_url || nguoiDung?.avatar_url);
    Alert.alert("Ảnh đại diện", "Tuỳ chọn thay đổi avatar cá nhân:", [
      { text: "Chọn ảnh từ thư viện", onPress: handleChonAvatar },
      ...(coAvatar
        ? [{ text: "Xoá ảnh về mặc định", style: "destructive" as const, onPress: handleXoaAvatar }]
        : []),
      { text: "Huỷ", style: "cancel" as const },
    ]);
  };

  const handleMoSuaHoSo = () => {
    setTenHienThi(hoSo?.display_name || nguoiDung?.display_name || "");
    setTieuSu(hoSo?.bio || "");
    setMoModalSua(true);
  };

  const handleLuuHoSo = async () => {
    if (!tenHienThi.trim()) {
      Alert.alert("Lỗi", "Tên hiển thị không được để trống.");
      return;
    }
    setDangLuu(true);
    try {
      const res = await capNhatHoSoToi({
        display_name: tenHienThi.trim(),
        bio: tieuSu.trim(),
      });
      if (res) {
        setMoModalSua(false);
        await taiLaiThongTin();
        refetchHoSo();
        Alert.alert("Thành công", "Đã cập nhật thông tin hồ sơ.");
      }
    } catch {
      Alert.alert("Thất bại", "Không thể lưu hồ sơ. Vui lòng thử lại.");
    } finally {
      setDangLuu(false);
    }
  };

  const kiemTraKetNoiApi = async () => {
    setDangKiemTra(true);
    setKiemTraStatus(null);
    try {
      const res = await getHealth({ baseUrl: API_BASE_URL });
      if (res.data?.status === "ok") {
        setKiemTraStatus("Kết nối máy chủ OK (status: ok)");
      } else {
        setKiemTraStatus(`Máy chủ phản hồi: ${JSON.stringify(res.data)}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi kết nối";
      setKiemTraStatus(`Thất bại: ${msg}`);
    } finally {
      setDangKiemTra(false);
    }
  };

  if (dangTai) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const coQuyenMod = nguoiDung?.la_staff === true || (subModData && subModData.length > 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Khối Tài khoản Cá Nhân */}
      <View style={styles.card}>
        <View style={styles.avatarRow}>
          <Avatar
            url={hoSo?.avatar_url || nguoiDung?.avatar_url}
            ten={hoSo?.display_name || nguoiDung?.display_name || nguoiDung?.username}
            size={68}
            coTheSua={daDangNhap}
            onSua={handleDoiAvatarMenu}
          />

          <View style={styles.userInfo}>
            {daDangNhap && nguoiDung ? (
              <>
                <View style={styles.nameRow}>
                  <Text style={styles.displayName}>
                    {hoSo?.display_name || nguoiDung.display_name || nguoiDung.username}
                  </Text>
                  {nguoiDung.la_staff && (
                    <View style={styles.staffBadge}>
                      <ShieldCheck size={12} color="#eab308" />
                      <Text style={styles.staffBadgeText}>MOD</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.username}>u/{nguoiDung.username}</Text>
                {nguoiDung.email ? (
                  <Text style={styles.email}>{nguoiDung.email}</Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.displayName}>Khách (Chưa đăng nhập)</Text>
                <Text style={styles.username}>Đăng nhập để vote và bình luận</Text>
              </>
            )}
          </View>
        </View>

        {dangUploadAvatar && (
          <View style={styles.uploadingBox}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.uploadingText}>Đang cập nhật ảnh đại diện...</Text>
          </View>
        )}

        {/* Bio (tiểu sử) nếu có */}
        {daDangNhap && hoSo?.bio ? (
          <Text style={styles.bioText}>{hoSo.bio}</Text>
        ) : null}

        {/* Thống kê hoạt động cá nhân (nếu đã đăng nhập) */}
        {daDangNhap && hoSo && (
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
        )}

        {/* Nút hành động chính */}
        {daDangNhap ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.editBtn} onPress={handleMoSuaHoSo}>
              <Edit3 size={14} color="#d4d4d8" />
              <Text style={styles.editBtnText} numberOfLines={1}>
                Sửa hồ sơ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.publicBtn}
              onPress={() => router.push(`/u/${nguoiDung?.username}` as any)}
            >
              <ExternalLink size={14} color="#60a5fa" />
              <Text style={styles.publicBtnText} numberOfLines={1}>
                Xem hồ sơ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={dangXuat}>
              <LogOut size={15} color="#ef4444" />
              <Text style={styles.logoutText}>Đăng xuất</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push("/login")}
          >
            <LogIn size={16} color="#ffffff" />
            <Text style={styles.loginText}>Đăng nhập ngay</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs Nội Dung Cá Nhân (Chuẩn Web) */}
      {daDangNhap && (
        <View style={styles.tabsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsHeaderContainer}
          >
            <TouchableOpacity
              style={[styles.tabChip, activeTab === "bai-viet" && styles.tabChipActive]}
              onPress={() => setActiveTab("bai-viet")}
            >
              <Layers size={14} color={activeTab === "bai-viet" ? "#3b82f6" : "#a1a1aa"} />
              <Text
                style={[
                  styles.tabChipText,
                  activeTab === "bai-viet" && styles.tabChipTextActive,
                ]}
              >
                Bài viết
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabChip, activeTab === "da-vote" && styles.tabChipActive]}
              onPress={() => setActiveTab("da-vote")}
            >
              <ThumbsUp size={14} color={activeTab === "da-vote" ? "#3b82f6" : "#a1a1aa"} />
              <Text
                style={[
                  styles.tabChipText,
                  activeTab === "da-vote" && styles.tabChipTextActive,
                ]}
              >
                Đã vote
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabChip, activeTab === "dang-theo" && styles.tabChipActive]}
              onPress={() => setActiveTab("dang-theo")}
            >
              <Bookmark size={14} color={activeTab === "dang-theo" ? "#3b82f6" : "#a1a1aa"} />
              <Text
                style={[
                  styles.tabChipText,
                  activeTab === "dang-theo" && styles.tabChipTextActive,
                ]}
              >
                Đang theo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabChip, activeTab === "chuyen-muc" && styles.tabChipActive]}
              onPress={() => setActiveTab("chuyen-muc")}
            >
              <Hash size={14} color={activeTab === "chuyen-muc" ? "#3b82f6" : "#a1a1aa"} />
              <Text
                style={[
                  styles.tabChipText,
                  activeTab === "chuyen-muc" && styles.tabChipTextActive,
                ]}
              >
                Chuyên mục
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabChip, activeTab === "nguoi" && styles.tabChipActive]}
              onPress={() => setActiveTab("nguoi")}
            >
              <Users size={14} color={activeTab === "nguoi" ? "#3b82f6" : "#a1a1aa"} />
              <Text
                style={[
                  styles.tabChipText,
                  activeTab === "nguoi" && styles.tabChipTextActive,
                ]}
              >
                Người
              </Text>
            </TouchableOpacity>

            {coQuyenMod && (
              <TouchableOpacity
                style={[
                  styles.tabChip,
                  styles.modTabChip,
                  activeTab === "khu-mod" && styles.modTabChipActive,
                ]}
                onPress={() => setActiveTab("khu-mod")}
              >
                <ShieldCheck
                  size={14}
                  color={activeTab === "khu-mod" ? "#facc15" : "#eab308"}
                />
                <Text
                  style={[
                    styles.tabChipText,
                    styles.modTabChipText,
                    activeTab === "khu-mod" && styles.modTabChipTextActive,
                  ]}
                >
                  Khu Mod
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Render Nội Dung Từng Tab */}
          <View style={styles.tabContentContainer}>
            {/* Tab 1: Bài viết của tôi */}
            {activeTab === "bai-viet" && (
              <View>
                {dangTaiMachCuaToi ? (
                  <View style={styles.tabLoading}>
                    <ActivityIndicator size="small" color="#3b82f6" />
                  </View>
                ) : (machCuaToiData?.items || []).length === 0 ? (
                  <View style={styles.tabEmpty}>
                    <Text style={styles.tabEmptyText}>Bạn chưa tạo mạch nào.</Text>
                    <TouchableOpacity
                      style={styles.newMachBtn}
                      onPress={() => router.push("/mach/new")}
                    >
                      <Text style={styles.newMachBtnText}>+ Viết bài mới</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  (machCuaToiData?.items || []).map((m: MachTomTatOut) => (
                    <MachCard key={m.id} mach={m} onVote={handleVote} />
                  ))
                )}
              </View>
            )}

            {/* Tab 2: Đã vote */}
            {activeTab === "da-vote" && (
              <View>
                {dangTaiDaVote ? (
                  <View style={styles.tabLoading}>
                    <ActivityIndicator size="small" color="#3b82f6" />
                  </View>
                ) : (daVoteData?.items || []).length === 0 ? (
                  <View style={styles.tabEmpty}>
                    <Text style={styles.tabEmptyText}>Bạn chưa vote mạch nào.</Text>
                  </View>
                ) : (
                  (daVoteData?.items || []).map((m: MachTomTatOut) => (
                    <MachCard key={m.id} mach={m} onVote={handleVote} />
                  ))
                )}
              </View>
            )}

            {/* Tab 3: Đang theo dõi */}
            {activeTab === "dang-theo" && (
              <View>
                {dangTaiDangTheo ? (
                  <View style={styles.tabLoading}>
                    <ActivityIndicator size="small" color="#3b82f6" />
                  </View>
                ) : (dangTheoData?.items || []).length === 0 ? (
                  <View style={styles.tabEmpty}>
                    <Text style={styles.tabEmptyText}>Bạn chưa theo dõi mạch nào.</Text>
                  </View>
                ) : (
                  (dangTheoData?.items || []).map((m: MachTomTatOut) => (
                    <MachCard key={m.id} mach={m} onVote={handleVote} />
                  ))
                )}
              </View>
            )}

            {/* Tab 4: Chuyên mục đang theo */}
            {activeTab === "chuyen-muc" && (
              <View>
                {dangTaiSubDangTheo ? (
                  <View style={styles.tabLoading}>
                    <ActivityIndicator size="small" color="#3b82f6" />
                  </View>
                ) : (subDangTheoData || []).length === 0 ? (
                  <View style={styles.tabEmpty}>
                    <Text style={styles.tabEmptyText}>Bạn chưa theo dõi chuyên mục nào.</Text>
                  </View>
                ) : (
                  (subDangTheoData || []).map((s: SubChiTietOut) => (
                    <TouchableOpacity
                      key={s.slug}
                      style={styles.subCard}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/s/${s.slug}` as any)}
                    >
                      <View style={styles.subCardInfo}>
                        <View style={styles.subCardTitleRow}>
                          <Text style={styles.subCardSlug}>s/{s.slug}</Text>
                          <Text style={styles.subCardTen}>{s.ten}</Text>
                        </View>
                        {s.mo_ta ? (
                          <Text style={styles.subCardMoTa} numberOfLines={2}>
                            {s.mo_ta}
                          </Text>
                        ) : null}
                        <Text style={styles.subCardCount}>{s.so_mach} bài viết</Text>
                      </View>
                      <ChevronRight size={18} color="#71717a" />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* Tab 5: Người dùng đang theo */}
            {activeTab === "nguoi" && (
              <View>
                {dangTaiUserDangTheo ? (
                  <View style={styles.tabLoading}>
                    <ActivityIndicator size="small" color="#3b82f6" />
                  </View>
                ) : (userDangTheoData || []).length === 0 ? (
                  <View style={styles.tabEmpty}>
                    <Text style={styles.tabEmptyText}>Bạn chưa theo dõi tác giả nào.</Text>
                  </View>
                ) : (
                  (userDangTheoData || []).map((u: NguoiDungTomTatOut) => (
                    <TouchableOpacity
                      key={u.username}
                      style={styles.userCard}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/u/${u.username}` as any)}
                    >
                      <Avatar
                        url={u.avatar_url}
                        ten={u.display_name || u.username}
                        size={44}
                      />
                      <View style={styles.userCardInfo}>
                        <Text style={styles.userCardName}>
                          {u.display_name || u.username}
                        </Text>
                        <Text style={styles.userCardUsername}>u/{u.username}</Text>
                      </View>
                      <ChevronRight size={18} color="#71717a" />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* Tab 6: Khu Mod / Quản trị viên */}
            {activeTab === "khu-mod" && (
              <View>
                <View style={styles.modIntroBox}>
                  <View style={styles.modIntroTitleRow}>
                    <ShieldCheck size={18} color="#eab308" />
                    <Text style={styles.modIntroTitle}>QUYỀN KIỂM DUYỆT VIÊN</Text>
                  </View>
                  <Text style={styles.modIntroDesc}>
                    Bạn có thẩm quyền kiểm duyệt các bài viết và chuyên mục phụ trách. Khi xem bài viết trên app, hãy dùng nút Mod (khiên vàng) để khoá mạch, ẩn bài, ẩn mốc hoặc ẩn bình luận vi phạm.
                  </Text>
                </View>

                <Text style={styles.modSubSectionTitle}>CHUYÊN MỤC BẠN LÀM MOD</Text>

                {dangTaiSubMod ? (
                  <View style={styles.tabLoading}>
                    <ActivityIndicator size="small" color="#eab308" />
                  </View>
                ) : (subModData || []).length === 0 ? (
                  <View style={styles.tabEmpty}>
                    <Text style={styles.tabEmptyText}>
                      {nguoiDung?.la_staff
                        ? "Bạn là Quản trị viên toàn hệ thống (Staff)."
                        : "Bạn chưa được phân công quản lý chuyên mục nào."}
                    </Text>
                  </View>
                ) : (
                  (subModData || []).map((s: SubChiTietOut) => (
                    <TouchableOpacity
                      key={s.slug}
                      style={styles.subCard}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/s/${s.slug}` as any)}
                    >
                      <View style={styles.subCardInfo}>
                        <View style={styles.subCardTitleRow}>
                          <Text style={styles.subCardSlug}>s/{s.slug}</Text>
                          <Text style={styles.subCardTen}>{s.ten}</Text>
                        </View>
                        {s.mo_ta ? (
                          <Text style={styles.subCardMoTa} numberOfLines={2}>
                            {s.mo_ta}
                          </Text>
                        ) : null}
                        <Text style={styles.subCardCount}>{s.so_mach} bài viết</Text>
                      </View>
                      <ChevronRight size={18} color="#eab308" />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Thông tin Môi trường Dev & Máy chủ */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>CẤU HÌNH KẾT NỐI API</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Server size={18} color="#9ca3af" />
          <View style={styles.infoTextGroup}>
            <Text style={styles.infoLabel}>Django API Base URL:</Text>
            <Text style={styles.infoValue}>{API_BASE_URL}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.testBtn}
          onPress={kiemTraKetNoiApi}
          disabled={dangKiemTra}
        >
          {dangKiemTra ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.testBtnText}>Kiểm tra kết nối API</Text>
          )}
        </TouchableOpacity>

        {kiemTraStatus ? (
          <View style={styles.statusBox}>
            {kiemTraStatus.includes("OK") ? (
              <CheckCircle size={16} color="#22c55e" />
            ) : (
              <AlertCircle size={16} color="#ef4444" />
            )}
            <Text style={styles.statusBoxText}>{kiemTraStatus}</Text>
          </View>
        ) : null}
      </View>

      {/* Modal Chỉnh Sửa Hồ Sơ */}
      <Modal
        visible={moModalSua}
        animationType="slide"
        transparent
        onRequestClose={() => setMoModalSua(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setMoModalSua(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chỉnh sửa hồ sơ</Text>
              <TouchableOpacity onPress={() => setMoModalSua(false)}>
                <X size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Tên hiển thị</Text>
            <TextInput
              style={styles.textInput}
              value={tenHienThi}
              onChangeText={setTenHienThi}
              placeholder="Nhập tên hiển thị..."
              placeholderTextColor="#71717a"
              maxLength={50}
            />

            <Text style={styles.inputLabel}>Tiểu sử / Giới thiệu</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={tieuSu}
              onChangeText={setTieuSu}
              placeholder="Giới thiệu đôi nét về bạn..."
              placeholderTextColor="#71717a"
              multiline
              numberOfLines={4}
              maxLength={300}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setMoModalSua(false)}
              >
                <Text style={styles.cancelText}>Huỷ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, dangLuu && styles.btnDisabled]}
                disabled={dangLuu}
                onPress={handleLuuHoSo}
              >
                {dangLuu ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveText}>Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#121212",
  },
  card: {
    backgroundColor: "#1e1e1e",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  displayName: {
    color: "#f4f4f5",
    fontSize: 18,
    fontWeight: "700",
  },
  staffBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2c2817",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#eab308",
  },
  staffBadgeText: {
    color: "#facc15",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  username: {
    color: "#60a5fa",
    fontSize: 14,
    marginTop: 2,
  },
  email: {
    color: "#71717a",
    fontSize: 12,
    marginTop: 2,
  },
  uploadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 8,
    backgroundColor: "#18181b",
    borderRadius: 8,
  },
  uploadingText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  bioText: {
    color: "#d4d4d8",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: "#18181b",
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
    height: 20,
    backgroundColor: "#27272a",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#27272a",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  editBtnText: {
    color: "#f4f4f5",
    fontSize: 13,
    fontWeight: "600",
  },
  publicBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#1e293b",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  publicBtnText: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "600",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#27272a",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "600",
  },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
    gap: 8,
  },
  loginText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  tabsSection: {
    marginBottom: 20,
  },
  tabsHeaderContainer: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
    marginBottom: 12,
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1e1e1e",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  tabChipActive: {
    backgroundColor: "#1e293b",
    borderColor: "#3b82f6",
  },
  tabChipText: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "600",
  },
  tabChipTextActive: {
    color: "#60a5fa",
  },
  modTabChip: {
    borderColor: "#854d0e",
    backgroundColor: "#1f1d14",
  },
  modTabChipActive: {
    borderColor: "#eab308",
    backgroundColor: "#2c2817",
  },
  modTabChipText: {
    color: "#eab308",
  },
  modTabChipTextActive: {
    color: "#facc15",
  },
  tabContentContainer: {
    minHeight: 120,
  },
  tabLoading: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  tabEmpty: {
    padding: 30,
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  tabEmptyText: {
    color: "#71717a",
    fontSize: 14,
  },
  newMachBtn: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newMachBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  subCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  subCardInfo: {
    flex: 1,
    marginRight: 12,
  },
  subCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  subCardSlug: {
    color: "#60a5fa",
    fontSize: 14,
    fontWeight: "700",
  },
  subCardTen: {
    color: "#f4f4f5",
    fontSize: 14,
    fontWeight: "600",
  },
  subCardMoTa: {
    color: "#9ca3af",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  subCardCount: {
    color: "#71717a",
    fontSize: 11,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  userCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userCardName: {
    color: "#f4f4f5",
    fontSize: 14,
    fontWeight: "700",
  },
  userCardUsername: {
    color: "#60a5fa",
    fontSize: 12,
    marginTop: 2,
  },
  modIntroBox: {
    backgroundColor: "#2c2817",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#eab308",
  },
  modIntroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  modIntroTitle: {
    color: "#facc15",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modIntroDesc: {
    color: "#e4e4e7",
    fontSize: 12,
    lineHeight: 18,
  },
  modSubSectionTitle: {
    color: "#71717a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionHeader: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: "#71717a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  infoTextGroup: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    color: "#71717a",
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    color: "#60a5fa",
    fontSize: 14,
    fontFamily: "monospace",
  },
  testBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  testBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  statusBoxText: {
    color: "#d4d4d8",
    fontSize: 13,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: "#18181b",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    color: "#f4f4f5",
    fontSize: 17,
    fontWeight: "700",
  },
  inputLabel: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#27272a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f4f4f5",
    fontSize: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelText: {
    color: "#a1a1aa",
    fontSize: 14,
    fontWeight: "600",
  },
  saveBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  saveText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
