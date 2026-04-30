import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView as RNScrollView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import RideMap from "@/components/RideMap";
import {
  ActiveTrip,
  DriverTripStatus,
  PendingRide,
  acceptRide,
  getActiveTrips,
  getPendingRides,
  updateRideStatus,
} from "@/services/driverApi";
import {
  emitMessageSeen,
  emitTypingStatus,
  joinDriverRideRoom,
  joinDriverRoom,
  listenForMessageReceipts,
  listenForRideMessages,
  listenForRideRequests,
  listenForTypingStatus,
  stopListeningForRideRequests,
} from "@/services/driverSocket";
import { RideMessage, RideMarketplace, fetchRideMarketplace, sendRideMessage } from "@/services/rideApi";

const INK = "#081018";
const PAPER = "#F7F4EE";
const SURFACE = "#FFFFFF";
const ALT_SURFACE = "#F1ECE3";
const RULE = "#DDD5C9";
const MUTED = "#6D685D";
const ACCENT = "#0FA958";
const DANGER = "#DC2626";

const TRIP_STATUS_LABELS: Record<DriverTripStatus, string> = {
  accepted: "Heading to pickup",
  arriving: "Reached pickup",
  on_trip: "Trip in progress",
  completed: "Completed",
};

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

function withReceiptStatus(
  messages: RideMessage[],
  messageIds: string[],
  status: "delivered" | "seen",
  timestamp: string,
) {
  return messages.map((message) => {
    if (!message.id || !messageIds.includes(message.id)) {
      return message;
    }

    return {
      ...message,
      deliveredAt:
        status === "delivered"
          ? message.deliveredAt || timestamp
          : message.deliveredAt || message.createdAt,
      seenAt: status === "seen" ? timestamp : message.seenAt ?? null,
    };
  });
}

