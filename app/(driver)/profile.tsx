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
    TextInput,
    View,
} from "react-native";

import { detectBackendPort } from "@/constants/api";
import { updateDriverLocation } from "@/services/driverApi";
import { UserProfile, fetchUserProfile, logout } from "@/services/profileApi";

// ── Design tokens ─────────────────────────────────────────────────────────────
const INK = "#0A0A0A";
const PAPER = "#FFFFFF";
const SURFACE = "#F2F2F2";
const RULE = "#D6D6D6";
const MUTED = "#888888";
const ACCENT = "#00C853";
const ACCENT_DIM = "#00C85320";
const DANGER = "#FF3B30";

export default function DriverProfile() {
  const { userId: userIdParam } = useLocalSearchParams<{
    userId?: string;
    name?: string;
  }>();

  const userId = typeof userIdParam === "string" ? userIdParam : "";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState("Baddi");
  const [updatingLocation, setUpdatingLocation] = useState(false);

  useEffect(() => {
    detectBackendPort().catch(() => console.warn("Port detection failed"));
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await fetchUserProfile(userId);
        setProfile(data);
      } catch (error) {
        console.error("Failed to load profile:", error);
        Alert.alert("Error", "Failed to load your profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        onPress: async () => {
          try {
            await logout(userId);
            router.replace("/");
          } catch {
            Alert.alert("Error", "Failed to logout");
          }
        },
        style: "destructive",
      },
    ]);
  };

  const handleSetLocation = async () => {
    if (!userId || !locationName.trim()) {
      Alert.alert("Invalid", "Please enter a location name");
      return;
    }

    try {
      setUpdatingLocation(true);
      // For now, use mock coordinates for common locations
      const locationCoords: { [key: string]: { lat: number; lng: number } } = {
        baddi: { lat: 31.2833, lng: 76.55 },
        delhi: { lat: 28.6139, lng: 77.209 },
        chandigarh: { lat: 30.7333, lng: 76.7794 },
        shimla: { lat: 31.7725, lng: 77.1728 },
        mohali: { lat: 30.6394, lng: 76.6916 },
      };

      const normalized = locationName.toLowerCase().trim();
      const coords = locationCoords[normalized] || { lat: 31.2833, lng: 76.55 }; // Default to Baddi

      await updateDriverLocation(userId, coords.lat, coords.lng, locationName);
      Alert.alert(
        "Success",
        `Location updated to ${locationName}! (${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°)`,
      );
    } catch (error) {
      Alert.alert("Error", "Failed to update location");
      console.error("Location update error:", error);
    } finally {
      setUpdatingLocation(false);
    }
  };

  if (loading) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={INK} />
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={INK} />
        <Text style={s.errorText}>Failed to load profile</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />

      <ScrollView contentContainerStyle={s.scrollContent}>
        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <Pressable onPress={() => router.back()}>
              <Text style={s.backBtn}>← Back</Text>
            </Pressable>
            <Text style={s.headerTitle}>Driver Profile</Text>
            <View style={{ width: 50 }} />
          </View>
        </View>

        {/* ── PROFILE CARD ── */}
        <View style={s.profileCard}>
          {/* Avatar & Basic Info */}
          <View style={s.avatarSection}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={s.profileName}>{profile.name}</Text>
            <Text style={s.profileEmail}>{profile.email}</Text>
          </View>

          {/* Rating & Stats */}
          <View style={s.statsSection}>
            <View style={s.statBox}>
              <Text style={s.statValue}>
                {profile.rating?.toFixed(1) || "4.5"}⭐
              </Text>
              <Text style={s.statLabel}>Rating</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statValue}>{profile.totalRides || 0}</Text>
              <Text style={s.statLabel}>Rides</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statValue}>
                {profile.acceptanceRate?.toFixed(0) || "100"}%
              </Text>
              <Text style={s.statLabel}>Acceptance</Text>
            </View>
          </View>

          {/* Vehicle Info */}
          <View style={s.infoSection}>
            <Text style={s.sectionTitle}>VEHICLE INFORMATION</Text>

            <View style={s.infoRow}>
              <Text style={s.infoLabel}>VEHICLE</Text>
              <Text style={s.infoValue}>
                {profile.vehicle || "Not specified"}
              </Text>
            </View>

            <View style={s.infoRow}>
              <Text style={s.infoLabel}>REGISTRATION NUMBER</Text>
              <Text style={s.infoValue}>
                {profile.vehicleNumber || "Not specified"}
              </Text>
            </View>

            <View style={s.infoRow}>
              <Text style={s.infoLabel}>EARNINGS TODAY</Text>
              <Text style={[s.infoValue, { color: ACCENT }]}>
                ₹{profile.totalEarnings?.toLocaleString() || "0"}
              </Text>
            </View>
          </View>

          {/* Location Setting */}
          <View style={s.infoSection}>
            <Text style={s.sectionTitle}>OPERATING LOCATION</Text>

            <View style={s.locationInputWrapper}>
              <TextInput
                style={s.locationInput}
                placeholder="Enter location (e.g., Baddi, Delhi)"
                placeholderTextColor={MUTED}
                value={locationName}
                onChangeText={setLocationName}
                editable={!updatingLocation}
              />
              <Pressable
                style={[s.setLocationBtn, updatingLocation && s.disabled]}
                onPress={handleSetLocation}
                disabled={updatingLocation}
              >
                {updatingLocation ? (
                  <ActivityIndicator color={PAPER} size="small" />
                ) : (
                  <Text style={s.setLocationBtnText}>📍 SET</Text>
                )}
              </Pressable>
            </View>
            <Text style={s.locationHelper}>
              Passengers will see rides from this location
            </Text>
          </View>

          {/* Account Info */}
          <View style={s.infoSection}>
            <Text style={s.sectionTitle}>ACCOUNT INFORMATION</Text>

            <View style={s.infoRow}>
              <Text style={s.infoLabel}>MEMBER SINCE</Text>
              <Text style={s.infoValue}>
                {profile.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString()
                  : "N/A"}
              </Text>
            </View>

            <View style={s.infoRow}>
              <Text style={s.infoLabel}>STATUS</Text>
              <Text
                style={[
                  s.infoValue,
                  {
                    color: profile.isOnline ? ACCENT : MUTED,
                    fontWeight: "600",
                  },
                ]}
              >
                {profile.isOnline ? "● Online" : "● Offline"}
              </Text>
            </View>
          </View>
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={s.actionsSection}>
          <Pressable style={s.actionItem}>
            <Text style={s.actionIcon}>📊</Text>
            <View style={s.actionContent}>
              <Text style={s.actionTitle}>Earnings Report</Text>
              <Text style={s.actionSubtitle}>View detailed earnings</Text>
            </View>
            <Text style={s.actionArrow}>›</Text>
          </Pressable>

          <Pressable style={s.actionItem}>
            <Text style={s.actionIcon}>⭐</Text>
            <View style={s.actionContent}>
              <Text style={s.actionTitle}>Ratings & Reviews</Text>
              <Text style={s.actionSubtitle}>See what passengers think</Text>
            </View>
            <Text style={s.actionArrow}>›</Text>
          </Pressable>

          <Pressable style={s.actionItem}>
            <Text style={s.actionIcon}>🛡️</Text>
            <View style={s.actionContent}>
              <Text style={s.actionTitle}>Security & Account</Text>
              <Text style={s.actionSubtitle}>Manage your account settings</Text>
            </View>
            <Text style={s.actionArrow}>›</Text>
          </Pressable>

          <Pressable style={s.actionItem}>
            <Text style={s.actionIcon}>📱</Text>
            <View style={s.actionContent}>
              <Text style={s.actionTitle}>Help & Support</Text>
              <Text style={s.actionSubtitle}>
                Get help from our support team
              </Text>
            </View>
            <Text style={s.actionArrow}>›</Text>
          </Pressable>
        </View>

        {/* ── LOGOUT BUTTON ── */}
        <Pressable style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutBtnText}>LOGOUT</Text>
        </Pressable>

        <View style={s.spacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAPER,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  header: {
    backgroundColor: INK,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backBtn: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: "600",
  },
  headerTitle: {
    color: PAPER,
    fontSize: 18,
    fontWeight: "700",
  },

  // Profile Card
  profileCard: {
    margin: 16,
    backgroundColor: PAPER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RULE,
    overflow: "hidden",
  },

  // Avatar & Basic Info
  avatarSection: {
    backgroundColor: SURFACE,
    paddingVertical: 32,
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "700",
    color: PAPER,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "700",
    color: INK,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: MUTED,
  },

  // Stats Section
  statsSection: {
    flexDirection: "row",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: ACCENT_DIM,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: MUTED,
    fontWeight: "600",
  },
  statDivider: {
    width: 1,
    backgroundColor: RULE,
  },

  // Info Section
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: RULE,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    marginBottom: 16,
    letterSpacing: 1,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: MUTED,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
    color: INK,
  },

  // Location Setting
  locationInputWrapper: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  locationInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 8,
    fontSize: 14,
    color: INK,
    backgroundColor: PAPER,
  },
  setLocationBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: ACCENT,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  setLocationBtnText: {
    color: PAPER,
    fontWeight: "600",
    fontSize: 12,
  },
  locationHelper: {
    fontSize: 12,
    color: MUTED,
    fontStyle: "italic",
  },
  disabled: {
    opacity: 0.6,
  },

  // Actions Section
  actionsSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: SURFACE,
    borderRadius: 8,
    marginBottom: 12,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: INK,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: MUTED,
  },
  actionArrow: {
    fontSize: 20,
    color: MUTED,
  },

  // Logout
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: DANGER,
    borderRadius: 8,
    alignItems: "center",
  },
  logoutBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: PAPER,
  },

  // Error
  errorText: {
    fontSize: 16,
    color: DANGER,
    textAlign: "center",
    marginTop: 32,
  },

  spacer: {
    height: 40,
  },
});
