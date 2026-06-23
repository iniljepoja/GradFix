// Basemap tile configuration. CARTO Voyager keeps the map readable with place/street labels.
// Some Serbian labels may still render in Cyrillic at high zoom because raster tiles do not let the
// app force a label language. A vector-tile basemap is needed for guaranteed Latin-only labels.
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
export const TILE_SUBDOMAINS = 'abcd';
