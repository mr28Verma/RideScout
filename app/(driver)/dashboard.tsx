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

import { detectBackendPort } from "@/constants/api";
import {
    DriverEarnings,
    getDriverEarnings,
    toggleOnlineStatus,
} from "@/services/driverApi";
import { joinDriverRoom, listenForRideRequests } from "@/services/driverSocket";

// ── Design tokens (matches passenger design system) ───────────────────────────
const INK = "#0A0A0A";
const PAPER = "#FFFFFF";
const SURFACE = "#F2F2F2";
const RULE = "#D6D6D6";
const MUTED = "#888888";
const ACCENT = "#00C853";
const ACCENT_DIM = "#00C85320";

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
  const [earnings, setEarnings] = useState<DriverEarnings | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    detectBackendPort().catch(() => console.warn("Port detection failed"));
  }, []);

  useEffect(() => {
    if (!userId) return;
    getDriverEarnings(userId)
      .then(setEarnings)
      .catch(() => console.warn("Failed to load earnings"));
  }, [userId]);

  useEffect(() => {
    if (!userId || !isOnline) return;
    joinDriverRoom(userId);
    listenForRideRequests((ride: any) => {
      Alert.alert("New Ride Request", `📍 ${ride.pickup}\n💵 ₹${ride.fare}`, [
        { text: "Ignore", style: "cancel" },
        {
          text: "View",
          onPress: () =>
            router.push({
              pathname: "/(driver)/available-rides",
              params: { driverId: userId },
            }),
        },
      ]);
    });
  }, [userId, isOnline]);

  const handleToggleOnline = async () => {
    try {
      setTogglingStatus(true);
      await toggleOnlineStatus(userId, !isOnline);
      setIsOnline((prev) => !prev);
      if (!isOnline) Alert.alert("You're online", "Ready to accept rides.");
    } catch {
      Alert.alert("Error", "Failed to update status. Try again.");
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleViewRides = () => {
    if (!isOnline) {
      Alert.alert("You're offline", "Go online to see ride requests.");
      return;
    }
    router.push({
      pathname: "/(driver)/available-rides",
      params: { driverId: userId },
    });
  };

  const handleViewHistory = () =>
    router.push({
      pathname: "/(driver)/ride-history",
      params: { driverId: userId, name: firstName },
    });

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />

      {/* ── LEFT ACCENT BAR ── */}
      <View style={[s.accentBar, isOnline && s.accentBarOnline]} />

      {/* ── HEADER ── */}
      <View style={s.header}>
        {/* Top bar: logo + status pill */}
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

        <Text style={s.greeting}>Driver mode,</Text>
        <Text style={s.name}>{firstName}</Text>

        {/* Toggle */}
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
            <ActivityIndicator color={isOnline ? INK : PAPER} size="small" />
          ) : (
            <>
              <Text
                style={[s.toggleBtnText, isOnline && s.toggleBtnTextOnline]}
              >
                {isOnline ? "Go Offline" : "Go Online"}
              </Text>
              <View
                style={[s.toggleArrowBox, isOnline && s.toggleArrowBoxOnline]}
              >
                <Text style={[s.toggleArrow, isOnline && s.toggleArrowOnline]}>
                  {isOnline ? "✕" : "→"}
                </Text>
              </View>
            </>
          )}
        </Pressable>
      </View>

      {/* ── SHEET ── */}
      <ScrollView
        style={s.sheet}
        contentContainerStyle={s.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Earnings block */}
        <View style={s.earningsRow}>
          <View style={s.earningsMain}>
            <Text style={s.sectionTag}>TODAY EARNINGS</Text>
            <Text style={s.earningsAmount}>
              ₹{earnings?.todayEarnings ?? 0}
            </Text>
          </View>
          <View style={s.tripsBox}>
            <Text style={s.tripsCount}>{earnings?.todayTrips ?? 0}</Text>
            <Text style={s.tripsLabel}>Trips{"\n"}today</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Stats row */}
        <View style={s.statsRow}>
          <StatCell label="Rating" value={`${earnings?.rating ?? "4.5"} ★`} />
          <View style={s.statsDiv} />
          <StatCell
            label="Acceptance"
            value={`${earnings?.acceptanceRate ?? 92}%`}
          />
          <View style={s.statsDiv} />
          <StatCell
            label="Total Rides"
            value={`${earnings?.totalTrips ?? 0}`}
          />
        </View>

        <View style={s.divider} />

        {/* Active status banner (visible only when online) */}
        {isOnline && (
          <View style={s.activeBanner}>
            <View style={s.activeDot} />
            <Text style={s.activeBannerText}>Listening for ride requests…</Text>
          </View>
        )}

        {/* View Ride Requests CTA */}
        <View style={s.ctaWrap}>
          <Pressable
            style={({ pressed }) => [
              s.primaryBtn,
              !isOnline && s.primaryBtnDisabled,
              pressed && isOnline && s.pressed,
            ]}
            onPress={handleViewRides}
          >
            <Text
              style={[s.primaryBtnText, !isOnline && s.primaryBtnTextDisabled]}
            >
              VIEW RIDE REQUESTS
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

        {/* Footer */}
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
            <Text style={s.footerRowLabel}>My Profile</Text>
            <Text style={s.footerArrow}>›</Text>
          </Pressable>
          <View style={s.divider} />
          <Pressable style={s.footerRow} onPress={handleViewHistory}>
            <Text style={s.footerRowLabel}>Ride History</Text>
            <Text style={s.footerArrow}>›</Text>
          </Pressable>
          <View style={s.divider} />
          <Pressable style={s.footerRow} onPress={() => router.replace("/")}>
            <Text style={[s.footerRowLabel, { color: MUTED }]}>Sign Out</Text>
            <Text style={s.footerArrow}>›</Text>
          </Pressable>
        </View>
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

  // Accent bar
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: MUTED,
    zIndex: 10,
  },
  accentBarOnline: {
    backgroundColor: ACCENT,
  },

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
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  statusPillOnline: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_DIM,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MUTED,
  },
  statusDotOnline: {
    backgroundColor: ACCENT,
  },
  statusPillText: {
    color: PAPER,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  greeting: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  name: {
    color: PAPER,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1.5,
    lineHeight: 46,
    marginTop: 2,
    marginBottom: 24,
  },

  // Toggle button
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingLeft: 22,
    paddingRight: 6,
  },
  toggleBtnOffline: {
    backgroundColor: ACCENT,
  },
  toggleBtnOnline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#2a2a2a",
  },
  toggleBtnText: {
    color: INK,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 2,
  },
  toggleBtnTextOnline: {
    color: PAPER,
  },
  toggleArrowBox: {
    width: 42,
    height: 42,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleArrowBoxOnline: {
    backgroundColor: "#1a1a1a",
  },
  toggleArrow: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: "300",
  },
  toggleArrowOnline: {
    color: MUTED,
    fontSize: 14,
  },

  // Sheet
  sheet: { flex: 1, backgroundColor: PAPER },
  sheetContent: { paddingBottom: 48 },
  divider: { height: 1, backgroundColor: RULE, marginHorizontal: 20 },

  // Earnings
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
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  tripsBox: {
    backgroundColor: SURFACE,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: RULE,
  },
  tripsCount: {
    color: INK,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  tripsLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
    lineHeight: 14,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  statCell: { flex: 1, alignItems: "center" },
  statsDiv: { width: 1, backgroundColor: RULE, marginVertical: 4 },
  statValue: {
    color: INK,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  statLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 3,
  },

  // Active banner
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: ACCENT_DIM,
    paddingVertical: 10,
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
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // CTA
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
    letterSpacing: 2,
  },
  primaryBtnTextDisabled: {
    color: MUTED,
  },
  primaryArrowBox: {
    width: 44,
    height: 44,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryArrowBoxDisabled: {
    backgroundColor: RULE,
  },
  primaryArrow: {
    color: ACCENT,
    fontSize: 20,
    fontWeight: "300",
  },
  primaryArrowDisabled: {
    color: MUTED,
  },

  // Footer
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
    letterSpacing: 0.3,
  },
  footerArrow: {
    color: MUTED,
    fontSize: 22,
    fontWeight: "300",
  },
});
