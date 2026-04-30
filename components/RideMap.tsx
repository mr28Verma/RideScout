import { memo, useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

type MapPoint = {
  lat: number;
  lng: number;
  label: string;
};

type RideMapPayload = {
  pickup?: MapPoint;
  drop?: MapPoint;
  driver?: MapPoint;
  title: string;
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

function normalizePoint(
  point: RideMapProps["pickup"],
  fallbackLabel: string,
): MapPoint | undefined {
  if (!isValidCoordinate(point?.lat, point?.lng)) {
    return undefined;
  }

  return {
    lat: point!.lat!,
    lng: point!.lng!,
    label: point?.label?.trim() || fallbackLabel,
  };
}

const MAP_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #f5f1e8;
        overflow: hidden;
        font-family: Arial, sans-serif;
      }
      #map {
        width: 100%;
        height: 100%;
        background: #f5f1e8;
      }
      .leaflet-control-attribution {
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
      .ride-driver-marker {
        width: 20px;
        height: 20px;
        border-radius: 10px;
        border: 3px solid #ffffff;
        background: #0f172a;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.32);
        position: relative;
      }
      .ride-driver-marker::after {
        content: '';
        position: absolute;
        inset: -8px;
        border-radius: 999px;
        border: 1px solid rgba(15, 23, 42, 0.16);
      }
      .stats-pill {
        background: rgba(8, 16, 24, 0.92);
        color: #ffffff;
        border-radius: 14px;
        padding: 8px 10px;
        box-shadow: 0 8px 18px rgba(8, 16, 24, 0.16);
      }
      .stats-title {
        font-size: 9px;
        letter-spacing: 1px;
        color: rgba(255, 255, 255, 0.68);
        text-transform: uppercase;
      }
      .stats-value {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        font-weight: 700;
        color: #ffffff;
      }
      .stats-subvalue {
        display: block;
        margin-top: 3px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.8);
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
      const map = L.map('map', { zoomControl: false, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const markerIcons = {
        pickup: L.divIcon({
          className: 'ride-marker-wrapper',
          html: '<div class="ride-marker" style="background:#16A34A;"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        }),
        drop: L.divIcon({
          className: 'ride-marker-wrapper',
          html: '<div class="ride-marker" style="background:#F59E0B;"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        }),
        driver: L.divIcon({
          className: 'ride-marker-wrapper',
          html: '<div class="ride-driver-marker"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      };

      let pickupMarker = null;
      let dropMarker = null;
      let driverMarker = null;
      let routeLine = null;
      let statsControl = null;
      let lastDriverPosition = null;
      let activeAnimation = null;
      let routeCacheKey = '';

      function createMarker(marker, point, icon) {
        if (!point) {
          if (marker) {
            map.removeLayer(marker);
          }
          return null;
        }

        if (!marker) {
          marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
        } else {
          marker.setLatLng([point.lat, point.lng]);
        }

        marker.bindPopup('<strong>' + point.label + '</strong>');
        return marker;
      }

      function animateDriverMarker(nextPoint) {
        if (!nextPoint) {
          if (driverMarker) {
            map.removeLayer(driverMarker);
            driverMarker = null;
          }
          lastDriverPosition = null;
          return;
        }

        if (!driverMarker) {
          driverMarker = L.marker([nextPoint.lat, nextPoint.lng], {
            icon: markerIcons.driver
          }).addTo(map);
          driverMarker.bindPopup('<strong>' + nextPoint.label + '</strong>');
          lastDriverPosition = { lat: nextPoint.lat, lng: nextPoint.lng };
          return;
        }

        driverMarker.bindPopup('<strong>' + nextPoint.label + '</strong>');

        if (!lastDriverPosition) {
          driverMarker.setLatLng([nextPoint.lat, nextPoint.lng]);
          lastDriverPosition = { lat: nextPoint.lat, lng: nextPoint.lng };
          return;
        }

        if (activeAnimation) {
          cancelAnimationFrame(activeAnimation.frameId);
          activeAnimation = null;
        }

        const start = { ...lastDriverPosition };
        const end = { lat: nextPoint.lat, lng: nextPoint.lng };
        const startTime = performance.now();
        const duration = 1200;

        function tick(now) {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          const lat = start.lat + (end.lat - start.lat) * eased;
          const lng = start.lng + (end.lng - start.lng) * eased;

          driverMarker.setLatLng([lat, lng]);

          if (progress < 1) {
            activeAnimation = { frameId: requestAnimationFrame(tick) };
          } else {
            lastDriverPosition = end;
            activeAnimation = null;
          }
        }

        activeAnimation = { frameId: requestAnimationFrame(tick) };
      }

      function updateStats(distanceText, etaText) {
        if (statsControl) {
          map.removeControl(statsControl);
        }

        statsControl = L.control({ position: 'topright' });
        statsControl.onAdd = function () {
          const div = L.DomUtil.create('div', 'stats-pill');
          div.innerHTML =
            '<div class="stats-title">Trip outlook</div>' +
            '<span class="stats-value">' + distanceText + '</span>' +
            '<span class="stats-subvalue">' + etaText + '</span>';
          return div;
        };
        statsControl.addTo(map);
      }

      function fitAllBounds(payload, routeCoords) {
        const bounds = [];

        [payload.pickup, payload.drop, payload.driver].forEach((point) => {
          if (point) {
            bounds.push([point.lat, point.lng]);
          }
        });

        if (Array.isArray(routeCoords)) {
          routeCoords.forEach((coord) => bounds.push([coord[1], coord[0]]));
        }

        if (bounds.length === 0) {
          map.setView([28.6139, 77.209], 12);
          return;
        }

        if (bounds.length === 1) {
          map.setView(bounds[0], 14);
          return;
        }

        map.fitBounds(bounds, {
          padding: [42, 42],
          maxZoom: 15
        });
      }

      async function drawRoute(payload) {
        const routePoints = [];
        if (payload.pickup) routePoints.push(payload.pickup);
        if (payload.driver) routePoints.push(payload.driver);
        if (payload.drop) routePoints.push(payload.drop);

        const canRequestRoute = payload.pickup && payload.drop;
        if (!canRequestRoute) {
          if (routeLine) {
            map.removeLayer(routeLine);
            routeLine = null;
          }
          updateStats(payload.driver ? 'Driver live' : 'Waiting route', payload.title || 'Map ready');
          fitAllBounds(payload);
          return;
        }

        const routeKey = JSON.stringify({
          pickup: payload.pickup,
          drop: payload.drop,
          driver: payload.driver
            ? {
                lat: Number(payload.driver.lat.toFixed(4)),
                lng: Number(payload.driver.lng.toFixed(4))
              }
            : null
        });

        if (routeCacheKey === routeKey && routeLine) {
          fitAllBounds(payload);
          return;
        }

        routeCacheKey = routeKey;
        const coordinates = routePoints
          .map((point) => point.lng + ',' + point.lat)
          .join(';');

        try {
          const response = await fetch(
            'https://router.project-osrm.org/route/v1/driving/' +
              coordinates +
              '?overview=full&geometries=geojson',
          );
          const data = await response.json();
          const route = data && data.routes && data.routes[0];

          if (!route || !route.geometry || !Array.isArray(route.geometry.coordinates)) {
            throw new Error('Route missing');
          }

          const latLngs = route.geometry.coordinates.map((coord) => [coord[1], coord[0]]);
          if (routeLine) {
            map.removeLayer(routeLine);
          }

          routeLine = L.polyline(latLngs, {
            color: '#111827',
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          const distanceKm = route.distance / 1000;
          const durationMinutes = route.duration / 60;
          updateStats(
            distanceKm.toFixed(1) + ' km',
            Math.max(1, Math.round(durationMinutes)) + ' min ETA',
          );
          fitAllBounds(payload, route.geometry.coordinates);
        } catch (error) {
          const fallbackLine = [
            [payload.pickup.lat, payload.pickup.lng],
            ...(payload.driver ? [[payload.driver.lat, payload.driver.lng]] : []),
            [payload.drop.lat, payload.drop.lng]
          ];

          if (routeLine) {
            map.removeLayer(routeLine);
          }

          routeLine = L.polyline(fallbackLine, {
            color: '#111827',
            weight: 4,
            opacity: 0.8,
            dashArray: '7 8'
          }).addTo(map);

          updateStats('Route preview', 'OSRM unavailable');
          fitAllBounds(payload);
        }
      }

      async function renderMap(payload) {
        pickupMarker = createMarker(pickupMarker, payload.pickup, markerIcons.pickup);
        dropMarker = createMarker(dropMarker, payload.drop, markerIcons.drop);
        animateDriverMarker(payload.driver);
        await drawRoute(payload);
      }

      window.__rideMapRender = renderMap;

      document.addEventListener('message', async function (event) {
        try {
          const payload = JSON.parse(event.data);
          await renderMap(payload);
        } catch (error) {
          updateStats('Map sync failed', 'Trying again');
        }
      });

      window.addEventListener('message', async function (event) {
        try {
          const payload = JSON.parse(event.data);
          await renderMap(payload);
        } catch (error) {
          updateStats('Map sync failed', 'Trying again');
        }
      });

      map.setView([28.6139, 77.209], 12);
      updateStats('Preparing map', 'Waiting for coordinates');
    </script>
  </body>
</html>
`;

function RideMap({
  pickup,
  drop,
  driver,
  height = 220,
  title = "Live map",
}: RideMapProps) {
  const webViewRef = useRef<WebView>(null);
  const hasLoadedRef = useRef(false);

  const payload = useMemo<RideMapPayload>(
    () => ({
      title,
      pickup: normalizePoint(pickup, "Pickup"),
      drop: normalizePoint(drop, "Destination"),
      driver: normalizePoint(driver, "Driver"),
    }),
    [driver, drop, pickup, title],
  );

  useEffect(() => {
    if (!hasLoadedRef.current || !webViewRef.current) {
      return;
    }

    const script = `
      window.__rideMapRender && window.__rideMapRender(${JSON.stringify(payload)});
      true;
    `;
    webViewRef.current.injectJavaScript(script);
  }, [payload]);

  if (!payload.pickup && !payload.drop && !payload.driver) {
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
        <Text style={styles.mapMeta}>Leaflet + OSRM</Text>
      </View>
      <View style={styles.mapBody}>
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={Platform.OS === "web" ? { html: MAP_HTML, baseUrl: "" } : { html: MAP_HTML }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          nestedScrollEnabled={false}
          onLoadEnd={() => {
            hasLoadedRef.current = true;
            const script = `
              window.__rideMapRender && window.__rideMapRender(${JSON.stringify(payload)});
              true;
            `;
            webViewRef.current?.injectJavaScript(script);
          }}
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
