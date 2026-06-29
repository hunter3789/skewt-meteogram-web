/**
 * Meteogram Viewer
 *
 * Dependencies:
 * - D3.js v7: https://d3js.org/
 * - MarchingSquares.js: https://github.com/RaumZeit/MarchingSquares.js
 *
 * Developed by ChangJae Lee
 *
 * Features:
 * - Meteogram visualization of vertical temperature, wind, dew-point depression, and precipitation.
 * - Interactive time navigation with brush, zoom, and pan controls.
 * - Mobile- and web-optimized user experience.
 * - Skew-T log-P diagram overlay support.
 *
 * Initializes a dynamic meteogram visualizer.
 *
 * @param {Array<Object>} ds - Meteogram dataset containing forecast/valid times and vertical profile data.
 * @param {string|HTMLElement} timebarContainer - Container element or ID for the time navigation bar.
 * @param {string|HTMLElement} chartContainer - Container element or ID where the meteogram chart will be rendered.
 * @param {string|HTMLElement} skewTimeContainer - Container element or ID for the selected Skew-T valid time display.
 * @param {string|HTMLElement} skewImageContainer - Container element or ID where the Skew-T image/overlay will be rendered.
 */
var mto = function fnMtoDisp(ds, timebarContainer, chartContainer, skewTimeContainer, skewImageContainer) {
  if (timebarContainer != undefined) {
    var item = document.querySelector(timebarContainer);
    while (item.hasChildNodes()) {
      item.removeChild(item.childNodes[0]);
    }
  }

  if (chartContainer != undefined) {
    var item = document.querySelector(chartContainer);
    while (item.hasChildNodes()) {
      item.removeChild(item.childNodes[0]);
    }
  }

  if (skewTimeContainer != undefined) {
    document.querySelector(skewTimeContainer).innerText = "";
  }

  if (skewImageContainer != undefined) {
    var item = document.querySelector(skewImageContainer);
    while (item.hasChildNodes()) {
      item.removeChild(item.childNodes[0]);
    }
  }

  if (ds.length == 0) {
    return;
  }

  //properties used in calculations
  var margin = {top: 45, right: 60, bottom: 30, left: 70};
  var marginNavi = {top: 20, right: 60, bottom: 20, left: 70};
  var width = document.querySelector(chartContainer).offsetWidth - margin.left - margin.right;
  var height = [450, 120];
  var nchart = 2;
  var parseTime = d3.timeParse("%Y%m%d%H");
  var canvas = [], ctx = [], hoverCanvas = [], hoverCtx = [], marginChart = [], zoom = [];
  var domain1, domain2, line_tm1, line_tm2;
  var transform = {x:0, y:0, k:0};
  var DEGRAD = Math.PI/180;
  var mto_skewt;
  var isAdjustingBrush = false;

  // Create a small canvas to define the pattern
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = 8;
  patternCanvas.height = 8;

  const patternCtx = patternCanvas.getContext('2d');
  // Draw the crossed pattern
  patternCtx.strokeStyle = 'rgba(0,255,0,0.7)';
  patternCtx.lineWidth = 1;

  // Draw horizontal and vertical lines
  patternCtx.beginPath();
  patternCtx.moveTo(0, 0); // Horizontal line
  patternCtx.lineTo(6, 6);
  patternCtx.moveTo(6, 0); // Vertical line
  patternCtx.lineTo(0, 6);
  patternCtx.stroke();

  //from start time to end time
  var date1 = new Date(); date1.setTime(parseTime(d3.min(ds, function(d){return d.tm_ef;})).getTime());
  var date2 = new Date(); date2.setTime(parseTime(d3.max(ds, function(d){return d.tm_ef;})).getTime());

  //domain for the drawing
  var domain1 = new Date(); domain1.setTime(date1);
  var domain2 = new Date(); domain2.setTime(date2);

  var mto_hover = true;
  var mto_variables = [{name: "rn", color: "skyblue", visible:true},{name: "ta", color: "rgb(255, 0, 0)", visible:true},
                   {name: "td", color: "rgb(255, 180, 0)", visible:true}, {name: "wd", color: "rgb(0, 102, 153)", visible:true}, 
                   {name: "rn_sum", color: "rgb(50, 108, 17)", visible:true}]

  var barbsize = 15;
  var xScale = d3.scaleTime().range([barbsize+10,width-(barbsize+10)]).domain([date1,date2]);//scaleBand is used for  bar chart
  var xscaleNavi = d3.scaleTime().range([0,width]).domain([date1,date2]);

  var totalDays = d3.timeDay.count(date1, date2);
  var minTickWidth = 70;   // px per date label
  var availableWidth = width;

  var dayStep = Math.ceil((totalDays * minTickWidth) / availableWidth);

  dayStep = Math.max(1, dayStep);  // 1 = every day, 2 = every other day, etc.

  var xAxisNavi = d3.axisBottom(xscaleNavi)
    .ticks(d3.timeDay.every(dayStep))
    .tickFormat(d3.timeFormat("%m.%d."));

  // time navigator
  var context = d3.select(timebarContainer).append("div").append("svg")
                  .attr("width",width+marginNavi.left+marginNavi.right)
                  .attr("height",20+marginNavi.top)
                  .style("z-index",200)
                  .append("g")
                  .attr("transform","translate("+marginNavi.left+","+marginNavi.top+")");
  var xAxisGroupNavi = context.append("g").call(xAxisNavi).attr("transform","translate(0,0)");
  var bisectX = d3.bisector(function(d) {return parseTime(d.tm_ef);}).left;

  //add brush
  //Brush must be added in a group
  var brush = d3.brushX()
                .extent([[0,-marginNavi.top],[width,0]])//(x0,y0)  (x1,y1)
                .on("brush end",brushed);//when mouse up, move the selection to the exact tick //start(mouse down), brush(mouse move), end(mouse up)
        
  context.append("g")
         .attr("class","brush")
         .call(brush)
         .call(brush.move,xscaleNavi.range());    

  // tooltip
  var tooltip = d3.select(chartContainer).append("div")
  .style("position","absolute")
  .style("font-weight","bold")
  .style("padding","2px 6px 2px 6px")
  .style("background-color","rgba(200,200,200,0.8)")
  .style("visibility","hidden");

  var tooltipCanvas = tooltip.append("canvas");
  var tooltipCtx = tooltipCanvas.node().getContext('2d');

  //hover area
  var newArr = [];
  ds.forEach(function(d){
    newArr = newArr.concat(d);
  });

  for (var i=0; i<nchart; i++) {
    marginChart[i] = margin;
        
    //create canvas
    canvas[i] = d3.select(chartContainer).append("div").attr("id","mto_canvas_" + i)
                  .append("canvas")
                  .attr("width",width+margin.left+margin.right)
                  .attr("height",height[i]+margin.top+margin.bottom); 

    ctx[i] = canvas[i].node().getContext('2d');

    //add zoom
    zoom[i] = d3.zoom()
                 .scaleExtent([1,50])// <1 means can resize smaller than  original size
                 .translateExtent([[0,0],[width,height[i]]])
                 .extent([[0,0],[width,height[i]]])//view point size
                 .on("zoom",zoomed);

    //hover area
    var left = 0;
    var top = document.getElementById("mto_canvas_"+i).getBoundingClientRect().top - document.getElementById("mto_canvas_0").getBoundingClientRect().top;
    hoverCanvas[i] = d3.select("#mto_canvas_"+i).append("canvas")
                     .attr("data-id",i)
                     .attr("class","hover")
                     .attr("width",width+margin.left+margin.right)
                     .attr("height",height[i]+margin.top+margin.bottom)
                     .style("cursor","pointer")
                     .style("position","absolute").style("z-index",600).style("left",parseFloat(left)+"px").style("top",parseFloat(top)+"px"); 

    hoverCtx[i] = hoverCanvas[i].node().getContext('2d');

    if (i == 0) {
      drawMtoGraph(ctx[i], width, height[i], margin);
    }
    else if (i == 1) {
      drawGraph(ctx[i], width, height[i], margin);
    }

    hoverCanvas[i].call(zoom[i]);

    //add mouse event
    hoverCanvas[i].node().addEventListener("mousemove",function(e){
      hover(e, this);
    })
    hoverCanvas[i].node().addEventListener("mouseout",function(e){
      //if (!mto_hover) return;
      clearHover();
    })
    //hoverCanvas[i].node().addEventListener("click",function(e){
    //  mto_hover = !mto_hover;
    //})
  }

  if (skewImageContainer != undefined) {
    if (mto_skewt == undefined) {
      mto_skewt = new SkewT(skewImageContainer, undefined, undefined, 1);
    }
    else {
      mto_skewt.resize();
      mto_skewt.clear();
    }
  }

  // Wind Barb
  function drawWindBarb(wsd, vec, barbsize, x, y, ctx) {
    if (wsd <= 0 || vec == 0) {
      ctx.beginPath();
      ctx.arc(x,y,2,0,2*Math.PI);
      ctx.stroke();
      return;
    }

    wsd *= 1.943844492;
    var flags = Math.floor(wsd/50);
    var pennants = Math.floor((wsd - flags*50)/10);
    var halfpennants = Math.floor((wsd - flags*50 - pennants*10)/5);
    var px = barbsize;
    // Draw wind barb stems
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(parseFloat(vec - 180) * DEGRAD);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, barbsize);
    ctx.stroke();
    // Draw wind barb flags and pennants for each stem
    for (var i=0; i<flags; i++) {
      ctx.beginPath();
      ctx.moveTo(0, px);
      ctx.lineTo(-10, px);
      ctx.lineTo(0, px-4);
      ctx.stroke();
      ctx.fill();
      px -= 7;
    }
    // Draw pennants on each barb
    for (i=0; i<pennants; i++) {
      ctx.beginPath();
      ctx.moveTo(0, px);
      ctx.lineTo(-10, px+4);
      ctx.stroke();
      px -= 3;
    }
    // Draw half-pennants on each barb
    if (flags == 0 && pennants == 0 && halfpennants == 0) {
      halfpennants = 1;
    }

    for (i=0; i<halfpennants; i++) {
      ctx.beginPath();
      ctx.moveTo(0, px);
      ctx.lineTo(-5, px+2);
      ctx.stroke();
      px -= 3;
    }
    ctx.restore();
  }

  function drawMtoGraph(ctx, width, height, margin){   
    if (ctx == undefined) return;
    var time_domain = [];
    var xrange_domain = [];
    for (var i=0; i<ds.length; i++) {
      if (i < ds.length) {
        time_domain.push(parseTime(ds[i].tm_ef));
      }
      xrange_domain.push(i);
    }
    timeScale = d3.scaleTime()
                  .domain(time_domain)   // Domain is your data categories
                  .range(xrange_domain); // Explicit color table

    pa_domain = [];
    yrange_domain = [];
    var gridHeight = 0;
    for (var j=ds[0].data.length-1; j>=0; j--) {     
      if (ds[0].data[j].pres == "SFC") {
        continue;
      }
      pa_domain.push(ds[0].data[j].pres);
      yrange_domain.push(gridHeight);
      gridHeight++;
    }

    linearScale = d3.scaleLinear()
                  .domain(pa_domain)   // Domain is your data categories
                  .range(yrange_domain); // Explicit color table

    yScale = d3.scaleLog().range([height,0]).domain([1000, 250]);  

    // Create the pattern
    const pattern = ctx.createPattern(patternCanvas, 'repeat');

    ctx.clearRect(0, 0, width+margin.left+margin.right, height+margin.top+margin.bottom);

    var gridWidth = ds.length;

    var data_ta = [];
    var data_ttd = [];
    for (var j=gridHeight; j>0; j--) {
      var arr_ta = [];
      var arr_ttd = [];
      for (var i=0; i<ds.length; i++) {
        arr_ta.push(ds[i].data[j].ta);
        arr_ttd.push(ds[i].data[j].ta - ds[i].data[j].td);
      }
     data_ta.push(arr_ta);
     data_ttd.push(arr_ttd);
    }

    // Define grid dimensions
    const cellWidth = width / gridWidth;
    const cellHeight = height / gridHeight;

    var minval = Math.ceil(Math.min(...data_ta.flat()));
    var maxval = Math.floor(Math.max(...data_ta.flat()));
    minval = minval % 2 === 0 ? minval : minval + 1;
    maxval = maxval % 2 === 0 ? maxval : maxval - 1;

    var intervals = d3.range(minval, maxval, 2);

    var n = mto_variables.findIndex(function(x){return (x.name == "td")});
    if (mto_variables[n].visible) {
      var isoBands = [];
      var intervals_ttd = d3.range(0, 8, 2);
      for (var i = 1; i < intervals_ttd.length; i++) {
        var lowerBand = intervals_ttd[i - 1];
        var upperBand = intervals_ttd[i];
        var band = MarchingSquaresJS.isoBands(
                data_ttd,
                lowerBand,
                upperBand - lowerBand,
                {
                    successCallback: function (band) {
                        //console.log('Band' + i + ':', band)
                    },
                    verbose: true
                }
        );
        isoBands.push({"coords": band, "level": i, "val": intervals_ttd[i]});
      }

      ctx.strokeStyle = 'green';
      ctx.lineWidth = 1;
      // Set the pattern as the fillStyle
      ctx.fillStyle = pattern;
      isoBands.forEach((contour) => {
        ctx.beginPath();
        contour.coords.forEach((points) => {
            points.forEach(([x, y], j) => {

                const canvasX = x * cellWidth;
                const canvasY = y * cellHeight;
                if (j === 0) {
                  ctx.moveTo(xScale(timeScale.invert(canvasX/(width/ds.length)))+margin.left, yScale(linearScale.invert(canvasY/(height/gridHeight)))+margin.top);
                } else {
                  ctx.lineTo(xScale(timeScale.invert(canvasX/(width/ds.length)))+margin.left, yScale(linearScale.invert(canvasY/(height/gridHeight)))+margin.top);
                }
            });
        });
        ctx.stroke();

        if (contour.val < 6) {
          ctx.fill();
        }
      });
    }

    var n = mto_variables.findIndex(function(x){return (x.name == "ta")});
    if (mto_variables[n].visible) {
      var isoLines = [];
      MarchingSquaresJS
        .isoLines(data_ta,
                intervals,
                {
                    polygons: false,
                    linearRing: false
                }
      )
      .forEach(function(isolines, i) {
        isoLines.push({
          "coords": isolines,
          "level": i + 1,
          "val": intervals[i]});
      });

      ctx.strokeStyle = 'red';
      ctx.setLineDash([]);
      isoLines.forEach((contour) => {
        contour.coords.forEach((points) => {
            var midPointX1 = midPointX2 = 0, midPointY1 = midPointY2 =0, text1 = text2 = true;
            var preCanvasX = preCanvasY = -99, angle1 = angle2 = -999;
            ctx.beginPath();
            points.forEach(([x, y], j) => {

                const canvasX = x * cellWidth;
                const canvasY = y * cellHeight;
                //console.log(canvasX/(width/ds.length), timeScale.invert(canvasX/(width/ds.length)), xScale(timeScale.invert(canvasX/(width/ds.length))));
                if (j === 0) {
                    ctx.moveTo(xScale(timeScale.invert(canvasX/(width/ds.length)))+margin.left, yScale(linearScale.invert(canvasY/(height/gridHeight)))+margin.top);
                } else {
                    ctx.lineTo(xScale(timeScale.invert(canvasX/(width/ds.length)))+margin.left, yScale(linearScale.invert(canvasY/(height/gridHeight)))+margin.top);
                }

                // Collect points for midpoint calculation
                if (text1 && xScale(timeScale.invert(canvasX/(width/ds.length))) > width/3 && xScale(timeScale.invert(canvasX/(width/ds.length))) < width/9*4) {
                  text1 = false;
                  if (preCanvasX >= 0 && preCanvasY >= 0) {
                    var dx = xScale(timeScale.invert(canvasX/(width/ds.length))) - xScale(timeScale.invert(preCanvasX/(width/ds.length)));
                    var dy = yScale(linearScale.invert(canvasY/(height/gridHeight))) - yScale(linearScale.invert(preCanvasY/(height/gridHeight)));

                    // Compute the angle in radians
                    angle1 = Math.atan2(dy, dx);

                    // Convert to degrees
                    //angle1 = angleRadians * (180 / Math.PI);
                  }
                  midPointX1 = canvasX;
                  midPointY1 = canvasY;
                }
                else if (text2 && xScale(timeScale.invert(canvasX/(width/ds.length))) > width/3*2 && xScale(timeScale.invert(canvasX/(width/ds.length))) < width/9*7) {
                  text2 = false;
                  if (preCanvasX >= 0 && preCanvasY >= 0) {
                    var dx = xScale(timeScale.invert(canvasX/(width/ds.length))) - xScale(timeScale.invert(preCanvasX/(width/ds.length)));
                    var dy = yScale(linearScale.invert(canvasY/(height/gridHeight))) - yScale(linearScale.invert(preCanvasY/(height/gridHeight)));

                    // Compute the angle in radians
                    var angle2 = Math.atan2(dy, dx);

                    // Convert to degrees
                    //angle2 = angleRadians * (180 / Math.PI);
                  }
                  midPointX2 = canvasX;
                  midPointY2 = canvasY;
                }

                preCanvasX = canvasX;
                preCanvasY = canvasY;
            });

            if (contour.val % 8 == 0) {
              ctx.lineWidth = 2;
            }
            else {
              ctx.lineWidth = 1;
            }
            ctx.strokeStyle = 'red';
            ctx.stroke();
            //ctx.closePath();

            if (contour.val % 4 == 0) {
              ctx.font = "900 12px Arial";
              ctx.fillStyle = "red";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.strokeStyle = 'white';
              ctx.lineWidth = 3;
              if (!text1) {
                var randPos1 = 0;
                if (angle1 > -999) {
                  var x = xScale(timeScale.invert(midPointX1/(width/ds.length)))+margin.left;
                  var y = yScale(linearScale.invert(midPointY1/(height/gridHeight)))+margin.top;
                  ctx.save(); // Save the current state
                  ctx.translate(x, y); // Move the origin to (x, y)
                  ctx.rotate(angle1); // Rotate by the specified angle
                  ctx.strokeText(contour.val, 0, 0);
                  ctx.fillText(contour.val, 0, 0);
                  ctx.restore();
                }
                else {
                  ctx.strokeText(contour.val, xScale(timeScale.invert(midPointX1/(width/ds.length)))+margin.left+randPos1, yScale(linearScale.invert(midPointY1/(height/gridHeight)))+margin.top);
                  ctx.fillText(contour.val, xScale(timeScale.invert(midPointX1/(width/ds.length)))+margin.left+randPos1, yScale(linearScale.invert(midPointY1/(height/gridHeight)))+margin.top);
                }
              }

              if (!text2) {
                var randPos2 = 0;
                if (angle1 > -999) {
                  var x = xScale(timeScale.invert(midPointX2/(width/ds.length)))+margin.left;
                  var y = yScale(linearScale.invert(midPointY2/(height/gridHeight)))+margin.top;
                  ctx.save(); // Save the current state
                  ctx.translate(x, y); // Move the origin to (x, y)
                  ctx.rotate(angle2); // Rotate by the specified angle
                  ctx.strokeText(contour.val, 0, 0);
                  ctx.fillText(contour.val, 0, 0);
                  ctx.restore();
                }
                else {
                  ctx.strokeText(contour.val, xScale(timeScale.invert(midPointX2/(width/ds.length)))+margin.left+randPos2, yScale(linearScale.invert(midPointY2/(height/gridHeight)))+margin.top);
                  ctx.fillText(contour.val, xScale(timeScale.invert(midPointX2/(width/ds.length)))+margin.left+randPos2, yScale(linearScale.invert(midPointY2/(height/gridHeight)))+margin.top);
                }
              }
            }
        });
      });
    }

    var date = new Date();
    date.setTime(parseTime(ds[0].tm_ef).getTime()+60*60*1000);
    var scale = xScale(date) - xScale(parseTime(ds[0].tm_ef));

    var n = mto_variables.findIndex(function(x){return (x.name == "wd")});
    if (mto_variables[n].visible) {
      var barbsize = 15;

      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      ctx.fillStyle = "black";
      for (var i=0; i<ds.length; i++) {
        if (ds[i].tm_ef < line_tm1 || ds[i].tm_ef > line_tm2) {
          continue;
        }

        if (scale*16 < barbsize) {
          if (parseInt(d3.timeFormat("%H")(parseTime(ds[i].tm_ef))) % 24 != 9 || parseInt(d3.timeFormat("%d")(parseTime(ds[i].tm_ef))) % 2 != 0) {
            continue;
          }
        }
        else if (scale*8 < barbsize) {
          if (parseInt(d3.timeFormat("%H")(parseTime(ds[i].tm_ef))) % 24 != 9) {
            continue;
          }
        }
        else if (scale*4 < barbsize) {
          if (parseInt(d3.timeFormat("%H")(parseTime(ds[i].tm_ef))) % 12 != 9) {
            continue;
          }
        }
        else if (scale*2 < barbsize) {
          if (parseInt(d3.timeFormat("%H")(parseTime(ds[i].tm_ef))) % 6 != 3) {
            continue;
          }
        }
        else if (scale*0.667 < barbsize) {
          if (parseInt(d3.timeFormat("%H")(parseTime(ds[i].tm_ef))) % 3 != 0) {
            continue;
          }
        }

        for (var j=gridHeight; j>0; j--) {
          var wsd = ds[i].data[j].wsd;
          var vec = ds[i].data[j].vec;
          drawWindBarb(wsd, vec, barbsize, xScale(parseTime(ds[i].tm_ef))+margin.left, yScale(ds[i].data[j].pres)+margin.top, ctx);
        }
      }
    }

    //clear margin area
    ctx.fillStyle = "black";
    ctx.clearRect(0, 0, margin.left, height+margin.top+margin.bottom);
    ctx.clearRect(width+margin.left, 0, width+margin.left+margin.right, height+margin.top+margin.bottom);
    ctx.setLineDash([]);

    //add y axis
    ctx.font = "650 12px Arial";
    var yAxis_domain = [250, 300, 400, 500, 600, 700, 800, 850, 925, 1000];
    var yAxis = d3.axisLeft(yScale).tickSize(-width);
    var ticks = yAxis.tickValues(pa_domain);
    var tickSize = -width;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    yAxis_domain.forEach(function(d) {
      ctx.moveTo(margin.left, yScale(d)+margin.top);
      ctx.lineTo(width+margin.left, yScale(d)+margin.top);
    });
    ctx.strokeStyle = "black";
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    yAxis_domain.forEach(function(d) {
      ctx.fillText(d+"hPa", 65, yScale(d)+margin.top);
    });
 
    //add x axis
    if (scale*36 < 100) {
      var ticks = xScale.ticks(d3.timeDay.every(dayStep));
    }
    else if (scale*18 < 100) {
      var ticks = xScale.ticks(d3.timeDay);
    }
    else if (scale*8 < 100) {
      var ticks = xScale.ticks(d3.timeHour.every(12));
    }
    else if (scale*4 < 100) {
      var ticks = xScale.ticks(d3.timeHour.every(6));
    }
    else if (scale*1.5 < 100) {
      var ticks = xScale.ticks(d3.timeHour.every(3));
    }
    else {
      var ticks = xScale.ticks(d3.timeHour);
    }

    var tickSize = -width;
    var tickFormat;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ticks.forEach(function(d) {
      ctx.moveTo(xScale(d)+margin.left, height+margin.top);
      ctx.lineTo(xScale(d)+margin.left, margin.top);
    });
    ctx.strokeStyle = "black";
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ticks.forEach(function(d) {
      if (scale*18 < 100) {
        tickFormat = d3.timeFormat("%m/%d");
      }
      else {
        if (d3.timeFormat("%H")(d) == "00") {
          tickFormat = d3.timeFormat("%m/%d");
          ctx.font = "700 12px Arial";
        }
        else {
          tickFormat = d3.timeFormat("%H:%M");
          ctx.font = "12px Arial";
        }
      }

      ctx.fillText(tickFormat(d), xScale(d)+margin.left, height+margin.top+margin.bottom);
    });


    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    //add legend
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(5, 4);
    ctx.lineTo(20, 4);
    ctx.strokeStyle = "red";
    ctx.stroke();

    ctx.font = "650 12px Arial";
    ctx.fillText("Temp. (℃)", 25, 2);

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(5, 20);
    ctx.lineTo(20, 20);
    ctx.strokeStyle = "green";
    ctx.stroke();

    ctx.font = "650 12px Arial";
    ctx.fillText("T-Td < 6℃", 25, 18);

    return;
  }

  function drawGraph(ctx, width, height, margin){
    if (ctx == undefined) return;

    var date = new Date();
    date.setTime(parseTime(ds[0].tm_ef).getTime()+60*60*1000);
    var scale = xScale(date) - xScale(parseTime(ds[0].tm_ef));

    ctx.clearRect(0, 0, width+margin.left+margin.right, height+margin.top+margin.bottom);

    var gridHeight = 0;
    for (var j=ds[0].data.length-1; j>=0; j--) {     
      if (ds[0].data[j].pres == "SFC") {
        continue;
      }
      gridHeight++;
    }
    
    var rn = [];

    var init = true, prevTm = 0, rn_sum = 0;
    ds.forEach(function(d) {
      if (d.tm_ef < line_tm1 || d.tm_ef > line_tm2) {
        return;
      }

      if (init) {
        rn_sum += d.data[0].rn;
        rn.push({"tm_ef": parseTime(d.tm_ef), "rn": d.data[0].rn, "rn_sum": rn_sum});
        init = false;
        prevTm = d.tm_ef;
      }
      else {
        var itv = (parseTime(d.tm_ef) - parseTime(prevTm))/(60*60*1000);
        for (k=1; k<=itv; k++) {
          var date = new Date();
          date.setTime(parseTime(prevTm).getTime()+k*60*60*1000);
          rn_sum += d.data[0].rn/itv;
          rn.push({"tm_ef": date, "rn": d.data[0].rn/itv, "rn_sum": rn_sum});
        }

        prevTm = d.tm_ef;
      }
    });

    var ymax1 = -99, ymax2 = -99, bar_width = 0;
    rn.forEach(function(d) {  
      if (ymax1 < d.rn) {
        ymax1 = d.rn;
      }

      if (ymax2 < d.rn_sum) {
        ymax2 = d.rn_sum;
      }
    });

    if (rn.length >= 2) {
      bar_width = (xScale(rn[1].tm_ef) - xScale(rn[0].tm_ef))/1.0;
    }

    if (ymax1 < 2.5) {
      ymax1 = 2.5;
    }
    else {
      ymax1 = Math.ceil(ymax1/5)*5;
    }

    if (ymax2 < 2.5) {
      ymax2 = 2.5;
    }
    else {
      ymax2 = Math.ceil(ymax2/5)*5;
    }

    yScale1 = d3.scaleLinear().range([0,height]).domain([ymax1, 0]);  
    yScale2 = d3.scaleLinear().range([0,height]).domain([ymax2, 0]);  

    var n = mto_variables.findIndex(function(x){return (x.name == "rn")});
    if (mto_variables[n].visible) {
      var radius = 1;
      rn.forEach(function(d) {  

        ctx.fillStyle = "skyblue";
        ctx.strokeStyle = "skyblue";
        ctx.lineWidth = 1;
        ctx.fillRect(margin.left+xScale(d.tm_ef)-bar_width/2, margin.top + yScale1(d.rn), bar_width, height - yScale1(d.rn));
        if (d.rn >= 0.05) {
          ctx.strokeRect(margin.left+xScale(d.tm_ef)-bar_width/2, margin.top + yScale1(d.rn), bar_width, height - yScale1(d.rn));
        }
      });
    }

    ctx.strokeStyle = "green";
    ctx.lineWidth = 1;

    var n = mto_variables.findIndex(function(x){return (x.name == "rn_sum")});
    if (mto_variables[n].visible) {
      ctx.beginPath();
      ctx.setLineDash([10,5]);
      d3.line()
        .x(function(d){return xScale(d.tm_ef)+margin.left;})
        .y(function(d){return yScale2(d.rn_sum)+margin.top;})
        .context(ctx)(rn);
      ctx.stroke();
    }

    //clear margin area
    ctx.fillStyle = "black";
    ctx.clearRect(0, 0, margin.left, height+margin.top+margin.bottom);
    ctx.clearRect(width+margin.left, 0, width+margin.left+margin.right, height+margin.top+margin.bottom);
    ctx.setLineDash([]);

    //add y axis
    ctx.font = "650 12px Arial";
    ticks = d3.range(0,ymax1+0.1,ymax1/5);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "black";    
    ctx.beginPath();
    ticks.forEach(function(d) {
      var y = Math.round(yScale1(d) + margin.top) + 0.5;      
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width+margin.left, y);
    });
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ticks.forEach(function(d) {
      if (d > 10) {
        ctx.fillText(d.toFixed(0), 45, yScale1(d)+margin.top);
      }
      else {
        ctx.fillText(d.toFixed(1), 45, yScale1(d)+margin.top);
      }
    });

    ctx.textAlign = "left";
    ctx.fillText("(mm)", 25, margin.top+height+20);
    ctx.fillText("precip.", 25, margin.top-20);

    ctx.fillStyle = "skyblue";
    ctx.fillRect(8, margin.top-25, 10, 10);
    ctx.fillStyle = "black";

    ticks = d3.range(0,ymax2+0.1,ymax2/5);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ticks.forEach(function(d) {
      if (d > 10) {
        ctx.fillText(d.toFixed(0), margin.left + width + 10, yScale2(d)+margin.top);
      }
      else {
        ctx.fillText(d.toFixed(1), margin.left + width + 10, yScale2(d)+margin.top);
      }
    });

    ctx.textAlign = "right";
    ctx.fillText("(mm)", margin.left + width + 30, margin.top+height+20);
    ctx.fillText("Total precip.", margin.left + width + 30, margin.top-20);

    ctx.lineWidth = 2;
    ctx.setLineDash([4,2]);
    ctx.beginPath();
    ctx.moveTo(margin.left + width - 65, margin.top-22);
    ctx.lineTo(margin.left + width - 45, margin.top-22);
    ctx.strokeStyle = "green";
    ctx.stroke();
    ctx.setLineDash([]);

    //add x axis
    if (scale*36 < 100) {
      var ticks = xScale.ticks(d3.timeDay.every(dayStep));
    }
    else if (scale*18 < 100) {
      var ticks = xScale.ticks(d3.timeDay);
    }
    else if (scale*8 < 100) {
      var ticks = xScale.ticks(d3.timeHour.every(12));
    }
    else if (scale*4 < 100) {
      var ticks = xScale.ticks(d3.timeHour.every(6));
    }
    else if (scale*1.5 < 100) {
      var ticks = xScale.ticks(d3.timeHour.every(3));
    }
    else {
      var ticks = xScale.ticks(d3.timeHour);
    }

    var tickSize = -width;
    var tickFormat;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ticks.forEach(function(d) {
      ctx.moveTo(xScale(d)+margin.left, height+margin.top);
      ctx.lineTo(xScale(d)+margin.left, margin.top);
    });
    ctx.strokeStyle = "black";
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ticks.forEach(function(d) {
      if (scale*18 < 100) {
        tickFormat = d3.timeFormat("%m/%d");
      }
      else {
        if (d3.timeFormat("%H")(d) == "00") {
          tickFormat = d3.timeFormat("%m/%d");
          ctx.font = "700 12px Arial";
        }
        else {
          tickFormat = d3.timeFormat("%H:%M");
          ctx.font = "12px Arial";
        }
      }

      ctx.fillText(tickFormat(d), xScale(d)+margin.left, height+margin.top+margin.bottom);
    });

    return;
  }

  function drawWindBarb(wsd, vec, barbsize, x, y, ctx) {
    if (wsd <= 0 || vec == 0) {
      ctx.beginPath();
      ctx.arc(x,y,2,0,2*Math.PI);
      ctx.stroke();
      return;
    }

    wsd *= 1.943844492;
    var flags = Math.floor(wsd/50);
    var pennants = Math.floor((wsd - flags*50)/10);
    var halfpennants = Math.floor((wsd - flags*50 - pennants*10)/5);
    var px = barbsize;
    // Draw wind barb stems
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(parseFloat(vec - 180) * DEGRAD);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, barbsize);
    ctx.stroke();
    // Draw wind barb flags and pennants for each stem
    for (var i=0; i<flags; i++) {
      ctx.beginPath();
      ctx.moveTo(0, px);
      ctx.lineTo(-10, px);
      ctx.lineTo(0, px-4);
      ctx.stroke();
      ctx.fill();
      px -= 7;
    }
    // Draw pennants on each barb
    for (i=0; i<pennants; i++) {
      ctx.beginPath();
      ctx.moveTo(0, px);
      ctx.lineTo(-10, px+4);
      ctx.stroke();
      px -= 3;
    }
    // Draw half-pennants on each barb
    if (flags == 0 && pennants == 0 && halfpennants == 0) {
      halfpennants = 1;
    }

    for (i=0; i<halfpennants; i++) {
      ctx.beginPath();
      ctx.moveTo(0, px);
      ctx.lineTo(-5, px+2);
      ctx.stroke();
      px -= 3;
    }
    ctx.restore();
  }

  function hover(event, el){  
    if (!mto_hover) return;

    clearHover();

    if (event.offsetX < margin.left || event.offsetX > margin.left + width) {
      return;
    }

    var x = xScale.invert(event.offsetX-margin.left);
    var n = bisectX(newArr, x, 1);//0 is the first point
    n=n==newArr.length?newArr.length-1:n;
    if (newArr.length > 1) {
      if ((parseTime(newArr[n].tm_ef)-x)>(x-parseTime(newArr[n-1].tm_ef))) {
        n = n-1;
      }
    }

    if (newArr[n].tm_ef < line_tm1 || newArr[n].tm_ef > line_tm2) {
      return;
    }

    for (var i=0; i<nchart; i++) {
      drawHover(i, hoverCtx[i], width, height[i], marginChart[i], x, n);
    }

    if (skewTimeContainer != undefined) {
      document.querySelector(skewTimeContainer).innerText = "[ " + ds[n].tm_ef.substring(0,4) + ". " + ds[n].tm_ef.substring(4,6) + ". " + ds[n].tm_ef.substring(6,8) + ". " + ds[n].tm_ef.substring(8,10) + ":00 (+" + (parseTime(ds[n].tm_ef) - parseTime(ds[n].tm_fc))/(60*60*1000) + "h) ]";
    }

    if (skewImageContainer != undefined) {
      var skew_data = [{"variables": ds[n].data, "indices": {}}]
      mto_skewt.plot(skew_data);
    }

    return;
  }

  function clearHover() {
    tooltip.style("visibility","hidden");

    for (var i=0; i<nchart; i++) {
      hoverCtx[i].clearRect(0, 0, width+margin.left+margin.right, height[i]+margin.top+margin.bottom);
    }
  }

  function drawHover(id, ctx, width, height, margin, x, n) {
    ctx.clearRect(0, 0, width+margin.left+margin.right, height+margin.top+margin.bottom);

    ctx.strokeStyle = "skyblue";
    ctx.setLineDash([4,2]);
    ctx.lineWidth = 1.5;
    var xx = xScale(parseTime(newArr[n].tm_ef))+margin.left;
    ctx.beginPath();
    ctx.moveTo(xx, margin.top);
    ctx.lineTo(xx, height+margin.top);    
    ctx.stroke();

    ctx.setLineDash([]);

    var radius = 3;
    var barbsize = 15;

    if (id == 0) {
      pa_domain = [];
      yrange_domain = [];
      var gridHeight = 0;
      for (var j=ds[0].data.length-1; j>=0; j--) {     
        if (ds[0].data[j].pres == "SFC") {
          continue;
        }
        pa_domain.push(ds[0].data[j].pres);
        yrange_domain.push(gridHeight);
        gridHeight++;
      }

      linearScale = d3.scaleLinear()
                    .domain(pa_domain)   // Domain is your data categories
                    .range(yrange_domain); // Explicit color table

      yScale = d3.scaleLog().range([height,0]).domain([1000, 250]);  

      for (var j=gridHeight; j>0; j--) {  
        ctx.fillStyle = "blue";
        ctx.beginPath();
        ctx.arc(xScale(parseTime(ds[n].tm_ef))+margin.left,yScale(ds[n].data[j].pres)+margin.top,radius,0,2*Math.PI);
        ctx.fill();

        ctx.strokeStyle = "blue";
        var wsd = ds[n].data[j].wsd;
        var vec = ds[n].data[j].vec;
        drawWindBarb(wsd, vec, barbsize, xScale(parseTime(ds[n].tm_ef))+margin.left, yScale(ds[n].data[j].pres)+margin.top, ctx);
      }
    }
    else if (id == 1) {
      var rn = [];

      var init = true, prevTm = 0, rn_sum = 0, itv_hover = 0, rn_hover = 0;
      ds.forEach(function(d) {
        if (d.tm_ef < line_tm1 || d.tm_ef > line_tm2) {
          return;
        }

        if (init) {
          rn_sum += d.data[0].rn;
          rn.push({"tm_ef": parseTime(d.tm_ef), "rn": d.data[0].rn, "rn_sum": rn_sum});
          init = false;
          prevTm = d.tm_ef;
        }
        else {
          var itv = (parseTime(d.tm_ef) - parseTime(prevTm))/(60*60*1000);
          for (k=1; k<=itv; k++) {
            var date = new Date();
            date.setTime(parseTime(prevTm).getTime()+k*60*60*1000);
            rn_sum += d.data[0].rn/itv;
            if (date <= parseTime(ds[n].tm_ef)) {
              rn_hover = rn_sum;
              itv_hover = itv;
            }
            rn.push({"tm_ef": date, "rn": d.data[0].rn/itv, "rn_sum": rn_sum});
          }

          prevTm = d.tm_ef;
        }
      });

      var ymax1 = -99, ymax2 = -99, bar_width = 0;
      rn.forEach(function(d) {  
        if (ymax1 < d.rn) {
          ymax1 = d.rn;
        }

        if (ymax2 < d.rn_sum) {
          ymax2 = d.rn_sum;
        }
      });

      if (rn.length >= 2) {
        bar_width = (xScale(rn[1].tm_ef) - xScale(rn[0].tm_ef))/1.0;
      }

      if (ymax1 < 2.5) {
        ymax1 = 2.5;
      }
      else {
        ymax1 = Math.ceil(ymax1/5)*5;
      }

      if (ymax2 < 2.5) {
        ymax2 = 2.5;
      }
      else {
        ymax2 = Math.ceil(ymax2/5)*5;
      }

      yScale1 = d3.scaleLinear().range([0,height]).domain([ymax1, 0]);  
      yScale2 = d3.scaleLinear().range([0,height]).domain([ymax2, 0]);  

      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(margin.left+xScale(parseTime(ds[n].tm_ef)),margin.top + yScale2(rn_hover),radius,0,2*Math.PI);
      ctx.fill();

      var tm1 = new Date(); tm1.setTime(rn[0].tm_ef.getTime());
      var rn_tm1 = addZeros(tm1.getFullYear(),4) + addZeros(tm1.getMonth()+1,2) + addZeros(tm1.getDate(),2) + addZeros(tm1.getHours(),2) + addZeros(tm1.getMinutes(),2);
      var text = "[ " + rn_tm1.substring(4,6) + ". " + rn_tm1.substring(6,8) + ". " + rn_tm1.substring(8,10) + ":00 - ";
      text += ds[n].tm_ef.substring(4,6) + ". " + ds[n].tm_ef.substring(6,8) + ". " + ds[n].tm_ef.substring(8,10) + ":00 ]";


      if (width < 600) {
        ctx.fillStyle = "rgba(200,200,200,0.8)";
        ctx.fillRect(margin.left-15,margin.top + yScale2(rn_hover)-60, 320, 50);
        ctx.fillStyle = "black";
        ctx.font = "650 12px Arial";
        ctx.fillText("[ " + ds[n].tm_ef.substring(0,4) + ". " + ds[n].tm_ef.substring(4,6) + ". " + ds[n].tm_ef.substring(6,8) + ". " + ds[n].tm_ef.substring(8,10) + ":00 ]", margin.left-10,margin.top + yScale2(rn_hover)-45);   
        ctx.fillText(itv_hover + "h precip. : " + ds[n].data[0].rn.toFixed(1) + "mm", margin.left-10,margin.top + yScale2(rn_hover)-30);   
        ctx.fillText("Total precip. " + text + ": " + rn_hover.toFixed(1) + "mm", margin.left-10,margin.top + yScale2(rn_hover)-15);   
      }
      else if (xScale(parseTime(ds[n].tm_ef))+345 < width || xScale(parseTime(ds[n].tm_ef))+margin.left-345 < 0) {
        ctx.fillStyle = "rgba(200,200,200,0.8)";
        ctx.fillRect(xScale(parseTime(ds[n].tm_ef))+margin.left+15,margin.top + yScale2(rn_hover)-60, 320, 50);
        ctx.fillStyle = "black";
        ctx.font = "650 12px Arial";
        ctx.fillText("[ " + ds[n].tm_ef.substring(0,4) + ". " + ds[n].tm_ef.substring(4,6) + ". " + ds[n].tm_ef.substring(6,8) + ". " + ds[n].tm_ef.substring(8,10) + ":00 ]", xScale(parseTime(ds[n].tm_ef))+margin.left+25,margin.top + yScale2(rn_hover)-45);   
        ctx.fillText(itv_hover + "h precip. : " + ds[n].data[0].rn.toFixed(1) + "mm", xScale(parseTime(ds[n].tm_ef))+margin.left+25,margin.top + yScale2(rn_hover)-30);   
        ctx.fillText("Total precip. " + text + ": " + rn_hover.toFixed(1) + "mm", xScale(parseTime(ds[n].tm_ef))+margin.left+25,margin.top + yScale2(rn_hover)-15);   
      }
      else {
        ctx.fillStyle = "rgba(200,200,200,0.8)";
        ctx.fillRect(xScale(parseTime(ds[n].tm_ef))+margin.left-345,margin.top + yScale2(rn_hover)-60, 320, 50);
        ctx.fillStyle = "black";
        ctx.font = "650 12px Arial";
        ctx.fillText("[ " + ds[n].tm_ef.substring(0,4) + ". " + ds[n].tm_ef.substring(4,6) + ". " + ds[n].tm_ef.substring(6,8) + ". " + ds[n].tm_ef.substring(8,10) + ":00 ]", xScale(parseTime(ds[n].tm_ef))+margin.left-25-310,margin.top + yScale2(rn_hover)-45);   
        ctx.fillText(itv_hover + "h precip. : " + ds[n].data[0].rn.toFixed(1) + "mm", xScale(parseTime(ds[n].tm_ef))+margin.left-25-310,margin.top + yScale2(rn_hover)-30);   
        ctx.fillText("Total precip. " + text + ": " + rn_hover.toFixed(1) + "mm", xScale(parseTime(ds[n].tm_ef))+margin.left-25-310,margin.top + yScale2(rn_hover)-15);   
      }
    }

    return;
  }

  function zoomed(event){  
    clearHover();

    if(event && event.type === "brush") return; // ignore zoom-by-brush
    transform = event.transform;
    domain1.setTime(event.transform.rescaleX(xscaleNavi).domain()[0]);
    domain2.setTime(event.transform.rescaleX(xscaleNavi).domain()[1]); 
    calcAxis();

    drawMtoGraph(ctx[0], width, height[0], margin);
    drawGraph(ctx[1], width, height[1], margin);

    //brush area
    context.select(".brush").call(brush.move, [xscaleNavi(event.transform.rescaleX(xscaleNavi).domain()[0]),xscaleNavi(event.transform.rescaleX(xscaleNavi).domain()[1])]);
  }

  function brushed(event){
    if (isAdjustingBrush) return;
    if(event && event.type === "zoom") return; // ignore brush-by-zoom
    else {

      var date = new Date();
      date.setTime(parseTime(ds[0].tm_ef).getTime()+60*60*1000);
      var scale = xScale(date) - xScale(parseTime(ds[0].tm_ef));

      if (scale < 2.5) {
        domain1 = xscaleNavi.invert(event.selection[0]);
        domain2 = xscaleNavi.invert(event.selection[1]);

        if (domain2.getTime() > domain1.getTime() + scale*94*60*60*1000) {
          domain2.setTime(domain1.getTime() + scale*94*60*60*1000);
          //brush area
          isAdjustingBrush = true;
          context.select(".brush").call(brush.move, [xscaleNavi(domain1), xscaleNavi(domain2)]);
          isAdjustingBrush = false;
        }
      }
      else {
        domain1 = xscaleNavi.invert(event.selection[0]);
        domain2 = xscaleNavi.invert(event.selection[1]);
      }

      calcAxis();
      xScale.domain([domain1, domain2]);
      transform.k = (date2 - date1) / (domain2 - domain1);
      transform.x = width * (date1 - domain1) / (date2 - date1) * transform.k;

      drawMtoGraph(ctx[0], width, height[0], margin);
      drawGraph(ctx[1], width, height[1], margin);
    }
  }
  
  function calcAxis() {
    var tm1 = new Date(); tm1.setTime(domain1.getTime() - 6*60*60*1000);
    var tm2 = new Date(); tm2.setTime(domain2.getTime() + 6*60*60*1000);

    line_tm1 = addZeros(tm1.getFullYear(),4) + addZeros(tm1.getMonth()+1,2) + addZeros(tm1.getDate(),2) + addZeros(tm1.getHours(),2) + addZeros(tm1.getMinutes(),2);
    line_tm2 = addZeros(tm2.getFullYear(),4) + addZeros(tm2.getMonth()+1,2) + addZeros(tm2.getDate(),2) + addZeros(tm2.getHours(),2) + addZeros(tm2.getMinutes(),2);
  }

  function addZeros(num, digit) {
    var zero = '';
    num = num.toString();
    if (num.length < digit) {
      for (var i=0; i < digit - num.length; i++) {
        zero += '0'
      }
    }
    return zero + num;
  }
}
