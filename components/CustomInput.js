import { useState } from "react";
import { StyleSheet, TextInput } from "react-native";

const OLIVE = "#3D4A2E";
const AMBER = "#C8882A";

export default function CustomInput({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = "default",
  style = null,
  placeholderTextColor = "#A89880",
}) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize="none"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.input, focused && styles.inputFocused, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#EDE7D8",
    borderWidth: 1.5,
    borderColor: "#D5CCB8",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 8,
    fontSize: 14,
    color: OLIVE,
    letterSpacing: 0.3,
  },
  inputFocused: {
    borderColor: AMBER,
    backgroundColor: "#F5EFE0",
  },
});
