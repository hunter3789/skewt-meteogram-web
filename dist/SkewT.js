/**
 * SkewT
 *
 * Original Code - v1.1.0 (2016)
 * David Felix - dfelix@live.com.pt
 * 
 * Updates (2022 - 2026) by ChangJae Lee
 * - Background Grid: Expanded dry/moist adiabats and Mixing Ratio lines.
 * - Thermodynamics: Computed and rendered severe weather indicators (i.e., CAPE, CIN, LFC, EL, LCL, CCL).
 * - Multi-Profile Overlay: Supported rendering and comparing multiple sounding diagrams simultaneously.
 * - Dynamic Sounding Editor: Enabled real-time interactive adjustments of base height, temperature, and dewpoint to instantly visualize stability shifts.
 * - Mobile & Web UX: Optimized tooltips, Zoom and panning.
 *
 * Dependency:
 * d3.v7.min.js from https://d3js.org/
 * 
**/

/**
* Initializes a dynamic Skew-T Log-P diagram visualizer.
* @param {string|HTMLElement} chartContainer - The container element or ID where the Skew-T chart will be rendered.
* @param {string|HTMLElement} tooltipContainer - The container element or ID for the interactive hover data.
* @param {string|HTMLElement} tableContainer - The container element or ID for the thermodynamic indices table.
* @param {number} [overlays=1] - The number of sounding profiles to overlay on a single diagram.
**/
var SkewT = function(chartContainer, tooltipContainer, tableContainer, overlays = 1) {
    // Force it to be a number, default to 1 if parsing fails (NaN)
    overlays = Number(overlays) || 1;
    // Clamp the value strictly between 1 and 4
    var maxOverlays = 4;
    overlays = Math.max(1, Math.min(maxOverlays, overlays));

    var drawIndices = true;
    var useEdit = false;

    //properties used in calculations
    var wrapper = d3.select(chartContainer);
    var maxWidth = 800;
    var width, height;
    var margin = {top: 30, right: 40 + 30*(overlays-1), bottom: 20, left: 35}; //container margins
    var deg2rad = (Math.PI/180);
    var tan = Math.tan(55*deg2rad);
    var basep = 1050;
    var topp = 100;
    var plines = [1000,925,850,700,500,400,300,250,200,150,100];
    var pticks = [950,900,800,750,650,600,550,450,400,350,250,150];
    var barbsize = 25;
    // functions for Scales and axes. Note the inverted domain for the y-scale: bigger is up!
    var r = d3.scaleLinear().range([0,300]).domain([0,150]);
    var y2 = d3.scaleLinear();
    var bisectTemp = d3.bisector(function(d) { return d; }).left; // bisector function for tooltips
    var w, h, x, y, xAxis, yAxis, yAxis2, xNavi, yNavi;
    var clonedData = [{"variables": [], "indices": {}}];
    //aux
    var unit = "kt"; // or kmh
    var color = ["red", "blue", "green", "purple"];
    var selectedIndex = 0;

    //containers
    var svg = wrapper.append("svg").attr("id", "svg").attr("cursor", "grab");   //main svg
    var container = svg.append("g").attr("id", "container"); //container 
    var skewtbg = container.append("g").attr("id", "skewtbg").attr("class", "skewtbg");//background
    var skewtgroup = container.append("g").attr("class", "skewt"); // put skewt lines in this group
    var barbgroup  = container.append("g").attr("class", "windbarb"); // put barbs in this group    

    var skewdrag = d3.drag()
        .on('start', skewdragstarted)
        .on('drag', skewdragged)
        .on('end', skewdragended);

    var basedrag = d3.drag()
        .on('start', skewdragstarted)
        .on('drag', skewbasedragged)
        .on('end', skewdragended);

    createTable(tableContainer);

    function skewdragstarted(d) {
      d3.select(this).raise().classed('active', true);
    }

    function skewdragged(event) {
      var d = [];
      d[0] = x.invert(event.x);
      d[1] = y.invert(event.y);

      var idx = this.getAttribute("data-idx");
      var type = this.getAttribute("data-type");
      var pres = this.getAttribute("data-pres");

      var k = clonedData[idx].variables.findIndex(function(x){return (x.pres == pres)});
      if (type == "ta") {
        clonedData[idx].variables[k].ta = parseFloat(x.invert(x(d[0]) - (y(basep)-y(d[1]))/tan));

        if (x.invert(x(d[0]) - (y(basep)-y(d[1]))/tan) < clonedData[idx].variables[k].td) {
          clonedData[idx].variables[k].td = clonedData[idx].variables[k].ta;
        }
      }
      else if (type == "td") {
        clonedData[idx].variables[k].td = parseFloat(x.invert(x(d[0]) - (y(basep)-y(d[1]))/tan));

        if (x.invert(x(d[0]) - (y(basep)-y(d[1]))/tan) > clonedData[idx].variables[k].ta) {
          clonedData[idx].variables[k].ta = clonedData[idx].variables[k].td;
        }
      }

      selectedIndex = idx;
      plot(clonedData, drawIndices, useEdit);
    }

    function skewdragended(d) {
      d3.select(this).classed('active', false);
    }

    function skewbasedragged(event) {
      var base = y.invert(event.y);
      var idx = this.getAttribute("data-idx");

      if (base < 300) {
        base = 300;
      }
      else if (base > clonedData[idx].indices.base) {
        base = clonedData[idx].indices.base;
      }

      clonedData[idx].indices.tmpBase = base;

      selectedIndex = idx;
      plot(clonedData, drawIndices, useEdit);
    }

    //local functions   
    function setVariables() {
        var containerWidth = Math.min(parseInt(wrapper.style('width'), 10) - 10, 800);
        width = containerWidth + 30*(overlays-1); // tofix: using -10 to prevent x overflow
        height = containerWidth * 0.828734; //to fix
        w = width - margin.left - margin.right;
        h = height - margin.top - margin.bottom;     
        x = d3.scaleLinear().range([0, w]).domain([-50,50]);
        y = d3.scaleLog().range([0, h]).domain([topp, basep]);
        xNavi = d3.scaleLinear().range([0, w]).domain([-50,50]);
        yNavi = d3.scaleLog().range([0, h]).domain([topp, basep]);
        xAxis = d3.axisBottom(x).tickSize(0,0).ticks(10).tickFormat("");
        yAxis = d3.axisRight(y).tickSize(0,0).tickValues(plines.filter(function(d) { return (y(d) >= 0 && y(d) <= h); })).tickFormat(d3.format(".0d"));
    }
    
    function convert(msvalue, unit)
    {
        switch(unit) {
            case "kt":
                return msvalue*1.943844492;
            break;
            case "kmh":
                return msvalue*3.6;
            break;
            default:
                return msvalue;
        }       
    }

    //assigns d3 events

    function resize() {
        setVariables();
        svg.attr("width", w + margin.right + margin.left).attr("height", h + margin.top + margin.bottom);               
        container.attr("transform", "translate(" + margin.left + "," + margin.top + ")");       
        drawBackground();
        makeBarbTemplates();
        makeDefs();
    }
    
    var drawBackground = function() {
        skewtbg.selectAll("*").remove(); 
        yAxis = d3.axisRight(y).tickSize(0,0).tickValues(plines.filter(function(d) { return (y(d) >= 0 && y(d) <= h); })).tickFormat(d3.format(".0d"));

        // Add clipping path
        skewtbg.append("clipPath")
        .attr("id", "clipper")
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", w)
        .attr("height", h);

        skewtbg.append("clipPath")
        .attr("id", "clipper2")
        .append("rect")
        .attr("x", 1)
        .attr("y", 0)
        .attr("width", w-1)
        .attr("height", h);

        var temp = d3.range(-120,60,10);
        temp.forEach( function (item, i) {
          if (item % 20 != 0) return;

          var poly = [{"x": x(item)-0.5, "y": y(basep)}, {"x": x(item+10)-0.5, "y": y(basep)}, {"x": x(item+10)-0.5 + (y(basep)-y(100))/tan, "y": y(100)}, {"x": x(item)-0.5 + (y(basep)-y(100))/tan, "y": y(100)}];
          skewtbg.append("polygon")
          .data([poly])
          .attr("fill", "#f2f2ff")
          .attr("clip-path", "url(#clipper2)")
          .attr("points", function(d) {
            return d.map(function(d) {
              return [d.x,d.y].join(",");
            }).join(" ");
          });
        });

        // Skewed temperature lines
        skewtbg.selectAll("templine")
        .data(d3.range(-120,45,5))
        .enter().append("line")
        .attr("x1", function(d) { return x(d)-0.5 + (y(basep)-y(100))/tan; })
        .attr("x2", function(d) { return x(d)-0.5; })
        .attr("y1", y(100))
        .attr("y2", y(basep))
        .attr("class", function(d) { if (d % 10 == 0) { return "tempbold"; } else { return "templine"}})
        .attr("clip-path", "url(#clipper)");

        // Logarithmic pressure lines
        skewtbg.selectAll("pressureline")
        .data(plines)  
        .enter().append("line")
        .attr("x1", 0)
        .attr("x2", w)
        .attr("y1", function(d) { return y(d); })
        .attr("y2", function(d) { return y(d); })
        .attr("clip-path", "url(#clipper)")
        .attr("class", "templine");

        // create array to plot dry adiabats
        var pp = d3.range(topp,basep+1,10);
        var dryad = d3.range(-40,240,10);
        var all = [];
        for (var i=0; i<dryad.length; i++) { 
            var z = [];
            for (var j=0; j<pp.length; j++) {
              var zz = x( ( 273.15 + dryad[i] ) / Math.pow( (1000/pp[j]), 0.286) -273.15) + (y(basep)-y(pp[j]))/tan;
              z.push(zz);
            }
            all.push(z);
        }

        for (var i=0; i<all.length; i++) { 
          all[i] = all[i].filter(function(d) { return (d<w+20); });  
        }

        var dryline = d3.line()
            .x(function(d,i) { return d; })
            .y(function(d,i) { return y(pp[i])} );      
        
        // Draw dry adiabats
        skewtbg.selectAll("dryadiabatline")
        .data(all)
        .enter().append("path")
        .attr("class", "dryline")
        .attr("clip-path", "url(#clipper)")
        .attr("d", dryline);

        var vp = 0;
        var e_array = [];
        var t_array = [];
        for (var t=-60; t<=50; t+=.01) {
          vp=calcVaporPressure(t);
          e_array.push(vp);
          t_array.push(t);
        }

        var allmoist = [];
        var moistad = d3.range(-20,40,5);

        for (i=0; i<moistad.length; i++) { 
          var a = [];
          for (j=0; j<pp.length; j++) { 
            a.push( findTC( calcThetaE(basep, moistad[i], moistad[i]), pp[j])) 
          }
          allmoist.push(a);
        }

        var moistline = d3.line()
            .x(function(d,i) { return x(d) + (y(basep)-y(pp[i]))/tan;})
            .y(function(d,i) { return y(pp[i])} );
        
        // Draw moist adiabats
        skewtbg.selectAll(".moistline")
        .data(allmoist)
        .enter().append("path")
        .attr("class", "moistline")
        .attr("clip-path", "url(#clipper)")
        .attr("d", moistline);

        var mixra1, mixra2, mixra3;
        var allmixr1050 = [];
        var allmixr975 = [];
        var allmixr200 = [];
        var Ttuple = [];
        var allT = [];
        var mixr_lims = [.1,.2,.4,.6,1,1.5,2,4,6,9,14,20,30,40,60];
        var mixp = [1050, 975, 200]
        mixr_lims.forEach(function (item) {  
          for (var i=0; i<=e_array.length; i++) {
            var mixraf1 = 0;
            var mixraf2 = 0;
            var Ttuple = [];
            mixra1 = calcMixingRatio(e_array[i],1050);
            if (mixra1 >= item) {
              allmixr1050.push(mixra1);
              Ttuple.push(t_array[i]);
              break;
            }
          }

          for (var j=0; j<=e_array.length; j++) {
            mixra2 = calcMixingRatio(e_array[j],975);
            if (mixra2 >= item) {
              allmixr975.push(mixra2);
              Ttuple.push(t_array[j]);
              break;
            }
          }

          for (var j=0; j<=e_array.length; j++) {
            mixra3 = calcMixingRatio(e_array[j],200);
            if (mixra3 >= item) {
              allmixr200.push(mixra3);
              Ttuple.push(t_array[j]);
              break;
            }
          }
          allT.push(Ttuple);
        });

        // Mixing Ratio Lines
        var mrline = d3.line()
        .x(function(d,i) { return x(d) + (y(basep)-y(mixp[i]))/tan})
        .y(function(d,i) { return y(mixp[i])} );

        // Draw mixing ratio lines
        skewtbg.selectAll(".mrline")
        .data(allT)
        .enter().append("path")
        .attr("class", "gridline")
        .attr("class", "mrline")
        .attr("clip-path", "url(#clipper)")
        .attr("d", mrline);

        var xVal, yVal, mixR975, roundedMixR;
        allT.forEach( function (item, i) {
          xVal = x(item[1]) + (y(basep) - y(975))/tan;
          yVal = y(975);
          mixR975 = parseFloat(allmixr975[i]);
          if (mixR975 < 3) {
            roundedMixR = mixR975.toFixed(1);
            xVal = xVal-14;
          }
          else {
            roundedMixR = mixR975.toFixed(0);
            if (roundedMixR < 10) {
                xVal = xVal-8;
            }
            else {
                xVal = xVal-12;
            }
          }
        
          if (xVal < 0 || xVal > w || yVal < 0 || yVal > h) {
            return;
          }  

          skewtbg.append("text")
            .attr("transform","translate( " + xVal + " ," + yVal + ")")
            .text(roundedMixR)
            .attr("opacity",".65")
            .attr("class", "skewtext")
            .attr("fill","green");
        });

        // Line along right edge of plot
        skewtbg.append("line")
        .attr("x1", w-0.5)
        .attr("x2", w-0.5)
        .attr("y1", 0)
        .attr("y2", h)
        .attr("class", "gridline");

        // Add axes
        skewtbg.append("g").attr("class", "x axis").attr("transform", "translate(0," + (h-0.5) + ")").call(xAxis);
        skewtbg.append("g").attr("class", "y axis skewtextbold").attr("transform", "translate(-0.5,0)").call(yAxis); 

        // Add temperature value
        temp.forEach( function (item, i) {
          if (item > 40 || item < -100) return;

          xVal = x(item)-0.5 + (y(basep) - y(basep)/(temp.length-1)*i)/tan - 4;
          yVal = y(basep)/(temp.length-1)*i;

          if (xVal < 0 || xVal > w || yVal < 0 || yVal > h) {
            return;
          }  

          skewtbg.append("text")
            .attr("transform","translate( " + xVal + " ," + yVal + ") rotate(-58)")
            .text(item)
            .attr("opacity","1")
            .attr("class","skewtextbold")
            .attr("fill","brown");
        });
    }
    
    var makeBarbTemplates = function(){
        var speeds = d3.range(0,300,5);
        var barbdef = container.append('defs')
        speeds.forEach(function(d) {
            var thisbarb = barbdef.append('g').attr('id', 'barb'+d);
            var flags = Math.floor(d/50);
            var pennants = Math.floor((d - flags*50)/10);
            var halfpennants = Math.floor((d - flags*50 - pennants*10)/5);
            var px = barbsize;
            // Draw wind barb stems
            thisbarb.append("line").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", barbsize);
            // Draw wind barb flags and pennants for each stem
            for (var i=0; i<flags; i++) {
                thisbarb.append("polyline")
                    .attr("points", "0,"+px+" -10,"+(px)+" 0,"+(px-4))
                    .attr("class", "flag");
                px -= 7;
            }
            // Draw pennants on each barb
            for (i=0; i<pennants; i++) {
                thisbarb.append("line")
                    .attr("x1", 0)
                    .attr("x2", -10)
                    .attr("y1", px)
                    .attr("y2", px+4)
                px -= 3;
            }
            // Draw half-pennants on each barb
            for (i=0; i<halfpennants; i++) {
                thisbarb.append("line")
                    .attr("x1", 0)
                    .attr("x2", -5)
                    .attr("y1", px)
                    .attr("y2", px+2)
                px -= 3;
            }
        });     
    }

    var makeDefs = function(){
        var xsize = 2;
        var xdef = container.append('defs').append('g').attr('id', 'xdef');
        xdef.append("line").attr("x1", -xsize).attr("x2", xsize).attr("y1", -xsize).attr("y2", xsize);
        xdef.append("line").attr("x1", -xsize).attr("x2", xsize).attr("y1", xsize).attr("y2", -xsize);

        xsize = 8;
        var basedef = container.append('defs').append('g').attr('id', 'basedef');
        basedef.append("polyline").attr("points", "0,0 -" + xsize + ",-" + xsize/2 + " -" + xsize + "," + xsize/2);

        var pattern = container.append('defs').append('pattern').attr('id', 'pattern').attr('patternUnits', 'userSpaceOnUse')
                               .attr('width', 4).attr('height', 4).attr('patternTransform', 'rotate(-45 2 2)');
        pattern.append("line").attr("x1", 4).attr("x2", 0).attr("y1", 0).attr("y2", 4).attr("stroke-width", 0.5).attr("stroke", "#000").attr("stroke-dasharray", 1);
    }

    var drawToolTips = function(s) {
        var pres = [];
        for (var i=0; i<s.length; i++) {
          if (s[i].variables != undefined) {
            for (var j=0; j<s[i].variables.length; j++) {     
              if (s[i].variables[j].ta <= -999 || s[i].variables[j].td <= -999) {
                continue;
              }
              var p = parseFloat(s[i].variables[j].pres);
              if (pres.indexOf(p) == -1) {
                pres.push(p);
              }
            }
          }
        }

        pres = pres.sort((a,b) => a-b);
  
        if (tooltipContainer != undefined) {

            var focus = skewtgroup.append("g").attr("class", "focus").append("line").style("display", "none")
            .attr("x1", 0)
            .attr("x2", width-margin.left-margin.right)
            .attr("y1", 0)
            .attr("y2", 0)
            .attr("class", "focusline"); 
      
            var tooltip = d3.select(tooltipContainer)
                .style("position","absolute")
                .style("font-weight","bold")
                .style("padding","2px 6px 2px 6px")
                .style("background-color","rgba(155,155,155,0.4)")
                .style("width","285px")
                .style("height",(15 + overlays*15) + "px")
                .style("border-radius","4px")
                .style("visibility","hidden");

            svg
                .on("mouseout touchend", function() { tooltip.style("visibility", "hidden"); focus.style("display", "none"); })
                .on("mousemove touchmove", function () { 
                    var pointerCoords = d3.pointer(event, svg.node());
                    var mouseY = pointerCoords[1] - margin.top;
                    var mouseX = pointerCoords[0];

                    var y0 = y.invert(mouseY); 
                    if (mouseY < 0 || mouseY > height - margin.top - margin.bottom) {
                        return;
                    }

                    var i = bisectTemp(pres, y0, 1, pres.length-1);
                    var d0 = pres[i - 1];
                    var d1 = pres[i];
                    var d = y0 - d0 > d1 - y0 ? d1 : d0;

                    var svgRect = document.getElementById("svg").getBoundingClientRect();
                    var left = parseFloat(pointerCoords[0] + svgRect.left + 10);
                    var top = parseFloat(pointerCoords[1] + svgRect.top + 10);

                    var text = "[ " + d + "hPa ]";

                    for (var i=0; i<s.length; i++) {
                      if (s[i].variables == undefined) {
                        continue;
                      }

                      var n = s[i].variables.findIndex(function(x){return (parseFloat(x.pres) == d)})
                      if (n != -1) {
                        text += "<br>";
                        text += "Skew-T-" + (i+1) + ": ";
                        if (parseFloat(s[i].variables[n].ta) > -999) {
                          text += parseFloat(s[i].variables[n].ta).toFixed(1) + "℃ / ";
                        }
                        else {
                          text += "- / ";
                        }

                        if (parseFloat(s[i].variables[n].td) > -999) {
                          text += parseFloat(s[i].variables[n].td).toFixed(1) + "℃ / ";
                        }
                        else {
                          text += "- / ";
                        }

                        if (parseFloat(s[i].variables[n].vec) > -999) {
                          text += parseFloat(s[i].variables[n].vec).toFixed(0) + "° / ";
                        }
                        else {
                          text += "- / ";
                        }

                        if (parseFloat(s[i].variables[n].wsd) > -999) {
                          text += parseFloat(s[i].variables[n].wsd).toFixed(1) + "m/s";
                        }
                        else {
                          text += "-";
                        }

                        tooltip.html(text);
                      }
                    }

                    tooltip.style("left", left + "px")
                           .style("top", top + "px")
                           .style("visibility", "visible");

                    focus.attr("transform", "translate(0," + y(d) + ")").style("display", "block");
                });
        }
    }
    
    /**
     * Renders or updates the sounding profiles, wind barbs, and thermodynamic layers on the Skew-T diagram.
     * @param {Array} s - The sounding dataset array containing vertical profile variables (pressure, temperature, dewpoint, wind) and computed indices.
     * @param {boolean} [updateDrawIndices=true] - Toggle to draw or hide thermodynamic marker lines and labels (LCL, CCL, LFC, EL) and polygon overlays (CAPE/CIN).
     * @param {boolean} [updateUseEdit=false] - Toggle interactive editing mode. If true, renders draggable handles (circles/lines) to manually alter the temperature and dewpoint profiles.
     */
    var plot = function(s, updateDrawIndices = true, updateUseEdit = false){
        drawIndices = updateDrawIndices;
        useEdit = updateUseEdit;

        clonedData = JSON.parse(JSON.stringify(s));

        skewtgroup.selectAll("path").remove(); //clear previous paths from skew
        skewtgroup.selectAll("line").remove(); //clear previous paths from skew
        skewtgroup.selectAll("text").remove(); //clear previous paths from skew
        skewtgroup.selectAll("circle").remove(); //clear previous paths from skew
        skewtgroup.selectAll("use").remove(); //clear previous paths from skew
        barbgroup.selectAll("use").remove(); //clear previous paths from barbs
        skewtgroup.selectAll(".focus").remove(); //clear previous paths from skew

        var cnt = 0;

        for (var idx=0; idx<clonedData.length; idx++) {
          if (clonedData[idx].variables == undefined || clonedData[idx].variables.length == 0) continue;
          cnt++;
        }

        //tooltip
        drawToolTips(clonedData);

        for (var idx=0; idx<clonedData.length; idx++) {
          if (clonedData[idx].variables == undefined || clonedData[idx].variables.length == 0) continue;

          //skew-t stuff
          var skewtline = clonedData[idx].variables.filter(function(d) { return (d.ta > -999 && (d.pres != "SFC" || (d.pres == "SFC" && d.ps != undefined && d.ps > 1000))); });
          var skewtlines = [];
          skewtlines.push(skewtline);

          var skewtline1 = clonedData[idx].variables.filter(function(d) { return (d.td > -999 && (d.pres != "SFC" || (d.pres == "SFC" && d.ps != undefined && d.ps > 1000))); });
          var skewtlines1 = [];
          skewtlines1.push(skewtline1);

          var skewtline2 = clonedData[idx].variables.filter(function(d) { return (d.ta > -999 && d.td > -999 && ((d.pres != "SFC" && d.pres >= 300) || (d.pres == "SFC" && d.ps != undefined && d.ps > 1000))); });
          var skewtlines2 = [];
          skewtlines2.push(skewtline2);
       
          var templine = d3.line().x(function(d,i) { if (d.pres != "SFC") return x(d.ta) + (y(basep)-y(d.pres))/tan; else return x(d.ta) + (y(basep)-y(d.ps))/tan; })
                                  .y(function(d,i) { if (d.pres != "SFC") return y(d.pres); else return y(d.ps); });
          var templines = skewtgroup.selectAll("templines")
              .data(skewtlines).enter().append("path")
              .attr("stroke", color[idx])
              .attr("class", "temp skline")
              .attr("clip-path", "url(#clipper)")
              .attr("d", templine);

          var tempdewline = d3.line().x(function(d,i) { if (d.pres != "SFC") return x(d.td) + (y(basep)-y(d.pres))/tan; else return x(d.td) + (y(basep)-y(d.ps))/tan; })
                                     .y(function(d,i) { if (d.pres != "SFC") return y(d.pres); else return y(d.ps); });
          var tempDewlines = skewtgroup.selectAll("tempdewlines")
              .data(skewtlines1).enter().append("path")
              .attr("stroke", color[idx])
              .attr("class", "dwpt skline")
              .attr("clip-path", "url(#clipper)")
              .attr("d", tempdewline);

          //barbs stuff
          var barbs = clonedData[idx].variables.filter(function(d) { return (parseFloat(d.wsd) > 0 && d.pres >= 100 && d.pres != "SFC" && y(d.pres) >= 0 && y(d.pres) <= h) && parseFloat(d.pres).toFixed(0) % 5 == 0; });
          var allbarbs = barbgroup.selectAll("barbs")
              .data(barbs).enter().append("use")
              .attr("stroke", color[idx])
              .attr("fill", color[idx])
              .attr("xlink:href", function (d) { return "#barb"+Math.round(convert(d.wsd, "kt")/5)*5; }) // 0,5,10,15,... always in kt
              .attr("transform", function(d,i) { return "translate("+(w+idx*30)+","+y(d.pres)+") rotate("+(d.vec-180)+")"; });           

          //skew-index
          var dset = clonedData[idx].variables.slice();

          for (var k=0; k<dset.length; k++) {
            if (dset[k].pres != "SFC" && parseFloat(dset[k].pres) != -999 && dset[k].ta != -999 && dset[k].td != -999) {
              var base = parseFloat(dset[k].pres);
              break;
            }
          }

          for (var k=0; k<dset.length; k++) {
            if ((dset[k].pres == "SFC" && dset[k].ps == undefined) || parseFloat(dset[k].ta) <= -999.0 || parseFloat(dset[k].td) <= -999.0 || parseFloat(dset[k].pres) < 100.0) {
              dset.splice(k,1);
              k--;
            }
            else if (dset[k].pres == "SFC" && dset[k].ps != undefined) {
              base = parseFloat(dset[k].ps);
              clonedData[idx].indices.base = base;
              var d = {};
              d.pres = parseFloat(dset[k].ps);
              d.ta = parseFloat(dset[k].ta);
              d.td = parseFloat(dset[k].td);
              d.gh = -999.;
              dset.splice(k,1);
              if (base < 1000) {
                k--;
              }
              else {
                dset.unshift(d);
              }
            }
          }

          if (clonedData[idx].indices.base == undefined) {
            clonedData[idx].indices.base = base;
          }

          if (clonedData[idx].indices.tmpBase == undefined) {
            clonedData[idx].indices.tmpBase = base;
          }

          for (var k=0; k<dset.length; k++) {
            if (dset[k].pres > clonedData[idx].indices.tmpBase) {
              var dtmp = {};
              dtmp.pres = dset[k].pres;
              dtmp.ta = dset[k].ta;
              dtmp.td = dset[k].td;
              dset.splice(k,1);
              k--;
            }
          }

          if (dset[0].pres != undefined && dset[0].pres != clonedData[idx].indices.tmpBase && dtmp != undefined) {
            var d = {};
            d.pres = clonedData[idx].indices.tmpBase;
            d.ta = parseFloat(dtmp.ta) - (parseFloat(dtmp.ta) - parseFloat(dset[0].ta))/(parseFloat(dtmp.pres) - parseFloat(dset[0].pres)) * (parseFloat(dtmp.pres) - parseFloat(clonedData[idx].indices.tmpBase));
            d.td = parseFloat(dtmp.td) - (parseFloat(dtmp.td) - parseFloat(dset[0].td))/(parseFloat(dtmp.pres) - parseFloat(dset[0].pres)) * (parseFloat(dtmp.pres) - parseFloat(clonedData[idx].indices.tmpBase));
            d.gh = -999.;
            dset.unshift(d);
          }

          // wet-bulb temperature
          calcTw(dset);

          if (cnt == 1) {
            var twline = d3.line().x(function(d,i) { if (d.pres != "SFC") return x(d.tw) + (y(basep)-y(d.pres))/tan; else return x(d.tw) + (y(basep)-y(d.ps))/tan; })
                                  .y(function(d,i) { if (d.pres != "SFC") return y(d.pres); else return y(d.ps); });
            var twlines = skewtgroup.selectAll("twlines")
                .data(skewtlines2).enter().append("path")
                .attr("stroke", "black")
                .attr("class", "tw")
                .attr("clip-path", "url(#clipper)")
                .attr("d", twline);
          }

          //skewT base
          if (y(clonedData[idx].indices.tmpBase) >= 0 && y(clonedData[idx].indices.tmpBase) <= h) {
            if (useEdit) {
              skewtgroup.append("use")
              .attr("stroke", color[idx])
              .attr("fill", color[idx])
              .attr("xlink:href", "#basedef")
              .attr("transform", "translate(-6," + y(clonedData[idx].indices.tmpBase) + ")")
              .style('cursor', 'pointer')
              .attr('data-idx', idx)
              .call(basedrag);

              skewtgroup.append("line")
              .attr("stroke", color[idx])
              .attr("x1", -20)
              .attr("x2", w)
              .attr("y1", y(clonedData[idx].indices.tmpBase))
              .attr("y2", y(clonedData[idx].indices.tmpBase))
              .attr("z-index", 10)
              .attr("stroke-width", 2)
              .style('cursor', 'pointer')
              .attr('data-idx', idx)
              .call(basedrag);
            }
            else {
              skewtgroup.append("line")
              .attr("stroke", color[idx])
              .attr("x1", 0)
              .attr("x2", w)
              .attr("y1", y(clonedData[idx].indices.tmpBase))
              .attr("y2", y(clonedData[idx].indices.tmpBase))
              .attr("stroke-width", 1)
            }
          }

          var lfc = {};
          var lcl = calcLcl(parseFloat(dset[0].pres), parseFloat(dset[0].ta), parseFloat(dset[0].td));
          var ccl = calcCcl(dset);
          if (ccl.p >= lcl.p) {
            ccl.p = lcl.p;
            ccl.t = lcl.t;
            lfc.p = lcl.p;
            lfc.t = lcl.t;
          }
          else {
            lfc = calcLfc(dset, lcl);
          }
          var el = calcEl(dset, lcl, ccl, lfc);
          var cape = calcCape(dset, lcl, ccl, lfc, el);
          var cin = calcCin(dset, lcl, ccl, lfc, el);
          var cvt = calcCVT(dset, ccl);
          var tpw = calcTPW(dset);

          clonedData[idx].indices.lcl = lcl;
          clonedData[idx].indices.ccl = ccl;
          clonedData[idx].indices.lfc = lfc;
          clonedData[idx].indices.el = el;
          clonedData[idx].indices.cape = cape;
          clonedData[idx].indices.cin = cin;
          clonedData[idx].indices.cvt = cvt;
          clonedData[idx].indices.tpw = tpw;

          if (drawIndices) {
            if (cape.value > 0) {
              var capeline = d3.line().x(function(d,i) { return x(d.ta) + (y(basep)-y(d.pres))/tan; }).y(function(d,i) { return y(d.pres); });
              var capeLines = skewtgroup.selectAll("capelines")
                .data([cape.polygon]).enter().append("path")
                .attr("fill", color[idx])
                .attr("fill-opacity", 0.3)
                .attr("clip-path", "url(#clipper)")
                .attr("d", capeline);
            }

            if (cin.value > 0 && cin.polygon != undefined && cin.polygon.length > 0) {
              var cinline = d3.line().x(function(d,i) { return x(d.ta) + (y(basep)-y(d.pres))/tan; }).y(function(d,i) { return y(d.pres); });
              var cinLines = skewtgroup.selectAll("cinlines")
                .data([cin.polygon]).enter().append("path")
                .attr("stroke", color[idx])
                .attr("stroke-width", 0.5)
                .attr("stroke-dasharray", 3)
                .attr("fill", "url(#pattern)")
                .attr("clip-path", "url(#clipper)")
                .attr("d", cinline);
            }

            if (lcl.p != -999 && lcl.p > 100) {
              xVal = x(lcl.t-273.15) + (y(basep)-y(lcl.p))/tan;
              yVal = y(lcl.p);

              if (xVal >= 0 && xVal <= w && yVal >= 0 && yVal <= h) {
                skewtgroup.append("line")
                .attr("x1", xVal)
                .attr("x2", xVal - 20)
                .attr("y1", yVal)
                .attr("y2", yVal)
                .attr("stroke", color[idx])
                .attr("stroke-width", 0.75)
                .attr("clip-path", "url(#clipper)");

                skewtgroup.append("text")
                .attr("x", xVal - 40)
                .attr("y", yVal + 3)
                .text("LCL")
                .attr("class", "skewtext")
                .attr("fill", color[idx]);

                skewtgroup.append("use")
                .attr("stroke", color[idx])
                .attr("fill", color[idx])
                .attr("xlink:href", "#xdef")
                .attr("transform", "translate("+xVal+","+yVal+")"); 
              }
            }

            if (ccl.p != -999 && ccl.p > 100 && ccl.t != lcl.t && ccl.p != lcl.p) {
              xVal = x(ccl.t-273.15) + (y(basep)-y(ccl.p))/tan;
              yVal = y(ccl.p);

              if (xVal >= 0 && xVal <= w && yVal >= 0 && yVal <= h) {
                skewtgroup.append("line")
                .attr("x1", xVal)
                .attr("x2", xVal + 20)
                .attr("y1", yVal)
                .attr("y2", yVal)
                .attr("stroke", color[idx])
                .attr("stroke-width", 0.75)
                .attr("clip-path", "url(#clipper)");

                skewtgroup.append("text")
                .attr("x", xVal + 25)
                .attr("y", yVal + 3)
                .text("CCL")
                .attr("class", "skewtext")
                .attr("fill", color[idx]);

                skewtgroup.append("use")
                .attr("stroke", color[idx])
                .attr("fill", color[idx])
                .attr("xlink:href", "#xdef")
                .attr("transform", "translate("+xVal+","+yVal+")"); 
              }
            }

            if (lfc.t != -999 && lfc.t != lcl.t && lfc.p != lcl.p) {
              xVal = x(lfc.t-273.15) + (y(basep)-y(lfc.p))/tan;
              yVal = y(lfc.p);

              if (xVal >= 0 && xVal <= w && yVal >= 0 && yVal <= h) {
                skewtgroup.append("line")
                .attr("x1", xVal)
                .attr("x2", xVal - 20)
                .attr("y1", yVal)
                .attr("y2", yVal)
                .attr("stroke", color[idx])
                .attr("stroke-width", 0.75)
                .attr("clip-path", "url(#clipper)");

                skewtgroup.append("text")
                .attr("x", xVal - 40)
                .attr("y", yVal + 3)
                .text("LFC")
                .attr("class", "skewtext")
                .attr("fill", color[idx]);

                skewtgroup.append("use")
                .attr("stroke", color[idx])
                .attr("fill", color[idx])
                .attr("xlink:href", "#xdef")
                .attr("transform", "translate("+xVal+","+yVal+")"); 
              }
            }

            if (el.t != -999 && el.p != lfc.p) {
              xVal = x(el.t-273.15) + (y(basep)-y(el.p))/tan;
              yVal = y(el.p);

              if (xVal >= 0 && xVal <= w && yVal >= 0 && yVal <= h) {
                skewtgroup.append("line")
                .attr("x1", xVal)
                .attr("x2", xVal + 20)
                .attr("y1", yVal)
                .attr("y2", yVal)
                .attr("stroke", color[idx])
                .attr("stroke-width", 0.75)
                .attr("clip-path", "url(#clipper)");

                skewtgroup.append("text")
                .attr("x", xVal + 25)
                .attr("y", yVal + 3)
                .text("EL")
                .attr("class", "skewtext")
                .attr("fill", color[idx]);

                skewtgroup.append("use")
                .attr("stroke", color[idx])
                .attr("fill", color[idx])
                .attr("xlink:href", "#xdef")
                .attr("transform", "translate("+xVal+","+yVal+")"); 
              }
            }
          }

          //skewT value change
          if (useEdit) {
              skewtgroup.selectAll("draggable-td")
              .data(skewtline).enter().append("circle")
              .attr("r", 3)
              .attr("cx", function(d) { if (d.pres != "SFC") return x(d.td) + (y(basep)-y(d.pres))/tan; else return x(d.td) + (y(basep)-y(d.ps))/tan; })
              .attr("cy", function(d) { if (d.pres != "SFC") return y(d.pres); else return y(d.ps); })
              .attr("stroke", color[idx])
              .attr("fill", color[idx])
              .attr("fill-opacity", 0)
              .style('cursor', 'pointer')
              .attr('data-idx', idx)
              .attr('data-type', 'td')
              .attr('data-pres', function(d) { return d.pres; })
              .attr("clip-path", "url(#clipper)")
              .call(skewdrag);

              skewtgroup.selectAll("draggable-ta")
              .data(skewtline).enter().append("circle")
              .attr("r", 3)
              .attr("cx", function(d) { if (d.pres != "SFC") return x(d.ta) + (y(basep)-y(d.pres))/tan; else return x(d.ta) + (y(basep)-y(d.ps))/tan; })
              .attr("cy", function(d) { if (d.pres != "SFC") return y(d.pres); else return y(d.ps); })
              .attr("fill", color[idx])
              .style('cursor', 'pointer')
              .attr('data-idx', idx)
              .attr('data-type', 'ta')
              .attr('data-pres', function(d) { return d.pres; })
              .attr("clip-path", "url(#clipper)")
              .call(skewdrag);
          }
        }

        selectTable(selectedIndex);
    }

    var clear = function(s){
        skewtgroup.selectAll("path").remove(); //clear previous paths from skew
        skewtgroup.selectAll("line").remove(); //clear previous lines from skew
        barbgroup.selectAll("use").remove(); //clear previous paths from barbs
        //must clear tooltips!
        container.append("rect")
            .attr("class", "overlay")
            .attr("width", w)
            .attr("height", h)
            .on("mouseover", function(){ return false;})
            .on("mouseout", function() { return false;})
            .on("mousemove",function() { return false;});
    }
    
    //assings functions as public methods
    this.drawBackground = drawBackground;
    this.plot = plot;
    this.clear = clear;
    
    //init 
    setVariables();
    resize();

    //zoom
    var zoom = d3.zoom()
                 .scaleExtent([1,5])// <1 means can resize smaller than  original size
                 .translateExtent([[0,0],[w,h]])
                 .extent([[0,0],[w,h]])//view point size
                 .on("zoom", function(event) {
                   zoomed(event); 
                 });

    svg.call(zoom).call(zoom.transform, d3.zoomIdentity);
    svg.on("dblclick.zoom", null);

    function zoomed(event) {  
      if ((event.type === 'touchstart' || event.type === 'touchmove') && event.touches.length < 2) {
        return;
      }

      x.domain(event.transform.rescaleX(xNavi).domain());
      y.domain(event.transform.rescaleY(yNavi).domain());
      drawBackground();
      plot(clonedData, drawIndices, useEdit);
    }

    function createTable(tableContainer) {
      if (tableContainer != undefined) {
        var item = document.querySelector(tableContainer);
        while (item.hasChildNodes()) {
          item.removeChild(item.childNodes[0]);
        }
        
        var buttonGroup = document.createElement("div");
        buttonGroup.style.display = "flex";

        for (var i=0; i<overlays; i++) {
          var elem = document.createElement("div");
          elem.setAttribute('attribute','skew-button');
          elem.setAttribute('skew-id',i);
          elem.style.marginLeft = "10px";
          elem.classList.add("select-button");
          elem.innerText = "skew-T-" + (i+1);
          elem.addEventListener("click",function(e){
            selectTable(e.srcElement.getAttribute('skew-id'));
          })
          buttonGroup.append(elem);
        }
        item.append(buttonGroup);

        var tableGroup = document.createElement("div");
        tableGroup.id = "skew-table";
        tableGroup.style.marginTop = "10px";
        tableGroup.style.marginLeft = "10px";
        tableGroup.style.width = "360px";
        item.append(tableGroup);
      }
    }

    function selectTable(idx) {
      if (clonedData[idx] == undefined || clonedData[idx].variables == undefined) {
        for (var i=0; i<clonedData.length; i++) {
          if (clonedData[i].variables != undefined) {
            idx = i;
            break;
          }
        }
      }

      var el = document.querySelectorAll("[attribute='skew-button']")
      for (var i=0; i<el.length; i++) {
        if (i == idx) {
          el[i].classList.add("selected");
        }
        else {
          el[i].classList.remove("selected");
        }

        if (clonedData[i] == undefined || clonedData[i].variables == undefined) {
          el[i].style.display = "none";
        }
        else {
          el[i].style.display = "block";
        }
      }
      selectedIndex = idx;
      displayTable(selectedIndex);
    }

    function displayTable(selectedIndex) {
      if (tableContainer != undefined) {
        var d = clonedData[selectedIndex].indices;
		console.log(clonedData[selectedIndex]);
        var item = document.getElementById("skew-table");
        while (item.hasChildNodes()) {
          item.removeChild(item.childNodes[0]);
        }

        item.style.borderRadius = "2px";
        item.style.backgroundColor = "#eee";

        var divGroup = document.createElement("div");
        divGroup.style.display = "flex";
        divGroup.style.height = "18px";
        divGroup.style.lineHeight = "18px";

        var el = document.createElement("div");
        el.innerText = "BASE";
        el.style.fontWeight = 900;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        var value = d.tmpBase;
        if (value > -999) {
          var text = value.toFixed(1) + " hPa";
        }
        else {
          var text = "-";
        }

        el.innerText = text;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        el.innerText = "LCL";
        el.style.fontWeight = 900;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        if (d.lcl != undefined) {
          var value = d.lcl.p;
          if (value > -999) {
            var text = value.toFixed(0) + " hPa";
          }
          else {
            var text = "-";
          }
        }
        else {
          var text = "-";
        }
        el.innerText = text;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        el.innerText = "CCL";
        el.style.fontWeight = 900;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        if (d.ccl != undefined) {
          var value = d.ccl.p;
          if (value > -999) {
            var text = value.toFixed(0) + " hPa";
          }
          else {
            var text = "-";
          }
        }
        else {
          var text = "-";
        }
        el.innerText = text;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        item.appendChild(divGroup);

        var divGroup = document.createElement("div");
        divGroup.style.display = "flex";
        divGroup.style.height = "18px";
        divGroup.style.lineHeight = "18px";

        var el = document.createElement("div");
        el.innerText = "LFC";
        el.style.fontWeight = 900;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        if (d.lfc != undefined) {
          var value = d.lfc.p;
          if (value > -999) {
            var text = value.toFixed(0) + " hPa";
          }
          else {
            var text = "-";
          }
        }
        else {
          var text = "-";
        }
        el.innerText = text;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        el.innerText = "EL";
        el.style.fontWeight = 900;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        if (d.el != undefined) {
          var value = d.el.p;
          if (value > -999) {
            var text = value.toFixed(0) + " hPa";
          }
          else {
            var text = "-";
          }
        }
        else {
          var text = "-";
        }
        el.innerText = text;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        el.innerText = "CVT";
        el.style.fontWeight = 900;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        var value = d.cvt;
        if (value > -999) {
          var text = value.toFixed(1) + " ℃";
        }
        else {
          var text = "-";
        }
        el.innerText = text;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        item.appendChild(divGroup);

        var divGroup = document.createElement("div");
        divGroup.style.display = "flex";
        divGroup.style.height = "18px";
        divGroup.style.lineHeight = "18px";

        var el = document.createElement("div");
        el.innerText = "CAPE";
        el.style.fontWeight = 900;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        if (d.cape != undefined) {
          var value = d.cape.value;
          if (value > -999) {
            var text = value.toFixed(0) + " J/kg";
          }
          else {
            var text = "-";
          }
        }
        else {
          var text = "-";
        }
        el.innerText = text;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        el.innerText = "CIN";
        el.style.fontWeight = 900;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        if (d.cin != undefined) {
          var value = d.cin.value;
          if (value > -999) {
            var text = value.toFixed(0) + " J/kg";
          }
          else {
            var text = "-";
          }
        }
        else {
          var text = "-";
        }
        el.innerText = text;

        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        el.innerText = "TPW";
        el.style.fontWeight = 900;
        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        var el = document.createElement("div");
        var value = d.tpw;
        if (value > -999) {
          var text = value.toFixed(1) + " mm";
        }
        else {
          var text = "-";
        }
        el.innerText = text;

        el.style.textAlign = "center";
        el.style.minWidth = "58px";
        divGroup.appendChild(el); 

        item.appendChild(divGroup);
      }
    }

};