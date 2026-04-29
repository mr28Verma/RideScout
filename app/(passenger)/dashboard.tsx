import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import LocationInput from "@/components/LocationInput";
import RideMap from "@/components/RideMap";
import { detectBackendPort } from "@/constants/api";
import {
  joinRideRoom,
  listenForDriverAccepted,
  listenForDriverLocation,
  listenForRideMessages,
  listenForRideStatus,
  listenForTripCompleted,
  listenForTripStarted,
} from "@/services/passengerSocket";
import { processPayment } from "@/services/payment";
import {
  PaymentMethod,
  PaymentMethodType,
  RidePreference,
  SavedPlace,
  UserProfile,
  fetchUserProfile,
} from "@/services/profileApi";
import {
  DriverInfo,
  RideMarketplace,
  RideMessage,
  RideStatus,
  bookRide,
  estimateFare,
  fetchActiveRide,
  fetchNearbyDrivers,
  fetchRideMarketplace,
  rateCompletedRide,
  sendRideMessage,
} from "@/services/rideApi";

const INK = "#081018";
const PAPER = "#F7F4EE";
const SURFACE = "#FFFFFF";
const ALT_SURFACE = "#F1ECE3";
const RULE = "#DDD5C9";
const MUTED = "#6D685D";
const ACCENT = "#0FA958";
const ACCENT_SOFT = "#DCF7E8";
const DANGER = "#DC2626";

const PAYMENT_LABELS: Record<PaymentMethodType, string> = {
  mock: "Cash",
  stripe: "Card",
  razorpay: "UPI",
};

const RIDE_TYPES: Array<{
  id: RidePreference;
  label: string;
  multiplier: number;
  etaOffset: number;
}> = [
  { id: "bike", label: "Bike", multiplier: 0.55, etaOffset: 1 },
  { id: "mini", label: "Mini", multiplier: 1, etaOffset: 3 },
  { id: "sedan", label: "Sedan", multiplier: 1.25, etaOffset: 4 },
  { id: "suv", label: "SUV", multiplier: 1.65, etaOffset: 6 },
];

type FareState = {
  estimatedFare: number;
  distanceKm: number;
  estimatedDurationMinutes?: number;
};

