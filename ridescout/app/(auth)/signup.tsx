import { View, Text, StyleSheet, StatusBar, Dimensions } from "react-native";
import { useState } from "react";
import { router } from "expo-router";

import CustomInput from "@/components/CustomInput";
import CustomButton from "@/components/CustomButton";

const { width } = Dimensions.get("window");

const OLIVE = "#3D4A2E";
const AMBER = "#C8882A";
const CREAM = "#F5EFE0";
const BARK = "#6B5035";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = () => {
    if (name && email && password) {
      alert("Account created!");
      router.replace("/login");
    } else {
      alert("Please fill all fields");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background blobs — same as Login */}
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      {/* Brand area */}
      <View style={styles.brandArea}>
        <View style={styles.compassRing}>
          <View style={styles.compassInner}>
            <View style={[styles.compassArrow, styles.compassArrowNorth]} />
            <View style={[styles.compassArrow, styles.compassArrowSouth]} />
          </View>
        </View>
        <Text style={styles.brandName}>RIDESCOUT</Text>
        <Text style={styles.brandTagline}>navigate your journey</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.cardHeading}>Create account</Text>
        <Text style={styles.cardSubtext}>Join the scout network today</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>FULL NAME</Text>
          <CustomInput
            placeholder="John Doe"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <CustomInput
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <CustomInput
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <View style={styles.spacer} />

        <CustomButton title="CREATE ACCOUNT" onPress={handleSignup} />

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already a scout? </Text>
          <Text
            style={styles.loginLink}
            onPress={() => router.replace("/(tabs)")}
          >
            Sign in
          </Text>
        </View>
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

  // Brand
  brandArea: {
    alignItems: "center",
    marginBottom: 30,
  },
  compassRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: AMBER,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  compassInner: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  compassArrow: {
    position: "absolute",
    width: 0,
    height: 0,
  },
  compassArrowNorth: {
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: AMBER,
    bottom: "50%",
  },
  compassArrowSouth: {
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: CREAM,
    top: "50%",
  },
  brandName: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 6,
    color: CREAM,
  },
  brandTagline: {
    fontSize: 12,
    letterSpacing: 3,
    color: AMBER,
    marginTop: 4,
    textTransform: "uppercase",
  },

  // Card
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
    marginTop: 4,
    marginBottom: 24,
    letterSpacing: 0.3,
  },

  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: BARK,
    marginBottom: 6,
  },

  spacer: {
    height: 8,
  },

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },
  loginText: {
    fontSize: 13,
    color: BARK,
  },
  loginLink: {
    fontSize: 13,
    color: OLIVE,
    fontWeight: "700",
  },
});