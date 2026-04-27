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

import CustomInput from "@/components/CustomInput";
import { detectBackendPort } from "@/constants/api";
import {
  UserProfile,
  fetchUserProfile,
  logout,
  updateUserProfile,
} from "@/services/profileApi";

// ── Design tokens ─────────────────────────────────────────────────────────────
const INK = "#0A0A0A";
const PAPER = "#FFFFFF";
const SURFACE = "#F2F2F2";
const RULE = "#D6D6D6";
const MUTED = "#888888";
const ACCENT = "#00C853";

export default function PassengerProfile() {
  const { userId: userIdParam } = useLocalSearchParams<{
    userId?: string;
    name?: string;
  }>();

  const userId = typeof userIdParam === "string" ? userIdParam : "";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

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
        console.log(`[Profile] Loading profile for userId: ${userId}`);
        const data = await fetchUserProfile(userId);
        console.log(`[Profile] Profile loaded successfully:`, data);
        setProfile(data);
        setEditName(data.name);
      } catch (error) {
        console.error("Failed to load profile:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("[Profile] Error details:", errorMsg);
        Alert.alert("Error", errorMsg || "Failed to load your profile");
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

  const handleSaveProfile = async () => {
    const nextName = editName.trim();

    if (!nextName) {
      Alert.alert("Invalid name", "Please enter your name.");
      return;
    }

    try {
      setSavingProfile(true);
      const updatedProfile = await updateUserProfile(userId, {
        name: nextName,
      });
      setProfile(updatedProfile);
      setEditName(updatedProfile.name);
      setIsEditing(false);
      Alert.alert("Profile updated", "Your name has been saved.");
    } catch (error) {
      Alert.alert(
        "Update failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSavingProfile(false);
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
            <Text style={s.headerTitle}>My Profile</Text>
            <View style={{ width: 50 }} />
          </View>
        </View>

        {/* ── PROFILE CARD ── */}
        <View style={s.profileCard}>
          <View style={s.avatarSection}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={s.profileName}>{profile.name}</Text>
            <Text style={s.profileRole}>Passenger</Text>
          </View>

          {/* ── INFO SECTION ── */}
          <View style={s.infoSection}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>EMAIL</Text>
              <Text style={s.infoValue}>{profile.email}</Text>
            </View>
            <View style={s.divider} />
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>MEMBER SINCE</Text>
              <Text style={s.infoValue}>
                {profile.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString()
                  : "N/A"}
              </Text>
            </View>
          </View>

          {/* ── EDIT SECTION ── */}
          {isEditing ? (
            <View style={s.editSection}>
              <Text style={s.editTitle}>Edit Name</Text>
              <View style={s.inputBox}>
                <CustomInput
                  placeholder="Full Name"
                  value={editName}
                  onChangeText={setEditName}
                  placeholderTextColor={MUTED}
                />
              </View>
              <View style={s.buttonRow}>
                <Pressable
                  style={[s.cancelBtn, { flex: 1, marginRight: 8 }]}
                  onPress={() => {
                    setIsEditing(false);
                    setEditName(profile.name);
                  }}
                >
                  <Text style={s.cancelBtnText}>CANCEL</Text>
                </Pressable>
                <Pressable
                  style={[s.saveBtn, { flex: 1 }]}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator color={PAPER} size="small" />
                  ) : (
                    <Text style={s.saveBtnText}>SAVE</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={s.editBtn} onPress={() => setIsEditing(true)}>
              <Text style={s.editBtnText}>EDIT PROFILE</Text>
            </Pressable>
          )}
        </View>

        {/* ── ACTIONS ── */}
        <View style={s.actionsSection}>
          <Pressable style={s.actionItem}>
            <Text style={s.actionIcon}>📍</Text>
            <View style={s.actionContent}>
              <Text style={s.actionTitle}>Saved Locations</Text>
              <Text style={s.actionSubtitle}>Manage your favorite places</Text>
            </View>
            <Text style={s.actionArrow}>›</Text>
          </Pressable>

          <Pressable style={s.actionItem}>
            <Text style={s.actionIcon}>💳</Text>
            <View style={s.actionContent}>
              <Text style={s.actionTitle}>Payment Methods</Text>
              <Text style={s.actionSubtitle}>
                Add or remove payment options
              </Text>
            </View>
            <Text style={s.actionArrow}>›</Text>
          </Pressable>

          <Pressable style={s.actionItem}>
            <Text style={s.actionIcon}>🚨</Text>
            <View style={s.actionContent}>
              <Text style={s.actionTitle}>Emergency Contacts</Text>
              <Text style={s.actionSubtitle}>
                People to contact in case of emergency
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
  profileRole: {
    fontSize: 14,
    color: MUTED,
  },

  // Info Section
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoRow: {
    marginVertical: 12,
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
  divider: {
    height: 1,
    backgroundColor: RULE,
    marginVertical: 8,
  },

  // Edit Section
  editSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: RULE,
  },
  editTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: INK,
    marginTop: 16,
    marginBottom: 8,
  },
  inputBox: {
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  input: {
    fontSize: 16,
    color: INK,
  },
  buttonRow: {
    flexDirection: "row",
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: INK,
  },
  saveBtn: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: PAPER,
  },

  // Edit Button
  editBtn: {
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: ACCENT,
    borderRadius: 8,
    alignItems: "center",
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
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
    backgroundColor: "#FF3B30",
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
    color: "#FF3B30",
    textAlign: "center",
    marginTop: 32,
  },

  spacer: {
    height: 40,
  },
});
