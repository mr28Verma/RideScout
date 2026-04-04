import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";

import LocationInput from "@/components/LocationInput";
import { detectBackendPort } from "@/constants/api";
import {
    emitNewRideRequest,
    joinRideRoom,
    listenForDriverAccepted,
    listenForDriverLocation,
    listenForRideStatus,
    listenForTripCompleted,
    listenForTripStarted,
    startRideSimulation,
} from "@/services/passengerSocket";
import { processPayment } from "@/services/payment";
import {
    DriverInfo,
    RideStatus,
    bookRide,
    estimateFare,
    fetchNearbyDrivers,
} from "@/services/rideApi";

// ── Design tokens ─────────────────────────────────────────────────────────────
const INK = "#0A0A0A";
const PAPER = "#FFFFFF";
const SURFACE = "#F2F2F2";
const RULE = "#D6D6D6";
const MUTED = "#888888";
const ACCENT = "#00C853";
const ACCENT_DIM = "#00C85320";

export default function PassengerDashboard() {
  const { name: nameParam, userId: userIdParam } = useLocalSearchParams<{
    name?: string;
    userId?: string;
  }>();

  const userId = typeof userIdParam === "string" ? userIdParam : "";
  const firstName =
    typeof nameParam === "string" && nameParam.trim().length > 0
      ? nameParam.split(" ")[0]
      : "Scout";

  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [pickupCoords, setPickupCoords] = useState({
    lat: 28.6139,
    lon: 77.209,
  });
  const [dropCoords, setDropCoords] = useState({ lat: 28.5355, lon: 77.391 });
  const [fare, setFare] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<DriverInfo[]>([]);
  const [rideStatus, setRideStatus] = useState<RideStatus | null>(null);
  const [activeRideId, setActiveRideId] = useState<string>("");
  const [trackingText, setTrackingText] = useState("Awaiting booking");
  const [isEstimating, setIsEstimating] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverInfo | null>(null);

  useEffect(() => {
    detectBackendPort().catch(() => console.warn("Port detection failed"));
  }, []);

  useEffect(() => {
    // Optionally fetch drivers on mount with default location
    fetchNearbyDrivers(pickupCoords.lat, pickupCoords.lon)
      .then(setNearbyDrivers)
      .catch(() => setNearbyDrivers([]));
  }, []);

  // Debug: Log when pickup or drop changes
  useEffect(() => {
    console.log("🔄 Location state updated:", { pickup, drop });
  }, [pickup, drop]);

  useEffect(() => {
    if (!activeRideId) return;
    const u: Array<() => void> = [];
    u.push(
      listenForRideStatus((e: any) => {
        if (e.rideId !== activeRideId) return;
        setRideStatus(e.status);
      }),
    );
    u.push(
      listenForDriverLocation((e: any) => {
        if (e.rideId !== activeRideId) return;
        setTrackingText(
          `Live · (${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}) · ${e.heading}°`,
        );
      }),
    );
    u.push(
      listenForDriverAccepted((d: any) => {
        if (d.rideId !== activeRideId) return;
        setRideStatus("accepted");
        setTrackingText(`${d.driverName} · ${d.vehicle} · ★${d.rating}`);
      }),
    );
    u.push(
      listenForTripStarted((d: any) => {
        if (d.rideId !== activeRideId) return;
        setRideStatus("on_trip");
        setTrackingText("Driver is on the way with you");
      }),
    );
    u.push(
      listenForTripCompleted((d: any) => {
        if (d.rideId !== activeRideId) return;
        setRideStatus("completed");
        setTrackingText("Trip completed");
      }),
    );
    return () => u.forEach((fn) => fn());
  }, [activeRideId]);

  const statusLabel = useMemo(() => {
    const map: Record<string, string> = {
      searching: "SEARCHING",
      accepted: "ACCEPTED",
      on_trip: "ON TRIP",
      completed: "COMPLETED",
    };
    return rideStatus ? (map[rideStatus] ?? rideStatus.toUpperCase()) : "—";
  }, [rideStatus]);

  const statusAccent = useMemo(() => {
    if (!rideStatus || rideStatus === "searching") return MUTED;
    if (rideStatus === "completed" || rideStatus === "on_trip") return ACCENT;
    return INK;
  }, [rideStatus]);

  const handleEstimate = async () => {
    console.log("🟡 Estimate button pressed");
    console.log("📍 Current state:", {
      pickup,
      drop,
      pickupCoords,
      dropCoords,
    });

    if (!pickup || pickup.trim() === "") {
      alert(`Please select PICKUP location. Current: "${pickup}"`);
      return;
    }
    if (!drop || drop.trim() === "") {
      alert(`Please select DESTINATION. Current: "${drop}"`);
      return;
    }

    try {
      setIsEstimating(true);
      console.log("📍 Frontend - Sending estimate request:", {
        pickup,
        drop,
        pickupCoords,
        dropCoords,
      });

      const data = await estimateFare(
        pickup,
        drop,
        pickupCoords.lat,
        pickupCoords.lon,
        dropCoords.lat,
        dropCoords.lon,
      );

      console.log("✅ Fare estimate response:", data);

      setFare(data.estimatedFare);
      setDistance(data.distanceKm);
      setSelectedDriver(null); // Reset selected driver when re-estimating

      // Fetch nearby drivers based on pickup location
      const drivers = await fetchNearbyDrivers(
        pickupCoords.lat,
        pickupCoords.lon,
      );
      setNearbyDrivers(drivers);
    } catch (e) {
      console.error("❌ Estimation error:", e);
      alert(e instanceof Error ? e.message : "Estimation failed");
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSelectDriver = (driver: DriverInfo) => {
    setSelectedDriver(driver);
  };

  const handleBookRide = async () => {
    if (!userId) {
      alert("Session expired.");
      router.replace("/");
      return;
    }
    if (!pickup || !drop) {
      alert("Enter both locations.");
      return;
    }
    if (!fare) {
      alert("Estimate fare first.");
      return;
    }
    if (!selectedDriver) {
      alert("Select a driver first.");
      return;
    }
    try {
      setIsBooking(true);
      const booked = await bookRide({
        passengerId: userId,
        pickup,
        drop,
        estimatedFare: fare,
        paymentMethod: "mock",
      });
      const rideId = booked.ride._id;
      setActiveRideId(rideId);
      setRideStatus("searching");
      setTrackingText("Searching for nearby drivers…");
      joinRideRoom(rideId, userId);
      emitNewRideRequest({
        rideId,
        passengerId: userId,
        passengerName: firstName,
        pickupLocation: pickup,
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lon,
        drop,
        dropLat: dropCoords.lat,
        dropLng: dropCoords.lon,
        fare,
      });
      startRideSimulation(rideId);
      await processPayment("mock", { amount: fare, currency: "INR", rideId });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />

      {/* ── HEADER ── */}
      <View style={s.header}>
        <View style={s.topBar}>
          <View style={s.logoBadge}>
            <Text style={s.logoText}>RIDE</Text>
          </View>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(passenger)/profile",
                params: { userId, name: firstName },
              })
            }
          >
            <View style={s.profileDot}>
              <Text style={s.profileInitial}>{firstName[0].toUpperCase()}</Text>
            </View>
          </Pressable>
        </View>
        <Text style={s.greeting}>Where to?</Text>
        <Text style={s.subGreeting}>Good to see you, {firstName}</Text>
      </View>

      {/* ── SHEET ── */}
      <ScrollView
        style={s.sheet}
        contentContainerStyle={s.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Route input */}
        <View style={s.routeBlock}>
          <View style={s.routeRow}>
            <View style={s.routeIconCol}>
              <View style={s.dotPickup} />
              <View style={s.routeConnector} />
            </View>
            <View style={s.routeField}>
              <Text style={s.fieldTag}>PICKUP</Text>
              <LocationInput
                placeholder="Current location"
                setLocation={setPickup}
                setCoords={setPickupCoords}
                darkMode={true}
                dotColor="#00C853"
              />
            </View>
          </View>
          <View style={s.fieldDivider} />
          <View style={s.routeRow}>
            <View style={s.routeIconCol}>
              <View style={s.dotDrop} />
            </View>
            <View style={s.routeField}>
              <Text style={s.fieldTag}>DESTINATION</Text>
              <LocationInput
                placeholder="Where are you going?"
                setLocation={setDrop}
                setCoords={setDropCoords}
                darkMode={true}
                dotColor="#FF5252"
              />
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [s.estimateStrip, pressed && s.pressed]}
            onPress={handleEstimate}
          >
            <Text style={s.estimateStripLabel}>
              {isEstimating ? "CALCULATING…" : "GET FARE ESTIMATE"}
            </Text>
            {isEstimating ? (
              <ActivityIndicator color={PAPER} size="small" />
            ) : (
              <Text style={s.estimateArrow}>↗</Text>
            )}
          </Pressable>
        </View>

        {/* Metrics */}
        <View style={s.metricsStrip}>
          <View style={s.metricCell}>
            <Text style={s.metricTag}>FARE</Text>
            <Text style={s.metricBig}>{fare ? `₹${fare}` : "—"}</Text>
            <Text style={s.metricSub}>
              {distance ? `${distance} km` : "Not estimated"}
            </Text>
          </View>
          <View style={s.metricDivider} />
          <View style={s.metricCell}>
            <Text style={s.metricTag}>STATUS</Text>
            <Text style={[s.metricBig, { color: statusAccent, fontSize: 15 }]}>
              {statusLabel}
            </Text>
            <Text style={s.metricSub} numberOfLines={2}>
              {trackingText}
            </Text>
          </View>
        </View>

        {/* Nearby drivers / Ride Selection */}
        {fare && nearbyDrivers.length > 0 && (
          <View style={s.driversSection}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>SELECT A RIDE</Text>
              <View style={s.countBadge}>
                <Text style={s.countText}>{nearbyDrivers.length}</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.driversScroll}
            >
              {nearbyDrivers.map((d) => (
                <Pressable
                  key={d.id}
                  style={[
                    s.driverCard,
                    selectedDriver?.id === d.id && s.driverCardSelected,
                  ]}
                  onPress={() => handleSelectDriver(d)}
                >
                  <View style={s.driverIconBox}>
                    <Text style={s.driverIcon}>🚗</Text>
                  </View>
                  <Text style={s.driverName}>{d.name}</Text>
                  <Text style={s.driverVehicle}>{d.vehicle}</Text>
                  <Text style={s.ratingText}>★ {d.rating}</Text>
                  {selectedDriver?.id === d.id && (
                    <View style={s.selectedCheckmark}>
                      <Text style={s.checkmarkIcon}>✓</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Book CTA */}
        <View style={s.ctaWrap}>
          <Pressable
            style={({ pressed }) => [
              s.bookBtn,
              pressed && s.pressed,
              !selectedDriver && s.bookBtnDisabled,
            ]}
            onPress={handleBookRide}
            disabled={!selectedDriver && !!fare}
          >
            {isBooking ? (
              <ActivityIndicator color={INK} />
            ) : (
              <>
                <Text style={s.bookBtnText}>
                  {selectedDriver ? "CONFIRM & BOOK" : "SELECT A RIDE"}
                </Text>
                <View style={s.bookBtnArrowBox}>
                  <Text style={s.bookBtnArrow}>→</Text>
                </View>
              </>
            )}
          </Pressable>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Pressable
            style={s.footerRow}
            onPress={() =>
              router.push({
                pathname: "/(passenger)/profile",
                params: { userId, name: firstName },
              })
            }
          >
            <Text style={s.footerRowLabel}>My Profile</Text>
            <Text style={s.footerRowArrow}>›</Text>
          </Pressable>
          <View style={s.footerRule} />
          <Pressable
            style={s.footerRow}
            onPress={() =>
              router.push({
                pathname: "/(passenger)/ride-history",
                params: { userId, name: firstName },
              })
            }
          >
            <Text style={s.footerRowLabel}>Ride History</Text>
            <Text style={s.footerRowArrow}>›</Text>
          </Pressable>
          <View style={s.footerRule} />
          <Pressable style={s.footerRow} onPress={() => router.replace("/")}>
            <Text style={[s.footerRowLabel, { color: MUTED }]}>Sign Out</Text>
            <Text style={s.footerRowArrow}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  pressed: { opacity: 0.75 },

  // Header
  header: {
    backgroundColor: INK,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  logoBadge: {
    borderWidth: 1.5,
    borderColor: PAPER,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  logoText: {
    color: PAPER,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
  },
  profileDot: {
    width: 34,
    height: 34,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: { color: INK, fontSize: 15, fontWeight: "900" },
  greeting: {
    color: PAPER,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1.5,
    lineHeight: 46,
  },
  subGreeting: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
    letterSpacing: 0.3,
  },

  // Sheet
  sheet: { flex: 1, backgroundColor: PAPER },
  sheetContent: { paddingBottom: 48 },

  // Route block
  routeBlock: { borderBottomWidth: 1, borderBottomColor: RULE },
  routeRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 14,
  },
  routeIconCol: { alignItems: "center", paddingTop: 18, width: 14 },
  dotPickup: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
  routeConnector: {
    width: 1,
    flex: 1,
    backgroundColor: RULE,
    marginTop: 4,
    minHeight: 20,
  },
  dotDrop: { width: 10, height: 10, backgroundColor: INK },
  routeField: { flex: 1 },
  fieldTag: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  fieldInput: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 16,
    fontWeight: "700",
    color: INK,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: RULE,
    marginLeft: 48,
    marginRight: 20,
  },
  estimateStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: INK,
    marginHorizontal: 20,
    marginVertical: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  estimateStripLabel: {
    color: PAPER,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  estimateArrow: { color: ACCENT, fontSize: 18, fontWeight: "300" },

  // Metrics
  metricsStrip: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  metricCell: { flex: 1, paddingVertical: 20, paddingHorizontal: 20 },
  metricDivider: { width: 1, backgroundColor: RULE, marginVertical: 16 },
  metricTag: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  metricBig: {
    color: INK,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  metricSub: { color: MUTED, fontSize: 11, marginTop: 4, lineHeight: 15 },

  // Drivers
  driversSection: {
    paddingTop: 20,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  driversScroll: {
    paddingRight: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: INK,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  countBadge: {
    backgroundColor: ACCENT_DIM,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countText: { color: ACCENT, fontSize: 10, fontWeight: "800" },
  driverCard: {
    marginLeft: 20,
    marginBottom: 16,
    width: 96,
    borderWidth: 1,
    borderColor: RULE,
    padding: 12,
    backgroundColor: SURFACE,
  },
  driverCardSelected: {
    borderColor: ACCENT,
    borderWidth: 2,
    backgroundColor: ACCENT_DIM,
  },
  selectedCheckmark: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    backgroundColor: ACCENT,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkIcon: { color: PAPER, fontSize: 14, fontWeight: "900" },
  driverIconBox: {
    width: 36,
    height: 36,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  driverIcon: { fontSize: 18 },
  driverName: { color: INK, fontSize: 12, fontWeight: "800", lineHeight: 16 },
  driverVehicle: { color: MUTED, fontSize: 10, marginTop: 2 },
  ratingText: { color: INK, fontSize: 11, fontWeight: "700", marginTop: 6 },

  // CTA
  ctaWrap: { padding: 20, borderBottomWidth: 1, borderBottomColor: RULE },
  bookBtn: {
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingLeft: 22,
    paddingRight: 6,
  },
  bookBtnDisabled: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
  },
  bookBtnText: {
    color: INK,
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 2,
  },
  bookBtnArrowBox: {
    width: 44,
    height: 44,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  bookBtnArrow: { color: ACCENT, fontSize: 20, fontWeight: "300" },

  // Footer
  footer: { marginTop: 4 },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  footerRule: { height: 1, backgroundColor: RULE, marginHorizontal: 20 },
  footerRowLabel: {
    color: INK,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  footerRowArrow: { color: MUTED, fontSize: 22, fontWeight: "300" },
});
