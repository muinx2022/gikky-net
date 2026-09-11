import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Search as SearchIcon, X } from "lucide-react-native";
import { timKiem } from "@gikky/api-client";
import type { KetQuaTronOut } from "@gikky/api-client";

import { MachCard } from "../../components/MachCard";
import { layDanhSachSub } from "../../lib/api";
import { API_BASE_URL } from "../../lib/config";

export default function SearchScreen() {
  const router = useRouter();
  const [tuKhoa, setTuKhoa] = useState("");
  const [dangTim, setDangTim] = useState(false);
  const [ketQua, setKetQua] = useState<KetQuaTronOut[]>([]);
  const [daTim, setDaTim] = useState(false);
  const [hienNutLenDau, setHienNutLenDau] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Danh sách Subs để gợi ý nhanh
  const { data: allSubs = [] } = useQuery({
    queryKey: ["subs"],
    queryFn: layDanhSachSub,
  });

  const matchingSubs =
    tuKhoa.trim().length >= 1
      ? allSubs.filter(
          (s) =>
            s.slug.toLowerCase().includes(tuKhoa.toLowerCase().trim()) ||
            s.ten.toLowerCase().includes(tuKhoa.toLowerCase().trim())
        )
      : [];

  const thucHienTimKiem = async () => {
    if (!tuKhoa.trim()) return;
    setDangTim(true);
    setDaTim(true);
    try {
      const res = await timKiem({
        baseUrl: API_BASE_URL,
        query: {
          q: tuKhoa.trim(),
          limit: 20,
        },
      });
      setKetQua(res.data?.items || []);
    } catch {
      setKetQua([]);
    } finally {
      setDangTim(false);
    }
  };

  const xoaTuKhoa = () => {
    setTuKhoa("");
    setKetQua([]);
    setDaTim(false);
  };

  return (
    <View style={styles.container}>
      {/* Khung tìm kiếm */}
      <View style={styles.searchBar}>
        <SearchIcon size={18} color="#71717a" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Tìm mạch, mã cổ phiếu, từ khoá..."
          placeholderTextColor="#71717a"
          value={tuKhoa}
          onChangeText={setTuKhoa}
          onSubmitEditing={thucHienTimKiem}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {tuKhoa ? (
          <TouchableOpacity onPress={xoaTuKhoa} style={styles.clearBtn}>
            <X size={16} color="#a1a1aa" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Gợi ý chuyên mục khớp từ khoá */}
      {matchingSubs.length > 0 && (
        <View style={styles.subMatchRow}>
          <Text style={styles.subMatchLabel}>Chuyên mục:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subMatchScroll}
          >
            {matchingSubs.map((s) => (
              <TouchableOpacity
                key={s.slug}
                style={styles.subChip}
                onPress={() => router.push(`/s/${s.slug}` as any)}
              >
                <Text style={styles.subChipText}>s/{s.slug}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Kết quả tìm kiếm */}
      {dangTim ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.statusText}>Đang tìm kiếm...</Text>
        </View>
      ) : daTim && ketQua.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.statusText}>Không tìm thấy kết quả nào phù hợp.</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={ketQua}
          keyExtractor={(item, index) => `${item.loai}-${item.mach?.id || index}`}
          renderItem={({ item }) =>
            item.mach ? <MachCard mach={item.mach} /> : null
          }
          contentContainerStyle={styles.listContent}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            setHienNutLenDau(y > 350);
          }}
          scrollEventThrottle={32}
        />
      )}

      {/* Nút mũi tên lên đầu trang */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    margin: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#2d2d2d",
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 44,
    color: "#f3f4f6",
    fontSize: 14,
  },
  clearBtn: {
    padding: 6,
  },
  subMatchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  subMatchLabel: {
    color: "#71717a",
    fontSize: 12,
    fontWeight: "600",
    marginRight: 8,
  },
  subMatchScroll: {
    gap: 6,
  },
  subChip: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
  },
  subChipText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  statusText: {
    color: "#71717a",
    fontSize: 14,
    marginTop: 10,
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