function formatDuration(minutes?: number) {
  if (!minutes) return "Soon";
  const totalMinutes = Math.max(1, Math.round(minutes));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  return remainder > 0 ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function appendUniqueMessage(
  current: RideMessage[],
  next: RideMessage,
): RideMessage[] {
  const exists = current.some(
    (message) =>
      message.createdAt === next.createdAt &&
      message.senderId === next.senderId &&
      message.text === next.text,
  );

  return exists ? current : [...current, next];
}

function getPassengerTripCopy(
  status: RideStatus,
  driverName?: string,
): { title: string; eta: string } {
  switch (status) {
    case "searching":
      return {
        title: "Looking for the nearest driver...",
        eta: "Matching now",
      };
    case "accepted":
      return {
        title: driverName
          ? `${driverName} accepted your trip`
          : "Driver accepted your trip",
        eta: "Heading to pickup",
      };
    case "arriving":
      return {
        title: driverName
          ? `${driverName} reached your pickup`
          : "Driver reached your pickup",
        eta: "Meet your driver now",
      };
    case "on_trip":
      return {
        title: "Trip in progress",
        eta: "On the way to destination",
      };
    case "completed":
      return {
        title: "Trip completed",
        eta: "Thanks for riding",
      };
    default:
      return {
        title: "Enter your route to start",
        eta: "--",
      };
  }
}

export default function PassengerDashboard() {
  const { name: nameParam, userId: userIdParam } = useLocalSearchParams<{
    name?: string;
    userId?: string;
  }>();

  const userId = typeof userIdParam === "string" ? userIdParam : "";
  const fallbackName =
    typeof nameParam === "string" && nameParam.trim().length > 0
      ? nameParam
      : "Scout";

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [pickupCoords, setPickupCoords] = useState({
    lat: 28.6139,
    lon: 77.209,
  });
  const [dropCoords, setDropCoords] = useState({ lat: 28.5355, lon: 77.391 });
  const [selectedRideTypeId, setSelectedRideTypeId] =
    useState<RidePreference>("mini");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [fareState, setFareState] = useState<FareState | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<DriverInfo[]>([]);
  const [rideMarket, setRideMarket] = useState<RideMarketplace | null>(null);
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [rideStatus, setRideStatus] = useState<RideStatus | null>(null);
  const [trackingText, setTrackingText] = useState("Enter your route to start");
  const [driverEtaText, setDriverEtaText] = useState("—");
  const [chatDraft, setChatDraft] = useState("");
  const [estimateError, setEstimateError] = useState("");
  const [isEstimating, setIsEstimating] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLocatingPickup, setIsLocatingPickup] = useState(false);
  const [routeResetKey, setRouteResetKey] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState("");

  useEffect(() => {
    detectBackendPort().catch(() => console.warn("Port detection failed"));
  }, []);

  useEffect(() => {
    if (!userId) return;

    Promise.all([fetchUserProfile(userId), fetchActiveRide(userId)])
      .then(([data, activeRide]) => {
        setProfile(data);
        setSelectedRideTypeId(data.preferredRideType ?? "mini");
        const defaultPayment =
          data.paymentMethods?.find((method) => method.isDefault) ??
          data.paymentMethods?.[0];
        if (defaultPayment) {
          setSelectedPaymentMethodId(defaultPayment.id);
        }

        if (activeRide) {
          setRideMarket(activeRide);
          setMessages(activeRide.messages ?? []);
          setRideStatus(activeRide.status);
          setPickup(activeRide.pickup);
          setDrop(activeRide.drop);
          if (activeRide.pickupLat !== undefined && activeRide.pickupLng !== undefined) {
            setPickupCoords({
              lat: activeRide.pickupLat,
              lon: activeRide.pickupLng,
            });
          }
          if (activeRide.dropLat !== undefined && activeRide.dropLng !== undefined) {
            setDropCoords({
              lat: activeRide.dropLat,
              lon: activeRide.dropLng,
            });
          }
          if (activeRide.routeMetrics?.distanceKm || activeRide.routeMetrics?.estimatedDurationMinutes) {
            setFareState({
              estimatedFare: activeRide.actualFare || activeRide.estimatedFare,
              distanceKm: activeRide.routeMetrics?.distanceKm || 0,
              estimatedDurationMinutes:
                activeRide.routeMetrics?.estimatedDurationMinutes || undefined,
            });
          }
          const tripCopy = getPassengerTripCopy(
            activeRide.status,
            activeRide.assignedDriver?.name,
          );
          setTrackingText(tripCopy.title);
          setDriverEtaText(tripCopy.eta);
          setRatingScore(activeRide.passengerRating?.score || 5);
          setRatingFeedback(activeRide.passengerRating?.feedback || "");
        }
      })
      .catch(() => setProfile(null));
  }, [userId]);

  useEffect(() => {
    if (!rideMarket?.rideId || !userId) return;

    joinRideRoom(rideMarket.rideId, userId);

    const offAccepted = listenForDriverAccepted((payload: any) => {
      if (payload.rideId !== rideMarket.rideId) return;
      setRideStatus("accepted");
      setTrackingText(`${payload.driverName} accepted your trip`);
      setDriverEtaText(
        payload.etaMinutes
          ? `${formatDuration(payload.etaMinutes)} away`
          : "Driver assigned",
      );
      refreshRide(rideMarket.rideId);
    });
    const offStatus = listenForRideStatus((payload: any) => {
      if (payload.rideId !== rideMarket.rideId) return;
      setRideStatus(payload.status);
      const tripCopy = getPassengerTripCopy(
        payload.status,
        rideMarket.assignedDriver?.name,
      );
      setTrackingText(tripCopy.title);
      setDriverEtaText(tripCopy.eta);
    });
    const offLocation = listenForDriverLocation((payload: any) => {
      if (payload.rideId !== rideMarket.rideId) return;
      setTrackingText(
        `Driver live at ${payload.lat.toFixed(4)}, ${payload.lng.toFixed(4)}`,
      );
    });
    const offStarted = listenForTripStarted((payload: any) => {
      if (payload.rideId !== rideMarket.rideId) return;
      setRideStatus("on_trip");
      setTrackingText("Trip started");
      setDriverEtaText("On the way to destination");
    });
    const offCompleted = listenForTripCompleted((payload: any) => {
      if (payload.rideId !== rideMarket.rideId) return;
      setRideStatus("completed");
      setTrackingText(`Trip finished - Rs ${payload.fare}`);
      setDriverEtaText("Ride closed");
      refreshRide(rideMarket.rideId);
    });
    const offMessages = listenForRideMessages((payload: any) => {
      if (payload.rideId !== rideMarket.rideId || !payload.message) return;
      setMessages((current) => appendUniqueMessage(current, payload.message));
    });

    return () => {
      offAccepted();
      offStatus();
      offLocation();
      offStarted();
      offCompleted();
      offMessages();
    };
  }, [rideMarket?.rideId, userId]);

  const firstName = useMemo(() => {
    const source = profile?.name || fallbackName;
    return source.split(" ")[0] || "Scout";
  }, [fallbackName, profile?.name]);

  const paymentOptions = useMemo<PaymentMethod[]>(() => {
    if (profile?.paymentMethods?.length) return profile.paymentMethods;
    return [
      {
        id: "default-mock",
        label: "Cash",
        type: "mock",
        last4: "0000",
        isDefault: true,
      },
    ];
  }, [profile?.paymentMethods]);

  const selectedPaymentMethod =
    paymentOptions.find((method) => method.id === selectedPaymentMethodId) ??
    paymentOptions.find((method) => method.isDefault) ??
    paymentOptions[0];

  const selectedRideType =
    RIDE_TYPES.find((rideType) => rideType.id === selectedRideTypeId) ??
    RIDE_TYPES[1];

  const selectedDriver = rideMarket?.assignedDriver ?? null;

  const finalFare = useMemo(() => {
    if (!fareState) return null;
    return Math.max(
      1,
      Math.round(fareState.estimatedFare * selectedRideType.multiplier),
    );
  }, [fareState, selectedRideType.multiplier]);

  const refreshRide = async (rideId = rideMarket?.rideId) => {
    if (!rideId) return;
    try {
      const ride = await fetchRideMarketplace(rideId);
      setRideMarket(ride);
      setMessages(ride.messages ?? []);
      setRideStatus(ride.status);
      const tripCopy = getPassengerTripCopy(
        ride.status,
        ride.assignedDriver?.name,
      );
      setTrackingText(tripCopy.title);
      setDriverEtaText(tripCopy.eta);
      setRatingScore(ride.passengerRating?.score || 5);
      setRatingFeedback(ride.passengerRating?.feedback || "");
    } catch {
      console.warn("Failed to refresh ride");
    }
  };

  const resetRoute = () => {
    setPickup("");
    setDrop("");
    setFareState(null);
    setNearbyDrivers([]);
    setRideMarket(null);
    setMessages([]);
    setRideStatus(null);
    setTrackingText("Enter your route to start");
    setDriverEtaText("--");
    setChatDraft("");
    setEstimateError("");
    setSelectedRideTypeId(profile?.preferredRideType ?? "mini");
    setRatingScore(5);
    setRatingFeedback("");
    setRouteResetKey((value) => value + 1);
  };

  const useCurrentLocation = async () => {
    try {
      setIsLocatingPickup(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Location needed", "Please allow location access.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      let locationLabel = `Current location (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})`;
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: coords.lat,
          longitude: coords.lon,
        });
        if (address) {
          locationLabel = [
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
        // Ignore reverse geocode failures and keep coordinate label.
      }

      setPickup(locationLabel);
      setPickupCoords(coords);
    } catch (error) {
      Alert.alert(
        "Could not get location",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsLocatingPickup(false);
    }
  };

  const applySavedPlace = (place: SavedPlace) => {
    const target = !pickup || (pickup && drop) ? "pickup" : "drop";
    const coords =
      place.lat !== undefined && place.lng !== undefined
        ? { lat: place.lat, lon: place.lng }
        : null;

    if (target === "pickup") {
      setPickup(place.address);
      if (coords) setPickupCoords(coords);
    } else {
      setDrop(place.address);
      if (coords) setDropCoords(coords);
    }
  };

  const handleEstimate = async () => {
    if (!pickup.trim() || !drop.trim()) {
      setEstimateError("Please enter both pickup and destination.");
      return;
    }

    try {
      setIsEstimating(true);
      setEstimateError("");
      const [fare, drivers] = await Promise.all([
        estimateFare(
          pickup,
          drop,
          pickupCoords.lat,
          pickupCoords.lon,
          dropCoords.lat,
          dropCoords.lon,
        ),
        fetchNearbyDrivers(pickupCoords.lat, pickupCoords.lon),
      ]);

      setFareState({
        estimatedFare: fare.estimatedFare,
        distanceKm: fare.distanceKm,
        estimatedDurationMinutes: fare.estimatedDurationMinutes,
      });
      setNearbyDrivers(drivers);
      setRideMarket(null);
      setMessages([]);
      setRideStatus(null);
      setTrackingText("Choose a ride type and confirm");
      setDriverEtaText("Finding nearest driver");
    } catch (error) {
      setEstimateError(
        error instanceof Error ? error.message : "Could not estimate fare.",
      );
    } finally {
      setIsEstimating(false);
    }
  };

  const handleBookRide = async () => {
    if (!userId || !finalFare || !fareState) return;

    try {
      setIsBooking(true);
      await processPayment(selectedPaymentMethod?.type ?? "mock", {
        amount: finalFare,
        currency: "INR",
        rideId: rideMarket?.rideId || `pending-${Date.now()}`,
      });

      const response = await bookRide({
        passengerId: userId,
        pickup,
        drop,
        estimatedFare: finalFare,
        paymentMethod: selectedPaymentMethod?.type ?? "mock",
        requestedRideType: selectedRideTypeId,
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lon,
        dropLat: dropCoords.lat,
        dropLng: dropCoords.lon,
      });

      const rideId = response.ride.rideId;
      const ride = await fetchRideMarketplace(rideId);
      setRideMarket(ride);
      setMessages(ride.messages ?? []);
      setRideStatus("searching");
      setTrackingText("Looking for the nearest driver...");
      setDriverEtaText("Matching now");
      joinRideRoom(rideId, userId);
    } catch (error) {
      Alert.alert(
        "Could not book ride",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsBooking(false);
    }
  };

  const handleSendMessage = async () => {
    if (!rideMarket?.rideId || !chatDraft.trim()) return;
    try {
      setIsSendingMessage(true);
      const response = await sendRideMessage({
        rideId: rideMarket.rideId,
        senderType: "passenger",
        senderId: userId,
        text: chatDraft.trim(),
      });
      setMessages((current) =>
        appendUniqueMessage(current, response.chatMessage),
      );
      setChatDraft("");
    } catch (error) {
      Alert.alert(
        "Could not send message",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleCallDriver = async () => {
    const phone = selectedDriver?.phone;
    if (!phone) {
      Alert.alert("Unavailable", "Driver phone number is not ready yet.");
      return;
    }
    const url = `tel:${phone}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Unavailable", "This device cannot place calls.");
      return;
    }
    await Linking.openURL(url);
  };

  const handleSubmitRating = async () => {
    if (!rideMarket?.rideId || !userId) return;

    try {
      setIsSubmittingRating(true);
      const response = await rateCompletedRide({
        rideId: rideMarket.rideId,
        passengerId: userId,
        score: ratingScore,
        feedback: ratingFeedback.trim(),
      });
      setRideMarket(response.ride);
      Alert.alert("Thanks", "Your trip rating has been saved.");
    } catch (error) {
      Alert.alert(
        "Could not save rating",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.hero}>
          <View style={s.heroTop}>
            <View style={s.logoBadge}>
              <Text style={s.logoText}>RIDE SCOUT</Text>
            </View>
            <Pressable
              style={s.profileButton}
              onPress={() =>
                router.push({
                  pathname: "/(passenger)/profile",
                  params: { userId, name: firstName },
                })
              }
            >
              <Text style={s.profileInitial}>
                {firstName[0]?.toUpperCase()}
              </Text>
            </Pressable>
          </View>
          <Text style={s.heroTitle}>Book your ride</Text>
          <Text style={s.heroSubtitle}>
            Fast estimate, automatic driver matching, then track one assigned
            driver all the way through the trip.
          </Text>
        </View>

        <View style={s.sheet}>
          {(profile?.savedPlaces?.length ?? 0) > 0 && (
            <View style={s.section}>
              <SectionHeader title="Saved places" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {profile?.savedPlaces?.map((place) => (
                  <Pressable
                    key={place.id}
                    style={s.savedPlaceCard}
                    onPress={() => applySavedPlace(place)}
                  >
                    <Text style={s.savedPlaceLabel}>{place.label}</Text>
                    <Text style={s.savedPlaceAddress} numberOfLines={2}>
                      {place.address}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={s.routeCard}>
            <SectionHeader
              title="Your route"
              action="Reset"
              onPress={resetRoute}
            />
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>PICKUP</Text>
              <LocationInput
                key={`pickup-${routeResetKey}`}
                placeholder="Current location"
                value={pickup}
                setLocation={setPickup}
                setCoords={setPickupCoords}
                darkMode={false}
                dotColor={ACCENT}
              />
              <Pressable style={s.inlineButton} onPress={useCurrentLocation}>
                <Text style={s.inlineButtonText}>
                  {isLocatingPickup ? "Locating..." : "Use current location"}
                </Text>
              </Pressable>
            </View>
            <View style={s.divider} />
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>DESTINATION</Text>
              <LocationInput
                key={`drop-${routeResetKey}`}
                placeholder="Where are you going?"
                value={drop}
                setLocation={setDrop}
                setCoords={setDropCoords}
                darkMode={false}
                dotColor="#F59E0B"
              />
            </View>
            <Pressable
              style={[s.primaryButton, isEstimating && s.disabledButton]}
              onPress={handleEstimate}
              disabled={isEstimating}
            >
              {isEstimating ? (
                <ActivityIndicator color={SURFACE} />
              ) : (
                <Text style={s.primaryButtonText}>Get fare estimate</Text>
              )}
            </Pressable>
            {estimateError ? (
              <Text style={s.errorText}>{estimateError}</Text>
            ) : null}
          </View>

          {fareState && (
            <View style={s.section}>
              <SectionHeader title="Route map" />
              <RideMap
                title={rideMarket ? "Trip map" : "Route preview"}
                pickup={{
                  lat: pickupCoords.lat,
                  lng: pickupCoords.lon,
                  label: pickup || "Pickup",
                }}
                drop={{
                  lat: dropCoords.lat,
                  lng: dropCoords.lon,
                  label: drop || "Destination",
                }}
                driver={
                  selectedDriver
                    ? {
                        lat: selectedDriver.lat,
                        lng: selectedDriver.lng,
                        label: selectedDriver.name,
                      }
                    : undefined
                }
                height={240}
              />
            </View>
          )}

          {fareState && (
            <View style={s.metricsRow}>
              <MetricCard
                label="Fare"
                value={`Rs ${fareState.estimatedFare}`}
              />
              <MetricCard
                label="Distance"
                value={`${fareState.distanceKm.toFixed(1)} km`}
              />
                <MetricCard
                  label="ETA"
                  value={
                    fareState.estimatedDurationMinutes
                    ? formatDuration(fareState.estimatedDurationMinutes)
                    : "Soon"
                  }
                />
            </View>
          )}

          {fareState && (
            <View style={s.section}>
              <SectionHeader title="Ride type" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {RIDE_TYPES.map((rideType) => {
                  const selected = rideType.id === selectedRideTypeId;
                  const rideFare = Math.max(
                    1,
                    Math.round(fareState.estimatedFare * rideType.multiplier),
                  );
                  return (
                    <Pressable
                      key={rideType.id}
                      style={[s.rideTypeCard, selected && s.rideTypeCardActive]}
                      onPress={() => setSelectedRideTypeId(rideType.id)}
                    >
                      <Text style={s.rideTypeName}>{rideType.label}</Text>
                      <Text style={s.rideTypeFare}>Rs {rideFare}</Text>
                        <Text style={s.rideTypeMeta}>
                        {formatDuration(
                          Math.max(
                            2,
                            Math.round(
                              (fareState.estimatedDurationMinutes ?? 8) / 2,
                            ) + rideType.etaOffset,
                          ),
                        )}{" "}
                        away
                        </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {fareState && (
            <View style={s.section}>
              <SectionHeader title="Payment" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {paymentOptions.map((method) => {
                  const selected = method.id === selectedPaymentMethod?.id;
                  return (
                    <Pressable
                      key={method.id}
                      style={[s.paymentCard, selected && s.paymentCardActive]}
                      onPress={() => setSelectedPaymentMethodId(method.id)}
                    >
                      <Text style={s.paymentType}>
                        {PAYMENT_LABELS[method.type]}
                      </Text>
                      <Text style={s.paymentName}>{method.label}</Text>
                      <Text style={s.paymentMeta}>
                        {method.type === "mock"
                          ? "Pay after ride"
                          : `•••• ${method.last4}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {nearbyDrivers.length > 0 && !rideMarket && (
            <View style={s.section}>
              <SectionHeader title="Nearby drivers" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {nearbyDrivers.slice(0, 4).map((driver, index) => (
                  <View key={driver.id} style={s.driverCard}>
                    <Text style={s.driverName}>{driver.name}</Text>
                    <Text style={s.driverVehicle}>{driver.vehicle}</Text>
                    <Text style={s.driverMeta}>Rating {driver.rating}</Text>
                    <Text style={s.driverEta}>{3 + index * 2} min away</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {fareState && !rideMarket && (
            <View style={s.summaryCard}>
              <Text style={s.sectionTitle}>Booking summary</Text>
              <SummaryRow label="Ride type" value={selectedRideType.label} />
              <SummaryRow
                label="Payment"
                value={`${selectedPaymentMethod.label} • ${PAYMENT_LABELS[selectedPaymentMethod.type]}`}
              />
              <SummaryRow
                label="Total"
                value={`Rs ${finalFare ?? fareState.estimatedFare}`}
              />
              <Pressable
                style={[s.primaryButton, isBooking && s.disabledButton]}
                onPress={handleBookRide}
                disabled={isBooking}
              >
                {isBooking ? (
                  <ActivityIndicator color={SURFACE} />
                ) : (
                  <Text style={s.primaryButtonText}>Confirm ride</Text>
                )}
              </Pressable>
            </View>
          )}

          {rideMarket && (
            <View style={s.section}>
              <SectionHeader
                title="Your trip"
                action="Refresh"
                onPress={() => refreshRide()}
              />
              <View style={s.statusCard}>
                <Text style={s.statusLabel}>
                  {(rideStatus ?? rideMarket.status)
                    .replace("_", " ")
                    .toUpperCase()}
                </Text>
                <Text style={s.statusTitle}>{trackingText}</Text>
                <Text style={s.statusMeta}>{driverEtaText}</Text>
                <View style={s.statusMapWrap}>
                  <RideMap
                    title="Live trip map"
                    pickup={{
                      lat: rideMarket.pickupLat,
                      lng: rideMarket.pickupLng,
                      label: rideMarket.pickup,
                    }}
                    drop={{
                      lat: rideMarket.dropLat,
                      lng: rideMarket.dropLng,
                      label: rideMarket.drop,
                    }}
                    driver={
                      selectedDriver
                        ? {
                            lat: selectedDriver.lat,
                            lng: selectedDriver.lng,
                            label: selectedDriver.name,
                          }
                        : undefined
                    }
                    height={250}
                  />
                </View>
                {selectedDriver ? (
                  <View style={s.driverAssignedCard}>
                    <View style={s.driverAssignedTop}>
                      <View>
                        <Text style={s.assignedName}>
                          {selectedDriver.name}
                        </Text>
                        <Text style={s.assignedVehicle}>
                          {selectedDriver.vehicle}
                        </Text>
                        <Text style={s.assignedPlate}>
                          {selectedDriver.vehicleNumber || "Plate pending"}
                        </Text>
                      </View>
                      <Text style={s.assignedRating}>
                        ★ {selectedDriver.rating}
                      </Text>
                    </View>
                    <View style={s.driverActions}>
                      <Pressable
                        style={s.secondaryAction}
                        onPress={handleCallDriver}
                      >
                        <Text style={s.secondaryActionText}>Call</Text>
                      </Pressable>
                      <Pressable
                        style={s.secondaryAction}
                        onPress={() =>
                          setTrackingText("You can message the driver below.")
                        }
                      >
                        <Text style={s.secondaryActionText}>Chat</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Text style={s.waitingText}>
                    We are automatically finding the closest available driver.
                  </Text>
                )}
              </View>
            </View>
          )}

          {rideMarket && selectedDriver && (
            <View style={s.chatCard}>
              <Text style={s.sectionTitle}>Message driver</Text>
              <View style={s.chatMessages}>
                {(messages.length === 0
                  ? [
                      {
                        senderType: "driver",
                        senderId: "preview",
                        senderName: selectedDriver.name,
                        text: "Use this chat after a driver is assigned.",
                        createdAt: new Date().toISOString(),
                      } as RideMessage,
                    ]
                  : messages
                ).map((message, index) => {
                  const mine = message.senderType === "passenger";
                  return (
                    <View
                      key={`${message.createdAt}-${index}`}
                      style={[
                        s.messageBubble,
                        mine ? s.messageMine : s.messageTheirs,
                      ]}
                    >
                      <Text style={s.messageSender}>
                        {mine ? "You" : message.senderName}
                      </Text>
                      <Text style={[s.messageText, mine && s.messageTextMine]}>
                        {message.text}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={s.chatComposer}>
                <TextInput
                  style={s.chatInput}
                  placeholder="Message your driver..."
                  placeholderTextColor={MUTED}
                  value={chatDraft}
                  onChangeText={setChatDraft}
                />
                <Pressable
                  style={[
                    s.chatSendButton,
                    (!chatDraft.trim() || isSendingMessage) && s.disabledButton,
                  ]}
                  onPress={handleSendMessage}
                  disabled={!chatDraft.trim() || isSendingMessage}
                >
                  {isSendingMessage ? (
                    <ActivityIndicator color={SURFACE} size="small" />
                  ) : (
                    <Text style={s.chatSendText}>Send</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {rideMarket?.status === "completed" && selectedDriver && (
            <View style={s.ratingCard}>
              <Text style={s.sectionTitle}>Rate your trip</Text>
              <Text style={s.ratingCopy}>
                Tell us how the trip with {selectedDriver.name} went.
              </Text>
              <View style={s.ratingRow}>
                {[1, 2, 3, 4, 5].map((score) => {
                  const selected = ratingScore === score;
                  return (
                    <Pressable
                      key={score}
                      style={[s.ratingPill, selected && s.ratingPillActive]}
                      onPress={() => setRatingScore(score)}
                    >
                      <Text
                        style={[
                          s.ratingPillText,
                          selected && s.ratingPillTextActive,
                        ]}
                      >
                        {score}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={s.feedbackInput}
                multiline
                placeholder="Write a short review..."
                placeholderTextColor={MUTED}
                value={ratingFeedback}
                onChangeText={setRatingFeedback}
              />
              <Pressable
                style={[s.primaryButton, isSubmittingRating && s.disabledButton]}
                onPress={handleSubmitRating}
                disabled={isSubmittingRating}
              >
                {isSubmittingRating ? (
                  <ActivityIndicator color={SURFACE} />
                ) : (
                  <Text style={s.primaryButtonText}>
                    {rideMarket.passengerRating?.score ? "Update rating" : "Submit rating"}
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          <View style={s.footerActions}>
            <Pressable
              style={s.footerRow}
              onPress={() =>
                router.push({
                  pathname: "/(passenger)/ride-history",
                  params: { userId, name: firstName },
                })
              }
            >
              <Text style={s.footerRowText}>Ride history</Text>
              <Text style={s.footerArrow}>›</Text>
            </Pressable>
            <Pressable style={s.footerRow} onPress={() => router.replace("/")}>
              <Text style={s.footerRowText}>Sign out</Text>
              <Text style={s.footerArrow}>›</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && onPress ? (
        <Pressable onPress={onPress}>
          <Text style={s.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metricCard}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  hero: {
    backgroundColor: INK,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 28,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 26,
  },
  logoBadge: {
    borderWidth: 1.5,
    borderColor: SURFACE,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  logoText: {
    color: SURFACE,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: {
    color: INK,
    fontSize: 15,
    fontWeight: "900",
  },
  heroTitle: {
    color: SURFACE,
    fontSize: 40,
    fontWeight: "900",
    lineHeight: 42,
  },
  heroSubtitle: {
    color: "#B9C1C8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 330,
  },
  sheet: {
    backgroundColor: PAPER,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -8,
    padding: 16,
    gap: 16,
  },
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: INK,
    fontSize: 19,
    fontWeight: "900",
  },
  sectionAction: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  savedPlaceCard: {
    width: 158,
    minHeight: 94,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 14,
    marginRight: 10,
  },
  savedPlaceLabel: {
    color: INK,
    fontSize: 14,
    fontWeight: "900",
  },
  savedPlaceAddress: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  routeCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  inputGroup: { marginTop: 10 },
  inputLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  divider: {
    height: 1,
    backgroundColor: RULE,
    marginVertical: 12,
  },
  inlineButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: ACCENT_SOFT,
    marginTop: 8,
  },
  inlineButtonText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "900",
  },
  primaryButton: {
    minHeight: 52,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: SURFACE,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },
  disabledButton: { opacity: 0.65 },
  errorText: {
    color: DANGER,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
  },
  metricsRow: { flexDirection: "row", gap: 10 },
  metricCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 14,
  },
  metricLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  metricValue: {
    color: INK,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 8,
  },
  rideTypeCard: {
    width: 132,
    minHeight: 92,
    padding: 14,
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: ALT_SURFACE,
    marginRight: 10,
  },
  rideTypeCardActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_SOFT,
  },
  rideTypeName: {
    color: INK,
    fontSize: 15,
    fontWeight: "900",
  },
  rideTypeFare: {
    color: INK,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10,
  },
  rideTypeMeta: {
    color: MUTED,
    fontSize: 11,
    marginTop: 4,
  },
  paymentCard: {
    width: 144,
    minHeight: 90,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 14,
    marginRight: 10,
  },
  paymentCardActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_SOFT,
  },
  paymentType: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "900",
  },
  paymentName: {
    color: INK,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 10,
  },
  paymentMeta: {
    color: MUTED,
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },
  driverCard: {
    width: 160,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 14,
    marginRight: 10,
  },
  driverName: {
    color: INK,
    fontSize: 15,
    fontWeight: "900",
  },
  driverVehicle: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  driverMeta: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  driverEta: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
  },
  summaryCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: RULE,
  },
  summaryLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
  },
  summaryValue: {
    color: INK,
    fontSize: 12,
    fontWeight: "800",
  },
  statusCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  statusLabel: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  statusTitle: {
    color: INK,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10,
  },
  statusMeta: {
    color: MUTED,
    fontSize: 12,
    marginTop: 6,
  },
  statusMapWrap: {
    marginTop: 14,
  },
  waitingText: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  driverAssignedCard: {
    marginTop: 14,
    backgroundColor: ALT_SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 14,
  },
  driverAssignedTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  assignedName: {
    color: INK,
    fontSize: 15,
    fontWeight: "900",
  },
  assignedVehicle: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  assignedPlate: {
    color: MUTED,
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  assignedRating: {
    color: INK,
    fontSize: 13,
    fontWeight: "800",
  },
  driverActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  secondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: SURFACE,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    color: INK,
    fontSize: 12,
    fontWeight: "800",
  },
  chatCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  chatMessages: { gap: 8, marginTop: 12 },
  messageBubble: {
    maxWidth: "90%",
    padding: 10,
  },
  messageMine: {
    alignSelf: "flex-end",
    backgroundColor: INK,
  },
  messageTheirs: {
    alignSelf: "flex-start",
    backgroundColor: ALT_SURFACE,
  },
  messageSender: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4,
  },
  messageText: {
    color: INK,
    fontSize: 12,
    lineHeight: 17,
  },
  messageTextMine: { color: SURFACE },
  chatComposer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  chatInput: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: PAPER,
    color: INK,
    paddingHorizontal: 12,
  },
  chatSendButton: {
    minWidth: 76,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  chatSendText: {
    color: SURFACE,
    fontSize: 12,
    fontWeight: "900",
  },
  ratingCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  ratingCopy: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  ratingRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    marginBottom: 14,
  },
  ratingPill: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: PAPER,
  },
  ratingPillActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_SOFT,
  },
  ratingPillText: {
    color: INK,
    fontWeight: "900",
    fontSize: 14,
  },
  ratingPillTextActive: {
    color: ACCENT,
  },
  feedbackInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: PAPER,
    color: INK,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  footerActions: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  footerRowText: {
    color: INK,
    fontSize: 14,
    fontWeight: "800",
  },
  footerArrow: {
    color: MUTED,
    fontSize: 22,
  },
});
