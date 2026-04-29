import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { RideRecord, RideStatus, fetchRideHistory } from "@/services/rideApi";

const INK = "#0A0A0A";
const PAPER = "#FFFFFF";
const SURFACE = "#F2F2F2";
const RULE = "#D6D6D6";
const MUTED = "#888888";
const ACCENT = "#00C853";
const WARNING = "#F59E0B";
const DANGER = "#DC2626";

const STATUS_LABELS: Record<RideStatus, string> = {
  bidding: "Bidding",
  searching: "Searching",
  accepted: "Accepted",
  arriving: "Arriving",
  on_trip: "On trip",
  completed: "Completed",
};

const STATUS_COLORS: Record<RideStatus, string> = {
  bidding: ACCENT,
  searching: WARNING,
  accepted: INK,
  arriving: WARNING,
  on_trip: ACCENT,
  completed: ACCENT,
};

export default function RideHistoryPage() {
  const { userId, name } = useLocalSearchParams<{
    userId?: string;
    name?: string;
  }>();

  const passengerId = typeof userId === "string" ? userId : "";
  const [history, setHistory] = useState<RideRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const totalSpent = useMemo(
    () =>
      history
        .filter((ride) => ride.status === "completed")
        .reduce((sum, ride) => sum + ride.estimatedFare, 0),
    [history],
  );

  const loadHistory = useCallback(
    async (isRefresh = false) => {
      if (!passengerId) {
        setError("Missing passenger id.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError("");
        const rides = await fetchRideHistory(passengerId);
        setHistory(rides);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [passengerId],
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const goBackToDashboard = () => {
    router.replace({
      pathname: "/(passenger)/dashboard",
      params: { userId: passengerId, name },
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={goBackToDashboard}>
            <Text style={styles.backBtn}>Back</Text>
          </Pressable>
          <Pressable onPress={() => loadHistory(true)} disabled={refreshing}>
            <Text style={styles.refreshBtn}>
              {refreshing ? "Refreshing" : "Refresh"}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Ride History</Text>
        <Text style={styles.subtitle}>Your recent trips and active rides</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryTag}>TRIPS</Text>
          <Text style={styles.summaryValue}>{history.length}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCell}>
          <Text style={styles.summaryTag}>SPENT</Text>
          <Text style={styles.summaryValue}>₹{totalSpent}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHistory(true)}
            tintColor={INK}
          />
        }
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={INK} />
            <Text style={styles.stateText}>Loading rides</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorTitle}>Could not load rides</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => loadHistory()}>
              <Text style={styles.retryText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyTitle}>No rides yet</Text>
            <Text style={styles.stateText}>
              Book your first trip and it will appear here.
            </Text>
            <Pressable style={styles.retryBtn} onPress={goBackToDashboard}>
              <Text style={styles.retryText}>BOOK A RIDE</Text>
            </Pressable>
          </View>
        ) : (
          history.map((ride) => <RideCard key={ride._id} ride={ride} />)
        )}
      </ScrollView>
    </View>
  );
}

function RideCard({ ride }: { ride: RideRecord }) {
  const statusColor = STATUS_COLORS[ride.status] ?? MUTED;
  const statusLabel = STATUS_LABELS[ride.status] ?? ride.status;
  const dateLabel = new Date(ride.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeLabel = new Date(ride.createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{dateLabel}</Text>
          <Text style={styles.cardSub}>{timeLabel}</Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusLabel.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.routeBlock}>
        <View style={styles.routeRow}>
          <View style={styles.pickupDot} />
          <Text style={styles.routeText} numberOfLines={2}>
            {ride.pickup}
          </Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routeRow}>
          <View style={styles.dropDot} />
          <Text style={styles.routeText} numberOfLines={2}>
            {ride.drop}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.footerTag}>FARE</Text>
          <Text style={styles.fareText}>₹{ride.estimatedFare}</Text>
        </View>
        <View style={styles.paymentPill}>
          <Text style={styles.paymentText}>{ride.paymentMethod}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: INK },
  header: { paddingHorizontal: 22, paddingTop: 52, paddingBottom: 22 },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  backBtn: { color: ACCENT, fontSize: 13, fontWeight: "800" },
  refreshBtn: { color: PAPER, fontSize: 13, fontWeight: "700" },
  title: {
    color: PAPER,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 40,
  },
  subtitle: { color: MUTED, marginTop: 6, fontSize: 13 },
  summaryRow: {
    flexDirection: "row",
    backgroundColor: PAPER,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  summaryCell: { flex: 1, paddingVertical: 16, paddingHorizontal: 22 },
  summaryDivider: { width: 1, backgroundColor: RULE, marginVertical: 12 },
  summaryTag: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  summaryValue: {
    color: INK,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 2,
  },
  sheet: { flex: 1, backgroundColor: PAPER },
  sheetContent: { padding: 18, paddingBottom: 34 },
  centerState: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  stateText: {
    color: MUTED,
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 19,
  },
  emptyTitle: { color: INK, fontSize: 22, fontWeight: "900" },
  errorTitle: { color: DANGER, fontSize: 18, fontWeight: "900" },
  errorText: {
    color: MUTED,
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 19,
  },
  retryBtn: {
    backgroundColor: INK,
    paddingVertical: 13,
    paddingHorizontal: 18,
    marginTop: 18,
  },
  retryText: {
    color: PAPER,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  card: {
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: PAPER,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitle: { color: INK, fontSize: 16, fontWeight: "900" },
  cardSub: { color: MUTED, fontSize: 12, marginTop: 2 },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  routeBlock: {
    backgroundColor: SURFACE,
    padding: 14,
    marginTop: 14,
  },
  routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  pickupDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: ACCENT,
    marginTop: 5,
  },
  dropDot: {
    width: 9,
    height: 9,
    backgroundColor: INK,
    marginTop: 5,
  },
  routeLine: {
    width: 1,
    height: 18,
    backgroundColor: RULE,
    marginLeft: 4,
    marginVertical: 4,
  },
  routeText: { flex: 1, color: INK, fontSize: 13, fontWeight: "700" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  footerTag: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  fareText: { color: INK, fontSize: 22, fontWeight: "900", marginTop: 2 },
  paymentPill: {
    backgroundColor: SURFACE,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  paymentText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
