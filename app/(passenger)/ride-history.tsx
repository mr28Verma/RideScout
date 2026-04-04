import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { RideRecord, fetchRideHistory } from "@/services/rideApi";

const BG = "#0D0D0D";
const WHITE = "#FFFFFF";
const TEXT_MUTE = "#6B7280";
const BORDER = "#E5E7EB";

export default function RideHistoryPage() {
  const { userId, name } = useLocalSearchParams<{
    userId?: string;
    name?: string;
  }>();
  const [history, setHistory] = useState<RideRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      if (!userId || typeof userId !== "string") {
        setError("Missing passenger id.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const rides = await fetchRideHistory(userId);
        setHistory(rides);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [userId]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Ride history</Text>
        <Text style={styles.subtitle}>All your completed and active rides</Text>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
      >
        {loading ? (
          <ActivityIndicator color="#111" />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : history.length === 0 ? (
          <Text style={styles.empty}>No rides yet.</Text>
        ) : (
          history.map((ride) => (
            <View key={ride._id} style={styles.card}>
              <Text style={styles.route}>
                {ride.pickup} → {ride.drop}
              </Text>
              <Text style={styles.meta}>
                ₹{ride.estimatedFare} • {ride.status.replace("_", " ")}
              </Text>
              <Text style={styles.meta}>
                {new Date(ride.createdAt).toLocaleString()}
              </Text>
            </View>
          ))
        )}

        <Text
          style={styles.back}
          onPress={() =>
            router.replace({
              pathname: "/(passenger)/dashboard",
              params: { userId, name },
            })
          }
        >
          Back to dashboard
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 22, paddingTop: 54, paddingBottom: 18 },
  title: { color: WHITE, fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#D1D5DB", marginTop: 6, fontSize: 12 },
  sheet: {
    flex: 1,
    backgroundColor: WHITE,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  sheetContent: { padding: 18, paddingBottom: 30 },
  card: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  route: { fontSize: 15, fontWeight: "700", color: "#111" },
  meta: { marginTop: 4, fontSize: 12, color: TEXT_MUTE },
  empty: { color: TEXT_MUTE, fontSize: 13 },
  error: { color: "#DC2626", fontSize: 13 },
  back: {
    textAlign: "center",
    color: TEXT_MUTE,
    marginTop: 14,
    fontWeight: "600",
  },
});
