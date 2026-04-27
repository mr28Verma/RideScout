import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

import LocationInput from "@/components/LocationInput";
import { detectBackendPort } from "@/constants/api";
import {
  emitNewRideRequest,
  joinRideRoom,
  listenForDriverAccepted,
  listenForDriverLocation,
  listenForRideStatus,
  listenForTripCompleted,
  listenForTripStarted,
  startRideSimulation,
} from "@/services/passengerSocket";
import { processPayment } from "@/services/payment";
import {
  DriverInfo,
  RideStatus,
  bookRide,
  estimateFare,
  fetchNearbyDrivers,
} from "@/services/rideApi";

// ── Design tokens ─────────────────────────────────────────────────────────────
const INK = "#0A0A0A";
const PAPER = "#FFFFFF";
const SURFACE = "#F2F2F2";
const RULE = "#D6D6D6";
const MUTED = "#888888";
const ACCENT = "#00C853";
const ACCENT_DIM = "#00C85320";
const DANGER = "#DC2626";
const SEARCH_TIMEOUT_MS = 45_000;

type RideTypeId = "bike" | "mini" | "sedan" | "suv";

type RideType = {
  id: RideTypeId;
  label: string;
  capacity: string;
  multiplier: number;
  etaOffset: number;
};

const RIDE_TYPES: RideType[] = [
  {
    id: "bike",
    label: "Bike",
    capacity: "1 seat",
    multiplier: 0.55,
    etaOffset: 1,
  },
  {
    id: "mini",
    label: "Mini",
    capacity: "4 seats",
    multiplier: 1,
    etaOffset: 3,
  },
  {
    id: "sedan",
    label: "Sedan",
    capacity: "4 seats",
    multiplier: 1.25,
    etaOffset: 4,
  },
  {
    id: "suv",
    label: "SUV",
    capacity: "6 seats",
    multiplier: 1.65,
    etaOffset: 6,
  },
];

