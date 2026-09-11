import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  X,
  ArrowBigUp,
  ArrowBigDown,
  Flag,
  Send,
  ShieldAlert,
  CornerDownRight,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react-native";
import type { BinhLuanOut } from "@gikky/api-client";
import { ThanHtml } from "./ThanHtml";

interface Props {
  hienThi: boolean;
  tieuDe: string;
  danhSach: BinhLuanOut[];
  dangTai: boolean;
  daDangNhap?: boolean;
  laStaff?: boolean;
  usernameHienTai?: string | null;
  onDong: () => void;
  onVote?: (binhLuanId: number, huong: number) => void;
  onGuiBinhLuan?: (noiDung: string, parentId?: number | null) => Promise<boolean | void>;
  onSuaBinhLuan?: (binhLuanId: number, noiDungMoi: string) => Promise<boolean | void>;
  onAnBinhLuan?: (binhLuanId: number, an: boolean) => Promise<boolean | void>;
  onXoaBinhLuan?: (binhLuanId: number) => Promise<boolean | void>;
  onBaoCao?: (binhLuanId: number) => void;
  onModAction?: (binhLuanId: number, dangAn: boolean) => void;
}

/** Làm phẳng cây phân cấp bình luận DFS để render theo thứ tự thảo luận kèm thụt lề */
function phangHoaBinhLuan(threads: BinhLuanOut[]): BinhLuanOut[] {
  const result: BinhLuanOut[] = [];
  function duyet(node: BinhLuanOut) {
    result.push(node);
    if (node.replies && node.replies.length > 0) {
      for (const con of node.replies) {
        duyet(con);
      }
    }
  }
  for (const t of threads) {
    duyet(t);
  }
  return result;
}

