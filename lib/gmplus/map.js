'use strict';

var utils = require('gmplus/utils');
var defaults = require('gmplus/defaults');
var gmaps = require('gmplus/gmaps.js');
var topojson = require('topojson');

'use strict';
module.exports = function(global) {




  /**
   * Creates a new Google Map Instance
   * @param args Arguments to instantiate a Google Maps
   *
   */
  function newMap(args, cb) {

    cb = cb || function(){};

    var mapOptions = utils.clone(args); // To clone Array content

    mapOptions.zoom = args.zoom || defaults.zoom;
    mapOptions.center = new global.google.maps.LatLng(args.lat, args.lng);

    // These are custom properties from GMP API that need to be unset.
    mapOptions.id = undefined;
    mapOptions.lat = undefined;
    mapOptions.lng = undefined;

    that.id = args.id;
    that.options = args;
    that.instance = new global.google.maps.Map(global.document.getElementById(args.id), mapOptions);
    global.GMP.maps[args.id].instance = that.instance;

    global.google.maps.event.addListenerOnce(that.instance, 'idle', function(){
      cb(false, that.instance);
    });
  }

  /**
   * Validates GMP Options
   * @param options to validate
   * @param cb Only used when something goes wrong
   * @returns {boolean} true/false
   */
  function validOptions(options, cb) {
    if (!options || options && typeof options !== 'object') {
      cb(new Error('You must pass a valid first parameter: options'));
      return false;
    }

    if (!options.id && !options.class) {
      cb(new Error('You must pass an "id" or a "class" property values'));
      return false;
    }

    if (!options.lat || !options.lng) {
      cb(new Error('You must pass valid "lat" (latitude) and "lng" (longitude) values'));
      return false;
    }

    return true;
  }


  var that;

  /**
   * Creates a new GMaps Plus instance
   * @param options
   * @constructor
   */
  function GMP(options, cb) {
    that = this;

    if (validOptions(options, cb)) {
      global.GMP.maps = GMP.maps || {};
      global.GMP.maps[options.id] = {
        create: function () {
          newMap(this.arguments, cb);
        },
        arguments: options
      };


      if (options.async !== false) {
        gmaps.load(options);
      } else {
        global.GMP.maps[options.id].create();
      }
    }

    return this;
  }

  // a GMP Instance
  GMP.prototype.instance = false;


  // Animations
  GMP.prototype.bounce = 1;
  GMP.prototype.drop = 2;

  /**
   * Adds Markers to the Map
   * @param args Array or Markers
   * @param options things like groups etc
   * @returns {Array} all the instances of the markers.
   */
  GMP.prototype.addMarker = function(args, options) {
    if (Object.prototype.toString.call(args) === '[object Array]') {
      var markers = [];
      var marker;
      for (var i in args) {
        marker = _addMarker(args[i], options);
        markers.push(marker);

      }

      return markers;
    }

    if (typeof args === 'object') {
      return _addMarker(args, options);
    }
  };

  GMP.prototype.updateMarker = function(args, options) {

    var s = utils.createSetters(options);

    if (Object.prototype.toString.call(args) === '[object Array]') {
      var uid;
      for (var item in args) {
        uid = args[item].uid;
        if (GMP.maps[that.id].markers[uid]) {
          _updateMarker(GMP.maps[that.id].markers[uid], s);
        }
      }
    }
  };

  function _updateMarker(marker, s) {
    if (s.count === 1) { // Looping only when necessary
      _updateMarkerValues(marker,s.setterKey, s.setters[s.setterKey]);
    } else {
      for (var setterKey in s.setters) {
        _updateMarkerValues(marker, setterKey, s.setters[setterKey]);
      }
    }
  }

  function _updateMarkerValues(marker, key, value)
  {
    if (key == 'setMove') {
      marker.setAnimation(value);
    } else {
      marker[key](value);
    }
  }

  function _bubble(marker, options) {

    var event = options.event || 'click';

    options.content = options.content.replace(/\{(\w+)\}/g, function(m, variable) {
      return (marker.data[variable]) ? marker.data[variable] : '';
    });

    var infowindow = new global.google.maps.InfoWindow(options);

    global.google.maps.event.addListener(marker, event, function() {
      infowindow.open(that.instance, marker);
    });
  }


  function _addMarker(marker, options)
  {
    marker.map = that.instance;
    marker.position = new global.google.maps.LatLng(marker.lat, marker.lng);

    var group = marker.group || false;

    if (options && options.group) {
      group = options.group || group;
    }

    // Adds options set via 2nd parameter. Overwrites any Marker options already set.
    if (options) {
      for (var i in options) {
        marker[i] = options[i];
      }
    }

    // Adds additional options from the Group and overwrites any Marker options already set.
    if (group && GMP.maps[that.id].groupOptions && GMP.maps[that.id].groupOptions[group]) {

      for (var j in GMP.maps[that.id].groupOptions[group]) {
        marker[j] = GMP.maps[that.id].groupOptions[group][j];
      }
    }

    marker.data = marker.data || {};

    if (marker.data) {
      marker.data.uid = utils.createUid();
    }

    if (that.options.crossfilter) {
      that.options.crossfilter.add([marker.data]);
    }

    var instance = new global.google.maps.Marker(marker);

    if (marker.move) {
      instance.setAnimation(marker.move);
    }

    if (marker.bubble) {
      _bubble(instance, marker.bubble);
    }


    // Adds Marker Reference to specific Group
    if (group) {
      GMP.maps[that.id].groups = GMP.maps[that.id].groups || {};
      GMP.maps[that.id].groups[group] = GMP.maps[that.id].groups[group] || [];
      GMP.maps[that.id].groups[group].push(instance);
    }


    // Adds Marker Reference of each Marker to "markers"
    GMP.maps[that.id].markers = GMP.maps[that.id].markers || {};
    GMP.maps[that.id].markers[marker.data.uid] = instance;


    return instance;
  }


  /**
   * Adds a New Group
   * @param name Name of the Group
   * @param options That Apply to all the Group
   */
  GMP.prototype.addGroup = function(name, options) {
    GMP.maps[that.id].groups = GMP.maps[that.id].groups || [];
    GMP.maps[that.id].groupOptions = GMP.maps[that.id].groupOptions || {};
    GMP.maps[that.id].groupOptions[name] = options;
  };


  /**
   * Updates all the Markers of a Group to have specific Properties
   * @param name
   * @param options
   */
  GMP.prototype.updateGroup = function(name, options) {
    var s = utils.createSetters(options);
    if (GMP.maps[that.id].groups && GMP.maps[that.id].groups[name]) {
      for (var item in GMP.maps[that.id].groups[name]) {
        _updateMarker(GMP.maps[that.id].groups[name][item], s);
      }
    }
  };

  //region TopoJSON
  /**
   * Loads a Topo JSON file into a Map
   * @param data The parsed JSON File
   * @param options
   */
  GMP.prototype.loadTopoJson = function(data, options)
  {
    var item, geoJson, features;
    for (var x in options) {
        item = options[x];
        geoJson = topojson.feature(data, data.objects[item.object]);
        features = that.instance.data.addGeoJson(geoJson);
        _addFeatureOptions(features, item);
    }

    return features;
  };

  /**
   * Adds GeoJSON Feature Options like: style
   * @param features
   * @param options
   * @private
   */
  function _addFeatureOptions(features, options) {
    var feature;
    for (var x in features) {
      feature = features[x];
      if (options.style) {
        that.instance.data.overrideStyle(feature, options.style);
      }
    }
  }
  //endregion

  return GMP;

};