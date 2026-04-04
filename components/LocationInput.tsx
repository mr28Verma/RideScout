import { useEffect, useRef, useState } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function LocationInput({
  placeholder,
  setLocation,
  setCoords,
  darkMode = true,
  dotColor = "#00C853",
}: any) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<any>(null);

  const touchingItemRef = useRef(false);

  const fetchLocations = (value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          value,
        )}&format=json&countrycodes=IN&limit=10&dedupe=1`;

        console.log("Fetching:", url);

        const res = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "RideScout-Mobile",
          },
        });

        console.log("Response status:", res.status);

        if (!res.ok) {
          console.warn(`API error: ${res.status}`);
          setSuggestions([]);
          return;
        }

        const data = await res.json();
        console.log("API Results:", data.length);

        if (Array.isArray(data) && data.length > 0) {
          setSuggestions(data);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setSuggestions([]);
      }
    }, 800);
  };

  const handleSelect = (place: any) => {
    touchingItemRef.current = false;

    const shortName = place.display_name.split(",")[0];

    console.log("🎯 handleSelect called:", {
      place,
      shortName,
      hasSetLocation: !!setLocation,
      hasSetCoords: !!setCoords,
    });

    setQuery(shortName);
    setLocation(shortName);

    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);

    console.log("📍 Location Selected:", {
      name: shortName,
      fullName: place.display_name,
      lat,
      lon,
      callingSetCoords: !!setCoords,
    });

    if (setCoords) {
      setCoords({
        lat,
        lon,
      });
      console.log("✅ Coordinates updated");
    } else {
      console.warn("⚠️ setCoords is not defined!");
    }

    setSuggestions([]);
    setFocused(false);

    console.log("🔚 handleSelect finished, state should update in parent");
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!touchingItemRef.current) {
        setSuggestions([]);
        setFocused(false);
      }
    }, 10);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Visual styling based on focus and selection state
  const isSelected = query.length > 0; // Location has been selected

  const borderColor = focused
    ? "#00C853"
    : isSelected
      ? "#00C853"
      : darkMode
        ? "rgba(255,255,255,0.12)"
        : "#D6D6D6";

  const bgColor = darkMode
    ? focused || isSelected
      ? "rgba(0,200,83,0.06)"
      : "rgba(255,255,255,0.06)"
    : focused || isSelected
      ? "#F2F2F2"
      : "#FFFFFF";

  // When a location is selected, show black text for visibility
  const textColor = isSelected ? "#000000" : darkMode ? "#FFFFFF" : "#0A0A0A";

  const showDropdown = suggestions.length > 0;

  return (
    <View style={styles.wrapper}>
      {/* INPUT */}
      <View
        style={[
          styles.inputContainer,
          { backgroundColor: bgColor, borderColor },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: dotColor }]} />

        <TextInput
          value={query}
          onChangeText={fetchLocations}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={darkMode ? "rgba(255,255,255,0.5)" : "#888888"}
          style={[styles.input, { color: textColor }]}
          autoCorrect={false}
          autoCapitalize="none"
          editable={true}
        />

        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery("");
              setLocation("");
              setSuggestions([]);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* DROPDOWN - Inline rendering for mobile */}
      {showDropdown && (
        <View
          style={[
            styles.dropdownInline,
            darkMode ? styles.dropdownDark : styles.dropdownLight,
          ]}
        >
          {suggestions.map((item: any, index: number) => (
            <TouchableOpacity
              key={index.toString()}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
              style={[
                styles.item,
                index < suggestions.length - 1 && {
                  borderBottomWidth: 0.5,
                  borderBottomColor: darkMode
                    ? "rgba(255,255,255,0.07)"
                    : "#D6D6D6",
                },
              ]}
            >
              <Text style={styles.itemPin}>📍</Text>

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.itemPrimary,
                    { color: darkMode ? "#FFFFFF" : "#0A0A0A" },
                  ]}
                  numberOfLines={1}
                >
                  {item.display_name.split(",")[0]}
                </Text>

                <Text
                  style={[
                    styles.itemSecondary,
                    {
                      color: darkMode ? "rgba(255,255,255,0.6)" : "#666666",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.display_name.split(",").slice(1, 3).join(",")}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
  },

  wrapperOpen: {
    zIndex: 1000,
    elevation: 1000,
    marginBottom: 240,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 10,
    zIndex: 10,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 2,
  },

  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    fontSize: 14,
    fontWeight: "500",
  },

  clearIcon: {
    fontSize: 14,
    color: "#888888",
    fontWeight: "600",
  },

  dropdown: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: "#1e1b4b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxHeight: 200,
    minHeight: 80,
    zIndex: 1001,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    overflow: "hidden",
  },

  dropdownInline: {
    backgroundColor: "#1e1b4b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxHeight: 300,
    marginTop: 4,
    marginBottom: 10,
    overflow: "hidden",
  },

  dropdownDark: {
    backgroundColor: "#1a1a2e",
    borderColor: "rgba(255,255,255,0.1)",
  },

  dropdownLight: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D6D6D6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },

  itemPin: {
    fontSize: 16,
    marginRight: 4,
  },

  itemPrimary: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },

  itemSecondary: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
});
