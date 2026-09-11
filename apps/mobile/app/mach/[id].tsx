import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  MessageSquare,
  Clock,
  Lock,
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
  Flag,
  PlusCircle,
  RotateCcw,
  Share2,
  ShieldAlert,
  X,
} from "lucide-react-native";
import type { BinhLuanOut, MocOut } from "@gikky/api-client";

import { BaoCaoModal, DoiTuongBaoCao } from "../../components/BaoCaoModal";
import { BinhLuanModal } from "../../components/BinhLuanModal";
import { ChanDongSo } from "../../components/ChanDongSo";
import { DongSoModal } from "../../components/DongSoModal";
import { LightboxModal } from "../../components/LightboxModal";
import { LichSuMocModal } from "../../components/LichSuMocModal";
import { MocItem } from "../../components/MocItem";
import { ModActionModal, DoiTuongMod } from "../../components/ModActionModal";
import { SoanThaoHtml, chuanHoaHtmlKhiLuu } from "../../components/SoanThaoHtml";
import { SuaMocModal } from "../../components/SuaMocModal";
import { useAuth } from "../../context/AuthContext";
import {
  anBinhLuanHienTai,
  dongSoMachHienTai,
  guiVote,
  layBinhLuanMach,
  layBinhLuanMoc,
  layChiTietMach,
  layThongTinMachCuaToi,
  moLaiMachHienTai,
  noiMocVaoMach,
  suaBinhLuanHienTai,
  suaMocHienTai,
  theoDoiMach,
  vietBinhLuanMoi,
  xoaBinhLuanHienTai,
  xoaMocHienTai,
} from "../../lib/api";

