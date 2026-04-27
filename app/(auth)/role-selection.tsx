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

import CustomButton from "@/components/CustomButton";
import { API_JSON_HEADERS, detectBackendPort, getApiBaseUrl } from "@/constants/api";

const OLIVE = "#3D4A2E";
const AMBER = "#C8882A";
const CREAM = "#F5EFE0";
const BARK = "#6B5035";

type RoleType = "passenger" | "driver";

export default function RoleSelection() {
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

      // Detect backend port first
      console.log("[RoleSelection] Detecting backend port...");
      await detectBackendPort();
      console.log("[RoleSelection] Backend port detected, making API call...");

      const apiUrl = getApiBaseUrl();
      console.log(`[RoleSelection] Connecting to: ${apiUrl}/api/auth/role`);

      const response = await fetch(`${apiUrl}/api/auth/role`, {
        method: "PATCH",
        headers: API_JSON_HEADERS,
        body: JSON.stringify({ userId, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert("Role update failed", data.message || "Please try again.");
        return;
      }

      router.replace({
        pathname:
          role === "driver" ? "/(driver)/dashboard" : "/(passenger)/dashboard",
        params: {
          name: typeof name === "string" ? name : "Scout",
          userId,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[RoleSelection Error]", errorMsg);
      Alert.alert(
        "Network error",
        "Unable to connect to server. Make sure the backend is running on your local machine.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <View style={styles.card}>
        <Text style={styles.cardHeading}>Choose your account type</Text>
        <Text style={styles.cardSubtext}>
          This is required only once after first login.
        </Text>

        <View style={styles.roleRow}>
          <Pressable
            style={[
              styles.roleOption,
              role === "passenger" && styles.roleOptionActive,
            ]}
            onPress={() => setRole("passenger")}
          >
            <Text
              style={[
                styles.roleOptionText,
                role === "passenger" && styles.roleOptionTextActive,
              ]}
            >
              Passenger
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.roleOption,
              role === "driver" && styles.roleOptionActive,
            ]}
            onPress={() => setRole("driver")}
          >
            <Text
              style={[
                styles.roleOptionText,
                role === "driver" && styles.roleOptionTextActive,
              ]}
            >
              Driver
            </Text>
          </Pressable>
        </View>

        <CustomButton
          title={loading ? "PLEASE WAIT..." : "CONTINUE"}
          onPress={handleContinue}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OLIVE,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  blobTop: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#4E5E38",
    opacity: 0.6,
  },
  blobBottom: {
    position: "absolute",
    bottom: -100,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#2E3820",
    opacity: 0.8,
  },
  card: {
    backgroundColor: CREAM,
    borderRadius: 20,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeading: {
    fontSize: 22,
    fontWeight: "800",
    color: OLIVE,
    letterSpacing: 0.5,
  },
  cardSubtext: {
    fontSize: 13,
    color: BARK,
    marginTop: 6,
    marginBottom: 18,
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  roleOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D8C9A4",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#F8F3E8",
  },
  roleOptionActive: {
    borderColor: AMBER,
    backgroundColor: "#F0E0BE",
  },
  roleOptionText: {
    color: BARK,
    fontWeight: "700",
    fontSize: 13,
  },
  roleOptionTextActive: {
    color: OLIVE,
  },
});
