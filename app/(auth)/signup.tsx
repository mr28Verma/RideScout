import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import CustomInput from "@/components/CustomInput";
import { detectBackendPort, getApiBaseUrl } from "@/constants/api";

// ── Design tokens ─────────────────────────────────────────────────────────────
const INK = "#0A0A0A";
const PAPER = "#FFFFFF";
const SURFACE = "#F2F2F2";
const RULE = "#D6D6D6";
const MUTED = "#888888";
const ACCENT = "#00C853";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert("Missing details", "Please fill all fields");
      return;
    }
    try {
      setLoading(true);
      await detectBackendPort();
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Signup failed", data.message || "Please try again.");
        return;
      }
      Alert.alert("Success", "Account created! Please login.");
      router.replace("/");
    } catch (error) {
      Alert.alert("Network error", "Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />

      {/* ── LEFT ACCENT BAR ── */}
      <View style={s.accentBar} />

      {/* ── TOP HALF: black brand area ── */}
      <View style={s.brandSection}>
        <View style={s.topBar}>
          <View style={s.logoBadge}>
            <Text style={s.logoText}>RIDE</Text>
          </View>
        </View>

        <Text style={s.headline}>Create{"\n"}Account.</Text>
        <Text style={s.subline}>Join thousands of riders today</Text>

        {/* Decorative step indicators */}
        <View style={s.stepRow}>
          <View style={s.stepActive} />
          <View style={s.stepDot} />
          <View style={s.stepDot} />
        </View>
      </View>

      {/* ── BOTTOM HALF: white form ── */}
      <View style={s.formSection}>
        {/* Name */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldTag}>FULL NAME</Text>
          <View style={s.inputBox}>
            <CustomInput
              placeholder="John Doe"
              value={name}
              onChangeText={setName}
              placeholderTextColor={MUTED}
            />
          </View>
        </View>

        {/* Email */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldTag}>EMAIL ADDRESS</Text>
          <View style={s.inputBox}>
            <CustomInput
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholderTextColor={MUTED}
            />
          </View>
        </View>

        {/* Password */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldTag}>PASSWORD</Text>
          <View style={s.inputBox}>
            <CustomInput
              placeholder="Min. 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={MUTED}
            />
          </View>
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [s.createBtn, pressed && { opacity: 0.8 }]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={s.createBtnText}>
            {loading ? "CREATING…" : "CREATE ACCOUNT"}
          </Text>
          {!loading && (
            <View style={s.createBtnArrowBox}>
              <Text style={s.createBtnArrow}>→</Text>
            </View>
          )}
        </Pressable>

        {/* Sign in link */}
        <View style={s.signinRow}>
          <Text style={s.signinText}>Already have an account? </Text>
          <Pressable onPress={() => router.replace("/")}>
            <Text style={s.signinLink}>Sign in</Text>
          </Pressable>
        </View>

        {/* Terms */}
        <Text style={s.terms}>
          By creating an account you agree to our{" "}
          <Text style={s.termsLink}>Terms of Service</Text> &amp;{" "}
          <Text style={s.termsLink}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: INK,
  },

  // Left accent bar
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: ACCENT,
    zIndex: 10,
  },

  // Brand section
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

  // Form section
  formSection: {
    flex: 0.58,
    backgroundColor: PAPER,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldTag: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  inputBox: {
    borderBottomWidth: 1.5,
    borderBottomColor: RULE,
  },
  input: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: "600",
    color: INK,
  },

  // CTA button
  createBtn: {
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
  createBtnText: {
    color: INK,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 2,
  },
  createBtnArrowBox: {
    width: 42,
    height: 42,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnArrow: {
    color: ACCENT,
    fontSize: 18,
    fontWeight: "300",
  },

  // Sign in
  signinRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  signinText: {
    color: MUTED,
    fontSize: 13,
  },
  signinLink: {
    color: INK,
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
  },

  // Terms
  terms: {
    color: MUTED,
    fontSize: 10,
    textAlign: "center",
    letterSpacing: 0.2,
    lineHeight: 15,
  },
  termsLink: {
    color: INK,
    fontWeight: "700",
  },
});