export default function MachDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const machId = Number(id);
  const queryClient = useQueryClient();
  const { nguoiDung, daDangNhap } = useAuth();

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${mach?.title} - https://gikky.net/m/${mach?.slug}`,
        url: `https://gikky.net/m/${mach?.slug}`,
      });
    } catch {
      // ignore
    }
  };

  // State quản lý Modal bình luận (Khán đài hoặc Ngăn kéo)
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [activeMocId, setActiveMocId] = useState<number | null>(null);

  // State quản lý Modal Nối Mốc mới
  const [noiMocVisible, setNoiMocVisible] = useState(false);
  const [noiDungMoc, setNoiDungMoc] = useState("");
  const [dangNoiMoc, setDangNoiMoc] = useState(false);

  // State quản lý Báo Cáo Vi Phạm
  const [baoCaoVisible, setBaoCaoVisible] = useState(false);
  const [doiTuongBaoCao, setDoiTuongBaoCao] = useState<DoiTuongBaoCao | null>(null);

  // State quản lý Công Cụ Mod
  const [modModalVisible, setModModalVisible] = useState(false);
  const [doiTuongMod, setDoiTuongMod] = useState<DoiTuongMod | null>(null);

  // State quản lý Đóng Sổ Mạch
  const [dongSoVisible, setDongSoVisible] = useState(false);
  const [dangDongSo, setDangDongSo] = useState(false);

  const handleXacNhanDongSo = async (ketQua: string, baiHoc: string) => {
    setDangDongSo(true);
    try {
      const res = await dongSoMachHienTai(machId, {
        ket_qua: ketQua.trim() || null,
        bai_hoc: baiHoc.trim() || null,
      });
      if (res) {
        queryClient.invalidateQueries({ queryKey: ["mach", machId] });
      }
    } finally {
      setDangDongSo(false);
    }
  };

  const handleMoLaiMach = () => {
    Alert.alert(
      "Mở lại mạch này?",
      "Dòng kết quả đã ghi khi đóng sổ sẽ bị xoá và bạn có thể tiếp tục nối mốc mới.",
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Mở lại",
          onPress: async () => {
            try {
              const res = await moLaiMachHienTai(machId);
              if (res) {
                queryClient.invalidateQueries({ queryKey: ["mach", machId] });
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Mở lại mạch thất bại.";
              Alert.alert("Lỗi", msg);
            }
          },
        },
      ]
    );
  };

  const handleMoBaoCao = (
    loai: "mach" | "moc" | "comment",
    id: number,
    tieuDe?: string
  ) => {
    if (!daDangNhap) {
      Alert.alert("Yêu cầu đăng nhập", "Bạn cần đăng nhập để gửi báo cáo vi phạm.");
      return;
    }
    setDoiTuongBaoCao({ target_type: loai, target_id: id, tieuDe });
    setBaoCaoVisible(true);
  };

  const handleMoModAction = (
    loai: "mach" | "moc" | "comment",
    id: number,
    tieuDe?: string,
    dangKhoa?: boolean,
    dangAn?: boolean
  ) => {
    setDoiTuongMod({ loai, id, tieuDe, dangKhoa, dangAn });
    setModModalVisible(true);
  };

  // State quản lý Lightbox xem ảnh
  const [anhPhongsTo, setAnhPhongsTo] = useState<string | null>(null);

  // State quản lý Lịch sử sửa mốc
  const [lichSuMocVisible, setLichSuMocVisible] = useState(false);
  const [lichSuMocId, setLichSuMocId] = useState<number | null>(null);
  const [lichSuMocSeq, setLichSuMocSeq] = useState<number | undefined>(undefined);

  // State quản lý Chỉnh sửa mốc
  const [suaMocVisible, setSuaMocVisible] = useState(false);
  const [mocDangSua, setMocDangSua] = useState<MocOut | null>(null);
  const [dangSuaMoc, setDangSuaMoc] = useState(false);

  const handleMoLichSuMoc = (mocId: number, seq: number) => {
    setLichSuMocId(mocId);
    setLichSuMocSeq(seq);
    setLichSuMocVisible(true);
  };

  const handleMoSuaMoc = (moc: MocOut) => {
    setMocDangSua(moc);
    setSuaMocVisible(true);
  };

  const handleLuuSuaMoc = async (mocId: number, body: string) => {
    setDangSuaMoc(true);
    try {
      const res = await suaMocHienTai(mocId, { body });
      if (res) {
        queryClient.invalidateQueries({ queryKey: ["mach", machId] });
      }
    } finally {
      setDangSuaMoc(false);
    }
  };

  const handleXoaMoc = (moc: MocOut) => {
    Alert.alert(
      `Xoá mốc #${moc.seq}?`,
      "Mốc này sẽ bị xoá khỏi mạch. Bạn có chắc chắn muốn xoá không?",
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Xoá mốc",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await xoaMocHienTai(moc.id);
              if (res) {
                queryClient.invalidateQueries({ queryKey: ["mach", machId] });
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Xoá mốc không thành công.";
              Alert.alert("Lỗi", msg);
            }
          },
        },
      ]
    );
  };

  // Cuộn về đầu trang
  const flatListRef = useRef<FlatList>(null);
  const [hienNutLenDau, setHienNutLenDau] = useState(false);

  const {
    data: mach,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["mach", machId],
    queryFn: () => layChiTietMach(machId),
    enabled: !!machId,
  });

  // State quản lý Accordion thu gọn / mở rộng các mốc
  const [mocsMoState, setMocsMoState] = useState<Record<number, boolean>>({});
  const mocOffsets = useRef<Record<number, number>>({});

  useEffect(() => {
    if (mach?.mocs && mach.mocs.length > 0) {
      const initial: Record<number, boolean> = {};
      const total = mach.mocs.length;
      mach.mocs.forEach((m) => {
        // Mốc 1 và mốc cuối cùng (mới nhất) luôn mở mặc định
        // Các mốc giữa (1 < seq < total) mặc định thu gọn
        if (m.seq === 1 || m.seq === total) {
          initial[m.seq] = true;
        } else {
          initial[m.seq] = false;
        }
      });
      setMocsMoState(initial);
    }
  }, [mach?.mocs]);

  const coMocThuGon = Boolean(
    mach?.mocs &&
      mach.mocs.length > 2 &&
      mach.mocs.some((m) => m.seq > 1 && m.seq < mach.mocs.length && !mocsMoState[m.seq])
  );

  const handleToggleMoc = (seq: number) => {
    setMocsMoState((prev) => ({
      ...prev,
      [seq]: !prev[seq],
    }));
  };

  const handleToggleAllMocs = () => {
    if (!mach?.mocs) return;
    const nextState: Record<number, boolean> = {};
    const total = mach.mocs.length;
    const openAll = coMocThuGon;
    mach.mocs.forEach((m) => {
      if (m.seq === 1 || m.seq === total) {
        nextState[m.seq] = true;
      } else {
        nextState[m.seq] = openAll;
      }
    });
    setMocsMoState(nextState);
  };

  const handleNhayToiMoc = (seq: number) => {
    if (!mocsMoState[seq]) {
      setMocsMoState((prev) => ({ ...prev, [seq]: true }));
    }
    const y = mocOffsets.current[seq];
    if (typeof y === "number") {
      flatListRef.current?.scrollToOffset({
        offset: Math.max(0, y - 80),
        animated: true,
      });
    }
  };

  // Query trạng thái cá nhân đối với mạch (ví dụ: đã theo dõi chưa)
  const { data: machMe } = useQuery({
    queryKey: ["mach-me", machId],
    queryFn: () => layThongTinMachCuaToi(machId),
    enabled: !!machId && daDangNhap,
  });

  // Query nạp bình luận theo Mốc hoặc toàn bộ Mạch
  const { data: binhLuanData, isLoading: dangTaiBinhLuan } = useQuery({
    queryKey: ["binh-luan", machId, activeMocId],
    queryFn: async () => {
      if (activeMocId !== null) {
        const res = await layBinhLuanMoc(activeMocId);
        return res?.threads || [];
      } else {
        const res = await layBinhLuanMach(machId);
        return res?.threads || [];
      }
    },
    enabled: modalVisible && !!machId,
  });

  const voteMutation = useMutation({
    mutationFn: async ({
      doiTuong,
      targetId,
      huong,
    }: {
      doiTuong: "moc" | "binh_luan";
      targetId: number;
      huong: number;
    }) => {
      return guiVote(doiTuong, targetId, huong);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mach", machId] });
      queryClient.invalidateQueries({ queryKey: ["binh-luan", machId] });
    },
  });

  const followMutation = useMutation({
    mutationFn: async (bat: boolean) => {
      return theoDoiMach(machId, bat);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mach-me", machId] });
    },
  });

  const handleVoteMoc = (mocId: number, huong: number) => {
    voteMutation.mutate({ doiTuong: "moc", targetId: mocId, huong });
  };

  const handleVoteBinhLuan = (blId: number, huong: number) => {
    voteMutation.mutate({ doiTuong: "binh_luan", targetId: blId, huong });
  };

  const handleMoNganKeo = (mocId: number, seq: number) => {
    setActiveMocId(mocId);
    setModalTitle(`Ngăn kéo mốc #${seq}`);
    setModalVisible(true);
  };

  const handleMoBinhLuan = () => {
    setActiveMocId(null);
    setModalTitle(`Bình luận (${mach?.comment_count || 0})`);
    setModalVisible(true);
  };

  const handleToggleTheoDoi = () => {
    if (!daDangNhap) {
      Alert.alert("Yêu cầu đăng nhập", "Bạn cần đăng nhập để theo dõi mạch này.");
      return;
    }
    const dangTheo = machMe?.following ?? false;
    followMutation.mutate(!dangTheo);
  };

  const handleGuiBinhLuan = async (text: string, parentId?: number | null) => {
    let anchorSeq: number | null = null;
    if (activeMocId !== null && mach?.mocs) {
      const moc = mach.mocs.find((m) => m.id === activeMocId);
      if (moc) anchorSeq = moc.seq;
    }

    const res = await vietBinhLuanMoi(machId, text, anchorSeq, parentId);
    if (res) {
      queryClient.invalidateQueries({ queryKey: ["binh-luan", machId, activeMocId] });
      queryClient.invalidateQueries({ queryKey: ["mach", machId] });
    }
  };

  const handleSuaBinhLuan = async (cId: number, noiDungMoi: string) => {
    try {
      const res = await suaBinhLuanHienTai(cId, { body: noiDungMoi });
      if (res) {
        queryClient.invalidateQueries({ queryKey: ["binh-luan", machId, activeMocId] });
        queryClient.invalidateQueries({ queryKey: ["mach", machId] });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chỉnh sửa bình luận thất bại.";
      Alert.alert("Lỗi", msg);
      throw err;
    }
  };

  const handleAnBinhLuan = async (cId: number, an: boolean) => {
    try {
      await anBinhLuanHienTai(cId, an);
      queryClient.invalidateQueries({ queryKey: ["binh-luan", machId, activeMocId] });
      queryClient.invalidateQueries({ queryKey: ["mach", machId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Thao tác ẩn/bỏ ẩn thất bại.";
      Alert.alert("Lỗi", msg);
      throw err;
    }
  };

  const handleXoaBinhLuan = async (cId: number) => {
    try {
      await xoaBinhLuanHienTai(cId);
      queryClient.invalidateQueries({ queryKey: ["binh-luan", machId, activeMocId] });
      queryClient.invalidateQueries({ queryKey: ["mach", machId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Xoá bình luận thất bại.";
      Alert.alert("Lỗi", msg);
      throw err;
    }
  };

  const handleNoiMocSubmit = async () => {
    const text = noiDungMoc.trim();
    if (!text || dangNoiMoc) return;
    setDangNoiMoc(true);
    try {
      const htmlFinal = chuanHoaHtmlKhiLuu(text);
      const res = await noiMocVaoMach(machId, { body: htmlFinal });
      if (res) {
        setNoiDungMoc("");
        setNoiMocVisible(false);
        queryClient.invalidateQueries({ queryKey: ["mach", machId] });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Nối mốc không thành công.";
      Alert.alert("Lỗi", msg);
    } finally {
      setDangNoiMoc(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.statusText}>Đang nạp chi tiết mạch...</Text>
      </View>
    );
  }

  if (!mach) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.statusText}>Không tìm thấy mạch này.</Text>
      </View>
    );
  }

  const tacGia = mach.author?.display_name || mach.author?.username || "Ẩn danh";
  const subName = mach.sub?.ten || mach.sub?.slug || "chung";
  const laChuMach = Boolean(
    daDangNhap &&
    mach.author?.username &&
    nguoiDung?.username === mach.author.username
  );
  const coTheNoiMoc = laChuMach && !mach.locked && !mach.closed_at;
  const dangTheoDoi = machMe?.following ?? false;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={mach.mocs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const total = mach.mocs.length;
          const coTheThuGon = total > 2 && item.seq > 1 && item.seq < total;
          const isExpanded = mocsMoState[item.seq] ?? (item.seq === 1 || item.seq === total);
          return (
            <MocItem
              moc={item}
              thuGon={coTheThuGon && !isExpanded}
              coTheThuGon={coTheThuGon}
              onToggleThuGon={() => handleToggleMoc(item.seq)}
              onLayout={(e) => {
                mocOffsets.current[item.seq] = e.nativeEvent.layout.y;
              }}
              onMoBinhLuan={handleMoNganKeo}
              onVote={handleVoteMoc}
              laStaff={nguoiDung?.la_staff ?? false}
              laChuMach={laChuMach}
              onBaoCao={(mocId, seq) =>
                handleMoBaoCao("moc", mocId, `Mốc #${seq} (${mach.title})`)
              }
              onModAction={(mocId, seq, dangAn) =>
                handleMoModAction("moc", mocId, `Mốc #${seq} (${mach.title})`, undefined, dangAn)
              }
              onXemAnh={(anhUrl) => setAnhPhongsTo(anhUrl)}
              onXemLichSu={handleMoLichSuMoc}
              onSuaMoc={handleMoSuaMoc}
              onXoaMoc={handleXoaMoc}
            />
          );
        }}
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
              refetch();
            }}
            tintColor="#3b82f6"
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBox}>
            {/* Huy hiệu trạng thái + Nút theo dõi */}
            <View style={styles.badgeRow}>
              <TouchableOpacity
                style={styles.subTag}
                activeOpacity={0.7}
                onPress={() => router.push(`/s/${subName}` as any)}
              >
                <Text style={styles.subText}>s/{subName}</Text>
              </TouchableOpacity>
              {mach.locked ? (
                <View style={[styles.statusTag, styles.statusLocked]}>
                  <Lock size={12} color="#f87171" />
                  <Text style={styles.statusLockedText}>Đã khoá</Text>
                </View>
              ) : mach.closed_at ? (
                <View style={[styles.statusTag, styles.statusClosed]}>
                  <CheckCircle2 size={12} color="#fbbf24" />
                  <Text style={styles.statusClosedText}>Đã đóng sổ</Text>
                </View>
              ) : (
                <View style={[styles.statusTag, styles.statusOpen]}>
                  <Text style={styles.statusOpenText}>Đang mở</Text>
                </View>
              )}

              {/* Nút theo dõi mạch */}
              <TouchableOpacity
                style={[
                  styles.followBtn,
                  dangTheoDoi && styles.followBtnActive,
                ]}
                onPress={handleToggleTheoDoi}
              >
                {dangTheoDoi ? (
                  <BookmarkCheck size={14} color="#60a5fa" />
                ) : (
                  <Bookmark size={14} color="#9ca3af" />
                )}
                <Text
                  style={[
                    styles.followBtnText,
                    dangTheoDoi && styles.followBtnTextActive,
                  ]}
                >
                  {dangTheoDoi ? "Đang theo" : "Theo dõi"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tiêu đề mạch */}
            <Text style={styles.title}>{mach.title}</Text>

            {/* Thông tin tác giả */}
            <View style={styles.authorRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => mach.author?.username && router.push(`/u/${mach.author.username}` as any)}
              >
                <Text style={styles.authorText}>Bởi u/{tacGia}</Text>
              </TouchableOpacity>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.entryCountText}>{mach.entry_count} mốc ghi</Text>
            </View>

            {/* Nút xem Bình luận, Nối mốc & Chia sẻ */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.khanDaiBtn} onPress={handleMoBinhLuan}>
                <MessageSquare size={16} color="#ffffff" />
                <Text style={styles.khanDaiBtnText}>
                  Bình luận ({mach.comment_count})
                </Text>
              </TouchableOpacity>

              {coTheNoiMoc ? (
                <TouchableOpacity
                  style={styles.noiMocBtn}
                  onPress={() => setNoiMocVisible(true)}
                >
                  <PlusCircle size={16} color="#ffffff" />
                  <Text style={styles.noiMocBtnText}>Nối mốc</Text>
                </TouchableOpacity>
              ) : null}

              {laChuMach && !mach.locked && !mach.closed_at ? (
                <TouchableOpacity
                  style={styles.dongSoBtn}
                  onPress={() => setDongSoVisible(true)}
                >
                  <CheckCircle2 size={16} color="#fbbf24" />
                  <Text style={styles.dongSoBtnText}>Đóng sổ</Text>
                </TouchableOpacity>
              ) : null}

              {laChuMach && !mach.locked && mach.closed_at ? (
                <TouchableOpacity
                  style={styles.moLaiBtn}
                  onPress={handleMoLaiMach}
                >
                  <RotateCcw size={16} color="#60a5fa" />
                  <Text style={styles.moLaiBtnText}>Mở lại</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                <Share2 size={16} color="#9ca3af" />
                <Text style={styles.shareBtnText}>Chia sẻ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.flagBtn}
                onPress={() => handleMoBaoCao("mach", machId, mach.title)}
              >
                <Flag size={15} color="#9ca3af" />
              </TouchableOpacity>

              {nguoiDung?.la_staff && (
                <TouchableOpacity
                  style={styles.modBtn}
                  onPress={() =>
                    handleMoModAction("mach", machId, mach.title, mach.locked, false)
                  }
                >
                  <ShieldAlert size={15} color="#eab308" />
                  <Text style={styles.modBtnText}>Mod</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Thanh Timeline ngang (Quick Jump Bar) */}
            {mach.mocs && mach.mocs.length > 1 ? (
              <View style={styles.timelineBarWrap}>
                <View style={styles.timelineBarHeader}>
                  <View style={styles.timelineTitleWrap}>
                    <Clock size={13} color="#9ca3af" />
                    <Text style={styles.timelineBarTitle}>
                      Dòng thời gian ({mach.mocs.length} mốc)
                    </Text>
                  </View>
                  {mach.mocs.length > 2 ? (
                    <TouchableOpacity
                      onPress={handleToggleAllMocs}
                      style={styles.toggleAllBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.toggleAllBtnText}>
                        {coMocThuGon ? "Mở tất cả" : "Thu gọn"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.timelineChipsList}
                >
                  {mach.mocs.map((m) => {
                    const isLast = m.seq === mach.mocs.length;
                    const isFirst = m.seq === 1;
                    const d = new Date(m.occurred_at);
                    const ngayThang = `${d.getDate()}/${d.getMonth() + 1}`;
                    const isOpening = mocsMoState[m.seq] ?? (isFirst || isLast);

                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          styles.timelineChip,
                          isOpening && styles.timelineChipActive,
                        ]}
                        onPress={() => handleNhayToiMoc(m.seq)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.timelineChipText,
                            isOpening && styles.timelineChipTextActive,
                          ]}
                        >
                          {isFirst
                            ? "📌 #1 Mở đầu"
                            : isLast
                            ? `🔥 #${m.seq} Mới nhất`
                            : `#${m.seq} · ${ngayThang}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.divider} />
          </View>
        }
        ListFooterComponent={
          <ChanDongSo
            status={mach.status}
            closedAt={mach.closed_at}
            ketQua={mach.ket_qua}
            baiHoc={mach.bai_hoc}
            moLaiDen={mach.mo_lai_den}
            laChuMach={laChuMach}
            onMoLaiMach={handleMoLaiMach}
          />
        }
      />

      {/* Nút cuộn về đầu trang */}
      {hienNutLenDau && (
        <TouchableOpacity
          style={styles.scrollToTopBtn}
          activeOpacity={0.8}
          onPress={() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}
        >
          <ArrowUp size={20} color="#ffffff" />
        </TouchableOpacity>
      )}

      {/* Modal hiển thị bình luận */}
      <BinhLuanModal
        hienThi={modalVisible}
        tieuDe={modalTitle}
        danhSach={(binhLuanData as BinhLuanOut[]) || []}
        dangTai={dangTaiBinhLuan}
        daDangNhap={daDangNhap}
        laStaff={nguoiDung?.la_staff ?? false}
        usernameHienTai={nguoiDung?.username}
        onDong={() => setModalVisible(false)}
        onVote={handleVoteBinhLuan}
        onGuiBinhLuan={handleGuiBinhLuan}
        onSuaBinhLuan={handleSuaBinhLuan}
        onAnBinhLuan={handleAnBinhLuan}
        onXoaBinhLuan={handleXoaBinhLuan}
        onBaoCao={(cId) => handleMoBaoCao("comment", cId, `Bình luận #${cId}`)}
        onModAction={(cId, dangAn) =>
          handleMoModAction("comment", cId, `Bình luận #${cId}`, undefined, dangAn)
        }
      />

      {/* Modal Nối Mốc Mới */}
      <Modal
        visible={noiMocVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setNoiMocVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setNoiMocVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nối mốc sự việc tiếp theo</Text>
              <TouchableOpacity onPress={() => setNoiMocVisible(false)}>
                <X size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 16 }}>
              <SoanThaoHtml
                giaTri={noiDungMoc}
                onChange={setNoiDungMoc}
                placeholder="Nội dung diễn biến mới (hỗ trợ HTML và thanh công cụ)..."
                minHeight={130}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setNoiMocVisible(false)}
              >
                <Text style={styles.modalCancelText}>Huỷ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  (!noiDungMoc.trim() || dangNoiMoc) && styles.btnDisabled,
                ]}
                disabled={!noiDungMoc.trim() || dangNoiMoc}
                onPress={handleNoiMocSubmit}
              >
                {dangNoiMoc ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Thêm mốc</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Báo Cáo Vi Phạm */}
      <BaoCaoModal
        hienThi={baoCaoVisible}
        doiTuong={doiTuongBaoCao}
        onDong={() => setBaoCaoVisible(false)}
      />

      {/* Modal Công Cụ Mod */}
      <ModActionModal
        hienThi={modModalVisible}
        doiTuong={doiTuongMod}
        onDong={() => setModModalVisible(false)}
        onThanhCong={() => {
          queryClient.invalidateQueries({ queryKey: ["mach", machId] });
          queryClient.invalidateQueries({ queryKey: ["binh-luan", machId] });
        }}
      />

      {/* Modal Đóng Sổ Mạch */}
      <DongSoModal
        hienThi={dongSoVisible}
        tieuDeMach={mach.title}
        dangXuLy={dangDongSo}
        onDong={() => setDongSoVisible(false)}
        onXacNhan={handleXacNhanDongSo}
      />

      {/* Modal Xem Ảnh Toàn Màn Hình */}
      <LightboxModal
        anhUrl={anhPhongsTo}
        onDong={() => setAnhPhongsTo(null)}
      />

      {/* Modal Lịch Sử Sửa Đổi Mốc */}
      <LichSuMocModal
        hienThi={lichSuMocVisible}
        mocId={lichSuMocId}
        seq={lichSuMocSeq}
        onDong={() => setLichSuMocVisible(false)}
      />

      {/* Modal Chỉnh Sửa Mốc */}
      <SuaMocModal
        hienThi={suaMocVisible}
        moc={mocDangSua}
        dangXuLy={dangSuaMoc}
        onDong={() => {
          setSuaMocVisible(false);
          setMocDangSua(null);
        }}
        onLuu={handleLuuSuaMoc}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  listContent: {
    padding: 14,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#121212",
    padding: 20,
  },
  statusText: {
    color: "#71717a",
    marginTop: 10,
    fontSize: 14,
  },
  headerBox: {
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  subTag: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  subText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
  },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  statusOpen: {
    backgroundColor: "#064e3b",
  },
  statusOpenText: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "700",
  },
  statusClosed: {
    backgroundColor: "#451a03",
  },
  statusClosedText: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "700",
  },
  statusLocked: {
    backgroundColor: "#450a0a",
  },
  statusLockedText: {
    color: "#f87171",
    fontSize: 11,
    fontWeight: "700",
  },
  title: {
    color: "#f4f4f5",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    marginBottom: 8,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  authorText: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "500",
  },
  metaDot: {
    color: "#52525b",
    marginHorizontal: 8,
  },
  entryCountText: {
    color: "#3b82f6",
    fontSize: 13,
    fontWeight: "600",
  },
  khanDaiBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  khanDaiBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  noiMocBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16a34a",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  noiMocBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27272a",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  shareBtnText: {
    color: "#d4d4d8",
    fontSize: 14,
    fontWeight: "600",
  },
  flagBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  modBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2c2817",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: "#eab308",
  },
  modBtnText: {
    color: "#facc15",
    fontSize: 13,
    fontWeight: "700",
  },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#27272a",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
    marginLeft: "auto",
  },
  followBtnActive: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  followBtnText: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "600",
  },
  followBtnTextActive: {
    color: "#60a5fa",
  },
  divider: {
    height: 1,
    backgroundColor: "#27272a",
    marginBottom: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    padding: 16,
  },
  modalBox: {
    backgroundColor: "#18181b",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: {
    color: "#f4f4f5",
    fontSize: 17,
    fontWeight: "700",
  },
  modalInput: {
    backgroundColor: "#27272a",
    borderRadius: 10,
    padding: 12,
    color: "#f4f4f5",
    fontSize: 14,
    textAlignVertical: "top",
    minHeight: 120,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    color: "#a1a1aa",
    fontSize: 14,
    fontWeight: "600",
  },
  modalSubmitBtn: {
    backgroundColor: "#16a34a",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  modalSubmitText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
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
  dongSoBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#78350f",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  dongSoBtnText: {
    color: "#fef3c7",
    fontSize: 13,
    fontWeight: "600",
  },
  moLaiBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e3a8a",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  moLaiBtnText: {
    color: "#dbeafe",
    fontSize: 13,
    fontWeight: "600",
  },
  timelineBarWrap: {
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: "#1c1c20",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  timelineBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  timelineTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timelineBarTitle: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  toggleAllBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  toggleAllBtnText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
  },
  timelineChipsList: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2,
  },
  timelineChip: {
    backgroundColor: "#27272a",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  timelineChipActive: {
    backgroundColor: "#1e3a8a",
    borderColor: "#3b82f6",
  },
  timelineChipText: {
    color: "#d4d4d8",
    fontSize: 12,
    fontWeight: "500",
  },
  timelineChipTextActive: {
    color: "#93c5fd",
    fontWeight: "700",
  },
});
