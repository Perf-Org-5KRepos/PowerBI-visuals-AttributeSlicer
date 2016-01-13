module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	eval("/// <reference path=\"../../base/references.d.ts\"/>\nvar EventEmitter_1 = __webpack_require__(1);\n/**\n * Class which represents the force graph\n */\n/* @Mixin(EventEmitter) */\nvar ForceGraph = (function () {\n    // private listeners: { [id: string]: Function[]; } = {};\n    /**\n     * Constructor for the force graph\n     */\n    function ForceGraph(element, width, height) {\n        if (width === void 0) { width = 500; }\n        if (height === void 0) { height = 500; }\n        this._configuration = {\n            linkDistance: 10,\n            linkStrength: 2,\n            charge: -120,\n            gravity: .1,\n            labels: false,\n            minZoom: .1,\n            maxZoom: 100\n        };\n        /**\n         * The event emitter for this graph\n         */\n        this.events = new EventEmitter_1.default();\n        this.element = element;\n        this.dimensions = { width: width, height: height };\n        this.svg = d3.select(this.element[0]).append(\"svg\")\n            .attr(\"width\", width)\n            .attr(\"height\", height);\n        this.force = d3.layout.force()\n            .linkDistance(10)\n            .linkStrength(2)\n            .gravity(.1)\n            .charge(-120)\n            .size([width, height]);\n        this.vis = this.svg.append('svg:g');\n    }\n    Object.defineProperty(ForceGraph.prototype, \"dimensions\", {\n        /**\n         * Returns the dimensions of this graph\n         */\n        get: function () {\n            return this._dimensions;\n        },\n        /**\n         * Setter for the dimensions\n         */\n        set: function (newDimensions) {\n            this._dimensions = {\n                width: newDimensions.width || this.dimensions.width,\n                height: newDimensions.height || this.dimensions.height\n            };\n            if (this.force) {\n                this.force.size([this.dimensions.width, this.dimensions.height]);\n                this.force.resume();\n                this.element.css({ width: this.dimensions.width, height: this.dimensions.height });\n                this.svg.attr({ width: this.dimensions.width, height: this.dimensions.height });\n            }\n        },\n        enumerable: true,\n        configurable: true\n    });\n    Object.defineProperty(ForceGraph.prototype, \"configuration\", {\n        /**\n         * Returns the configuration of this graph\n         */\n        get: function () {\n            return this._configuration;\n        },\n        /**\n         * Setter for the configuration\n         */\n        set: function (newConfig) {\n            var _this = this;\n            newConfig = $.extend(true, {}, this._configuration, newConfig);\n            if (this.force) {\n                var runStart;\n                /**\n                 * Updates the config value if necessary, and returns true if it was updated\n                 */\n                var updateForceConfig = function (name, defaultValue) {\n                    if (newConfig[name] !== _this._configuration[name]) {\n                        _this.force[name](newConfig[name] || defaultValue);\n                        return true;\n                    }\n                };\n                runStart = runStart || updateForceConfig(\"linkDistance\", 10);\n                runStart = runStart || updateForceConfig(\"linkStrength\", 2);\n                runStart = runStart || updateForceConfig(\"charge\", -120);\n                runStart = runStart || updateForceConfig(\"gravity\", .1);\n                if (newConfig.minZoom !== this._configuration.minZoom ||\n                    newConfig.maxZoom !== this._configuration.maxZoom) {\n                    this.zoom.scaleExtent([newConfig.minZoom, newConfig.maxZoom]);\n                }\n                if (runStart) {\n                    this.force.start();\n                }\n                if (newConfig.labels !== this._configuration.labels) {\n                    this.vis.selectAll(\".node text\")\n                        .style(\"opacity\", newConfig.labels ? 100 : 0);\n                }\n            }\n            this._configuration = newConfig;\n        },\n        enumerable: true,\n        configurable: true\n    });\n    Object.defineProperty(ForceGraph.prototype, \"data\", {\n        /**\n         * Alias for getData\n         */\n        get: function () {\n            return this.getData();\n        },\n        /**\n         * Alias for setData\n         */\n        set: function (graph) {\n            this.setData(graph);\n        },\n        enumerable: true,\n        configurable: true\n    });\n    /**\n     * Redraws the force graph\n     */\n    ForceGraph.prototype.redraw = function () {\n        if (this.vis && d3.event) {\n            this.vis.attr(\"transform\", \"translate(\" + d3.event.translate + \") scale(\" + d3.event.scale + \")\");\n        }\n    };\n    /**\n     * Gets the data associated with this graph\n     */\n    ForceGraph.prototype.getData = function () {\n        return this.graph;\n    };\n    /**\n     * Sets the data for this force graph\n     */\n    ForceGraph.prototype.setData = function (graph) {\n        var _this = this;\n        var me = this;\n        this.graph = graph;\n        this.zoom = d3.behavior.zoom()\n            .scaleExtent([this._configuration.minZoom, this._configuration.maxZoom])\n            .on(\"zoom\", function () { return _this.redraw(); });\n        var drag = d3.behavior.drag()\n            .origin(function (d) { return d; })\n            .on(\"dragstart\", function (d) {\n            d3.event.sourceEvent.stopPropagation();\n            d3.select(this).classed(\"dragging\", true);\n            me.force.start();\n        })\n            .on(\"drag\", function (d) {\n            d3.select(this).attr(\"cx\", d.x = d3.event.x).attr(\"cy\", d.y = d3.event.y);\n        })\n            .on(\"dragend\", function (d) {\n            d3.select(this).classed(\"dragging\", false);\n        });\n        this.svg.remove();\n        this.svg = d3.select(this.element[0]).append(\"svg\")\n            .attr(\"width\", this.dimensions.width)\n            .attr(\"height\", this.dimensions.height)\n            .attr(\"preserveAspectRatio\", \"xMidYMid meet\")\n            .attr(\"pointer-events\", \"all\")\n            .call(this.zoom);\n        this.vis = this.svg.append('svg:g');\n        var nodes = graph.nodes.slice();\n        var links = [];\n        var bilinks = [];\n        graph.links.forEach(function (link) {\n            var s = nodes[link.source];\n            var t = nodes[link.target];\n            var w = link.value;\n            var i = {}; // intermediate node\n            nodes.push(i);\n            links.push({ source: s, target: i }, { source: i, target: t });\n            bilinks.push([s, i, t, w]);\n        });\n        this.force.nodes(nodes).links(links).start();\n        this.vis.append(\"svg:defs\").selectAll(\"marker\")\n            .data([\"end\"])\n            .enter()\n            .append(\"svg:marker\")\n            .attr(\"id\", String)\n            .attr(\"viewBox\", \"0 -5 10 10\")\n            .attr(\"refX\", 15)\n            .attr(\"refY\", 0)\n            .attr(\"markerWidth\", 7)\n            .attr(\"markerHeight\", 7)\n            .attr(\"orient\", \"auto\")\n            .append(\"svg:path\")\n            .attr(\"d\", \"M0,-5L10,0L0,5\");\n        var link = this.vis.selectAll(\".link\")\n            .data(bilinks)\n            .enter().append(\"line\")\n            .attr(\"class\", \"link\")\n            .style(\"stroke\", \"gray\")\n            .style(\"stroke-width\", function (d) {\n            var w = 0.15 + (d[3] / 500);\n            return (w > 3) ? 3 : w;\n        })\n            .attr(\"id\", function (d) {\n            return d[0].name.replace(/\\./g, '_').replace(/@/g, '_') + '_' +\n                d[2].name.replace(/\\./g, '_').replace(/@/g, '_');\n        });\n        var node = this.vis.selectAll(\".node\")\n            .data(graph.nodes)\n            .enter().append(\"g\")\n            .call(drag)\n            .attr(\"class\", \"node\");\n        node.append(\"svg:circle\")\n            .attr(\"r\", function (d) { return Math.log(((d.num || 1) * 100)); })\n            .style(\"fill\", function (d) { return d.color; })\n            .style(\"stroke\", \"red\")\n            .style(\"stroke-width\", function (d) { return d.selected ? 1 : 0; })\n            .style(\"opacity\", 1);\n        node.on(\"click\", function (n) {\n            _this.events.raiseEvent(\"nodeClicked\", n);\n        });\n        node.on(\"mouseover\", function () {\n            console.log(\"mouseover\");\n            d3.select(_this.element.find(\"svg text\")[0]).style(\"opacity\", \"100\");\n        });\n        node.on(\"mouseout\", function () {\n            if (!_this._configuration.labels) {\n                d3.select(_this.element.find(\"svg text\")[0]).style(\"opacity\", \"0\");\n            }\n        });\n        link.append(\"svg:text\")\n            .text(function (d) { return 'yes'; })\n            .attr(\"fill\", \"black\")\n            .attr(\"stroke\", \"black\")\n            .attr(\"font-size\", \"5pt\")\n            .attr(\"stroke-width\", \"0.5px\")\n            .attr(\"class\", \"linklabel\")\n            .attr(\"text-anchor\", \"middle\")\n            .style(\"opacity\", function () {\n            return 100;\n        });\n        link.on(\"click\", function (n) { console.log(n); });\n        node.append(\"svg:text\")\n            .text(function (d) { return d.name; })\n            .attr(\"fill\", \"blue\")\n            .attr(\"stroke\", \"blue\")\n            .attr(\"font-size\", \"5pt\")\n            .attr(\"stroke-width\", \"0.5px\")\n            .style(\"opacity\", this._configuration.labels ? 100 : 0);\n        this.force.on(\"tick\", function () {\n            link.attr(\"x1\", function (d) { return d[0].x; })\n                .attr(\"y1\", function (d) { return d[0].y; })\n                .attr(\"x2\", function (d) { return d[2].x; })\n                .attr(\"y2\", function (d) { return d[2].y; });\n            node.attr(\"transform\", function (d) { return (\"translate(\" + d.x + \",\" + d.y + \")\"); });\n        });\n    };\n    /**\n     * Redraws the selections on the nodes\n     */\n    ForceGraph.prototype.redrawSelection = function () {\n        this.vis.selectAll(\".node circle\")\n            .style(\"stroke-width\", function (d) { return d.selected ? 1 : 0; });\n    };\n    return ForceGraph;\n})();\nexports.ForceGraph = ForceGraph;\n\n\n/*****************\n ** WEBPACK FOOTER\n ** ./visuals/forcegraph/ForceGraph.ts\n ** module id = 0\n ** module chunks = 0\n **/\n//# sourceURL=webpack:///./visuals/forcegraph/ForceGraph.ts?");