function formatMessageTimestamp(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AvailableRides() {
  const { driverId } = useLocalSearchParams<{ driverId?: string }>();
  const currentDriverId = typeof driverId === "string" ? driverId : "";

  const [pendingRides, setPendingRides] = useState<PendingRide[]>([]);
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [selectedRideId, setSelectedRideId] = useState("");
  const [selectedTripId, setSelectedTripId] = useState("");
  const [selectedRideMarket, setSelectedRideMarket] = useState<RideMarketplace | null>(null);
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [acceptingRideId, setAcceptingRideId] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isPassengerTyping, setIsPassengerTyping] = useState(false);
  const chatScrollRef = useRef<RNScrollView>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedTrip = useMemo(
    () => activeTrips.find((trip) => String(trip.rideId) === String(selectedTripId)) ?? null,
    [activeTrips, selectedTripId],
  );

  const loadBoard = async () => {
    if (!currentDriverId) return;

    try {
      setLoading(true);
      const [pending, active] = await Promise.all([
        getPendingRides(currentDriverId),
        getActiveTrips(currentDriverId),
      ]);
      setPendingRides(pending);
      setActiveTrips(active);
      if (!selectedRideId && pending[0]) {
        setSelectedRideId(String(pending[0].rideId));
      }
      if (!selectedTripId && active[0]) {
        setSelectedTripId(String(active[0].rideId));
      }
    } catch {
      Alert.alert("Error", "Failed to load ride requests");
    } finally {
      setLoading(false);
    }
  };

  const refreshRide = async (rideId: string) => {
    if (!rideId) return;
    try {
      const ride = await fetchRideMarketplace(rideId);
      setSelectedRideMarket(ride);
      setMessages(ride.messages ?? []);
      joinDriverRideRoom(rideId, currentDriverId);
    } catch {
      console.warn("Failed to refresh ride details");
    }
  };

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      if (!currentDriverId) return;
      joinDriverRoom(currentDriverId);
      await loadBoard();
    };

    setup();

    listenForRideRequests((ride: any) => {
      if (!mounted) return;
      setPendingRides((current) => {
        if (current.some((item) => String(item.rideId) === String(ride.rideId))) {
          return current;
        }
        return [
          {
            rideId: ride.rideId,
            passengerId: ride.passengerId,
            passengerName: ride.passengerName,
            passengerRating: 4.8,
            pickup: ride.pickup,
            drop: ride.drop,
            estimatedFare: ride.estimatedFare ?? ride.fare,
            requestedRideType: ride.requestedRideType ?? "mini",
            distance: ride.distance ?? "~5 km",
            eta: ride.eta ?? "~12 min",
            bidCount: 0,
            status: "searching",
            currentBid: null,
            lowestBid: null,
            createdAt: ride.createdAt ?? new Date().toISOString(),
          },
          ...current,
        ];
      });
    });

    const offMessages = listenForRideMessages((payload: any) => {
      if (String(payload?.rideId) !== String(selectedTripId) || !payload?.message) return;
      setMessages((current) => appendUniqueMessage(current, payload.message));
    });
    const offTyping = listenForTypingStatus((payload: any) => {
      if (
        String(payload?.rideId) !== String(selectedTripId) ||
        payload?.senderType !== "passenger"
      ) {
        return;
      }
      setIsPassengerTyping(Boolean(payload.isTyping));
    });
    const offReceipts = listenForMessageReceipts((payload: any) => {
      if (
        String(payload?.rideId) !== String(selectedTripId) ||
        !Array.isArray(payload?.messageIds)
      ) {
        return;
      }
      setMessages((current) =>
        withReceiptStatus(
          current,
          payload.messageIds,
          payload.status === "seen" ? "seen" : "delivered",
          payload.timestamp,
        ),
      );
    });

    return () => {
      mounted = false;
      stopListeningForRideRequests();
      offMessages();
      offTyping();
      offReceipts();
    };
  }, [currentDriverId, selectedTripId]);

  useEffect(() => {
    if (!selectedTripId) return;
    refreshRide(selectedTripId);
  }, [selectedTripId]);

  useEffect(() => {
    if (!selectedTripId) return;
    chatScrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, isPassengerTyping, selectedTripId]);

  useEffect(() => {
    if (!selectedTripId) return;

    const unseenMessageIds = messages
      .filter(
        (message) =>
          message.senderType === "passenger" &&
          message.id &&
          !message.seenAt,
      )
      .map((message) => message.id!);

    if (!unseenMessageIds.length) return;

    emitMessageSeen({
      rideId: selectedTripId,
      messageIds: unseenMessageIds,
      seenBy: "driver",
    });

    setMessages((current) =>
      withReceiptStatus(
        current,
        unseenMessageIds,
        "seen",
        new Date().toISOString(),
      ),
    );
  }, [messages, selectedTripId]);

  const handleAcceptRide = async (ride: PendingRide) => {
    try {
      setAcceptingRideId(String(ride.rideId));
      await acceptRide(String(ride.rideId), currentDriverId);
      await loadBoard();
      setSelectedTripId(String(ride.rideId));
      setSelectedRideId("");
      Alert.alert("Ride accepted", "Head to pickup and keep the passenger updated.");
    } catch (error) {
      Alert.alert(
        "Could not accept ride",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setAcceptingRideId("");
    }
  };

  const handleUpdateTripStatus = async (
    status: "arriving" | "on_trip" | "completed",
  ) => {
    if (!selectedTrip) return;
    try {
      setUpdatingStatus(status);
      await updateRideStatus(String(selectedTrip.rideId), status);
      await loadBoard();
      await refreshRide(String(selectedTrip.rideId));
      if (status === "completed") {
        Alert.alert("Trip completed", "Ride closed successfully.");
      }
    } catch (error) {
      Alert.alert(
        "Could not update trip",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setUpdatingStatus("");
    }
  };

  const handleCallPassenger = async () => {
    if (!selectedTrip?.passengerPhone) {
      Alert.alert("Unavailable", "Passenger phone number is not ready.");
      return;
    }
    const url = `tel:${selectedTrip.passengerPhone}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Unavailable", "This device cannot place calls.");
      return;
    }
    await Linking.openURL(url);
  };

  const handleSendMessage = async () => {
    if (!selectedRideMarket?.rideId || !chatDraft.trim()) return;
    try {
      setSendingMessage(true);
      const response = await sendRideMessage({
        rideId: selectedRideMarket.rideId,
        senderType: "driver",
        senderId: currentDriverId,
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
      setSendingMessage(false);
      emitTypingStatus({
        rideId: selectedRideMarket.rideId,
        senderType: "driver",
        senderId: currentDriverId,
        isTyping: false,
      });
    }
  };

  const handleChatDraftChange = (value: string) => {
    setChatDraft(value);
    if (!selectedRideMarket?.rideId || !currentDriverId) return;

    emitTypingStatus({
      rideId: selectedRideMarket.rideId,
      senderType: "driver",
      senderId: currentDriverId,
      isTyping: value.trim().length > 0,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (value.trim().length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        emitTypingStatus({
          rideId: selectedRideMarket.rideId,
          senderType: "driver",
          senderId: currentDriverId,
          isTyping: false,
        });
      }, 1200);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />

      <View style={s.hero}>
        <Text style={s.heroEyebrow}>Driver requests</Text>
        <Text style={s.heroTitle}>Accept, pickup, start, finish</Text>
        <Text style={s.heroSubtitle}>
          One incoming request at a time, then one rider to manage through the trip.
        </Text>
      </View>

      <View style={s.sheet}>
        {loading ? (
          <View style={s.loadingState}>
            <ActivityIndicator color={INK} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <View style={s.statsRow}>
              <StatCard label="Requests" value={`${pendingRides.length}`} />
              <StatCard label="Active trips" value={`${activeTrips.length}`} />
              <StatCard
                label="Latest fare"
                value={pendingRides[0] ? `Rs ${pendingRides[0].estimatedFare}` : "—"}
              />
            </View>

            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Incoming ride requests</Text>
                <Pressable onPress={loadBoard}>
                  <Text style={s.sectionAction}>Refresh</Text>
                </Pressable>
              </View>

              {pendingRides.length === 0 ? (
                <View style={s.emptyCard}>
                  <Text style={s.emptyTitle}>No waiting requests</Text>
                  <Text style={s.emptyText}>
                    Stay online. New passenger requests will appear here automatically.
                  </Text>
                </View>
              ) : (
                pendingRides.map((ride) => {
                  const active = String(ride.rideId) === String(selectedRideId);
                  return (
                    <Pressable
                      key={String(ride.rideId)}
                      style={[s.requestCard, active && s.requestCardActive]}
                      onPress={() => setSelectedRideId(String(ride.rideId))}
                    >
                      <View style={s.requestTop}>
                        <View style={s.requestCopy}>
                          <Text style={s.requestName}>{ride.passengerName}</Text>
                          <Text style={s.requestMeta}>
                            Rating {ride.passengerRating} • {ride.requestedRideType.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={s.requestFare}>Rs {ride.estimatedFare}</Text>
                      </View>
                      <Text style={s.routeText} numberOfLines={1}>
                        {ride.pickup}
                      </Text>
                      <Text style={s.routeArrow}>to</Text>
                      <Text style={s.routeText} numberOfLines={1}>
                        {ride.drop}
                      </Text>
                      <Text style={s.requestFooter}>{ride.distance} • {ride.eta}</Text>
                      <Pressable
                        style={[
                          s.acceptButton,
                          acceptingRideId === String(ride.rideId) && s.disabledButton,
                        ]}
                        onPress={() => handleAcceptRide(ride)}
                        disabled={acceptingRideId === String(ride.rideId)}
                      >
                        {acceptingRideId === String(ride.rideId) ? (
                          <ActivityIndicator color={SURFACE} size="small" />
                        ) : (
                          <Text style={s.acceptButtonText}>Accept ride</Text>
                        )}
                      </Pressable>
                    </Pressable>
                  );
                })
              )}
            </View>

            {activeTrips.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Active trips</Text>
                {activeTrips.map((trip) => {
                  const active = String(trip.rideId) === String(selectedTripId);
                  return (
                    <Pressable
                      key={String(trip.rideId)}
                      style={[s.tripCard, active && s.tripCardActive]}
                      onPress={() => setSelectedTripId(String(trip.rideId))}
                    >
                      <View style={s.requestTop}>
                        <View style={s.requestCopy}>
                          <Text style={s.requestName}>{trip.passengerName}</Text>
                          <Text style={s.requestMeta}>
                            {TRIP_STATUS_LABELS[trip.status] ?? trip.status}
                          </Text>
                        </View>
                        <Text style={s.requestFare}>Rs {trip.estimatedFare}</Text>
                      </View>
                      <Text style={s.routeText} numberOfLines={1}>
                        {trip.pickup}
                      </Text>
                      <Text style={s.routeArrow}>to</Text>
                      <Text style={s.routeText} numberOfLines={1}>
                        {trip.drop}
                      </Text>
                      <Text style={s.requestFooter}>{trip.passengerPhone}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {selectedTrip && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Trip controls</Text>
                <View style={s.controlCard}>
                  <Text style={s.controlTitle}>{selectedTrip.passengerName}</Text>
                  <Text style={s.controlMeta}>
                    {TRIP_STATUS_LABELS[selectedTrip.status] ?? selectedTrip.status} • {selectedTrip.passengerPhone}
                  </Text>
                  <View style={s.tripMapWrap}>
                    <RideMap
                      title="Passenger trip map"
                      pickup={{
                        lat: selectedRideMarket?.pickupLat,
                        lng: selectedRideMarket?.pickupLng,
                        label: selectedRideMarket?.pickup || selectedTrip.pickup,
                      }}
                      drop={{
                        lat: selectedRideMarket?.dropLat,
                        lng: selectedRideMarket?.dropLng,
                        label: selectedRideMarket?.drop || selectedTrip.drop,
                      }}
                      driver={
                        selectedRideMarket?.assignedDriver
                          ? {
                              lat: selectedRideMarket.assignedDriver.lat,
                              lng: selectedRideMarket.assignedDriver.lng,
                              label: selectedRideMarket.assignedDriver.name,
                            }
                          : undefined
                      }
                      height={240}
                    />
                  </View>
                  <View style={s.controlActions}>
                    <Pressable style={s.secondaryButton} onPress={handleCallPassenger}>
                      <Text style={s.secondaryButtonText}>Call rider</Text>
                    </Pressable>
                    {selectedTrip.status === "accepted" && (
                      <Pressable
                        style={[
                          s.primaryButton,
                          updatingStatus === "arriving" && s.disabledButton,
                        ]}
                        onPress={() => handleUpdateTripStatus("arriving")}
                        disabled={updatingStatus === "arriving"}
                      >
                        <Text style={s.primaryButtonText}>Reached pickup</Text>
                      </Pressable>
                    )}
                    {selectedTrip.status === "arriving" && (
                      <Pressable
                        style={[
                          s.primaryButton,
                          updatingStatus === "on_trip" && s.disabledButton,
                        ]}
                        onPress={() => handleUpdateTripStatus("on_trip")}
                        disabled={updatingStatus === "on_trip"}
                      >
                        <Text style={s.primaryButtonText}>Start trip</Text>
                      </Pressable>
                    )}
                    {selectedTrip.status === "on_trip" && (
                      <Pressable
                        style={[
                          s.primaryButton,
                          updatingStatus === "completed" && s.disabledButton,
                        ]}
                        onPress={() => handleUpdateTripStatus("completed")}
                        disabled={updatingStatus === "completed"}
                      >
                        <Text style={s.primaryButtonText}>Complete trip</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            )}

            {selectedTrip && (
              <View style={s.chatCard}>
                <Text style={s.sectionTitle}>Passenger chat</Text>
                <RNScrollView
                  ref={chatScrollRef}
                  style={s.chatMessages}
                  contentContainerStyle={s.chatMessagesContent}
                  onContentSizeChange={() =>
                    chatScrollRef.current?.scrollToEnd({ animated: true })
                  }
                >
                  {(messages.length === 0
                    ? [
                        {
                          senderType: "passenger",
                          senderId: "preview",
                          senderName: selectedTrip.passengerName,
                          text: "Chat appears here after the ride is accepted.",
                          createdAt: new Date().toISOString(),
                        } as RideMessage,
                      ]
                    : messages
                  ).map((message, index) => {
                    const mine = message.senderType === "driver";
                    return (
                      <View
                        key={`${message.createdAt}-${index}`}
                        style={[s.messageBubble, mine ? s.messageMine : s.messageTheirs]}
                      >
                        <Text style={s.messageSender}>
                          {mine ? "You" : message.senderName}
                        </Text>
                        <Text style={[s.messageText, mine && s.messageTextMine]}>
                          {message.text}
                        </Text>
                        <Text style={[s.messageMeta, mine && s.messageMetaMine]}>
                          {formatMessageTimestamp(message.createdAt)}
                          {mine
                            ? ` • ${
                                message.seenAt
                                  ? "Seen"
                                  : message.deliveredAt
                                    ? "Delivered"
                                    : "Sending"
                              }`
                            : ""}
                        </Text>
                      </View>
                    );
                  })}
                  {isPassengerTyping ? (
                    <Text style={s.typingIndicator}>Passenger is typing...</Text>
                  ) : null}
                </RNScrollView>
                <View style={s.chatComposer}>
                  <TextInput
                    style={s.chatInput}
                    placeholder="Message passenger..."
                    placeholderTextColor={MUTED}
                    value={chatDraft}
                    onChangeText={handleChatDraftChange}
                  />
                  <Pressable
                    style={[
                      s.chatSendButton,
                      (!chatDraft.trim() || sendingMessage) && s.disabledButton,
                    ]}
                    onPress={handleSendMessage}
                    disabled={!chatDraft.trim() || sendingMessage}
                  >
                    {sendingMessage ? (
                      <ActivityIndicator color={SURFACE} size="small" />
                    ) : (
                      <Text style={s.chatSendText}>Send</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 24,
  },
  heroEyebrow: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: SURFACE,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
    marginTop: 10,
  },
  heroSubtitle: {
    color: "#B9C1C8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 320,
  },
  sheet: {
    flex: 1,
    backgroundColor: PAPER,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 14,
  },
  statValue: {
    color: INK,
    fontSize: 22,
    fontWeight: "900",
  },
  statLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 6,
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
  emptyCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  emptyTitle: {
    color: INK,
    fontSize: 15,
    fontWeight: "900",
  },
  emptyText: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  requestCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 14,
  },
  requestCardActive: {
    borderColor: ACCENT,
    backgroundColor: ALT_SURFACE,
  },
  tripCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 14,
  },
  tripCardActive: {
    borderColor: ACCENT,
    backgroundColor: ALT_SURFACE,
  },
  requestTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  requestCopy: { flex: 1 },
  requestName: {
    color: INK,
    fontSize: 16,
    fontWeight: "900",
  },
  requestMeta: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  requestFare: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: "900",
  },
  routeText: {
    color: INK,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  routeArrow: {
    color: MUTED,
    fontSize: 11,
    marginTop: 4,
  },
  requestFooter: {
    color: MUTED,
    fontSize: 11,
    marginTop: 10,
  },
  acceptButton: {
    minHeight: 46,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  acceptButtonText: {
    color: SURFACE,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  disabledButton: {
    opacity: 0.65,
  },
  controlCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  controlTitle: {
    color: INK,
    fontSize: 16,
    fontWeight: "900",
  },
  controlMeta: {
    color: MUTED,
    fontSize: 12,
    marginTop: 6,
  },
  controlActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  tripMapWrap: {
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: RULE,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAPER,
  },
  secondaryButtonText: {
    color: INK,
    fontSize: 12,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: INK,
    fontSize: 12,
    fontWeight: "900",
  },
  chatCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  chatMessages: {
    maxHeight: 220,
    marginTop: 12,
  },
  chatMessagesContent: {
    gap: 8,
    paddingBottom: 4,
  },
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
  messageTextMine: {
    color: SURFACE,
  },
  messageMeta: {
    color: MUTED,
    fontSize: 10,
    marginTop: 6,
  },
  messageMetaMine: {
    color: "#CBD5E1",
  },
  typingIndicator: {
    color: MUTED,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 2,
  },
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
});
