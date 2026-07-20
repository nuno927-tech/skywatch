# SkyWatch — Live Satellite & ISS Tracker

A single-file web app that tracks the ISS and hundreds of satellites in real time,
rendered on a beautiful 3D globe. Live orbital data (TLEs) from
[Celestrak](https://celestrak.org), propagated in the browser with
[satellite.js](https://github.com/shashwatak/satellite-js); globe rendering by
[globe.gl](https://globe.gl).

## Features

- Photoreal 3D Earth with atmosphere and starfield, auto-rotating until you grab it
- Hundreds of live satellites (ISS, brightest objects, Starlink, GPS, Galileo, weather)
- ISS highlighted with its live orbital path
- "Use my location" — marks your position and lists every satellite currently above
  your horizon, sorted by elevation
- Floating **⌖** button to re-center the camera on your location anytime
- Click any satellite for live lat/lng, altitude, speed, elevation, range, and NORAD ID
- Filter by group and search by name

## Usage

It's one static file — `index.html`. Open it in any modern browser, or host it (below).
An internet connection is required (it fetches the 3D engine and live satellite data).
The "Use my location" feature needs **HTTPS** (works on any host below; not on `file://`).

## Hosting (free)

- **GitHub Pages** — Settings → Pages → deploy from the `main` branch. Served at
  `https://<username>.github.io/<repo>/`.
- **Netlify Drop** — drag `index.html` onto https://app.netlify.com/drop.
- **Cloudflare Pages** / **Vercel** — connect this repo for automatic deploys.

## License

MIT
