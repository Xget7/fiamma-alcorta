// Approximate placement of the PDF outline, southwest of San Martín/Cazzulino.
// The source is not georeferenced: these are not surveyed parcel coordinates.
const parcel = [
  [-32.4894941, -58.2563196],
  [-32.4895253, -58.2565077],
  [-32.4898438, -58.2564406],
  [-32.4898126, -58.2562525],
];

export function startLocationMap() {
  const container = document.querySelector('#location-map');
  if (!container) return;

  async function mount() {
    try {
      const L = await import('./vendor/leaflet/leaflet.js');
      container.replaceChildren();
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const map = L.map(container, {
        scrollWheelZoom: false,
        zoomControl: false,
        zoomAnimation: !reduced,
        fadeAnimation: !reduced,
        minZoom: 15,
        maxZoom: 19,
      });

      L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
      map.attributionControl.setPrefix(false);
      const lot = L.polygon(parcel, {
        color: '#236d71',
        weight: 2,
        fillColor: '#3e8d90',
        fillOpacity: 0.28,
      }).addTo(map);
      lot.bindTooltip('Terreno del proyecto', { sticky: true });
      lot.bindPopup('Sector elegido según la lámina. Delimitación aproximada.');

      const frame = () => map.fitBounds(lot.getBounds(), {
        padding: [55, 55], maxZoom: 19, animate: false,
      });
      frame();
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        keepBuffer: 0,
        updateWhenIdle: true,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const center = L.control({ position: 'topright' });
      center.onAdd = () => {
        const wrapper = L.DomUtil.create('div', 'leaflet-bar');
        const button = L.DomUtil.create('button', 'lugar__map-center', wrapper);
        button.type = 'button';
        button.textContent = 'Ver terreno';
        button.addEventListener('click', frame);
        L.DomEvent.disableClickPropagation(wrapper);
        L.DomEvent.disableScrollPropagation(wrapper);
        return wrapper;
      };
      center.addTo(map);

      // Keep the same geographic center when the responsive grid changes size.
      new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(container);
    } catch (error) {
      container.replaceChildren();
      const message = document.createElement('p');
      message.className = 'lugar__map-loading';
      message.textContent = 'El mapa no se pudo cargar. Podés abrirlo con el enlace de abajo.';
      container.append(message);
      console.error('No se pudo iniciar el mapa de ubicación.', error);
    }
  }

  // Request tiles only when the map is actually visible, without prefetching.
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    mount();
  });
  observer.observe(container);
}
