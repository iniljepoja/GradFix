// Basemap tile configuration. CARTO's labeled raster styles can switch Serbian labels between Latin
// and Cyrillic at different zoom levels. Use the no-label Voyager base for script consistency; report
// markers/popups provide the app's primary labels. A vector-tile basemap can later force Latin labels.
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
export const TILE_SUBDOMAINS = 'abcd';
