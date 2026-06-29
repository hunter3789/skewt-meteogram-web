# skewt-meteogram-web

A web-based dynamic skew-T log-P diagram and meteogram visualizer.

## Note
Original Core Architecture v1.1.0 (2016) by David Felix
- [GitHub] (https://github.com/dfelix/skewt-js)

Also inspired by SHARPpy.
- [Document] (https://sharppy.github.io/SHARPpy/index.html)
 
Refactoring & Features Update (2022 - 2026) by ChangJae Lee
- Background Grid: Expanded dry/moist adiabats and Mixing Ratio lines.
- Thermodynamics Engine: Computed and rendered severe weather indicators (i.e., CAPE, CIN, LFC, EL, LCL, CCL).
- Multi-Profile Overlay: Supported rendering and comparing multiple sounding diagrams simultaneously.
- Dynamic Sounding Editor: Enabled real-time interactive adjustments of base height, temperature, and dewpoint to instantly visualize stability shifts.
- Mobile & Web UX: Optimized tooltips, Zoom and panning.

## Dependency
- [d3.js (>= v7)] (https://d3js.org/)
- [MarchingSquares.js] (https://github.com/RaumZeit/MarchingSquares.js/) 

## Demo

[DEMO] (https://hunter3789.github.io/skewt-meteogram-web/demo.html)
![demo](demo.gif)

[DEMO] (https://hunter3789.github.io/skewt-meteogram-web/meteogram.html)
![demo](meteogram.gif)

## Installation and setup

- Quick use - Skew-T:

```js
<link rel="stylesheet" href="[path to css]/skewt.css" />
<script src="[path to js]/SkewT.js"></script>
<script src="[path to js]/skewt_function.js"></script>
```

- Quick use - Meteogram:

```js
<link rel="stylesheet" href="[path to css]/skewt.css" />
<script src="[path to js]/SkewT.js"></script>
<script src="[path to js]/skewt_function.js"></script>
<script src="[path to js]/meteogram.js"></script>
```

## Usage - Skew-T
1. **Initializes a dynamic Skew-T Log-P diagram**
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

## Usage - Meteogram
**Initializes a dynamic Meteogram**
```
/**
* Initializes a dynamic Skew-T Log-P diagram visualizer.
* @param {Array<Object>} ds - Meteogram dataset containing forecast/valid times and vertical profile data.
* @param {string|HTMLElement} timebarContainer - Container element or ID for the time navigation bar.
* @param {string|HTMLElement} chartContainer - Container element or ID where the meteogram chart will be rendered.
* @param {string|HTMLElement} skewTimeContainer - Container element or ID for the selected Skew-T valid time display.
* @param {string|HTMLElement} skewImageContainer - Container element or ID where the Skew-T image/overlay will be rendered.
**/
var meteogram = new mto(ds, timebarContainer, chartContainer, skewTimeContainer, skewImageContainer); 
```

## Data for Skew-T (example)
```
[
  {
    // meteorological variables
    "variables": [{
                    "pres": 1000, // pressure level (hPa or mb)
                    "ta": 29.2,   // temperature (celsius)
                    "td": 23.2,   // dew-point temperature (celsius)
                    "vec": 215,   // wind vector (degree)
                    "wsd": 3.2,   // wind speed (m/s)
                    "gh": 110.7   // geopotential height (gpm) (optional)
                },
                {
                    "pres": 950,
                    "ta": 24.8,
                    "td": 21.7,
                    "vec": 214,
                    "wsd": 5.3,
                    "gh": 565.8
                },
                ...,
                // surface variables (optional)
                {
                    "pres": "SFC",
                    "ps": "1000.8", // station pressure (hPa or mb)
                    "ta": "30.3",   // temperature (celsius)
                    "td": "24.1"    // dew-point temperature (celsius)
                }],
    // thermodynamic indices
    "indices": {}
  }
]
```

## Data for Meteogram (example)
```
[
    {
        "tm_fc": "2026060421", // issue time
        "tm_ef": "2026060421", // valid time
        "fcstime": 0,          // forecast lead time (hour)
        "data": [
            {
                "pres": "SFC", // pressure level (hPa or mb)
                "rn": 0        // precipitation (mm)
            },
            {
                "pres": 1000, // pressure level (hPa or mb)
                "ta": 19.9,   // temperature (celsius)
                "td": 18.8,   // dew-point temperature (celsius)
                "vec": 241.8, // wind vector (degree)
                "wsd": 1.5,   // wind speed (m/s)
                "gh": 19.1    // geopotential height (gpm) (optional)
            },
            ...,
            {
                "pres": 100,
                "ta": -65.4,
                "td": -81.7,
                "vec": 258.3,
                "wsd": 31.4,
                "gh": 16546.2
            }
        ]
    },
    {
        "tm_fc": "2026060421",
        "tm_ef": "2026060422",
        "fcstime": 1,
        "data": [...]
    }
]
```

## License

[LICENSE](LICENSE)
