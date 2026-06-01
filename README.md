# skewt-meteogram-web

It is a open-source leaflet plugin which generate the vector tiles(canvas) for geojson data in proj4 coordinates.
(support only for polygon and multipolygon at this time)

## Dependency
- [d3.js] (https://d3js.org/)

## Demo

[DEMO] (https://hunter3789.github.io/skewt-meteogram-web/demo.html)
![demo](demo.gif)

## Installation and setup

- Quick use:

```js
<link rel="stylesheet" href="[path to css]/skewt.css" />
<script src="[path to js]/SkewT.js.js"></script>
<script src="[path to js]/skewt_function.js.js"></script>
```

## Usage - Skew-T
1. **Initializes a dynamic Skew-T Log-P diagram **
```
/**
* Initializes a dynamic Skew-T Log-P diagram visualizer.
* @param {string|HTMLElement} chartContainer - The container element or ID where the Skew-T chart will be rendered.
* @param {string|HTMLElement} tooltipContainer - The container element or ID for the interactive hover data.
* @param {string|HTMLElement} tableContainer - The container element or ID for the thermodynamic indices table.
* @param {number} [overlays=1] - The number of sounding profiles to overlay on a single diagram.
**/
var skewt = new SkewT(chartContainer, tooltipContainer, tableContainer, overlays);
```

2. **Renders or updates the Skew-T diagram**
```
/**
* Renders or updates the sounding profiles, wind barbs, and thermodynamic layers on the Skew-T diagram.
* @param {Array} s - The sounding dataset array containing vertical profile variables (pressure, temperature, dewpoint, wind) and computed indices.
* @param {boolean} [updateDrawIndices=true] - Toggle to draw or hide thermodynamic marker lines and labels (LCL, CCL, LFC, EL) and polygon overlays (CAPE/CIN).
* @param {boolean} [updateUseEdit=false] - Toggle interactive editing mode. If true, renders draggable handles (circles/lines) to manually alter the temperature and dewpoint profiles.
*/
skewt.plot(s, drawIndices, useEdit);
```

## Data (example)


## License

[LICENSE](LICENSE)
