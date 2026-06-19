// Replace Leaflet's default marker icon with a self-contained, theme-coloured SVG pin.
//
// Why not the bundled PNGs: Leaflet 1.9's Icon.Default._getIconUrl PREPENDS a CSS-detected
// `imagePath` onto the icon URL (leaflet-src.js:7507). Under a Vite bundle that double-prefixes the
// already-absolute asset URLs (e.g. "/assets/" + "/assets/marker-icon-HASH.png") so every marker
// image 404s and the pins render invisible. Deleting that override AND pointing the icon at an
// inline SVG data URI removes the asset-resolution failure mode completely (nothing left to 404)
// and gives us an on-brand purple pin. Imported for its side effect wherever a <Marker> renders.
import L from 'leaflet';

const PIN = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.63 12.4 24.5 12.93 25.13a1.4 1.4 0 0 0 2.14 0C15.6 38.5 28 23.63 28 14 28 6.27 21.73 0 14 0z" fill="#6f4fc7"/>
    <circle cx="14" cy="14" r="5.2" fill="#ffffff"/>
  </svg>`,
);
const iconUrl = `data:image/svg+xml,${PIN}`;

// Drop the Icon.Default override so the base Icon._getIconUrl returns our URL verbatim (no prepend).
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl: iconUrl,
  shadowUrl: '',
  iconSize: [28, 40],
  iconAnchor: [14, 40],   // tip of the pin sits on the coordinate
  popupAnchor: [0, -34],  // popup opens above the pin head
});
