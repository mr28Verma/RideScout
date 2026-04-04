import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View
} from "react-native";

import {
    PendingRide,
    acceptRide,
    getPendingRides,
    rejectRide,
} from "@/services/driverApi";

const BLACK = "#0D0D0D";
const WHITE = "#FFFFFF";
const TEXT_DARK = "#111111";
const TEXT_MUTE = "#6B7280";
const CARD = "#F5F5F5";
const BORDER = "#E5E7EB";
const GREEN = "#10B981";
const RED = "#EF4444";

export default function AvailableRides() {
  const { driverId } = useLocalSearchParams<{ driverId?: string }>();
  const driveId = typeof driverId === "string" ? driverId : "";

  const [rides, setRides] = useState<PendingRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    const loadRides = async () => {
      try {
        setLoading(true);
        const data = await getPendingRides(driveId);
        setRides(data);
      } catch (error) {
        Alert.alert("Error", "Failed to load available rides");
      } finally {
        setLoading(false);
      }
    };

    loadRides();
    const interval = setInterval(loadRides, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [driveId]);

  const handleAccept = async (rideId: string, estimatedFare: number) => {
    // Prompt driver to set custom price if needed
    Alert.prompt(
      "Set Ride Price",
      `Suggested fare: ₹${estimatedFare}\n\nEnter your price (optional):`,
      [
        {
          text: "Cancel",
          onPress: () => {},
          style: "cancel",
        },
        {
          text: "Accept",
          onPress: async (customPrice?: string) => {
            try {
              setAccepting(rideId);
              await acceptRide(rideId, driveId);
              const finalPrice = customPrice
                ? parseInt(customPrice)
                : estimatedFare;
              Alert.alert(
                "Success",
                `Ride accepted for ₹${finalPrice}!\nNavigate to pickup location.`,
              );
              setRides((prev) => prev.filter((r) => r.rideId !== rideId));
            } catch (error) {
              Alert.alert("Error", "Could not accept ride");
            } finally {
              setAccepting(null);
            }
          },
        },
      ],
      "plain-text",
      estimatedFare.toString(),
    );
  };

  const handleReject = async (rideId: string) => {
    try {
      await rejectRide(rideId);
      setRides((prev) => prev.filter((r) => r.rideId !== rideId));
    } catch (error) {
      Alert.alert("Error", "Failed to reject ride");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.hero}>
        <Text style={styles.heroSmall}>Available Rides</Text>
        <Text style={styles.heroName}>{rides.length} waiting</Text>
        <Text style={styles.heroMeta}>Accept a ride to start earning</Text>
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
            <Text style={styles.emptyText}>No rides available</Text>
            <Text style={styles.emptyMeta}>
              Go online and wait for ride requests
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
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>
                      ★ {ride.passengerRating}
                    </Text>
                  </View>
                </View>
                <Text style={styles.fareText}>₹ {ride.estimatedFare}</Text>
              </View>

              <View style={styles.routeInfo}>
                <View style={styles.routePoint}>
                  <Text style={styles.routeLabel}>Pickup</Text>
                  <Text style={styles.routeText}>{ride.pickup}</Text>
                </View>
                <View style={styles.routeDivider}>
                  <Text style={styles.dividerDot}>•</Text>
                </View>
                <View style={styles.routePoint}>
                  <Text style={styles.routeLabel}>Drop</Text>
                  <Text style={styles.routeText}>{ride.drop}</Text>
                </View>
              </View>

              <View style={styles.metaInfo}>
                <Text style={styles.metaText}>
                  {ride.distance} • {ride.eta}
                </Text>
              </View>

              <View style={styles.actionButtons}>
                <Pressable
                  style={styles.rejectBtn}
                  onPress={() => handleReject(ride.rideId)}
                  disabled={accepting === ride.rideId}
                >
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </Pressable>
                <Pressable
                  style={styles.acceptBtn}
                  onPress={() => handleAccept(ride.rideId, ride.estimatedFare)}
                  disabled={accepting === ride.rideId}
                >
                  {accepting === ride.rideId ? (
                    <ActivityIndicator color={WHITE} />
                  ) : (
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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
    paddingBottom: 30,
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: "700",
  },
  ratingBadge: {
    marginTop: 4,
  },
  ratingText: {
    color: TEXT_MUTE,
    fontSize: 12,
  },
  fareText: {
    color: BLACK,
    fontSize: 18,
    fontWeight: "800",
  },

  routeInfo: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 12,
  },
  routePoint: {
    flex: 1,
  },
  routeLabel: {
    color: TEXT_MUTE,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  routeText: {
    color: TEXT_DARK,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 3,
  },
  routeDivider: {
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  dividerDot: {
    color: TEXT_MUTE,
    fontSize: 12,
  },

  metaInfo: {
    marginBottom: 12,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  metaText: {
    color: TEXT_MUTE,
    fontSize: 12,
  },

  actionButtons: {
    flexDirection: "row",
    gap: 10,
  },
  rejectBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: RED,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  rejectBtnText: {
    color: RED,
    fontWeight: "700",
    fontSize: 14,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  acceptBtnText: {
    color: WHITE,
    fontWeight: "700",
    fontSize: 14,
  },
});
