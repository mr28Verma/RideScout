import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import CustomInput from "@/components/CustomInput";
import { useAuth } from "@/contexts/AuthContext";

// ── Design tokens ─────────────────────────────────────────────────────────────
const INK = "#0A0A0A";
const PAPER = "#FFFFFF";
const RULE = "#D6D6D6";
const MUTED = "#888888";
const ACCENT = "#00C853";

export default function Login() {
  const { isAuthenticated, isRestoring, login, session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isRestoring || !isAuthenticated || !session?.user) return;

    if (!session.user.role) {
      router.replace({
        pathname: "/(auth)/role-selection",
        params: { userId: session.user.id, name: session.user.name },
      });
      return;
    }

    router.replace({
      pathname:
        session.user.role === "driver"
          ? "/(driver)/dashboard"
          : "/(passenger)/dashboard",
      params: { name: session.user.name, userId: session.user.id },
    });
  }, [isAuthenticated, isRestoring, session]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing details", "Please fill all fields");
      return;
    }
    try {
      setLoading(true);
      const authSession = await login({ email, password });
      const user = authSession.user;
      if (!user?.role) {
        router.replace({
          pathname: "/(auth)/role-selection",
          params: { userId: user.id, name: user.name },
        });
        return;
      }
      router.replace({
        pathname:
          user.role === "driver"
            ? "/(driver)/dashboard"
            : "/(passenger)/dashboard",
        params: { name: user.name, userId: user.id },
      });
    } catch (error) {
      Alert.alert(
        "Login failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (isRestoring) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <StatusBar barStyle="light-content" backgroundColor={INK} />
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />

      {/* ── LEFT ACCENT BAR ── */}
      <View style={s.accentBar} />

      {/* ── TOP: black brand section ── */}
      <View style={s.brandSection}>
        <View style={s.topBar}>
          <View style={s.logoBadge}>
            <Text style={s.logoText}>RIDE</Text>
          </View>
        </View>

        <View style={s.brandBody}>
          <Text style={s.headline}>Welcome{"\n"}Back.</Text>
          <Text style={s.subline}>Sign in to your account</Text>
        </View>

        {/* Decorative grid dots */}
        <View style={s.dotGrid}>
          {[...Array(12)].map((_, i) => (
            <View key={i} style={s.gridDot} />
          ))}
        </View>
      </View>

      {/* ── BOTTOM: white form section ── */}
      <View style={s.formSection}>
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
          <View style={s.fieldTagRow}>
            <Text style={s.fieldTag}>PASSWORD</Text>
            <Pressable>
              <Text style={s.forgotLink}>Forgot?</Text>
            </Pressable>
          </View>
          <View style={s.inputBox}>
            <CustomInput
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={MUTED}
            />
          </View>
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [s.signInBtn, pressed && { opacity: 0.8 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={s.signInBtnText}>
            {loading ? "SIGNING IN…" : "SIGN IN"}
          </Text>
          {!loading && (
            <View style={s.signInArrowBox}>
              <Text style={s.signInArrow}>→</Text>
            </View>
          )}
        </Pressable>

        {/* Divider */}
        <View style={s.orRow}>
          <View style={s.orLine} />
          <Text style={s.orText}>OR</Text>
          <View style={s.orLine} />
        </View>

        {/* Sign up */}
        <Pressable
          style={({ pressed }) => [s.signUpBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace("/(auth)/signup")}
        >
          <Text style={s.signUpBtnText}>CREATE AN ACCOUNT</Text>
        </Pressable>

        {/* Provider sign-in buttons */}
        <View style={s.providerRow}>
          <Pressable
            style={s.providerBtn}
            onPress={() => handleProviderSignIn("google")}
          >
            <Text style={s.providerBtnText}>🟦 Continue with Google</Text>
          </Pressable>

          <Pressable
            style={s.providerBtn}
            onPress={() => handleProviderSignIn("apple")}
          >
            <Text style={s.providerBtnText}> Continue with Apple</Text>
          </Pressable>
        </View>

        {/* Terms */}
        <Text style={s.terms}>
          By signing in you agree to our <Text style={s.termsLink}>Terms</Text>{" "}
          &amp; <Text style={s.termsLink}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}

// Provider sign-in handler (stub)
function handleProviderSignIn(provider: string) {
  // Note: implement OAuth via Expo AuthSession / Google / Apple SDKs.
  // This stub simply informs the developer and is safe to call during development.
  alert(
    `Provider sign-in (${provider}) not configured.\n\nTo enable: register an OAuth client, add redirect URIs, and implement AuthSession flow (or backend token exchange).`,
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: INK,
  },

  // Accent bar
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
    flex: 0.45,
    backgroundColor: INK,
    paddingHorizontal: 28,
    paddingTop: 52,
    paddingBottom: 24,
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
  brandBody: {
    flex: 1,
    justifyContent: "center",
  },
  headline: {
    color: PAPER,
    fontSize: 50,
    fontWeight: "900",
    letterSpacing: -2,
    lineHeight: 52,
  },
  subline: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 10,
    letterSpacing: 0.3,
  },
  // Decorative dot grid
  dotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 60,
    gap: 6,
    position: "absolute",
    right: 28,
    bottom: 24,
  },
  gridDot: {
    width: 3,
    height: 3,
    backgroundColor: "#2A2A2A",
  },

  // Form section
  formSection: {
    flex: 0.55,
    backgroundColor: PAPER,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldTagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  fieldTag: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  forgotLink: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
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

  // Sign in button
  signInBtn: {
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingLeft: 22,
    paddingRight: 6,
    marginTop: 4,
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

  // OR divider
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: RULE,
  },
  orText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },

  // Sign up button
  signUpBtn: {
    borderWidth: 1.5,
    borderColor: INK,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 20,
  },
  signUpBtnText: {
    color: INK,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 2,
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
  providerRow: {
    marginTop: 12,
    marginBottom: 12,
    gap: 10,
  },
  providerBtn: {
    borderWidth: 1,
    borderColor: RULE,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 10,
  },
  providerBtnText: {
    color: INK,
    fontWeight: "700",
  },
});
