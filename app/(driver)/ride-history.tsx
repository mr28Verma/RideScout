import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { DriverRideRecord, getDriverRideHistory } from "@/services/driverApi";

const BLACK = "#0D0D0D";
const WHITE = "#FFFFFF";
const TEXT_DARK = "#111111";
const TEXT_MUTE = "#6B7280";
const BORDER = "#E5E7EB";
const GREEN = "#10B981";

export default function DriverRideHistory() {
  const { driverId, name: nameParam } = useLocalSearchParams<{
    driverId?: string;
    name?: string;
  }>();

  const driveId = typeof driverId === "string" ? driverId : "";
  const firstName =
    typeof nameParam === "string" && nameParam.trim().length > 0
      ? nameParam.split(" ")[0]
      : "Scout";

  const [rides, setRides] = useState<DriverRideRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const data = await getDriverRideHistory(driveId);
        setRides(data);
      } catch {
        Alert.alert("Error", "Failed to load ride history");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [driveId]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.hero}>
        <Text style={styles.heroSmall}>Ride History</Text>
        <Text style={styles.heroName}>Hey, {firstName}</Text>
        <Text style={styles.heroMeta}>{rides.length} rides completed</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BLACK} />
        </View>
      ) : rides.length === 0 ? (
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
        >
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No rides yet</Text>
            <Text style={styles.emptyMeta}>
              Get online to start accepting rides
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
        >
          {rides.map((ride) => (
            <View key={ride.rideId} style={styles.rideCard}>
              <View style={styles.cardHeader}>
                <View style={styles.passengerInfo}>
                  <Text style={styles.passengerName}>{ride.passengerName}</Text>
                  <Text style={styles.ratingText}>
                    ★ {ride.passengerRating}
                  </Text>
                </View>
                <View style={styles.fareContainer}>
                  <Text style={styles.fareText}>₹ {ride.fare}</Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      ride.status === "completed" && styles.completedBadge,
                    ]}
                  >
                    {ride.status}
                  </Text>
                </View>
              </View>

              <View style={styles.routeInfo}>
                <View style={styles.routePoint}>
                  <Text style={styles.routeLabel}>From</Text>
                  <Text style={styles.routeText} numberOfLines={1}>
                    {ride.pickup}
                  </Text>
                </View>
                <Text style={styles.arrow}>→</Text>
                <View style={styles.routePoint}>
                  <Text style={styles.routeLabel}>To</Text>
                  <Text style={styles.routeText} numberOfLines={1}>
                    {ride.drop}
                  </Text>
                </View>
              </View>

              <View style={styles.metaInfo}>
                <Text style={styles.metaText}>
                  {ride.distance} • {new Date(ride.date).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLACK,
  },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 54,
    paddingBottom: 22,
  },
  heroSmall: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  heroName: {
    color: WHITE,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 3,
  },
  heroMeta: {
    color: "#D1D5DB",
    marginTop: 6,
    fontSize: 12,
  },

  sheet: {
    flex: 1,
    backgroundColor: WHITE,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  sheetContent: {
    padding: 18,
    paddingBottom: 80,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: WHITE,
  },

  emptyState: {
    alignItems: "center",
    marginTop: 80,
  },
  emptyText: {
    color: TEXT_DARK,
    fontSize: 18,
    fontWeight: "700",
  },
  emptyMeta: {
    color: TEXT_MUTE,
    marginTop: 8,
    fontSize: 14,
  },

  rideCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    color: TEXT_DARK,
    fontSize: 15,
    fontWeight: "700",
  },
  ratingText: {
    color: TEXT_MUTE,
    fontSize: 12,
    marginTop: 2,
  },
  fareContainer: {
    alignItems: "flex-end",
  },
  fareText: {
    color: BLACK,
    fontSize: 16,
    fontWeight: "800",
  },
  statusBadge: {
    color: TEXT_MUTE,
    fontSize: 11,
    marginTop: 4,
    textTransform: "capitalize",
  },
  completedBadge: {
    color: GREEN,
    fontWeight: "600",
  },

  routeInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  routePoint: {
    flex: 1,
  },
  routeLabel: {
    color: TEXT_MUTE,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  routeText: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  arrow: {
    color: TEXT_MUTE,
    fontSize: 14,
  },

  metaInfo: {
    paddingVertical: 6,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  metaText: {
    color: TEXT_MUTE,
    fontSize: 11,
  },

  backBtn: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: BLACK,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backBtnText: {
    color: WHITE,
    fontWeight: "700",
    fontSize: 14,
  },
});
