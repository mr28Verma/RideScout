import { TouchableOpacity, Text, StyleSheet, View } from "react-native";

const AMBER = "#C8882A";
const OLIVE = "#3D4A2E";

export default function CustomButton({ title, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={styles.button}
    >
      {/* Left accent stripe */}
      <View style={styles.stripe} />
      <Text style={styles.label}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: OLIVE,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  stripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: AMBER,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  label: {
    color: "#F5EFE0",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 3,
  },
});