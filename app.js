var map;
var rectangles;
var allTemplates;
var openAjaxCalls = 0;

$('document').ready( function() {
  // Create map and set to show the whole world
  map = L.map('map').setView([0, 0], 2);
  // Add OSM basemap for reference
  L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  // Add Positionskarten rectangles
  fillMap();
});

// Get data of all pages in category Kategorie:Vorlage:Positionskarte and add it to map
function fillMap() {
  allTemplates = [];
  var url = 'https://de.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Kategorie:Vorlage:Positionskarte&cmlimit=500&format=json';
  // Because the API limits category member output to max. 500 we have to break the call up into chunks of 500  
  get500Templates(url, '');
}

function get500Templates(url, continuepart) {
  // get 500 templates from category from API
  $.get(url+continuepart, function(data) {
    var pageids = [];
    // loop through the returned pages
    data.query.categorymembers.forEach(function(e,i,a) {
      pageids.push(e.pageid);
      // Querying pageids is limited to max. 50 in one query, so we have to break that up, too. 
      if(pageids.length == 50 || i==a.length-1)
      {
        // get 50 pages
        openAjaxCalls++;
        $.get('https://de.wikipedia.org/w/api.php?action=query&pageids=' + pageids.join('|') + '&prop=revisions&rvprop=content&format=json', function(vdata) {
          for(var page in vdata.query.pages)
          {
            // add them all to the allTemplates variable
            allTemplates.push(vdata.query.pages[page]);
          }
          // the slowest function will call the addTemplatesToMap method
          openAjaxCalls--;
          if(openAjaxCalls == 0) addTemplatesToMap();
        });
        // reset for next 50
        pageids = [];
      }
    });
    // if we haven't reached the end yet, there will be a continue property in the returned JSON with the pagination link
    if(data.continue) {
      get500Templates(url, '&cmcontinue='+data.continue.cmcontinue);
    }
  });
}

function addTemplatesToMap() {
  var failscount = 0;
  // Add rectangles to layer group for more efficient handling
  rectangles = L.layerGroup();
  // Loop through all templates
  allTemplates.sort((e1,e2)=>e1.title>e2.title).forEach(function(e,i,a){
    // get the top/bottom/left/right parameters
    var data = e.revisions[0]['*'].match(/top\s*=\s*(-?\d+\.?\d*)[\s\S]*bottom\s*=\s*(-?\d+\.?\d*)[\s\S]*left\s*=\s*(-?\d+\.?\d*)[\s\S]*right\s*=\s*(-?\d+\.?\d*)/);
    if(data != null)
    {    
      // if that worked, create bounds from those parameteres, bind popup, subscribe to events and then add the rectangle
      var bounds = [[data[1], data[3]], [data[2], data[4]]];
      rectangles.addLayer(L.rectangle(bounds, {color: "green", fill: false, weight: 2})
        .on('mouseover', highlightRectangle)
        .on('mouseout', dehighlightRectangle)
        .bindPopup('<a href="https://de.wikipedia.org/wiki/' + encodeURI(e.title) + '">' + e.title + '</a>')
      );
    }
    else
    {
      // otherwise add template to the fails section
      document.getElementById('fails').innerHTML += '<h3>' + e.title + "</h3><pre>" + e.revisions[0]['*'] + "</pre><hr />";
      failscount++;
    }
  });
  // Show all the rectangles on map
  rectangles.addTo(map);
  // Register filterRectangles with move event which fires whenever the user zooms or pans the map
  map.on('move', filterRectangles);
  // make those controls have immediate effect
  $("#onlyShowCompleteRects").on('change', filterRectangles);
  $("#hideRectsSmallerThan").on('change', filterRectangles);
  $("#hideRectsThreshold").on('change', filterRectangles);
  // handling collapse stuff when clicking the heading of items in the fails section
  $("h3").on('click', (e)=>e.target.classList.toggle('visible'));
  // output number of fails
  $("#failscount").html(failscount);
}

/*
  // could prevent failing extraction when parameters' order is mixed up, BUT
  // a) this only effects a dozen or so templates
  // b) this might cause wrong extraction when a keyword is contained more than once
  // c) in the long run it's better to unify the templates instead of handling exceptions here 
  allTemplates.forEach(function(e,i,a){
    var tt = e.revisions[0]['*'];
    var data;
    data[0] = tt.match(/top\s*=\s*(-?\d+\.?\d*)/);
    data[1] = tt.match(/bottom\s*=\s*(-?\d+\.?\d*)/);
    data[2] = tt.match(/left\s*=\s*(-?\d+\.?\d*)/);
    data[3] = tt.match(/right\s*=\s*(-?\d+\.?\d*)/);
    //...
  });
*/

function highlightRectangle(e) {
  var layer = e.target;
  var style = layer.options;
  //style.fill = true;
  //style.fillOpacity = 0.5;
  style.color = '#ff7800';   // orange
  layer.setStyle(style);
}

function dehighlightRectangle(e) {
  var layer = e.target;
  var style = layer.options;
  //style.fill = false;
  //style.fillOpacity = 1;
  style.color = 'green';
  layer.setStyle(style);
}

function filterRectangles() {
  // loop through all layers
  rectangles.eachLayer(function(layer) {
    var toBeShown = true;
    // check whether current map extent fully contains the layer's bbox (if requested)
    if($("#onlyShowCompleteRects").is(":checked")) toBeShown &= map.getBounds().contains(layer.getBounds());
    // check whether the layer's area is large enough (if requested)
    var b = layer._pxBounds;
    if($("#hideRectsSmallerThan").is(":checked")) toBeShown &= ((b.max.x-b.min.x) * (b.max.y-b.min.y)) > $("#hideRectsThreshold").val(); 
    // now show or hide the layer by setting the stroke property: stroke=false -> no outline drawn -> layer not visible
    var style = layer.options;
    style.stroke = toBeShown;
    layer.setStyle(style);
  });
}