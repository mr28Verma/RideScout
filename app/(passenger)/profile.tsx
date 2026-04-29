import { router, useLocalSearchParams } from "expo-router";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import CustomInput from "@/components/CustomInput";
import { detectBackendPort } from "@/constants/api";
import {
  EmergencyContact,
  PaymentMethod,
  PaymentMethodType,
  RidePreference,
  SavedPlace,
  UserProfile,
  fetchUserProfile,
  logout,
  updateUserProfile,
} from "@/services/profileApi";

const INK = "#0A0A0A";
const PAPER = "#FFFFFF";
const SURFACE = "#F2F2F2";
const RULE = "#D6D6D6";
const MUTED = "#888888";
const ACCENT = "#00C853";
const DANGER = "#DC2626";

const RIDE_TYPES: { id: RidePreference; label: string }[] = [
  { id: "bike", label: "Bike" },
  { id: "mini", label: "Mini" },
  { id: "sedan", label: "Sedan" },
  { id: "suv", label: "SUV" },
];

const PAYMENT_TYPE_LABELS: Record<PaymentMethodType, string> = {
  mock: "Cash",
  stripe: "Card",
  razorpay: "UPI",
};

const emptyPlaceDraft = { label: "", address: "", lat: "", lng: "" };
const emptyPaymentDraft = {
  label: "",
  type: "mock" as PaymentMethodType,
  last4: "",
  isDefault: true,
};
const emptyContactDraft = { name: "", phone: "", relationship: "" };

