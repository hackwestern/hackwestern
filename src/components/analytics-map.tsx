import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon issue with bundlers
const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Visit {
  id: number;
  url: string;
  visitorId: string;
  latitude: string | null;
  longitude: string | null;
  city: string | null;
  country: string | null;
  createdAt: Date;
}

interface MapViewProps {
  visits: Visit[];
}

export default function MapView({ visits }: MapViewProps) {
  const markers = visits.filter(
    (v) =>
      v.latitude &&
      v.longitude &&
      !isNaN(parseFloat(v.latitude)) &&
      !isNaN(parseFloat(v.longitude)),
  );

  return (
    <div className="overflow-hidden rounded-xl border border-primary-300">
      <MapContainer
        center={[30, 0]}
        zoom={2}
        scrollWheelZoom={true}
        style={{ height: "500px", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((v) => (
          <Marker
            key={v.id}
            position={[parseFloat(v.latitude!), parseFloat(v.longitude!)]}
            icon={icon}
          >
            <Popup>
              <div className="font-figtree text-sm">
                <p className="font-semibold text-heavy">{v.url}</p>
                <p className="text-medium">
                  {[v.city, v.country].filter(Boolean).join(", ")}
                </p>
                <p className="font-jetbrains-mono text-xs text-light">
                  {new Date(v.createdAt).toLocaleString()}
                </p>
                <p className="font-jetbrains-mono text-xs text-light">
                  {v.visitorId.slice(0, 8)}…
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {markers.length === 0 && (
        <div className="bg-primary-100 py-4 text-center font-figtree text-sm text-medium">
          No visits with location data yet. Location headers are provided by
          Vercel/Cloudflare in production.
        </div>
      )}
    </div>
  );
}
