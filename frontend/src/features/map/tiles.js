// Basemap tile configuration. We use CARTO's Voyager raster tiles instead of the default OSM tiles
// because OSM labels Serbian places (e.g. Subotica) in Cyrillic, whereas CARTO renders them in
// Latin script. No API key required — attribution to OpenStreetMap + CARTO is sufficient.
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
export const TILE_SUBDOMAINS = 'abcd';
