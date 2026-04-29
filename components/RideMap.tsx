import { memo, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

type Coordinate = {
  lat: number;
  lng: number;
  label: string;
  color: string;
};

type RideMapProps = {
  pickup?: { lat?: number; lng?: number; label?: string | null };
  drop?: { lat?: number; lng?: number; label?: string | null };
  driver?: { lat?: number; lng?: number; label?: string | null };
  height?: number;
  title?: string;
};

function isValidCoordinate(lat?: number, lng?: number) {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function buildMarkerScript(points: Coordinate[]) {
  const serializedPoints = JSON.stringify(points);

  return `
    const points = ${serializedPoints};
    const map = L.map('map', { zoomControl: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const bounds = [];

    points.forEach((point) => {
      const icon = L.divIcon({
        className: 'ride-marker-wrapper',
        html: '<div class="ride-marker" style="background:' + point.color + ';"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      L.marker([point.lat, point.lng], { icon })
        .addTo(map)
        .bindPopup('<strong>' + point.label + '</strong>');

      bounds.push([point.lat, point.lng]);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    } else {
      map.fitBounds(bounds, { padding: [36, 36] });
    }

    if (points.length >= 2) {
      const routeLine = points.map((point) => [point.lat, point.lng]);
      L.polyline(routeLine, {
        color: '#111827',
        weight: 4,
        opacity: 0.85,
        dashArray: points.length > 2 ? null : '6 8'
      }).addTo(map);
    }
  `;
}

function RideMap({
  pickup,
  drop,
  driver,
  height = 220,
  title = "Live map",
}: RideMapProps) {
  const points = useMemo(() => {
    const nextPoints: Coordinate[] = [];

    if (isValidCoordinate(pickup?.lat, pickup?.lng)) {
      nextPoints.push({
        lat: pickup!.lat!,
        lng: pickup!.lng!,
        label: pickup?.label?.trim() || "Pickup",
        color: "#16A34A",
      });
    }

    if (isValidCoordinate(drop?.lat, drop?.lng)) {
      nextPoints.push({
        lat: drop!.lat!,
        lng: drop!.lng!,
        label: drop?.label?.trim() || "Destination",
        color: "#F59E0B",
      });
    }

    if (isValidCoordinate(driver?.lat, driver?.lng)) {
      nextPoints.push({
        lat: driver!.lat!,
        lng: driver!.lng!,
        label: driver?.label?.trim() || "Driver",
        color: "#0F172A",
      });
    }

    return nextPoints;
  }, [driver?.label, driver?.lat, driver?.lng, drop?.label, drop?.lat, drop?.lng, pickup?.label, pickup?.lat, pickup?.lng]);

  const html = useMemo(() => {
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
            crossorigin=""
          />
          <style>
            html, body, #map {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              background: #f5f1e8;
            }
            .leaflet-control-attribution {
              font-family: Arial, sans-serif;
              font-size: 9px;
            }
            .ride-marker-wrapper {
              background: transparent;
              border: 0;
            }
            .ride-marker {
              width: 18px;
              height: 18px;
              border-radius: 9px;
              border: 3px solid #ffffff;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.24);
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script
            src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
            integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
            crossorigin=""
          ></script>
          <script>
            ${buildMarkerScript(points)}
          </script>
        </body>
      </html>
    `;
  }, [points]);

  if (points.length === 0) {
    return (
      <View style={[styles.emptyState, { height }]}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>
          Add real pickup and destination coordinates to load the map.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.mapShell, { height }]}>
      <View style={styles.mapHeader}>
        <Text style={styles.mapTitle}>{title}</Text>
        <Text style={styles.mapMeta}>OpenStreetMap</Text>
      </View>
      <View style={styles.mapBody}>
        <WebView
          originWhitelist={["*"]}
          source={Platform.OS === "web" ? { html, baseUrl: "" } : { html }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          nestedScrollEnabled={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapShell: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DDD5C9",
    backgroundColor: "#FFFFFF",
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE6D9",
    backgroundColor: "#F7F4EE",
  },
  mapTitle: {
    color: "#081018",
    fontSize: 13,
    fontWeight: "800",
  },
  mapMeta: {
    color: "#6D685D",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  mapBody: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: "#F7F4EE",
  },
  emptyState: {
    borderWidth: 1,
    borderColor: "#DDD5C9",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    color: "#081018",
    fontSize: 15,
    fontWeight: "900",
  },
  emptyText: {
    color: "#6D685D",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 280,
  },
});

export default memo(RideMap);