export default function PassengerDashboard() {
  const { name: nameParam, userId: userIdParam } = useLocalSearchParams<{
    name?: string;
    userId?: string;
  }>();

  const userId = typeof userIdParam === "string" ? userIdParam : "";
  const firstName =
    typeof nameParam === "string" && nameParam.trim().length > 0
      ? nameParam.split(" ")[0]
      : "Scout";

  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [pickupCoords, setPickupCoords] = useState({
    lat: 28.6139,
    lon: 77.209,
  });
  const [dropCoords, setDropCoords] = useState({ lat: 28.5355, lon: 77.391 });
  const [fare, setFare] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<DriverInfo[]>([]);
  const [rideStatus, setRideStatus] = useState<RideStatus | null>(null);
  const [activeRideId, setActiveRideId] = useState<string>("");
  const [trackingText, setTrackingText] = useState("Awaiting booking");
  const [isEstimating, setIsEstimating] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverInfo | null>(null);
  const [selectedRideTypeId, setSelectedRideTypeId] =
    useState<RideTypeId>("mini");
  const [estimateError, setEstimateError] = useState("");
  const [routeResetKey, setRouteResetKey] = useState(0);
  const [isLocatingPickup, setIsLocatingPickup] = useState(false);
  const [canQuickRetry, setCanQuickRetry] = useState(false);
  const bookingInFlightRef = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    detectBackendPort().catch(() => console.warn("Port detection failed"));
  }, []);

  useEffect(() => {
    // Optionally fetch drivers on mount with default location
    fetchNearbyDrivers(pickupCoords.lat, pickupCoords.lon)
      .then(setNearbyDrivers)
      .catch(() => setNearbyDrivers([]));
  }, [pickupCoords.lat, pickupCoords.lon]);

  // Debug: Log when pickup or drop changes
  useEffect(() => {
    console.log("🔄 Location state updated:", { pickup, drop });
  }, [pickup, drop]);

  useEffect(() => {
    if (!activeRideId) return;
    const u: (() => void)[] = [];
    u.push(
      listenForRideStatus((e: any) => {
        if (e.rideId !== activeRideId) return;
        setRideStatus(e.status);
      }),
    );
    u.push(
      listenForDriverLocation((e: any) => {
        if (e.rideId !== activeRideId) return;
        setTrackingText(
          `Live · (${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}) · ${e.heading}°`,
        );
      }),
    );
    u.push(
      listenForDriverAccepted((d: any) => {
        if (d.rideId !== activeRideId) return;
        setRideStatus("accepted");
        setTrackingText(`${d.driverName} · ${d.vehicle} · ★${d.rating}`);
      }),
    );
    u.push(
      listenForTripStarted((d: any) => {
        if (d.rideId !== activeRideId) return;
        setRideStatus("on_trip");
        setTrackingText("Driver is on the way with you");
      }),
    );
    u.push(
      listenForTripCompleted((d: any) => {
        if (d.rideId !== activeRideId) return;
        setRideStatus("completed");
        setTrackingText("Trip completed");
      }),
    );
    return () => u.forEach((fn) => fn());
  }, [activeRideId]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    if (!activeRideId || rideStatus !== "searching") {
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      Alert.alert(
        "No drivers yet",
        "No driver accepted your ride in time. You can try again with another ride type.",
      );
      setRideStatus(null);
      setActiveRideId("");
      setTrackingText("No driver found. Try again.");
      setCanQuickRetry(true);
    }, SEARCH_TIMEOUT_MS);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, [activeRideId, rideStatus]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const statusLabel = useMemo(() => {
    const map: Record<string, string> = {
      searching: "SEARCHING",
      accepted: "ACCEPTED",
      on_trip: "ON TRIP",
      completed: "COMPLETED",
    };
    return rideStatus ? (map[rideStatus] ?? rideStatus.toUpperCase()) : "—";
  }, [rideStatus]);

  const statusAccent = useMemo(() => {
    if (!rideStatus || rideStatus === "searching") return MUTED;
    if (rideStatus === "completed" || rideStatus === "on_trip") return ACCENT;
    return INK;
  }, [rideStatus]);

  const selectedRideType = useMemo(
    () =>
      RIDE_TYPES.find((rideType) => rideType.id === selectedRideTypeId) ??
      RIDE_TYPES[1],
    [selectedRideTypeId],
  );

  const finalFare = useMemo(() => {
    if (!fare) return null;
    return Math.max(1, Math.round(fare * selectedRideType.multiplier));
  }, [fare, selectedRideType.multiplier]);

  const estimateRideEta = (rideType: RideType) => {
    const distanceFactor = distance
      ? Math.min(14, Math.round(distance * 1.2))
      : 5;
    return `${Math.max(2, distanceFactor + rideType.etaOffset)} min`;
  };

  const estimateDriverEta = (driverIndex: number) => {
    const typeOffset =
      selectedRideType.id === "bike" ? 0 : selectedRideType.etaOffset;
    return `${Math.max(2, typeOffset + driverIndex * 2 + 3)} min`;
  };

  const resetRoute = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    setPickup("");
    setDrop("");
    setPickupCoords({ lat: 28.6139, lon: 77.209 });
    setDropCoords({ lat: 28.5355, lon: 77.391 });
    setFare(null);
    setDistance(null);
    setSelectedDriver(null);
    setSelectedRideTypeId("mini");
    setRideStatus(null);
    setActiveRideId("");
    setTrackingText("Awaiting booking");
    setCanQuickRetry(false);
    setEstimateError("");
    setRouteResetKey((value) => value + 1);
  };

  const cancelActiveSearch = () => {
    if (rideStatus !== "searching") return;

    Alert.alert("Cancel search", "Stop searching for drivers?", [
      { text: "Keep searching", style: "cancel" },
      {
        text: "Cancel ride",
        style: "destructive",
        onPress: () => {
          if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = null;
          }
          setRideStatus(null);
          setActiveRideId("");
          setTrackingText("Ride search cancelled.");
          setCanQuickRetry(true);
        },
      },
    ]);
  };

  const useCurrentLocation = async () => {
    try {
      setIsLocatingPickup(true);
      setEstimateError("");

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setEstimateError(
          "Location permission is needed to use current pickup.",
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };

      let label = "Current location";
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: coords.lat,
          longitude: coords.lon,
        });

        if (address) {
          label = [
            address.name,
            address.street,
            address.district,
            address.city,
            address.region,
          ]
            .filter(Boolean)
            .slice(0, 3)
            .join(", ");
        }
      } catch {
        label = `Current location (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})`;
      }

      setPickup(label || "Current location");
      setPickupCoords(coords);
      setFare(null);
      setDistance(null);
      setSelectedDriver(null);
      setRouteResetKey((value) => value + 1);
    } catch (error) {
      setEstimateError(
        error instanceof Error
          ? error.message
          : "Could not get current location.",
      );
    } finally {
      setIsLocatingPickup(false);
    }
  };

  const handleEstimate = async () => {
    console.log("🟡 Estimate button pressed");
    console.log("📍 Current state:", {
      pickup,
      drop,
      pickupCoords,
      dropCoords,
    });

    // Simple validation: just check if strings are non-empty
    const pickupValid = pickup && pickup.trim().length > 0;
    const dropValid = drop && drop.trim().length > 0;

    if (!pickupValid) {
      console.warn("❌ Pickup validation failed:", { pickup });
      setEstimateError("Please select a pickup location.");
      return;
    }
    if (!dropValid) {
      console.warn("❌ Drop validation failed:", { drop });
      setEstimateError("Please select a destination.");
      return;
    }

    console.log("✅ Validation passed, proceeding with estimate");

    try {
      setIsEstimating(true);
      setEstimateError("");
      setFare(null);
      setDistance(null);
      setSelectedDriver(null);
      setCanQuickRetry(false);
      console.log("📍 Frontend - Sending estimate request:", {
        pickup,
        drop,
        pickupCoords,
        dropCoords,
      });

      const data = await estimateFare(
        pickup,
        drop,
        pickupCoords.lat,
        pickupCoords.lon,
        dropCoords.lat,
        dropCoords.lon,
      );

      console.log("✅ Fare estimate response:", data);

      setFare(data.estimatedFare);
      setDistance(data.distanceKm);

      // Fetch nearby drivers based on pickup location
      const drivers = await fetchNearbyDrivers(
        pickupCoords.lat,
        pickupCoords.lon,
      );
      setNearbyDrivers(drivers);
      if (drivers.length > 0) {
        setCanQuickRetry(false);
      }
    } catch (e) {
      console.error("❌ Estimation error:", e);
      setEstimateError(e instanceof Error ? e.message : "Estimation failed");
    } finally {
      setIsEstimating(false);
    }
  };

  const handleQuickRetry = async () => {
    const rideTypeOrder: RideTypeId[] = ["mini", "bike", "sedan", "suv"];
    const currentTypeIndex = rideTypeOrder.indexOf(selectedRideTypeId);
    const nextType =
      rideTypeOrder[
        (currentTypeIndex + 1 + rideTypeOrder.length) % rideTypeOrder.length
      ];

    setSelectedRideTypeId(nextType);
    setSelectedDriver(null);
    setTrackingText(
      `Retrying with ${nextType.toUpperCase()} · fetching fresh nearby drivers...`,
    );
    setCanQuickRetry(false);
    await handleEstimate();
  };

  const handleSelectDriver = (driver: DriverInfo) => {
    setSelectedDriver(driver);
  };

  const handleBookRide = async () => {
    if (bookingInFlightRef.current) {
      return;
    }
    if (!userId) {
      alert("Session expired.");
      router.replace("/");
      return;
    }
    if (!pickup || !drop) {
      alert("Enter both locations.");
      return;
    }
    if (!finalFare) {
      Alert.alert("Estimate fare first", "Please get a fare estimate first.");
      return;
    }
    if (!selectedDriver) {
      Alert.alert("Select a ride", "Choose a driver before booking.");
      return;
    }
    try {
      bookingInFlightRef.current = true;
      setIsBooking(true);
      const booked = await bookRide({
        passengerId: userId,
        pickup,
        drop,
        estimatedFare: finalFare,
        paymentMethod: "mock",
      });
      const rideId = booked.ride._id;
      setActiveRideId(rideId);
      setRideStatus("searching");
      setTrackingText("Searching for nearby drivers…");
      joinRideRoom(rideId, userId);
      emitNewRideRequest({
        rideId,
        passengerId: userId,
        passengerName: firstName,
        pickupLocation: pickup,
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lon,
        drop,
        dropLat: dropCoords.lat,
        dropLng: dropCoords.lon,
        fare: finalFare,
      });
      startRideSimulation(rideId);
      await processPayment("mock", {
        amount: finalFare,
        currency: "INR",
        rideId,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setIsBooking(false);
      bookingInFlightRef.current = false;
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />

      {/* ── HEADER ── */}
      <View style={s.header}>
        <View style={s.topBar}>
          <View style={s.logoBadge}>
            <Text style={s.logoText}>RIDE</Text>
          </View>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(passenger)/profile",
                params: { userId, name: firstName },
              })
            }
          >
            <View style={s.profileDot}>
              <Text style={s.profileInitial}>{firstName[0].toUpperCase()}</Text>
            </View>
          </Pressable>
        </View>
        <Text style={s.greeting}>Where to?</Text>
        <Text style={s.subGreeting}>Good to see you, {firstName}</Text>
      </View>

      {/* ── SHEET ── */}
      <ScrollView
        style={s.sheet}
        contentContainerStyle={s.sheetContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Route input */}
        <View style={s.routeBlock}>
          <View style={s.routeHeader}>
            <Text style={s.sectionTitle}>ROUTE</Text>
            <Pressable onPress={resetRoute}>
              <Text style={s.resetText}>RESET</Text>
            </Pressable>
          </View>
          <View style={s.routeRow}>
            <View style={s.routeIconCol}>
              <View style={s.dotPickup} />
              <View style={s.routeConnector} />
            </View>
            <View style={s.routeField}>
              <Text style={s.fieldTag}>PICKUP</Text>
              <LocationInput
                key={`pickup-input-${routeResetKey}`}
                placeholder="Current location"
                value={pickup}
                setLocation={setPickup}
                setCoords={setPickupCoords}
                darkMode={true}
                dotColor="#00C853"
              />
              <Pressable
                style={({ pressed }) => [
                  s.currentLocationBtn,
                  pressed && s.pressed,
                ]}
                onPress={useCurrentLocation}
                disabled={isLocatingPickup}
              >
                <Text style={s.currentLocationText}>
                  {isLocatingPickup ? "LOCATING..." : "USE CURRENT LOCATION"}
                </Text>
                {isLocatingPickup && (
                  <ActivityIndicator color={ACCENT} size="small" />
                )}
              </Pressable>
            </View>
          </View>
          <View style={s.fieldDivider} />
          <View style={s.routeRow}>
            <View style={s.routeIconCol}>
              <View style={s.dotDrop} />
            </View>
            <View style={s.routeField}>
              <Text style={s.fieldTag}>DESTINATION</Text>
              <LocationInput
                key={`drop-input-${routeResetKey}`}
                placeholder="Where are you going?"
                value={drop}
                setLocation={setDrop}
                setCoords={setDropCoords}
                darkMode={true}
                dotColor="#FF5252"
              />
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              s.estimateStrip,
              pressed && s.pressed,
              isEstimating && s.estimateStripDisabled,
            ]}
            onPress={handleEstimate}
            disabled={isEstimating}
          >
            <Text style={s.estimateStripLabel}>
              {isEstimating ? "CALCULATING…" : "GET FARE ESTIMATE"}
            </Text>
            {isEstimating ? (
              <ActivityIndicator color={PAPER} size="small" />
            ) : (
              <Text style={s.estimateArrow}>↗</Text>
            )}
          </Pressable>
          {estimateError.length > 0 && (
            <View style={s.estimateErrorBox}>
              <Text style={s.estimateErrorText}>{estimateError}</Text>
            </View>
          )}
          {isEstimating && (
            <View style={s.estimateHintBox}>
              <Text style={s.estimateHintText}>
                Checking route, distance, fare and nearby drivers...
              </Text>
            </View>
          )}
        </View>

        {/* Metrics */}
        <View style={s.metricsStrip}>
          <View style={s.metricCell}>
            <Text style={s.metricTag}>FARE</Text>
            <Text style={s.metricBig}>{fare ? `₹${fare}` : "—"}</Text>
            <Text style={s.metricSub}>
              {distance ? `${distance} km` : "Not estimated"}
            </Text>
          </View>
          <View style={s.metricDivider} />
          <View style={s.metricCell}>
            <Text style={s.metricTag}>STATUS</Text>
            <Text style={[s.metricBig, { color: statusAccent, fontSize: 15 }]}>
              {statusLabel}
            </Text>
            <Text style={s.metricSub} numberOfLines={2}>
              {trackingText}
            </Text>
          </View>
        </View>

        {(rideStatus === "searching" || rideStatus === "accepted") && (
          <View style={s.liveStatusCard}>
            <View style={s.liveStatusDot} />
            <View style={s.liveStatusContent}>
              <Text style={s.liveStatusTitle}>
                {rideStatus === "searching"
                  ? "Finding your driver"
                  : "Driver accepted your ride"}
              </Text>
              <Text style={s.liveStatusSubtitle}>
                {rideStatus === "searching"
                  ? "Stay on this screen while we connect you."
                  : "Get ready. Your trip will start soon."}
              </Text>
            </View>
          </View>
        )}

        {/* Ride types */}
        {fare && (
          <View style={s.rideTypesSection}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>CHOOSE RIDE TYPE</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.rideTypesScroll}
            >
              {RIDE_TYPES.map((rideType) => {
                const typeFare = Math.max(
                  1,
                  Math.round(fare * rideType.multiplier),
                );
                const selected = selectedRideTypeId === rideType.id;

                return (
                  <Pressable
                    key={rideType.id}
                    style={[s.rideTypeCard, selected && s.rideTypeCardSelected]}
                    onPress={() => {
                      setSelectedRideTypeId(rideType.id);
                      setSelectedDriver(null);
                    }}
                  >
                    <Text style={s.rideTypeName}>{rideType.label}</Text>
                    <Text style={s.rideTypeMeta}>{rideType.capacity}</Text>
                    <Text style={s.rideTypeFare}>Rs {typeFare}</Text>
                    <Text style={s.rideTypeEta}>
                      {estimateRideEta(rideType)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Nearby drivers / Ride Selection */}
        {fare && nearbyDrivers.length > 0 && (
          <View style={s.driversSection}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>SELECT A RIDE</Text>
              <View style={s.countBadge}>
                <Text style={s.countText}>{nearbyDrivers.length}</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.driversScroll}
            >
              {nearbyDrivers.map((d, index) => (
                <Pressable
                  key={d.id}
                  style={[
                    s.driverCard,
                    selectedDriver?.id === d.id && s.driverCardSelected,
                  ]}
                  onPress={() => handleSelectDriver(d)}
                >
                  <View style={s.driverIconBox}>
                    <Text style={s.driverIcon}>🚗</Text>
                  </View>
                  <Text style={s.driverName}>{d.name}</Text>
                  <Text style={s.driverVehicle}>{d.vehicle}</Text>
                  <Text style={s.driverEta}>{estimateDriverEta(index)}</Text>
                  <Text style={s.ratingText}>★ {d.rating}</Text>
                  {selectedDriver?.id === d.id && (
                    <View style={s.selectedCheckmark}>
                      <Text style={s.checkmarkIcon}>✓</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {fare && nearbyDrivers.length === 0 && (
          <View style={s.emptyDriversSection}>
            <Text style={s.sectionTitle}>SELECT A RIDE</Text>
            <Text style={s.emptyDriversText}>
              No nearby drivers are available right now.
            </Text>
          </View>
        )}

        {fare && (
          <View style={s.summarySection}>
            <Text style={s.sectionTitle}>BOOKING SUMMARY</Text>
            <View style={s.summaryCard}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Ride</Text>
                <Text style={s.summaryValue}>{selectedRideType.label}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>ETA</Text>
                <Text style={s.summaryValue}>
                  {selectedDriver ? "Driver " : "Ride "}
                  {selectedDriver
                    ? estimateDriverEta(
                        nearbyDrivers.findIndex(
                          (driver) => driver.id === selectedDriver.id,
                        ),
                      )
                    : estimateRideEta(selectedRideType)}
                </Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Driver</Text>
                <Text style={s.summaryValue}>
                  {selectedDriver
                    ? `${selectedDriver.name} - ${selectedDriver.vehicle}`
                    : "Not selected"}
                </Text>
              </View>
              <View style={s.summaryDividerLine} />
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Total</Text>
                <Text style={s.summaryFare}>Rs {finalFare}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Book CTA */}
        <View style={s.ctaWrap}>
          <Pressable
            style={({ pressed }) => [
              s.bookBtn,
              pressed && s.pressed,
              (!finalFare || !selectedDriver) && s.bookBtnDisabled,
            ]}
            onPress={handleBookRide}
            disabled={
              !finalFare ||
              !selectedDriver ||
              isBooking ||
              bookingInFlightRef.current ||
              rideStatus === "searching" ||
              rideStatus === "accepted" ||
              rideStatus === "on_trip"
            }
          >
            {isBooking ? (
              <ActivityIndicator color={INK} />
            ) : (
              <>
                <Text style={s.bookBtnText}>
                  {rideStatus === "searching"
                    ? "SEARCHING DRIVER..."
                    : rideStatus === "accepted" || rideStatus === "on_trip"
                      ? "RIDE IN PROGRESS"
                      : !finalFare
                        ? "GET FARE FIRST"
                        : selectedDriver
                          ? "CONFIRM & BOOK"
                          : "SELECT A RIDE"}
                </Text>
                <View style={s.bookBtnArrowBox}>
                  <Text style={s.bookBtnArrow}>→</Text>
                </View>
              </>
            )}
          </Pressable>
          {rideStatus === "searching" && (
            <Pressable style={s.cancelSearchBtn} onPress={cancelActiveSearch}>
              <Text style={s.cancelSearchBtnText}>CANCEL SEARCH</Text>
            </Pressable>
          )}
          {canQuickRetry && rideStatus !== "searching" && (
            <View style={s.quickRetryBox}>
              <Text style={s.quickRetryText}>
                No driver matched quickly. Try a different ride type now.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  s.quickRetryBtn,
                  pressed && s.pressed,
                  isEstimating && s.quickRetryBtnDisabled,
                ]}
                onPress={handleQuickRetry}
                disabled={isEstimating}
              >
                <Text style={s.quickRetryBtnText}>
                  {isEstimating ? "RETRYING..." : "QUICK RETRY WITH NEXT TYPE"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Pressable
            style={s.footerRow}
            onPress={() =>
              router.push({
                pathname: "/(passenger)/profile",
                params: { userId, name: firstName },
              })
            }
          >
            <Text style={s.footerRowLabel}>My Profile</Text>
            <Text style={s.footerRowArrow}>›</Text>
          </Pressable>
          <View style={s.footerRule} />
          <Pressable
            style={s.footerRow}
            onPress={() =>
              router.push({
                pathname: "/(passenger)/ride-history",
                params: { userId, name: firstName },
              })
            }
          >
            <Text style={s.footerRowLabel}>Ride History</Text>
            <Text style={s.footerRowArrow}>›</Text>
          </Pressable>
          <View style={s.footerRule} />
          <Pressable style={s.footerRow} onPress={() => router.replace("/")}>
            <Text style={[s.footerRowLabel, { color: MUTED }]}>Sign Out</Text>
            <Text style={s.footerRowArrow}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  pressed: { opacity: 0.75 },

  // Header
  header: {
    backgroundColor: INK,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
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
  profileDot: {
    width: 34,
    height: 34,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: { color: INK, fontSize: 15, fontWeight: "900" },
  greeting: {
    color: PAPER,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1.5,
    lineHeight: 46,
  },
  subGreeting: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
    letterSpacing: 0.3,
  },

  // Sheet
  sheet: { flex: 1, backgroundColor: PAPER },
  sheetContent: { paddingBottom: 48 },

  // Route block
  routeBlock: { borderBottomWidth: 1, borderBottomColor: RULE },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  resetText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  routeRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 14,
  },
  routeIconCol: { alignItems: "center", paddingTop: 18, width: 14 },
  dotPickup: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
  routeConnector: {
    width: 1,
    flex: 1,
    backgroundColor: RULE,
    marginTop: 4,
    minHeight: 20,
  },
  dotDrop: { width: 10, height: 10, backgroundColor: INK },
  routeField: { flex: 1 },
  fieldTag: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  fieldInput: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 16,
    fontWeight: "700",
    color: INK,
  },
  currentLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: ACCENT_DIM,
  },
  currentLocationText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: RULE,
    marginLeft: 48,
    marginRight: 20,
  },
  estimateStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: INK,
    marginHorizontal: 20,
    marginVertical: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  estimateStripDisabled: {
    opacity: 0.75,
  },
  estimateStripLabel: {
    color: PAPER,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  estimateArrow: { color: ACCENT, fontSize: 18, fontWeight: "300" },
  estimateErrorBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  estimateErrorText: {
    color: DANGER,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  estimateHintBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    backgroundColor: SURFACE,
  },
  estimateHintText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },

  // Metrics
  metricsStrip: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  metricCell: { flex: 1, paddingVertical: 20, paddingHorizontal: 20 },
  metricDivider: { width: 1, backgroundColor: RULE, marginVertical: 16 },
  metricTag: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  metricBig: {
    color: INK,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  metricSub: { color: MUTED, fontSize: 11, marginTop: 4, lineHeight: 15 },
  liveStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: SURFACE,
  },
  liveStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
  liveStatusContent: { flex: 1 },
  liveStatusTitle: {
    color: INK,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  liveStatusSubtitle: {
    color: MUTED,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },

  // Drivers
  rideTypesSection: {
    paddingTop: 20,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  rideTypesScroll: {
    paddingRight: 20,
  },
  rideTypeCard: {
    width: 118,
    marginLeft: 20,
    marginBottom: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: SURFACE,
  },
  rideTypeCardSelected: {
    borderColor: ACCENT,
    borderWidth: 2,
    backgroundColor: ACCENT_DIM,
  },
  rideTypeName: {
    color: INK,
    fontSize: 16,
    fontWeight: "900",
  },
  rideTypeMeta: {
    color: MUTED,
    fontSize: 11,
    marginTop: 3,
  },
  rideTypeFare: {
    color: INK,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 12,
  },
  rideTypeEta: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  driversSection: {
    paddingTop: 20,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  emptyDriversSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  emptyDriversText: {
    color: MUTED,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  driversScroll: {
    paddingRight: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: INK,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  countBadge: {
    backgroundColor: ACCENT_DIM,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countText: { color: ACCENT, fontSize: 10, fontWeight: "800" },
  driverCard: {
    marginLeft: 20,
    marginBottom: 16,
    width: 96,
    borderWidth: 1,
    borderColor: RULE,
    padding: 12,
    backgroundColor: SURFACE,
  },
  driverCardSelected: {
    borderColor: ACCENT,
    borderWidth: 2,
    backgroundColor: ACCENT_DIM,
  },
  selectedCheckmark: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    backgroundColor: ACCENT,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkIcon: { color: PAPER, fontSize: 14, fontWeight: "900" },
  driverIconBox: {
    width: 36,
    height: 36,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  driverIcon: { fontSize: 18 },
  driverName: { color: INK, fontSize: 12, fontWeight: "800", lineHeight: 16 },
  driverVehicle: { color: MUTED, fontSize: 10, marginTop: 2 },
  ratingText: { color: INK, fontSize: 11, fontWeight: "700", marginTop: 6 },
  driverEta: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 5,
  },

  // Summary
  summarySection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  summaryCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: SURFACE,
    padding: 14,
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  summaryLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  summaryValue: {
    flex: 1,
    color: INK,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  summaryFare: {
    color: INK,
    fontSize: 20,
    fontWeight: "900",
  },
  summaryDividerLine: {
    height: 1,
    backgroundColor: RULE,
  },

  // CTA
  ctaWrap: { padding: 20, borderBottomWidth: 1, borderBottomColor: RULE },
  bookBtn: {
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingLeft: 22,
    paddingRight: 6,
  },
  bookBtnDisabled: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
  },
  bookBtnText: {
    color: INK,
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 2,
  },
  bookBtnArrowBox: {
    width: 44,
    height: 44,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  bookBtnArrow: { color: ACCENT, fontSize: 20, fontWeight: "300" },
  cancelSearchBtn: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: DANGER,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelSearchBtnText: {
    color: DANGER,
    fontWeight: "900",
    letterSpacing: 1.4,
    fontSize: 12,
  },
  quickRetryBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: SURFACE,
    padding: 12,
    gap: 10,
  },
  quickRetryText: {
    color: INK,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  quickRetryBtn: {
    backgroundColor: INK,
    paddingVertical: 12,
    alignItems: "center",
  },
  quickRetryBtnDisabled: {
    opacity: 0.75,
  },
  quickRetryBtnText: {
    color: PAPER,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  // Footer
  footer: { marginTop: 4 },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  footerRule: { height: 1, backgroundColor: RULE, marginHorizontal: 20 },
  footerRowLabel: {
    color: INK,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  footerRowArrow: { color: MUTED, fontSize: 22, fontWeight: "300" },
});