type PlaceDraft = typeof emptyPlaceDraft;
type PaymentDraft = typeof emptyPaymentDraft;
type ContactDraft = typeof emptyContactDraft;

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function PassengerProfile() {
  const { userId: userIdParam } = useLocalSearchParams<{
    userId?: string;
    name?: string;
  }>();

  const userId = typeof userIdParam === "string" ? userIdParam : "";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState("");
  const [isEditingBasics, setIsEditingBasics] = useState(false);
  const [editName, setEditName] = useState("");
  const [preferredRideType, setPreferredRideType] =
    useState<RidePreference>("mini");

  const [placeDraft, setPlaceDraft] = useState<PlaceDraft>(emptyPlaceDraft);
  const [editingPlaceId, setEditingPlaceId] = useState("");
  const [showPlaceForm, setShowPlaceForm] = useState(false);

  const [paymentDraft, setPaymentDraft] =
    useState<PaymentDraft>(emptyPaymentDraft);
  const [editingPaymentId, setEditingPaymentId] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const [contactDraft, setContactDraft] =
    useState<ContactDraft>(emptyContactDraft);
  const [editingContactId, setEditingContactId] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);

  useEffect(() => {
    detectBackendPort().catch(() => console.warn("Port detection failed"));
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await fetchUserProfile(userId);
        hydrateProfile(data);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        Alert.alert("Error", errorMsg || "Failed to load your profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const hydrateProfile = (data: UserProfile) => {
    setProfile(data);
    setEditName(data.name);
    setPreferredRideType(data.preferredRideType ?? "mini");
  };

  const savedPlaces = profile?.savedPlaces ?? [];
  const paymentMethods = profile?.paymentMethods ?? [];
  const emergencyContacts = profile?.emergencyContacts ?? [];

  const stats = useMemo(
    () => [
      { label: "SAVED", value: String(savedPlaces.length) },
      { label: "PAYMENTS", value: String(paymentMethods.length) },
      { label: "SAFETY", value: String(emergencyContacts.length) },
    ],
    [emergencyContacts.length, paymentMethods.length, savedPlaces.length],
  );

  const savePatch = async (
    sectionKey: string,
    patch: Partial<UserProfile>,
    successMessage: string,
  ) => {
    try {
      setSavingSection(sectionKey);
      const updatedProfile = await updateUserProfile(userId, patch);
      hydrateProfile(updatedProfile);
      Alert.alert("Saved", successMessage);
      return updatedProfile;
    } catch (error) {
      Alert.alert(
        "Update failed",
        error instanceof Error ? error.message : "Please try again.",
      );
      return null;
    } finally {
      setSavingSection("");
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logout(userId);
            router.replace("/");
          } catch {
            Alert.alert("Error", "Failed to logout");
          }
        },
      },
    ]);
  };

  const handleSaveBasics = async () => {
    const nextName = editName.trim();

    if (!nextName) {
      Alert.alert("Invalid name", "Please enter your name.");
      return;
    }

    const updated = await savePatch(
      "basics",
      {
        name: nextName,
        preferredRideType,
      },
      "Your passenger preferences are updated.",
    );

    if (updated) {
      setIsEditingBasics(false);
    }
  };

  const startPlaceForm = (place?: SavedPlace) => {
    if (place) {
      setEditingPlaceId(place.id);
      setPlaceDraft({
        label: place.label,
        address: place.address,
        lat: place.lat !== undefined ? String(place.lat) : "",
        lng: place.lng !== undefined ? String(place.lng) : "",
      });
    } else {
      setEditingPlaceId("");
      setPlaceDraft(emptyPlaceDraft);
    }
    setShowPlaceForm(true);
  };

  const handleSavePlace = async () => {
    const label = placeDraft.label.trim();
    const address = placeDraft.address.trim();

    if (!label || !address) {
      Alert.alert("Missing details", "Add a label and address for this place.");
      return;
    }

    const nextPlace: SavedPlace = {
      id: editingPlaceId || createId("place"),
      label,
      address,
      lat: parseOptionalNumber(placeDraft.lat),
      lng: parseOptionalNumber(placeDraft.lng),
    };

    const nextPlaces = editingPlaceId
      ? savedPlaces.map((place) => (place.id === editingPlaceId ? nextPlace : place))
      : [...savedPlaces, nextPlace];

    const updated = await savePatch(
      "places",
      { savedPlaces: nextPlaces },
      editingPlaceId ? "Saved place updated." : "Saved place added.",
    );

    if (updated) {
      setShowPlaceForm(false);
      setEditingPlaceId("");
      setPlaceDraft(emptyPlaceDraft);
    }
  };

  const handleDeletePlace = (placeId: string) => {
    Alert.alert("Delete place", "Remove this saved place?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await savePatch(
            "places",
            { savedPlaces: savedPlaces.filter((place) => place.id !== placeId) },
            "Saved place removed.",
          );
        },
      },
    ]);
  };

  const startPaymentForm = (payment?: PaymentMethod) => {
    if (payment) {
      setEditingPaymentId(payment.id);
      setPaymentDraft({
        label: payment.label,
        type: payment.type,
        last4: payment.last4,
        isDefault: payment.isDefault,
      });
    } else {
      setEditingPaymentId("");
      setPaymentDraft({
        ...emptyPaymentDraft,
        isDefault: paymentMethods.length === 0,
      });
    }
    setShowPaymentForm(true);
  };

  const handleSavePayment = async () => {
    const label = paymentDraft.label.trim();
    const last4 = paymentDraft.last4.replace(/\D/g, "").slice(-4);

    if (!label || last4.length !== 4) {
      Alert.alert(
        "Missing details",
        "Add a label and the last 4 digits for this payment method.",
      );
      return;
    }

    const nextPayment: PaymentMethod = {
      id: editingPaymentId || createId("payment"),
      label,
      type: paymentDraft.type,
      last4,
      isDefault: paymentDraft.isDefault,
    };

    let nextPayments = editingPaymentId
      ? paymentMethods.map((payment) =>
          payment.id === editingPaymentId ? nextPayment : payment,
        )
      : [...paymentMethods, nextPayment];

    if (nextPayment.isDefault) {
      nextPayments = nextPayments.map((payment) => ({
        ...payment,
        isDefault: payment.id === nextPayment.id,
      }));
    } else if (!nextPayments.some((payment) => payment.isDefault)) {
      nextPayments = nextPayments.map((payment, index) => ({
        ...payment,
        isDefault: index === 0,
      }));
    }

    const updated = await savePatch(
      "payments",
      { paymentMethods: nextPayments },
      editingPaymentId ? "Payment method updated." : "Payment method added.",
    );

    if (updated) {
      setShowPaymentForm(false);
      setEditingPaymentId("");
      setPaymentDraft(emptyPaymentDraft);
    }
  };

  const handleDeletePayment = (paymentId: string) => {
    Alert.alert("Delete payment", "Remove this payment method?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const remaining = paymentMethods.filter(
            (payment) => payment.id !== paymentId,
          );
          if (remaining.length > 0 && !remaining.some((payment) => payment.isDefault)) {
            remaining[0] = { ...remaining[0], isDefault: true };
          }
          await savePatch(
            "payments",
            { paymentMethods: remaining },
            "Payment method removed.",
          );
        },
      },
    ]);
  };

  const startContactForm = (contact?: EmergencyContact) => {
    if (contact) {
      setEditingContactId(contact.id);
      setContactDraft({
        name: contact.name,
        phone: contact.phone,
        relationship: contact.relationship,
      });
    } else {
      setEditingContactId("");
      setContactDraft(emptyContactDraft);
    }
    setShowContactForm(true);
  };

  const handleSaveContact = async () => {
    const name = contactDraft.name.trim();
    const phone = contactDraft.phone.trim();
    const relationship = contactDraft.relationship.trim();

    if (!name || !phone || !relationship) {
      Alert.alert(
        "Missing details",
        "Add a name, phone number, and relationship for this contact.",
      );
      return;
    }

    const nextContact: EmergencyContact = {
      id: editingContactId || createId("contact"),
      name,
      phone,
      relationship,
    };

    const nextContacts = editingContactId
      ? emergencyContacts.map((contact) =>
          contact.id === editingContactId ? nextContact : contact,
        )
      : [...emergencyContacts, nextContact];

    const updated = await savePatch(
      "contacts",
      { emergencyContacts: nextContacts },
      editingContactId ? "Emergency contact updated." : "Emergency contact added.",
    );

    if (updated) {
      setShowContactForm(false);
      setEditingContactId("");
      setContactDraft(emptyContactDraft);
    }
  };

  const handleDeleteContact = (contactId: string) => {
    Alert.alert("Delete contact", "Remove this emergency contact?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await savePatch(
            "contacts",
            {
              emergencyContacts: emergencyContacts.filter(
                (contact) => contact.id !== contactId,
              ),
            },
            "Emergency contact removed.",
          );
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={s.loadingRoot}>
        <StatusBar barStyle="light-content" backgroundColor={INK} />
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={s.loadingRoot}>
        <StatusBar barStyle="light-content" backgroundColor={INK} />
        <Text style={s.errorText}>Failed to load profile</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={INK} />

      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.header}>
          <View style={s.topBar}>
            <Pressable onPress={() => router.back()}>
              <Text style={s.backBtn}>Back</Text>
            </Pressable>
            <View style={s.logoBadge}>
              <Text style={s.logoText}>RIDE</Text>
            </View>
          </View>
          <Text style={s.greeting}>Passenger Profile</Text>
          <Text style={s.subGreeting}>
            Good to see you, {profile.name.split(" ")[0]}
          </Text>
        </View>

        <View style={s.statsRow}>
          {stats.map((item, index) => (
            <View key={item.label} style={s.statCell}>
              <Text style={s.statLabel}>{item.label}</Text>
              <Text style={s.statValue}>{item.value}</Text>
              {index < stats.length - 1 && <View style={s.statDivider} />}
            </View>
          ))}
        </View>

        <View style={s.sheet}>
          <View style={s.heroCard}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={s.heroTextWrap}>
              <Text style={s.profileName}>{profile.name}</Text>
              <Text style={s.profileRole}>Passenger</Text>
              <Text style={s.profileMeta}>{profile.email}</Text>
              <Text style={s.profileMeta}>
                Member since{" "}
                {profile.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString()
                  : "N/A"}
              </Text>
            </View>
          </View>

          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View>
                <Text style={s.sectionEyebrow}>ACCOUNT</Text>
                <Text style={s.sectionTitle}>Basics and ride preference</Text>
              </View>
              {!isEditingBasics && (
                <Pressable onPress={() => setIsEditingBasics(true)}>
                  <Text style={s.sectionAction}>EDIT</Text>
                </Pressable>
              )}
            </View>

            {isEditingBasics ? (
              <View>
                <View style={s.fieldStack}>
                  <Text style={s.fieldLabel}>NAME</Text>
                  <CustomInput
                    placeholder="Full Name"
                    value={editName}
                    onChangeText={setEditName}
                    placeholderTextColor={MUTED}
                  />
                </View>

                <Text style={s.fieldLabel}>PREFERRED RIDE</Text>
                <View style={s.choiceRow}>
                  {RIDE_TYPES.map((rideType) => {
                    const selected = preferredRideType === rideType.id;
                    return (
                      <Pressable
                        key={rideType.id}
                        style={[s.choicePill, selected && s.choicePillSelected]}
                        onPress={() => setPreferredRideType(rideType.id)}
                      >
                        <Text
                          style={[
                            s.choiceText,
                            selected && s.choiceTextSelected,
                          ]}
                        >
                          {rideType.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={s.buttonRow}>
                  <Pressable
                    style={[s.secondaryBtn, s.halfBtn]}
                    onPress={() => {
                      setIsEditingBasics(false);
                      setEditName(profile.name);
                      setPreferredRideType(profile.preferredRideType ?? "mini");
                    }}
                  >
                    <Text style={s.secondaryBtnText}>CANCEL</Text>
                  </Pressable>
                  <Pressable
                    style={[s.primaryBtn, s.halfBtn]}
                    onPress={handleSaveBasics}
                    disabled={savingSection === "basics"}
                  >
                    {savingSection === "basics" ? (
                      <ActivityIndicator color={PAPER} size="small" />
                    ) : (
                      <Text style={s.primaryBtnText}>SAVE</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={s.summaryList}>
                <SummaryRow
                  label="Name"
                  value={profile.name}
                />
                <SummaryRow
                  label="Ride preference"
                  value={
                    RIDE_TYPES.find((rideType) => rideType.id === preferredRideType)
                      ?.label ?? "Mini"
                  }
                />
              </View>
            )}
          </View>

          <ManageSection
            eyebrow="PLACES"
            title="Saved locations"
            subtitle="Fast-fill pickup or destination from your profile."
            actionLabel="ADD"
            onActionPress={() => startPlaceForm()}
            isBusy={savingSection === "places"}
          >
            {savedPlaces.length === 0 ? (
              <EmptyState text="Add home, work, or favorite stops to speed up booking." />
            ) : (
              savedPlaces.map((place) => (
                <ManageRow
                  key={place.id}
                  title={place.label}
                  subtitle={place.address}
                  meta={
                    place.lat !== undefined && place.lng !== undefined
                      ? `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`
                      : "No coordinates saved"
                  }
                  onEdit={() => startPlaceForm(place)}
                  onDelete={() => handleDeletePlace(place.id)}
                />
              ))
            )}

            {showPlaceForm && (
              <View style={s.formCard}>
                <Text style={s.formTitle}>
                  {editingPlaceId ? "Edit saved place" : "Add saved place"}
                </Text>
                <FormField
                  label="LABEL"
                  value={placeDraft.label}
                  onChangeText={(value) =>
                    setPlaceDraft((current) => ({ ...current, label: value }))
                  }
                  placeholder="Home"
                />
                <FormField
                  label="ADDRESS"
                  value={placeDraft.address}
                  onChangeText={(value) =>
                    setPlaceDraft((current) => ({ ...current, address: value }))
                  }
                  placeholder="14 Park Street, Kolkata"
                />
                <View style={s.buttonRow}>
                  <View style={s.halfBtn}>
                    <FormField
                      label="LAT"
                      value={placeDraft.lat}
                      onChangeText={(value) =>
                        setPlaceDraft((current) => ({ ...current, lat: value }))
                      }
                      placeholder="Optional"
                    />
                  </View>
                  <View style={s.halfBtn}>
                    <FormField
                      label="LNG"
                      value={placeDraft.lng}
                      onChangeText={(value) =>
                        setPlaceDraft((current) => ({ ...current, lng: value }))
                      }
                      placeholder="Optional"
                    />
                  </View>
                </View>
                <View style={s.buttonRow}>
                  <Pressable
                    style={[s.secondaryBtn, s.halfBtn]}
                    onPress={() => {
                      setShowPlaceForm(false);
                      setEditingPlaceId("");
                      setPlaceDraft(emptyPlaceDraft);
                    }}
                  >
                    <Text style={s.secondaryBtnText}>CANCEL</Text>
                  </Pressable>
                  <Pressable
                    style={[s.primaryBtn, s.halfBtn]}
                    onPress={handleSavePlace}
                    disabled={savingSection === "places"}
                  >
                    {savingSection === "places" ? (
                      <ActivityIndicator color={PAPER} size="small" />
                    ) : (
                      <Text style={s.primaryBtnText}>SAVE PLACE</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ManageSection>

          <ManageSection
            eyebrow="PAYMENTS"
            title="Payment methods"
            subtitle="Choose how your rides should be charged."
            actionLabel="ADD"
            onActionPress={() => startPaymentForm()}
            isBusy={savingSection === "payments"}
          >
            {paymentMethods.length === 0 ? (
              <EmptyState text="Add cash, card, or UPI details for faster checkout." />
            ) : (
              paymentMethods.map((payment) => (
                <ManageRow
                  key={payment.id}
                  title={payment.label}
                  subtitle={`${PAYMENT_TYPE_LABELS[payment.type]} ending in ${payment.last4}`}
                  meta={payment.isDefault ? "Default method" : "Available"}
                  onEdit={() => startPaymentForm(payment)}
                  onDelete={() => handleDeletePayment(payment.id)}
                />
              ))
            )}

            {showPaymentForm && (
              <View style={s.formCard}>
                <Text style={s.formTitle}>
                  {editingPaymentId ? "Edit payment method" : "Add payment method"}
                </Text>
                <FormField
                  label="LABEL"
                  value={paymentDraft.label}
                  onChangeText={(value) =>
                    setPaymentDraft((current) => ({ ...current, label: value }))
                  }
                  placeholder="Personal card"
                />
                <Text style={s.fieldLabel}>TYPE</Text>
                <View style={s.choiceRow}>
                  {(Object.keys(PAYMENT_TYPE_LABELS) as PaymentMethodType[]).map(
                    (type) => {
                      const selected = paymentDraft.type === type;
                      return (
                        <Pressable
                          key={type}
                          style={[
                            s.choicePill,
                            selected && s.choicePillSelected,
                          ]}
                          onPress={() =>
                            setPaymentDraft((current) => ({ ...current, type }))
                          }
                        >
                          <Text
                            style={[
                              s.choiceText,
                              selected && s.choiceTextSelected,
                            ]}
                          >
                            {PAYMENT_TYPE_LABELS[type]}
                          </Text>
                        </Pressable>
                      );
                    },
                  )}
                </View>
                <FormField
                  label="LAST 4 DIGITS"
                  value={paymentDraft.last4}
                  onChangeText={(value) =>
                    setPaymentDraft((current) => ({
                      ...current,
                      last4: value.replace(/\D/g, "").slice(-4),
                    }))
                  }
                  placeholder="1234"
                />
                <View style={s.toggleRow}>
                  <View>
                    <Text style={s.toggleTitle}>Set as default</Text>
                    <Text style={s.toggleSubtitle}>
                      Use this method first during booking.
                    </Text>
                  </View>
                  <Switch
                    value={paymentDraft.isDefault}
                    onValueChange={(value) =>
                      setPaymentDraft((current) => ({
                        ...current,
                        isDefault: value,
                      }))
                    }
                    trackColor={{ false: RULE, true: ACCENT }}
                    thumbColor={PAPER}
                  />
                </View>
                <View style={s.buttonRow}>
                  <Pressable
                    style={[s.secondaryBtn, s.halfBtn]}
                    onPress={() => {
                      setShowPaymentForm(false);
                      setEditingPaymentId("");
                      setPaymentDraft(emptyPaymentDraft);
                    }}
                  >
                    <Text style={s.secondaryBtnText}>CANCEL</Text>
                  </Pressable>
                  <Pressable
                    style={[s.primaryBtn, s.halfBtn]}
                    onPress={handleSavePayment}
                    disabled={savingSection === "payments"}
                  >
                    {savingSection === "payments" ? (
                      <ActivityIndicator color={PAPER} size="small" />
                    ) : (
                      <Text style={s.primaryBtnText}>SAVE METHOD</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ManageSection>

          <ManageSection
            eyebrow="SAFETY"
            title="Emergency contacts"
            subtitle="Keep people ready to reach if something goes wrong."
            actionLabel="ADD"
            onActionPress={() => startContactForm()}
            isBusy={savingSection === "contacts"}
          >
            {emergencyContacts.length === 0 ? (
              <EmptyState text="Add a trusted contact for emergencies during rides." />
            ) : (
              emergencyContacts.map((contact) => (
                <ManageRow
                  key={contact.id}
                  title={contact.name}
                  subtitle={contact.relationship}
                  meta={contact.phone}
                  onEdit={() => startContactForm(contact)}
                  onDelete={() => handleDeleteContact(contact.id)}
                />
              ))
            )}

            {showContactForm && (
              <View style={s.formCard}>
                <Text style={s.formTitle}>
                  {editingContactId ? "Edit emergency contact" : "Add emergency contact"}
                </Text>
                <FormField
                  label="NAME"
                  value={contactDraft.name}
                  onChangeText={(value) =>
                    setContactDraft((current) => ({ ...current, name: value }))
                  }
                  placeholder="Ananya Sen"
                />
                <FormField
                  label="PHONE"
                  value={contactDraft.phone}
                  onChangeText={(value) =>
                    setContactDraft((current) => ({ ...current, phone: value }))
                  }
                  placeholder="+91 98765 43210"
                />
                <FormField
                  label="RELATIONSHIP"
                  value={contactDraft.relationship}
                  onChangeText={(value) =>
                    setContactDraft((current) => ({
                      ...current,
                      relationship: value,
                    }))
                  }
                  placeholder="Sister"
                />
                <View style={s.buttonRow}>
                  <Pressable
                    style={[s.secondaryBtn, s.halfBtn]}
                    onPress={() => {
                      setShowContactForm(false);
                      setEditingContactId("");
                      setContactDraft(emptyContactDraft);
                    }}
                  >
                    <Text style={s.secondaryBtnText}>CANCEL</Text>
                  </Pressable>
                  <Pressable
                    style={[s.primaryBtn, s.halfBtn]}
                    onPress={handleSaveContact}
                    disabled={savingSection === "contacts"}
                  >
                    {savingSection === "contacts" ? (
                      <ActivityIndicator color={PAPER} size="small" />
                    ) : (
                      <Text style={s.primaryBtnText}>SAVE CONTACT</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ManageSection>

          <Pressable style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutBtnText}>LOGOUT</Text>
          </Pressable>
        </View>
      </ScrollView>
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

function EmptyState({ text }: { text: string }) {
  return <Text style={s.emptyText}>{text}</Text>;
}

function ManageSection({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  onActionPress,
  isBusy,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  onActionPress: () => void;
  isBusy: boolean;
  children: ReactNode;
}) {
  return (
    <View style={s.sectionCard}>
      <View style={s.sectionHeader}>
        <View style={s.sectionHeaderText}>
          <Text style={s.sectionEyebrow}>{eyebrow}</Text>
          <Text style={s.sectionTitle}>{title}</Text>
          <Text style={s.sectionSubtitle}>{subtitle}</Text>
        </View>
        <Pressable onPress={onActionPress} disabled={isBusy}>
          <Text style={s.sectionAction}>{isBusy ? "SAVING" : actionLabel}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function ManageRow({
  title,
  subtitle,
  meta,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  meta: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={s.manageRow}>
      <View style={s.manageCopy}>
        <Text style={s.manageTitle}>{title}</Text>
        <Text style={s.manageSubtitle}>{subtitle}</Text>
        <Text style={s.manageMeta}>{meta}</Text>
      </View>
      <View style={s.manageActions}>
        <Pressable onPress={onEdit}>
          <Text style={s.manageEdit}>EDIT</Text>
        </Pressable>
        <Pressable onPress={onDelete}>
          <Text style={s.manageDelete}>DELETE</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={s.fieldStack}>
      <Text style={s.fieldLabel}>{label}</Text>
      <CustomInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={MUTED}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: INK,
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingBottom: 40,
  },
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
    marginBottom: 24,
  },
  backBtn: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: "800",
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
  greeting: {
    color: PAPER,
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 42,
  },
  subGreeting: {
    color: MUTED,
    fontSize: 13,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: PAPER,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  statCell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    position: "relative",
  },
  statDivider: {
    position: "absolute",
    right: 0,
    top: 14,
    bottom: 14,
    width: 1,
    backgroundColor: RULE,
  },
  statLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  statValue: {
    color: INK,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  sheet: {
    backgroundColor: PAPER,
    padding: 16,
    gap: 14,
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RULE,
    padding: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: INK,
    fontSize: 28,
    fontWeight: "900",
  },
  heroTextWrap: {
    flex: 1,
  },
  profileName: {
    color: INK,
    fontSize: 24,
    fontWeight: "900",
  },
  profileRole: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  profileMeta: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: PAPER,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionEyebrow: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  sectionTitle: {
    color: INK,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  sectionSubtitle: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  sectionAction: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  fieldStack: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: SURFACE,
  },
  choicePillSelected: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  choiceText: {
    color: INK,
    fontSize: 12,
    fontWeight: "800",
  },
  choiceTextSelected: {
    color: PAPER,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  halfBtn: {
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  primaryBtnText: {
    color: PAPER,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: RULE,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: SURFACE,
  },
  secondaryBtnText: {
    color: INK,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  summaryList: {
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
  },
  summaryValue: {
    flex: 1,
    textAlign: "right",
    color: INK,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyText: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 19,
  },
  manageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: RULE,
  },
  manageCopy: {
    flex: 1,
  },
  manageTitle: {
    color: INK,
    fontSize: 15,
    fontWeight: "800",
  },
  manageSubtitle: {
    color: INK,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  manageMeta: {
    color: MUTED,
    fontSize: 11,
    marginTop: 4,
  },
  manageActions: {
    alignItems: "flex-end",
    gap: 10,
  },
  manageEdit: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  manageDelete: {
    color: DANGER,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  formCard: {
    marginTop: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: RULE,
    backgroundColor: SURFACE,
  },
  formTitle: {
    color: INK,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  toggleTitle: {
    color: INK,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleSubtitle: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  logoutBtn: {
    backgroundColor: DANGER,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    marginTop: 6,
  },
  logoutBtnText: {
    color: PAPER,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  errorText: {
    color: DANGER,
    fontSize: 16,
    fontWeight: "700",
  },
});