export function BinhLuanModal({
  hienThi,
  tieuDe,
  danhSach,
  dangTai,
  daDangNhap = false,
  laStaff = false,
  usernameHienTai,
  onDong,
  onVote,
  onGuiBinhLuan,
  onSuaBinhLuan,
  onAnBinhLuan,
  onXoaBinhLuan,
  onBaoCao,
  onModAction,
}: Props) {
  const [noiDung, setNoiDung] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [dangTraLoi, setDangTraLoi] = useState<{ id: number; tacGia: string } | null>(null);

  // State cho việc sửa bình luận
  const [dangSua, setDangSua] = useState<{ id: number; body: string } | null>(null);
  const [dangLuuSua, setDangLuuSua] = useState(false);

  const danhSachPhang = useMemo(() => phangHoaBinhLuan(danhSach), [danhSach]);

  const handleGui = async () => {
    const text = noiDung.trim();
    if (!text || dangGui || !onGuiBinhLuan) return;
    setDangGui(true);
    try {
      await onGuiBinhLuan(text, dangTraLoi?.id || null);
      setNoiDung("");
      setDangTraLoi(null);
    } finally {
      setDangGui(false);
    }
  };

  const handleXacNhanAn = (binhLuanId: number, an: boolean) => {
    if (!onAnBinhLuan) return;
    if (!an) {
      // Bỏ ẩn
      onAnBinhLuan(binhLuanId, false);
      return;
    }
    Alert.alert(
      "Ẩn bình luận",
      "Bạn có chắc chắn muốn ẩn bình luận này không?",
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Ẩn bình luận",
          style: "destructive",
          onPress: () => onAnBinhLuan(binhLuanId, true),
        },
      ]
    );
  };

  const handleXacNhanXoa = (binhLuanId: number) => {
    if (!onXoaBinhLuan) return;
    Alert.alert(
      "Xoá bình luận",
      "Bình luận này sẽ bị xoá vĩnh viễn (chỉ dành cho Quản trị viên).",
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Xoá vĩnh viễn",
          style: "destructive",
          onPress: () => onXoaBinhLuan(binhLuanId),
        },
      ]
    );
  };

  const handleLuuSuaSubmit = async () => {
    if (!dangSua || !onSuaBinhLuan) return;
    const text = dangSua.body.trim();
    if (!text) {
      Alert.alert("Lỗi", "Nội dung bình luận không được để trống.");
      return;
    }
    setDangLuuSua(true);
    try {
      await onSuaBinhLuan(dangSua.id, text);
      setDangSua(null);
    } catch {
      // lỗi đã được alert ở caller
    } finally {
      setDangLuuSua(false);
    }
  };

  const renderItem = ({ item }: { item: BinhLuanOut }) => {
    const tacGia = item.author?.display_name || item.author?.username || "Ẩn danh";
    const thoiGian = new Date(item.created_at).toLocaleDateString("vi-VN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const laCuaToi = Boolean(usernameHienTai && item.author?.username === usernameHienTai);
    const thutLe = Math.min(Math.max(0, (item.depth || 1) - 1) * 14, 56);
    const laBiaMoXoa = item.trang_thai === "da_xoa";
    const laBiaMoAn = item.trang_thai === "da_an";

    // Cửa sổ tự sửa: chỉ khi còn hạn hoặc là staff
    const conHanSua = Boolean(
      item.sua_duoc_den && new Date(item.sua_duoc_den).getTime() > Date.now()
    );
    const suaDuoc = !laBiaMoXoa && (laStaff || (laCuaToi && conHanSua));

    // Luật ẩn Hướng 2: Tác giả chỉ được ẩn khi CHƯA có ai phản hồi; staff được ẩn bất cứ lúc nào
    const coReply = Boolean(item.replies && item.replies.length > 0);
    const choPhepAn = laStaff || (laCuaToi && !coReply);

    // Chỉ Admin/Staff mới được xoá
    const choPhepXoa = laStaff;

    return (
      <View
        style={[
          styles.commentItem,
          { marginLeft: thutLe },
          item.depth > 1 && styles.commentItemNested,
        ]}
      >
        {/* Header bình luận */}
        <View style={styles.commentHeader}>
          <Text style={styles.authorText}>
            {laBiaMoXoa ? "[Đã xoá]" : `u/${tacGia}`}
          </Text>
          {item.la_chu_mach && !laBiaMoXoa ? (
            <View style={styles.opBadge}>
              <Text style={styles.opText}>Chủ mạch</Text>
            </View>
          ) : null}
          {laBiaMoAn ? (
            <View style={styles.hiddenBadge}>
              <Text style={styles.hiddenText}>Đã ẩn</Text>
            </View>
          ) : null}
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.timeText}>{thoiGian}</Text>
        </View>

        {/* Thân bình luận */}
        {laBiaMoXoa ? (
          <Text style={styles.tombstoneText}>[Bình luận đã xoá]</Text>
        ) : laBiaMoAn && !laCuaToi && !laStaff ? (
          <Text style={styles.tombstoneText}>[Bình luận đã bị ẩn]</Text>
        ) : (
          <ThanHtml body={item.body || "(Không có nội dung)"} style={styles.commentBody} />
        )}

        {/* Footer & Actions */}
        {!laBiaMoXoa && (
          <View style={styles.commentFooter}>
            {/* Vote */}
            <View style={styles.voteRow}>
              <TouchableOpacity style={styles.voteBtn} onPress={() => onVote?.(item.id, 1)}>
                <ArrowBigUp size={16} color="#9ca3af" />
              </TouchableOpacity>
              <Text style={styles.voteScore}>{item.score}</Text>
              <TouchableOpacity style={styles.voteBtn} onPress={() => onVote?.(item.id, -1)}>
                <ArrowBigDown size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Các hành động */}
            <View style={styles.commentActions}>
              {/* Trả lời */}
              {daDangNhap && !laBiaMoAn && onGuiBinhLuan && (
                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => setDangTraLoi({ id: item.id, tacGia })}
                >
                  <CornerDownRight size={12} color="#9ca3af" />
                  <Text style={styles.actionPillText}>Trả lời</Text>
                </TouchableOpacity>
              )}

              {/* Sửa (chỉ khi trong hạn hoặc staff) */}
              {suaDuoc && onSuaBinhLuan && (
                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => setDangSua({ id: item.id, body: item.body || "" })}
                >
                  <Pencil size={12} color="#60a5fa" />
                  <Text style={[styles.actionPillText, { color: "#60a5fa" }]}>Sửa</Text>
                </TouchableOpacity>
              )}

              {/* Ẩn / Bỏ ẩn (Hướng 2: chỉ khi chưa có reply hoặc staff) */}
              {choPhepAn && onAnBinhLuan && (
                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => handleXacNhanAn(item.id, !laBiaMoAn)}
                >
                  {laBiaMoAn ? (
                    <>
                      <Eye size={12} color="#a3e635" />
                      <Text style={[styles.actionPillText, { color: "#a3e635" }]}>Hiện</Text>
                    </>
                  ) : (
                    <>
                      <EyeOff size={12} color="#fbbf24" />
                      <Text style={[styles.actionPillText, { color: "#fbbf24" }]}>Ẩn</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Xoá (Chỉ dành cho Admin/Staff) */}
              {choPhepXoa && onXoaBinhLuan && (
                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => handleXacNhanXoa(item.id)}
                >
                  <Trash2 size={12} color="#f87171" />
                  <Text style={[styles.actionPillText, { color: "#f87171" }]}>Xoá</Text>
                </TouchableOpacity>
              )}

              {/* Báo cáo (Chỉ dành cho người khác) */}
              {!laCuaToi && !laBiaMoAn && onBaoCao && (
                <TouchableOpacity
                  style={styles.commentActionBtn}
                  onPress={() => onBaoCao(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Flag size={12} color="#71717a" />
                </TouchableOpacity>
              )}

              {/* Mod Action */}
              {laStaff && onModAction && (
                <TouchableOpacity
                  style={styles.commentModBtn}
                  onPress={() => onModAction(item.id, item.trang_thai === "da_an")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <ShieldAlert size={13} color="#eab308" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <Modal visible={hienThi} animationType="slide" transparent onRequestClose={onDong}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableWithoutFeedback onPress={onDong}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.sheetContainer}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{tieuDe}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onDong}>
                <X size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Danh sách bình luận */}
            {dangTai ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Đang nạp bình luận...</Text>
              </View>
            ) : danhSachPhang.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Chưa có bình luận nào. Hãy là người đầu tiên!</Text>
              </View>
            ) : (
              <FlatList
                data={danhSachPhang}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
              />
            )}

            {/* Khung gửi bình luận */}
            {daDangNhap ? (
              <View style={styles.inputArea}>
                {/* Banner đang trả lời */}
                {dangTraLoi && (
                  <View style={styles.replyBanner}>
                    <Text style={styles.replyBannerText}>
                      Đang trả lời <Text style={styles.replyHighlight}>@{dangTraLoi.tacGia}</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.replyCancelBtn}
                      onPress={() => setDangTraLoi(null)}
                    >
                      <X size={14} color="#a1a1aa" />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.inputBar}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={
                      dangTraLoi
                        ? `Trả lời @${dangTraLoi.tacGia}...`
                        : "Viết bình luận..."
                    }
                    placeholderTextColor="#71717a"
                    value={noiDung}
                    onChangeText={setNoiDung}
                    multiline
                    maxLength={2000}
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendBtn,
                      (!noiDung.trim() || dangGui) && styles.sendBtnDisabled,
                    ]}
                    disabled={!noiDung.trim() || dangGui}
                    onPress={handleGui}
                  >
                    {dangGui ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Send size={18} color="#ffffff" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.loginPrompt}>
                <Text style={styles.loginPromptText}>Đăng nhập tài khoản để viết bình luận</Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal sửa bình luận */}
      <Modal
        visible={dangSua !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setDangSua(null)}
      >
        <KeyboardAvoidingView
          style={styles.editOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.editBox}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Chỉnh sửa bình luận</Text>
              <TouchableOpacity onPress={() => setDangSua(null)}>
                <X size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.editInput}
              value={dangSua?.body || ""}
              onChangeText={(val) =>
                setDangSua((prev) => (prev ? { ...prev, body: val } : null))
              }
              multiline
              autoFocus
              maxLength={2000}
              placeholder="Nhập nội dung bình luận..."
              placeholderTextColor="#71717a"
            />

            <View style={styles.editFooter}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => setDangSua(null)}
                disabled={dangLuuSua}
              >
                <Text style={styles.editCancelText}>Huỷ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editSaveBtn,
                  (!dangSua?.body?.trim() || dangLuuSua) && styles.editSaveBtnDisabled,
                ]}
                onPress={handleLuuSuaSubmit}
                disabled={!dangSua?.body?.trim() || dangLuuSua}
              >
                {dangLuuSua ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.editSaveText}>Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#18181b",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    minHeight: 350,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  title: {
    color: "#f4f4f5",
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    padding: 16,
  },
  commentItem: {
    backgroundColor: "#27272a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  commentItemNested: {
    borderLeftWidth: 2,
    borderLeftColor: "#3f3f46",
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
  },
  authorText: {
    color: "#e4e4e7",
    fontSize: 13,
    fontWeight: "600",
  },
  opBadge: {
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  opText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  hiddenBadge: {
    backgroundColor: "#854d0e",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  hiddenText: {
    color: "#fef08a",
    fontSize: 10,
    fontWeight: "700",
  },
  metaDot: {
    color: "#71717a",
    marginHorizontal: 6,
  },
  timeText: {
    color: "#a1a1aa",
    fontSize: 11,
  },
  commentBody: {
    color: "#f4f4f5",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  tombstoneText: {
    color: "#71717a",
    fontSize: 13,
    fontStyle: "italic",
    marginVertical: 4,
  },
  commentFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    flexWrap: "wrap",
    gap: 8,
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  actionPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  actionPillText: {
    color: "#d4d4d8",
    fontSize: 11,
    fontWeight: "500",
  },
  commentActionBtn: {
    padding: 5,
    borderRadius: 4,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  commentModBtn: {
    padding: 5,
    borderRadius: 4,
    backgroundColor: "#2c2817",
    borderWidth: 1,
    borderColor: "#eab308",
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
    color: "#d4d4d8",
    fontSize: 12,
    fontWeight: "600",
    minWidth: 16,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: {
    color: "#a1a1aa",
    marginTop: 10,
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    color: "#71717a",
    fontSize: 14,
  },
  inputArea: {
    borderTopWidth: 1,
    borderTopColor: "#27272a",
    backgroundColor: "#18181b",
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#27272a",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#3f3f46",
  },
  replyBannerText: {
    color: "#a1a1aa",
    fontSize: 12,
  },
  replyHighlight: {
    color: "#60a5fa",
    fontWeight: "600",
  },
  replyCancelBtn: {
    padding: 2,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#27272a",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: "#f4f4f5",
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: "#2563eb",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#3f3f46",
    opacity: 0.5,
  },
  loginPrompt: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "#27272a",
    backgroundColor: "#18181b",
  },
  loginPromptText: {
    color: "#71717a",
    fontSize: 13,
  },
  // Style modal sửa bình luận
  editOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  editBox: {
    backgroundColor: "#18181b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    width: "100%",
    maxWidth: 480,
    padding: 16,
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  editTitle: {
    color: "#f4f4f5",
    fontSize: 16,
    fontWeight: "700",
  },
  editInput: {
    backgroundColor: "#27272a",
    borderRadius: 8,
    padding: 12,
    color: "#f4f4f5",
    fontSize: 14,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  editFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  editCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#27272a",
  },
  editCancelText: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "600",
  },
  editSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#2563eb",
  },
  editSaveBtnDisabled: {
    opacity: 0.5,
  },
  editSaveText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
});