/***/ },
/* 1 */
/***/ function(module, exports) {

	eval("/**\n * A mixin that adds support for event emitting\n */\nvar EventEmitter = (function () {\n    function EventEmitter() {\n        this.listeners = {};\n    }\n    /**\n     * Adds an event listener for the given event\n     */\n    EventEmitter.prototype.on = function (name, handler) {\n        var _this = this;\n        var listeners = this.listeners[name] = this.listeners[name] || [];\n        listeners.push(handler);\n        return {\n            destroy: function () {\n                _this.off(name, handler);\n            }\n        };\n    };\n    /**\n     * Removes an event listener for the given event\n     */\n    EventEmitter.prototype.off = function (name, handler) {\n        var listeners = this.listeners[name];\n        if (listeners) {\n            var idx = listeners.indexOf(handler);\n            if (idx >= 0) {\n                listeners.splice(idx, 1);\n            }\n        }\n    };\n    /**\n     * Raises the given event\n     */\n    /*protected*/ EventEmitter.prototype.raiseEvent = function (name) {\n        var _this = this;\n        var args = [];\n        for (var _i = 1; _i < arguments.length; _i++) {\n            args[_i - 1] = arguments[_i];\n        }\n        var listeners = this.listeners[name];\n        if (listeners) {\n            listeners.forEach(function (l) {\n                l.apply(_this, args);\n            });\n        }\n    };\n    return EventEmitter;\n})();\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.default = EventEmitter;\n\n\n/*****************\n ** WEBPACK FOOTER\n ** ./base/EventEmitter.ts\n ** module id = 1\n ** module chunks = 0\n **/\n//# sourceURL=webpack:///./base/EventEmitter.ts?");

/***/ }
/******/ ]);