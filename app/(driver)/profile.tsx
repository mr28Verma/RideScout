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

import CustomInput from "@/components/CustomInput";
import { detectBackendPort } from "@/constants/api";
import { useAuth } from "@/contexts/AuthContext";
import { updateDriverLocation } from "@/services/driverApi";
import {
  UserProfile,
  fetchUserProfile,
  updateUserProfile,
} from "@/services/profileApi";

const INK = "#081018";
const PAPER = "#F7F4EE";
const SURFACE = "#FFFFFF";
const ALT_SURFACE = "#F1ECE3";
const RULE = "#DDD5C9";
const MUTED = "#6D685D";
const ACCENT = "#0FA958";
const DANGER = "#DC2626";

const LOCATION_PRESETS: Record<string, { lat: number; lng: number }> = {
  baddi: { lat: 31.2833, lng: 76.55 },
  delhi: { lat: 28.6139, lng: 77.209 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  shimla: { lat: 31.7725, lng: 77.1728 },
  mohali: { lat: 30.6394, lng: 76.6916 },
};

export default function DriverProfile() {
  const { logout } = useAuth();
  const { userId: userIdParam } = useLocalSearchParams<{
    userId?: string;
    name?: string;
  }>();

  const userId = typeof userIdParam === "string" ? userIdParam : "";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [locationName, setLocationName] = useState("");

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
        hydrate(data);
      } catch {
        Alert.alert("Error", "Failed to load your profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const hydrate = (data: UserProfile) => {
    setProfile(data);
    setPhone(data.phone ?? "");
    setVehicle(data.vehicle ?? "");
    setVehicleNumber(data.vehicleNumber ?? "");
    setLocationName(data.currentLocation ?? "");
  };

  const readinessItems = useMemo(
    () => [
      { label: "Phone", ready: phone.trim().length > 0 },
      { label: "Vehicle", ready: vehicle.trim().length > 0 },
      { label: "Plate", ready: vehicleNumber.trim().length > 0 },
      { label: "Location", ready: locationName.trim().length > 0 },
    ],
    [locationName, phone, vehicle, vehicleNumber],
  );

  const readinessPercent = Math.round(
    (readinessItems.filter((item) => item.ready).length / readinessItems.length) * 100,
  );

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch {
            Alert.alert("Error", "Failed to logout");
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!userId) return;

    try {
      setSaving(true);
      const updated = await updateUserProfile(userId, {
        phone: phone.trim(),
        vehicle: vehicle.trim(),
        vehicleNumber: vehicleNumber.trim(),
        currentLocation: locationName.trim(),
      });

      const normalized = locationName.toLowerCase().trim();
      const coords = LOCATION_PRESETS[normalized];
      if (coords) {
        await updateDriverLocation(userId, coords.lat, coords.lng, locationName.trim());
      }

      hydrate(updated);
      Alert.alert("Saved", "Your quote readiness profile is updated.");
    } catch (error) {
      Alert.alert(
        "Could not save profile",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loadingRoot}>
        <StatusBar barStyle="light-content" backgroundColor={INK} />
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={s.loadingRoot}>
        <StatusBar barStyle="light-content" backgroundColor={INK} />
        <Text style={s.errorText}>Failed to load profile</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />

      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.header}>
          <View style={s.headerTop}>
            <Pressable onPress={() => router.back()}>
              <Text style={s.backBtn}>Back</Text>
            </Pressable>
            <View style={s.logoBadge}>
              <Text style={s.logoText}>RIDE</Text>
            </View>
          </View>
          <Text style={s.title}>Quote readiness</Text>
          <Text style={s.subtitle}>
            Passengers compare confidence fast. Complete your profile so your bids land better.
          </Text>
        </View>

        <View style={s.sheet}>
          <View style={s.heroCard}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={s.heroCopy}>
              <Text style={s.heroName}>{profile.name}</Text>
              <Text style={s.heroMeta}>{profile.email}</Text>
              <Text style={s.heroAccent}>{readinessPercent}% marketplace ready</Text>
            </View>
          </View>

          <View style={s.readinessCard}>
            <Text style={s.cardTitle}>Readiness checklist</Text>
            {readinessItems.map((item) => (
              <View key={item.label} style={s.readinessRow}>
                <Text style={s.readinessLabel}>{item.label}</Text>
                <Text style={[s.readinessValue, item.ready && s.ready]}>
                  {item.ready ? "Ready" : "Missing"}
                </Text>
              </View>
            ))}
          </View>

          <View style={s.formCard}>
            <Text style={s.cardTitle}>Marketplace details</Text>
            <Field
              label="PHONE"
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
            />
            <Field
              label="VEHICLE"
              value={vehicle}
              onChangeText={setVehicle}
              placeholder="Swift Dzire"
            />
            <Field
              label="NUMBER PLATE"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              placeholder="HP 12 AB 1234"
            />
            <Field
              label="OPERATING LOCATION"
              value={locationName}
              onChangeText={setLocationName}
              placeholder="Baddi"
            />
            <Text style={s.helperText}>
              Supported quick-map presets: Baddi, Delhi, Chandigarh, Shimla, Mohali.
            </Text>
            <Pressable
              style={[s.saveButton, saving && s.disabledButton]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={PAPER} size="small" />
              ) : (
                <Text style={s.saveButtonText}>SAVE PROFILE</Text>
              )}
            </Pressable>
          </View>

          <View style={s.summaryCard}>
            <Text style={s.cardTitle}>Current stats</Text>
            <SummaryRow
              label="Rating"
              value={profile.rating ? `${profile.rating.toFixed(1)} ★` : "4.5 ★"}
            />
            <SummaryRow
              label="Acceptance"
              value={
                profile.acceptanceRate !== undefined
                  ? `${profile.acceptanceRate.toFixed(0)}%`
                  : "100%"
              }
            />
            <SummaryRow
              label="Rides completed"
              value={`${profile.totalRides ?? 0}`}
            />
            <SummaryRow
              label="Current location"
              value={profile.currentLocation || "Not set"}
            />
          </View>

          <Pressable style={s.logoutButton} onPress={handleLogout}>
            <Text style={s.logoutButtonText}>LOGOUT</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={s.fieldBlock}>
      <Text style={s.fieldLabel}>{label}</Text>
      <CustomInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={MUTED}
      />
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  loadingRoot: {
    flex: 1,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { paddingBottom: 40 },
  header: {
    backgroundColor: INK,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  backBtn: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: "800",
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
  title: {
    color: PAPER,
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 42,
  },
  subtitle: {
    color: "#B9C1C8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 330,
  },
  sheet: {
    backgroundColor: PAPER,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -8,
    padding: 16,
    gap: 16,
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: PAPER,
    fontSize: 30,
    fontWeight: "900",
  },
  heroCopy: { flex: 1 },
  heroName: {
    color: INK,
    fontSize: 24,
    fontWeight: "900",
  },
  heroMeta: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  heroAccent: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 8,
    letterSpacing: 0.7,
  },
  readinessCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  cardTitle: {
    color: INK,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  readinessRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: RULE,
  },
  readinessLabel: {
    color: INK,
    fontSize: 13,
    fontWeight: "700",
  },
  readinessValue: {
    color: DANGER,
    fontSize: 12,
    fontWeight: "800",
  },
  ready: {
    color: ACCENT,
  },
  formCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  helperText: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 2,
  },
  saveButton: {
    minHeight: 50,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  disabledButton: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: PAPER,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  summaryCard: {
    backgroundColor: ALT_SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: RULE,
  },
  summaryLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
  },
  summaryValue: {
    flex: 1,
    textAlign: "right",
    color: INK,
    fontSize: 12,
    fontWeight: "800",
  },
  logoutButton: {
    minHeight: 52,
    backgroundColor: DANGER,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonText: {
    color: PAPER,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  errorText: {
    color: DANGER,
    fontSize: 16,
    fontWeight: "700",
  },
});
