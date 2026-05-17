'use client';

import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';

type TicketLocationMapProps = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  label?: string;
};

export default function TicketLocationMap({ latitude, longitude, accuracy, label }: TicketLocationMapProps) {
  const center: [number, number] = [latitude, longitude];

  return (
    <MapContainer center={center} zoom={16} scrollWheelZoom={false} className="h-full min-h-[260px] w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {accuracy ? (
        <Circle center={center} radius={accuracy} pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.12 }} />
      ) : null}
      <CircleMarker center={center} radius={9} pathOptions={{ color: '#1d4ed8', fillColor: '#2563eb', fillOpacity: 0.95 }}>
        <Popup>
          <div className="text-sm font-semibold">
            {label || 'Ticket location'}
            {accuracy ? <div className="text-xs font-normal text-slate-500">Accuracy: about {Math.round(accuracy)} m</div> : null}
          </div>
        </Popup>
      </CircleMarker>
    </MapContainer>
  );
}
