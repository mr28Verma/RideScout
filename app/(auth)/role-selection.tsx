import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  detectBackendPort,
} from "@/constants/api";
import { useAuth } from "@/contexts/AuthContext";

// Use same design tokens as Login/Signup for visual consistency
const INK = "#0A0A0A";
const PAPER = "#FFFFFF";
const RULE = "#D6D6D6";
const MUTED = "#888888";
const ACCENT = "#00C853";

type RoleType = "passenger" | "driver";

export default function RoleSelection() {
  const { completeRoleSelection } = useAuth();
  const { userId, name } = useLocalSearchParams<{
    userId?: string;
    name?: string;
  }>();
  const [role, setRole] = useState<RoleType>("passenger");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!userId || typeof userId !== "string") {
      Alert.alert("Error", "Missing user info. Please login again.");
      router.replace("/");
      return;
    }

    try {
      setLoading(true);
      await detectBackendPort();
      await completeRoleSelection(role);

      router.replace({
        pathname:
          role === "driver" ? "/(driver)/dashboard" : "/(passenger)/dashboard",
        params: {
          name: typeof name === "string" ? name : "Scout",
          userId,
        },
      });
    } catch (error) {
      console.error(error);
      Alert.alert("Network error", "Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />

      <View style={styles.accentBar} />

      <View style={styles.brandSection}>
        <View style={styles.topBar}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>RIDE</Text>
          </View>
        </View>

        <Text style={styles.headline}>Choose{"\n"}Account Type.</Text>
        <Text style={styles.subline}>
          This is required only once after first login.
        </Text>

        <View style={styles.stepRow}>
          <View style={styles.stepActive} />
          <View style={styles.stepDot} />
          <View style={styles.stepDot} />
        </View>
      </View>

      <View style={styles.formSection}>
        <View style={{ marginBottom: 18 }}>
          <Text style={styles.fieldTag}>ACCOUNT ROLE</Text>

          <Pressable
            style={({ pressed }) => [
              styles.roleBtn,
              role === "passenger" && styles.roleBtnActive,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => setRole("passenger")}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 20, marginRight: 12 }}>🧭</Text>
              <View>
                <Text
                  style={[
                    styles.roleTitle,
                    role === "passenger" && styles.roleTitleActive,
                  ]}
                >
                  Passenger
                </Text>
                <Text style={styles.roleSmall}>
                  Request rides and track drivers in real-time.
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.roleBtn,
              role === "driver" && styles.roleBtnActive,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => setRole("driver")}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 20, marginRight: 12 }}>🚗</Text>
              <View>
                <Text
                  style={[
                    styles.roleTitle,
                    role === "driver" && styles.roleTitleActive,
                  ]}
                >
                  Driver
                </Text>
                <Text style={styles.roleSmall}>
                  Go online to receive rides, navigate to pickups and earn.
                </Text>
              </View>
            </View>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.signInBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleContinue}
          disabled={loading}
        >
          <Text style={styles.signInBtnText}>
            {loading ? "PLEASE WAIT..." : "CONTINUE"}
          </Text>
          {!loading && (
            <View style={styles.signInArrowBox}>
              <Text style={styles.signInArrow}>→</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: INK,
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: ACCENT,
    zIndex: 10,
  },
  brandSection: {
    flex: 0.42,
    backgroundColor: INK,
    paddingHorizontal: 28,
    paddingTop: 52,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
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
  headline: {
    color: PAPER,
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: -2,
    lineHeight: 50,
    marginTop: 8,
  },
  subline: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.3,
    marginTop: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  stepActive: {
    width: 28,
    height: 4,
    backgroundColor: ACCENT,
  },
  stepDot: {
    width: 8,
    height: 4,
    backgroundColor: "#333333",
  },
  formSection: {
    flex: 0.58,
    backgroundColor: PAPER,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
  },
  fieldTag: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  roleBtn: {
    borderWidth: 1.2,
    borderColor: RULE,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: PAPER,
  },
  roleBtnActive: {
    borderColor: ACCENT,
    backgroundColor: "#F2FFF4",
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: INK,
  },
  roleTitleActive: {
    color: ACCENT,
  },
  roleSmall: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
  },
  signInBtn: {
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingLeft: 22,
    paddingRight: 6,
    marginTop: 8,
    marginBottom: 20,
  },
  signInBtnText: {
    color: INK,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 2,
  },
  signInArrowBox: {
    width: 42,
    height: 42,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  signInArrow: {
    color: ACCENT,
    fontSize: 18,
    fontWeight: "300",
  },
});
