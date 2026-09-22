import { formatKRW, formatTime, getCategoryByName } from "@/constants/mockData";
import {
  ExpenditureListItem,
  getMonthlyExpenditures,
} from "@/services/api/expenditureApi";
import { TopStore } from "@/scripts/useMapData";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  store: TopStore | null;
  year: number;
  month: number;
  onClose: () => void;
};

export default function StoreSheet({ store, year, month, onClose }: Props) {
  const [items, setItems] = useState<ExpenditureListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;

    let alive = true;
    setLoading(true);
    setError(null);
    setItems([]);

    getMonthlyExpenditures(year, month)
      .then((res) => {
        if (!alive) return;
        const all = res.dailyExpenditures.flatMap((d) => d.list);
        setItems(all.filter((e) => e.storeName === store.store));
      })
      .catch((e) => {
        if (alive) setError((e as Error)?.message ?? "불러오지 못했어요");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [store, year, month]);

  const openDetail = (id: number) => {
    onClose();
    router.push({
      pathname: "/expenditure/[id]",
      params: { id: String(id) },
    });
  };

  return (
    <Modal
      visible={store !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {store?.store}
              </Text>
              <Text style={styles.subtitle}>
                {year}년 {month}월 · {store?.count}회
              </Text>
            </View>
            <Text style={styles.total}>{formatKRW(store?.total ?? 0)}</Text>
          </View>

          {loading && (
            <View style={styles.centerBox}>
              <ActivityIndicator color="#3B82F6" />
            </View>
          )}

          {!loading && error && (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>{error}</Text>
            </View>
          )}

          {!loading && !error && items.length === 0 && (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>내역을 찾지 못했어요</Text>
            </View>
          )}

          <ScrollView
            style={styles.list}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          >
            {items.map((item) => {
              const cat = getCategoryByName(item.categoryName);
              return (
                <Pressable
                  key={item.expenditureId}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { opacity: 0.6 },
                  ]}
                  onPress={() => openDetail(item.expenditureId)}
                >
                  <View style={[styles.catDot, { backgroundColor: cat.color }]}>
                    <Ionicons name={cat.icon} size={13} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowDate}>
                      {Number(item.expenditureDate.slice(5, 7))}월{" "}
                      {Number(item.expenditureDate.slice(8, 10))}일{" "}
                      {formatTime(item.expenditureDate)}
                    </Text>
                    {!!item.memo && (
                      <Text style={styles.rowMemo} numberOfLines={1}>
                        {item.memo}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.rowAmount}>
                    {formatKRW(item.amount)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: "72%",
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    marginBottom: 20,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  title: { fontSize: 17, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  total: { fontSize: 16, fontWeight: "800", color: "#111827" },
  list: { marginTop: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
  },
  catDot: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rowDate: { color: "#111827", fontSize: 13, fontWeight: "600" },
  rowMemo: { color: "#6B7280", fontSize: 11, marginTop: 2 },
  rowAmount: { color: "#111827", fontSize: 14, fontWeight: "800" },
  centerBox: { alignItems: "center", paddingVertical: 32 },
  emptyText: { color: "#9CA3AF", fontSize: 13 },
});
