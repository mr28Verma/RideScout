import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

import { detectBackendPort } from "@/constants/api";
import {
  ActiveTrip,
  DriverEarnings,
  PendingRide,
  getActiveTrips,
  getDriverEarnings,
  getPendingRides,
  toggleOnlineStatus,
} from "@/services/driverApi";
import { joinDriverRoom, listenForRideRequests } from "@/services/driverSocket";
import { UserProfile, fetchUserProfile } from "@/services/profileApi";

const INK = "#081018";
const PAPER = "#F7F4EE";
const SURFACE = "#FFFFFF";
const RULE = "#DDD5C9";
const MUTED = "#6D685D";
const ACCENT = "#0FA958";
const ACCENT_SOFT = "#DCF7E8";

export default function DriverDashboard() {
  const { name: nameParam, userId: userIdParam } = useLocalSearchParams<{
    name?: string;
    userId?: string;
  }>();

  const userId = typeof userIdParam === "string" ? userIdParam : "";
  const firstName =
    typeof nameParam === "string" && nameParam.trim().length > 0
      ? nameParam.split(" ")[0]
      : "Driver";

  const [isOnline, setIsOnline] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [earnings, setEarnings] = useState<DriverEarnings | null>(null);
  const [pendingRides, setPendingRides] = useState<PendingRide[]>([]);
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const loadOverview = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const [earningsResult, profileResult, pendingResult, activeResult] =
        await Promise.allSettled([
          getDriverEarnings(userId),
          fetchUserProfile(userId),
          getPendingRides(userId),
          getActiveTrips(userId),
        ]);

      if (earningsResult.status === "fulfilled") {
        setEarnings(earningsResult.value);
      }

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
        setIsOnline(Boolean(profileResult.value.isOnline));
      }

      if (pendingResult.status === "fulfilled") {
        setPendingRides(pendingResult.value);
      } else {
        setPendingRides([]);
        Alert.alert(
          "Ride requests",
          pendingResult.reason?.message || "Failed to load ride requests",
        );
      }

      if (activeResult.status === "fulfilled") {
        setActiveTrips(activeResult.value);
      } else {
        setActiveTrips([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    detectBackendPort().catch(() => console.warn("Port detection failed"));
  }, []);

  useEffect(() => {
    if (!userId) return;

    loadOverview();
  }, [userId]);

  useEffect(() => {
    if (!userId || !isOnline) return;

    joinDriverRoom(userId);
    const off = listenForRideRequests((ride: any) => {
      setPendingRides((current) => {
        const exists = current.some(
          (item) => String(item.rideId) === String(ride.rideId),
        );
        if (exists) return current;

        return [
          {
            rideId: ride.rideId,
            passengerId: ride.passengerId,
            passengerName: ride.passengerName || "Passenger",
            passengerRating: 5,
            pickup: ride.pickup,
            drop: ride.drop,
            estimatedFare: ride.estimatedFare ?? ride.fare ?? 0,
            requestedRideType: ride.requestedRideType ?? "mini",
            distance: ride.distance ?? "~5 km",
            eta: ride.eta ?? "~12 min",
            bidCount: ride.bidCount ?? 0,
            status: ride.status ?? "searching",
            currentBid: null,
            lowestBid: null,
            createdAt: ride.createdAt ?? new Date().toISOString(),
          },
          ...current,
        ];
      });

      Alert.alert(
        "New route opened",
        `${ride.pickup}\nRs ${ride.estimatedFare ?? ride.fare}\n${ride.bidCount ?? 0} drivers quoted so far`,
        [
          { text: "Later", style: "cancel" },
          {
            text: "Open board",
            onPress: () =>
              router.push({
                pathname: "/(driver)/available-rides",
                params: { driverId: userId },
              }),
          },
        ],
      );
    });

    return () => {
      off?.();
    };
  }, [isOnline, userId]);

  const topBid = useMemo(() => {
    return pendingRides
      .map((ride) => ride.currentBid?.amount ?? ride.lowestBid ?? null)
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b)[0];
  }, [pendingRides]);

  const readinessPercent = useMemo(() => {
    const checklist = [
      profile?.phone ? 1 : 0,
      profile?.vehicle ? 1 : 0,
      profile?.vehicleNumber ? 1 : 0,
      profile?.currentLocation ? 1 : 0,
    ];
    return Math.round((checklist.reduce((sum, item) => sum + item, 0) / 4) * 100);
  }, [profile?.currentLocation, profile?.phone, profile?.vehicle, profile?.vehicleNumber]);

  const handleToggleOnline = async () => {
    try {
      setTogglingStatus(true);
      await toggleOnlineStatus(userId, !isOnline);
      setIsOnline((prev) => !prev);
      await loadOverview();
      if (!isOnline) {
        Alert.alert("You are online", "You can now receive marketplace requests.");
      }
    } catch {
      Alert.alert("Error", "Failed to update status. Try again.");
    } finally {
      setTogglingStatus(false);
    }
  };

  const openBoard = () => {
    if (!isOnline) {
      Alert.alert("You are offline", "Go online to quote on live requests.");
      return;
    }

    router.push({
      pathname: "/(driver)/available-rides",
      params: { driverId: userId },
    });
  };

  const openHistory = () =>
    router.push({
      pathname: "/(driver)/ride-history",
      params: { driverId: userId, name: firstName },
    });

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />

      <View style={[s.accentBar, isOnline && s.accentBarOnline]} />

      <View style={s.header}>
        <View style={s.topBar}>
          <View style={s.logoBadge}>
            <Text style={s.logoText}>RIDE</Text>
          </View>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(driver)/profile",
                params: { userId, name: firstName },
              })
            }
          >
            <View style={[s.statusPill, isOnline && s.statusPillOnline]}>
              <View style={[s.statusDot, isOnline && s.statusDotOnline]} />
              <Text style={s.statusPillText}>
                {isOnline ? "ONLINE" : "OFFLINE"}
              </Text>
            </View>
          </Pressable>
        </View>

        <Text style={s.greeting}>Driver mode</Text>
        <Text style={s.name}>{firstName}</Text>
        <Text style={s.subline}>
          Stay quote-ready and keep an eye on the market before you chase the next ride.
        </Text>

        <Pressable
          style={({ pressed }) => [
            s.toggleBtn,
            isOnline ? s.toggleBtnOnline : s.toggleBtnOffline,
            pressed && s.pressed,
          ]}
          onPress={handleToggleOnline}
          disabled={togglingStatus}
        >
          {togglingStatus ? (
            <ActivityIndicator color={isOnline ? PAPER : INK} size="small" />
          ) : (
            <>
              <Text style={[s.toggleBtnText, isOnline && s.toggleBtnTextOnline]}>
                {isOnline ? "Pause Marketplace" : "Go Live for Quotes"}
              </Text>
              <View style={[s.toggleArrowBox, isOnline && s.toggleArrowBoxOnline]}>
                <Text style={[s.toggleArrow, isOnline && s.toggleArrowOnline]}>
                  {isOnline ? "×" : "→"}
                </Text>
              </View>
            </>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={s.sheet}
        contentContainerStyle={s.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={INK} />
          </View>
        ) : (
          <>
            <View style={s.earningsRow}>
              <View style={s.earningsMain}>
                <Text style={s.sectionTag}>TODAY EARNINGS</Text>
                <Text style={s.earningsAmount}>Rs {earnings?.todayEarnings ?? 0}</Text>
              </View>
              <View style={s.tripsBox}>
                <Text style={s.tripsCount}>{earnings?.todayTrips ?? 0}</Text>
                <Text style={s.tripsLabel}>Trips today</Text>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.statsRow}>
              <StatCell label="Rating" value={`${earnings?.rating ?? "4.5"} ★`} />
              <View style={s.statsDiv} />
              <StatCell
                label="Open Requests"
                value={`${pendingRides.length}`}
              />
              <View style={s.statsDiv} />
              <StatCell label="Active Trips" value={`${activeTrips.length}`} />
            </View>

            <View style={s.divider} />

            {isOnline && (
              <View style={s.activeBanner}>
                <View style={s.activeDot} />
                <Text style={s.activeBannerText}>
                  Listening for ride requests and bid updates...
                </Text>
              </View>
            )}

            <View style={s.marketSection}>
              <View style={s.marketCardWide}>
                <Text style={s.sectionTag}>QUOTE READINESS</Text>
                <Text style={s.marketValue}>{readinessPercent}%</Text>
                <Text style={s.marketHint}>
                  Drivers with phone, vehicle, number plate, and live location win bids faster.
                </Text>
              </View>

              <View style={s.marketGrid}>
                <View style={s.marketCard}>
                  <Text style={s.sectionTag}>MY LIVE BIDS</Text>
                  <Text style={s.marketValueSmall}>
                    {pendingRides.filter((ride) => ride.currentBid).length}
                  </Text>
                  <Text style={s.marketHintSmall}>
                    Requests where you already quoted
                  </Text>
                </View>
                <View style={s.marketCard}>
                  <Text style={s.sectionTag}>LOWEST MARKET PRICE</Text>
                  <Text style={s.marketValueSmall}>
                    {topBid ? `Rs ${topBid}` : "—"}
                  </Text>
                  <Text style={s.marketHintSmall}>
                    Lowest visible live quote
                  </Text>
                </View>
              </View>
            </View>

            {activeTrips.length > 0 && (
              <>
                <View style={s.divider} />
                <View style={s.tripSection}>
                  <Text style={s.sectionTag}>ACTIVE PASSENGERS</Text>
                  {activeTrips.slice(0, 2).map((trip) => (
                    <Pressable
                      key={trip.rideId}
                      style={s.tripCard}
                      onPress={openBoard}
                    >
                      <View style={s.tripCardTop}>
                        <Text style={s.tripPassenger}>{trip.passengerName}</Text>
                        <Text style={s.tripFare}>Rs {trip.estimatedFare}</Text>
                      </View>
                      <Text style={s.tripRoute} numberOfLines={1}>
                        {trip.pickup}
                      </Text>
                      <Text style={s.tripRouteArrow}>to</Text>
                      <Text style={s.tripRoute} numberOfLines={1}>
                        {trip.drop}
                      </Text>
                      <Text style={s.tripMeta}>
                        {trip.status.toUpperCase()} • {trip.passengerPhone}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <View style={s.ctaWrap}>
              <Pressable
                style={({ pressed }) => [
                  s.primaryBtn,
                  !isOnline && s.primaryBtnDisabled,
                  pressed && isOnline && s.pressed,
                ]}
                onPress={openBoard}
              >
                <Text
                  style={[s.primaryBtnText, !isOnline && s.primaryBtnTextDisabled]}
                >
                  OPEN QUOTE BOARD
                </Text>
                <View
                  style={[
                    s.primaryArrowBox,
                    !isOnline && s.primaryArrowBoxDisabled,
                  ]}
                >
                  <Text
                    style={[s.primaryArrow, !isOnline && s.primaryArrowDisabled]}
                  >
                    →
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={s.footer}>
              <Pressable
                style={s.footerRow}
                onPress={() =>
                  router.push({
                    pathname: "/(driver)/profile",
                    params: { userId, name: firstName },
                  })
                }
              >
                <Text style={s.footerRowLabel}>Quote Readiness Profile</Text>
                <Text style={s.footerArrow}>›</Text>
              </Pressable>
              <View style={s.divider} />
              <Pressable style={s.footerRow} onPress={openHistory}>
                <Text style={s.footerRowLabel}>Ride History</Text>
                <Text style={s.footerArrow}>›</Text>
              </Pressable>
              <View style={s.divider} />
              <Pressable style={s.footerRow} onPress={() => router.replace("/")}>
                <Text style={[s.footerRowLabel, { color: MUTED }]}>Sign Out</Text>
                <Text style={s.footerArrow}>›</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statCell}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  pressed: { opacity: 0.75 },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: MUTED,
    zIndex: 10,
  },
  accentBarOnline: { backgroundColor: ACCENT },
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
    marginBottom: 24,
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
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#26313A",
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  statusPillOnline: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_SOFT,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MUTED,
  },
  statusDotOnline: { backgroundColor: ACCENT },
  statusPillText: {
    color: PAPER,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  greeting: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  name: {
    color: PAPER,
    fontSize: 40,
    fontWeight: "900",
    lineHeight: 42,
    marginTop: 6,
  },
  subline: {
    color: "#B9C1C8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 320,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingLeft: 22,
    paddingRight: 6,
    marginTop: 20,
  },
  toggleBtnOffline: { backgroundColor: ACCENT },
  toggleBtnOnline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#26313A",
  },
  toggleBtnText: {
    color: INK,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1.2,
  },
  toggleBtnTextOnline: { color: PAPER },
  toggleArrowBox: {
    width: 42,
    height: 42,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleArrowBoxOnline: { backgroundColor: "#1D2730" },
  toggleArrow: {
    color: ACCENT,
    fontSize: 18,
    fontWeight: "300",
  },
  toggleArrowOnline: {
    color: PAPER,
    fontSize: 16,
  },
  sheet: { flex: 1, backgroundColor: PAPER },
  sheetContent: { paddingBottom: 48 },
  loadingBox: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: 1, backgroundColor: RULE, marginHorizontal: 20 },
  earningsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  earningsMain: { flex: 1 },
  sectionTag: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  earningsAmount: {
    color: INK,
    fontSize: 40,
    fontWeight: "900",
  },
  tripsBox: {
    backgroundColor: SURFACE,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: RULE,
    minWidth: 96,
  },
  tripsCount: {
    color: INK,
    fontSize: 26,
    fontWeight: "900",
  },
  tripsLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 3,
  },
  statsRow: {
    flexDirection: "row",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  statCell: { flex: 1, alignItems: "center" },
  statsDiv: { width: 1, backgroundColor: RULE, marginVertical: 4 },
  statValue: {
    color: INK,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  statLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 5,
    textAlign: "center",
  },
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: ACCENT_SOFT,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  activeBannerText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "800",
  },
  marketSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  marketCardWide: {
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: SURFACE,
    padding: 16,
  },
  marketGrid: {
    flexDirection: "row",
    gap: 12,
  },
  marketCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: SURFACE,
    padding: 14,
  },
  marketValue: {
    color: INK,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 8,
  },
  marketValueSmall: {
    color: INK,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
  },
  marketHint: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  marketHintSmall: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  tripSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  tripCard: {
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: SURFACE,
    padding: 14,
  },
  tripCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  tripPassenger: {
    color: INK,
    fontSize: 15,
    fontWeight: "900",
  },
  tripFare: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: "900",
  },
  tripRoute: {
    color: INK,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  tripRouteArrow: {
    color: MUTED,
    fontSize: 11,
    marginTop: 4,
  },
  tripMeta: {
    color: MUTED,
    fontSize: 11,
    marginTop: 10,
  },
  ctaWrap: { padding: 20, borderBottomWidth: 1, borderBottomColor: RULE },
  primaryBtn: {
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingLeft: 22,
    paddingRight: 6,
  },
  primaryBtnDisabled: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
  },
  primaryBtnText: {
    color: INK,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1.5,
  },
  primaryBtnTextDisabled: { color: MUTED },
  primaryArrowBox: {
    width: 44,
    height: 44,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryArrowBoxDisabled: { backgroundColor: RULE },
  primaryArrow: {
    color: ACCENT,
    fontSize: 20,
    fontWeight: "300",
  },
  primaryArrowDisabled: { color: MUTED },
  footer: { marginTop: 4 },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  footerRowLabel: {
    color: INK,
    fontSize: 14,
    fontWeight: "700",
  },
  footerArrow: {
    color: MUTED,
    fontSize: 22,
    fontWeight: "300",
  },
});
