// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (modules, entry, mainEntry, parcelRequireName, globalName) {
  /* eslint-disable no-undef */
  var globalObject =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  /* eslint-enable no-undef */

  // Save the require from previous bundle to this closure if any
  var previousRequire =
    typeof globalObject[parcelRequireName] === 'function' &&
    globalObject[parcelRequireName];

  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire =
          typeof globalObject[parcelRequireName] === 'function' &&
          globalObject[parcelRequireName];
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        this
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      var res = localRequire.resolve(x);
      return res === false ? {} : newRequire(res);
    }

    function resolve(x) {
      var id = modules[name][1][x];
      return id != null ? id : x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  Object.defineProperty(newRequire, 'root', {
    get: function () {
      return globalObject[parcelRequireName];
    },
  });

  globalObject[parcelRequireName] = newRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (mainEntry) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(mainEntry);

    // CommonJS
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = mainExports;

      // RequireJS
    } else if (typeof define === 'function' && define.amd) {
      define(function () {
        return mainExports;
      });

      // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }
})({"764mN":[function(require,module,exports) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SECURE = false;
var HMR_ENV_HASH = "d6ea1d42532a7575";
module.bundle.HMR_BUNDLE_ID = "6a4e55ad8b7bab53";
"use strict";
/* global HMR_HOST, HMR_PORT, HMR_ENV_HASH, HMR_SECURE, chrome, browser, globalThis, __parcel__import__, __parcel__importScripts__, ServiceWorkerGlobalScope */ /*::
import type {
  HMRAsset,
  HMRMessage,
} from '@parcel/reporter-dev-server/src/HMRServer.js';
interface ParcelRequire {
  (string): mixed;
  cache: {|[string]: ParcelModule|};
  hotData: {|[string]: mixed|};
  Module: any;
  parent: ?ParcelRequire;
  isParcelRequire: true;
  modules: {|[string]: [Function, {|[string]: string|}]|};
  HMR_BUNDLE_ID: string;
  root: ParcelRequire;
}
interface ParcelModule {
  hot: {|
    data: mixed,
    accept(cb: (Function) => void): void,
    dispose(cb: (mixed) => void): void,
    // accept(deps: Array<string> | string, cb: (Function) => void): void,
    // decline(): void,
    _acceptCallbacks: Array<(Function) => void>,
    _disposeCallbacks: Array<(mixed) => void>,
  |};
}
interface ExtensionContext {
  runtime: {|
    reload(): void,
    getURL(url: string): string;
    getManifest(): {manifest_version: number, ...};
  |};
}
declare var module: {bundle: ParcelRequire, ...};
declare var HMR_HOST: string;
declare var HMR_PORT: string;
declare var HMR_ENV_HASH: string;
declare var HMR_SECURE: boolean;
declare var chrome: ExtensionContext;
declare var browser: ExtensionContext;
declare var __parcel__import__: (string) => Promise<void>;
declare var __parcel__importScripts__: (string) => Promise<void>;
declare var globalThis: typeof self;
declare var ServiceWorkerGlobalScope: Object;
*/ var OVERLAY_ID = "__parcel__error__overlay__";
var OldModule = module.bundle.Module;
function Module(moduleName) {
    OldModule.call(this, moduleName);
    this.hot = {
        data: module.bundle.hotData[moduleName],
        _acceptCallbacks: [],
        _disposeCallbacks: [],
        accept: function(fn) {
            this._acceptCallbacks.push(fn || function() {});
        },
        dispose: function(fn) {
            this._disposeCallbacks.push(fn);
        }
    };
    module.bundle.hotData[moduleName] = undefined;
}
module.bundle.Module = Module;
module.bundle.hotData = {};
var checkedAssets, assetsToDispose, assetsToAccept /*: Array<[ParcelRequire, string]> */ ;
function getHostname() {
    return HMR_HOST || (location.protocol.indexOf("http") === 0 ? location.hostname : "localhost");
}
function getPort() {
    return HMR_PORT || location.port;
} // eslint-disable-next-line no-redeclare
var parent = module.bundle.parent;
if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== "undefined") {
    var hostname = getHostname();
    var port = getPort();
    var protocol = HMR_SECURE || location.protocol == "https:" && !/localhost|127.0.0.1|0.0.0.0/.test(hostname) ? "wss" : "ws";
    var ws = new WebSocket(protocol + "://" + hostname + (port ? ":" + port : "") + "/"); // Web extension context
    var extCtx = typeof chrome === "undefined" ? typeof browser === "undefined" ? null : browser : chrome; // Safari doesn't support sourceURL in error stacks.
    // eval may also be disabled via CSP, so do a quick check.
    var supportsSourceURL = false;
    try {
        (0, eval)('throw new Error("test"); //# sourceURL=test.js');
    } catch (err) {
        supportsSourceURL = err.stack.includes("test.js");
    } // $FlowFixMe
    ws.onmessage = async function(event) {
        checkedAssets = {} /*: {|[string]: boolean|} */ ;
        assetsToAccept = [];
        assetsToDispose = [];
        var data = JSON.parse(event.data);
        if (data.type === "update") {
            // Remove error overlay if there is one
            if (typeof document !== "undefined") removeErrorOverlay();
            let assets = data.assets.filter((asset)=>asset.envHash === HMR_ENV_HASH); // Handle HMR Update
            let handled = assets.every((asset)=>{
                return asset.type === "css" || asset.type === "js" && hmrAcceptCheck(module.bundle.root, asset.id, asset.depsByBundle);
            });
            if (handled) {
                console.clear(); // Dispatch custom event so other runtimes (e.g React Refresh) are aware.
                if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") window.dispatchEvent(new CustomEvent("parcelhmraccept"));
                await hmrApplyUpdates(assets); // Dispose all old assets.
                let processedAssets = {} /*: {|[string]: boolean|} */ ;
                for(let i = 0; i < assetsToDispose.length; i++){
                    let id = assetsToDispose[i][1];
                    if (!processedAssets[id]) {
                        hmrDispose(assetsToDispose[i][0], id);
                        processedAssets[id] = true;
                    }
                } // Run accept callbacks. This will also re-execute other disposed assets in topological order.
                processedAssets = {};
                for(let i = 0; i < assetsToAccept.length; i++){
                    let id = assetsToAccept[i][1];
                    if (!processedAssets[id]) {
                        hmrAccept(assetsToAccept[i][0], id);
                        processedAssets[id] = true;
                    }
                }
            } else fullReload();
        }
        if (data.type === "error") {
            // Log parcel errors to console
            for (let ansiDiagnostic of data.diagnostics.ansi){
                let stack = ansiDiagnostic.codeframe ? ansiDiagnostic.codeframe : ansiDiagnostic.stack;
                console.error("\uD83D\uDEA8 [parcel]: " + ansiDiagnostic.message + "\n" + stack + "\n\n" + ansiDiagnostic.hints.join("\n"));
            }
            if (typeof document !== "undefined") {
                // Render the fancy html overlay
                removeErrorOverlay();
                var overlay = createErrorOverlay(data.diagnostics.html); // $FlowFixMe
                document.body.appendChild(overlay);
            }
        }
    };
    ws.onerror = function(e) {
        console.error(e.message);
    };
    ws.onclose = function() {
        console.warn("[parcel] \uD83D\uDEA8 Connection to the HMR server was lost");
    };
}
function removeErrorOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.remove();
        console.log("[parcel] ✨ Error resolved");
    }
}
function createErrorOverlay(diagnostics) {
    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    let errorHTML = '<div style="background: black; opacity: 0.85; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; font-family: Menlo, Consolas, monospace; z-index: 9999;">';
    for (let diagnostic of diagnostics){
        let stack = diagnostic.frames.length ? diagnostic.frames.reduce((p, frame)=>{
            return `${p}
<a href="/__parcel_launch_editor?file=${encodeURIComponent(frame.location)}" style="text-decoration: underline; color: #888" onclick="fetch(this.href); return false">${frame.location}</a>
${frame.code}`;
        }, "") : diagnostic.stack;
        errorHTML += `
      <div>
        <div style="font-size: 18px; font-weight: bold; margin-top: 20px;">
          🚨 ${diagnostic.message}
        </div>
        <pre>${stack}</pre>
        <div>
          ${diagnostic.hints.map((hint)=>"<div>\uD83D\uDCA1 " + hint + "</div>").join("")}
        </div>
        ${diagnostic.documentation ? `<div>📝 <a style="color: violet" href="${diagnostic.documentation}" target="_blank">Learn more</a></div>` : ""}
      </div>
    `;
    }
    errorHTML += "</div>";
    overlay.innerHTML = errorHTML;
    return overlay;
}
function fullReload() {
    if ("reload" in location) location.reload();
    else if (extCtx && extCtx.runtime && extCtx.runtime.reload) extCtx.runtime.reload();
}
function getParents(bundle, id) /*: Array<[ParcelRequire, string]> */ {
    var modules = bundle.modules;
    if (!modules) return [];
    var parents = [];
    var k, d, dep;
    for(k in modules)for(d in modules[k][1]){
        dep = modules[k][1][d];
        if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) parents.push([
            bundle,
            k
        ]);
    }
    if (bundle.parent) parents = parents.concat(getParents(bundle.parent, id));
    return parents;
}
function updateLink(link) {
    var newLink = link.cloneNode();
    newLink.onload = function() {
        if (link.parentNode !== null) // $FlowFixMe
        link.parentNode.removeChild(link);
    };
    newLink.setAttribute("href", link.getAttribute("href").split("?")[0] + "?" + Date.now()); // $FlowFixMe
    link.parentNode.insertBefore(newLink, link.nextSibling);
}
var cssTimeout = null;
function reloadCSS() {
    if (cssTimeout) return;
    cssTimeout = setTimeout(function() {
        var links = document.querySelectorAll('link[rel="stylesheet"]');
        for(var i = 0; i < links.length; i++){
            // $FlowFixMe[incompatible-type]
            var href = links[i].getAttribute("href");
            var hostname = getHostname();
            var servedFromHMRServer = hostname === "localhost" ? new RegExp("^(https?:\\/\\/(0.0.0.0|127.0.0.1)|localhost):" + getPort()).test(href) : href.indexOf(hostname + ":" + getPort());
            var absolute = /^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0 && !servedFromHMRServer;
            if (!absolute) updateLink(links[i]);
        }
        cssTimeout = null;
    }, 50);
}
function hmrDownload(asset) {
    if (asset.type === "js") {
        if (typeof document !== "undefined") {
            let script = document.createElement("script");
            script.src = asset.url + "?t=" + Date.now();
            if (asset.outputFormat === "esmodule") script.type = "module";
            return new Promise((resolve, reject)=>{
                var _document$head;
                script.onload = ()=>resolve(script);
                script.onerror = reject;
                (_document$head = document.head) === null || _document$head === void 0 || _document$head.appendChild(script);
            });
        } else if (typeof importScripts === "function") {
            // Worker scripts
            if (asset.outputFormat === "esmodule") return import(asset.url + "?t=" + Date.now());
            else return new Promise((resolve, reject)=>{
                try {
                    importScripts(asset.url + "?t=" + Date.now());
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        }
    }
}
async function hmrApplyUpdates(assets) {
    global.parcelHotUpdate = Object.create(null);
    let scriptsToRemove;
    try {
        // If sourceURL comments aren't supported in eval, we need to load
        // the update from the dev server over HTTP so that stack traces
        // are correct in errors/logs. This is much slower than eval, so
        // we only do it if needed (currently just Safari).
        // https://bugs.webkit.org/show_bug.cgi?id=137297
        // This path is also taken if a CSP disallows eval.
        if (!supportsSourceURL) {
            let promises = assets.map((asset)=>{
                var _hmrDownload;
                return (_hmrDownload = hmrDownload(asset)) === null || _hmrDownload === void 0 ? void 0 : _hmrDownload.catch((err)=>{
                    // Web extension bugfix for Chromium
                    // https://bugs.chromium.org/p/chromium/issues/detail?id=1255412#c12
                    if (extCtx && extCtx.runtime && extCtx.runtime.getManifest().manifest_version == 3) {
                        if (typeof ServiceWorkerGlobalScope != "undefined" && global instanceof ServiceWorkerGlobalScope) {
                            extCtx.runtime.reload();
                            return;
                        }
                        asset.url = extCtx.runtime.getURL("/__parcel_hmr_proxy__?url=" + encodeURIComponent(asset.url + "?t=" + Date.now()));
                        return hmrDownload(asset);
                    }
                    throw err;
                });
            });
            scriptsToRemove = await Promise.all(promises);
        }
        assets.forEach(function(asset) {
            hmrApply(module.bundle.root, asset);
        });
    } finally{
        delete global.parcelHotUpdate;
        if (scriptsToRemove) scriptsToRemove.forEach((script)=>{
            if (script) {
                var _document$head2;
                (_document$head2 = document.head) === null || _document$head2 === void 0 || _document$head2.removeChild(script);
            }
        });
    }
}
function hmrApply(bundle, asset) {
    var modules = bundle.modules;
    if (!modules) return;
    if (asset.type === "css") reloadCSS();
    else if (asset.type === "js") {
        let deps = asset.depsByBundle[bundle.HMR_BUNDLE_ID];
        if (deps) {
            if (modules[asset.id]) {
                // Remove dependencies that are removed and will become orphaned.
                // This is necessary so that if the asset is added back again, the cache is gone, and we prevent a full page reload.
                let oldDeps = modules[asset.id][1];
                for(let dep in oldDeps)if (!deps[dep] || deps[dep] !== oldDeps[dep]) {
                    let id = oldDeps[dep];
                    let parents = getParents(module.bundle.root, id);
                    if (parents.length === 1) hmrDelete(module.bundle.root, id);
                }
            }
            if (supportsSourceURL) // Global eval. We would use `new Function` here but browser
            // support for source maps is better with eval.
            (0, eval)(asset.output);
             // $FlowFixMe
            let fn = global.parcelHotUpdate[asset.id];
            modules[asset.id] = [
                fn,
                deps
            ];
        } else if (bundle.parent) hmrApply(bundle.parent, asset);
    }
}
function hmrDelete(bundle, id) {
    let modules = bundle.modules;
    if (!modules) return;
    if (modules[id]) {
        // Collect dependencies that will become orphaned when this module is deleted.
        let deps = modules[id][1];
        let orphans = [];
        for(let dep in deps){
            let parents = getParents(module.bundle.root, deps[dep]);
            if (parents.length === 1) orphans.push(deps[dep]);
        } // Delete the module. This must be done before deleting dependencies in case of circular dependencies.
        delete modules[id];
        delete bundle.cache[id]; // Now delete the orphans.
        orphans.forEach((id)=>{
            hmrDelete(module.bundle.root, id);
        });
    } else if (bundle.parent) hmrDelete(bundle.parent, id);
}
function hmrAcceptCheck(bundle, id, depsByBundle) {
    if (hmrAcceptCheckOne(bundle, id, depsByBundle)) return true;
     // Traverse parents breadth first. All possible ancestries must accept the HMR update, or we'll reload.
    let parents = getParents(module.bundle.root, id);
    let accepted = false;
    while(parents.length > 0){
        let v = parents.shift();
        let a = hmrAcceptCheckOne(v[0], v[1], null);
        if (a) // If this parent accepts, stop traversing upward, but still consider siblings.
        accepted = true;
        else {
            // Otherwise, queue the parents in the next level upward.
            let p = getParents(module.bundle.root, v[1]);
            if (p.length === 0) {
                // If there are no parents, then we've reached an entry without accepting. Reload.
                accepted = false;
                break;
            }
            parents.push(...p);
        }
    }
    return accepted;
}
function hmrAcceptCheckOne(bundle, id, depsByBundle) {
    var modules = bundle.modules;
    if (!modules) return;
    if (depsByBundle && !depsByBundle[bundle.HMR_BUNDLE_ID]) {
        // If we reached the root bundle without finding where the asset should go,
        // there's nothing to do. Mark as "accepted" so we don't reload the page.
        if (!bundle.parent) return true;
        return hmrAcceptCheck(bundle.parent, id, depsByBundle);
    }
    if (checkedAssets[id]) return true;
    checkedAssets[id] = true;
    var cached = bundle.cache[id];
    assetsToDispose.push([
        bundle,
        id
    ]);
    if (!cached || cached.hot && cached.hot._acceptCallbacks.length) {
        assetsToAccept.push([
            bundle,
            id
        ]);
        return true;
    }
}
function hmrDispose(bundle, id) {
    var cached = bundle.cache[id];
    bundle.hotData[id] = {};
    if (cached && cached.hot) cached.hot.data = bundle.hotData[id];
    if (cached && cached.hot && cached.hot._disposeCallbacks.length) cached.hot._disposeCallbacks.forEach(function(cb) {
        cb(bundle.hotData[id]);
    });
    delete bundle.cache[id];
}
function hmrAccept(bundle, id) {
    // Execute the module.
    bundle(id); // Run the accept callbacks in the new version of the module.
    var cached = bundle.cache[id];
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) cached.hot._acceptCallbacks.forEach(function(cb) {
        var assetsToAlsoAccept = cb(function() {
            return getParents(module.bundle.root, id);
        });
        if (assetsToAlsoAccept && assetsToAccept.length) {
            assetsToAlsoAccept.forEach(function(a) {
                hmrDispose(a[0], a[1]);
            }); // $FlowFixMe[method-unbinding]
            assetsToAccept.push.apply(assetsToAccept, assetsToAlsoAccept);
        }
    });
}

},{}],"g6Vmg":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "ReflParser", ()=>ReflParser);
var _msgpack = require("@ygoe/msgpack");
class ReflParser {
    constructor(){
        this.refl = null;
        this.reflData = {};
        this.indexedMap = {};
        this.unindexedMap = {};
        this.filename = null;
        this.numReflections = null;
    }
    hasReflTable() {
        return this.refl != null;
    }
    clearReflectionTable() {
        this.refl = null;
        this.reflData = {};
        this.filename = null;
        this.numReflections = null;
    }
    hasXYZObsData() {
        if (!this.hasReflTable()) return false;
        for(var i in this.reflData){
            if (!("xyzObs" in this.reflData[i][0])) return false;
        }
        return true;
    }
    hasXYZCalData() {
        if (!this.hasReflTable()) return false;
        for(var i in this.reflData){
            if (!("xyzCal" in this.reflData[i][0])) return false;
        }
        return true;
    }
    hasBboxData() {
        if (!this.hasReflTable()) return false;
        for(var i in this.reflData){
            if (!("bbox" in this.reflData[i][0])) return false;
        }
        return true;
    }
    hasMillerIndicesData() {
        if (!this.hasReflTable()) return false;
        for(var i in this.reflData){
            if (!("millerIdx" in this.reflData[i][0])) return false;
        }
        return true;
    }
    parseReflectionTable = (file)=>{
        const reader = new FileReader();
        return new Promise((resolve, reject)=>{
            reader.onerror = ()=>{
                reader.abort();
                reject(new DOMException("Problem parsing input file."));
            };
            reader.onloadend = ()=>{
                resolve(reader.result);
                const decoded = (0, _msgpack.deserialize)(new Uint8Array(reader.result));
                this.refl = decoded[2]["data"];
                this.loadReflectionData();
            };
            reader.readAsArrayBuffer(file);
            this.filename = file.name;
        });
    };
    containsColumn(column_name) {
        return column_name in this.refl;
    }
    getColumnBuffer(column_name) {
        return this.refl[column_name][1][1];
    }
    getUint32Array(column_name) {
        const buffer = this.getColumnBuffer(column_name);
        const dataView = new DataView(buffer.buffer);
        const arr = new Uint32Array(buffer.byteLength / 8);
        let count = 0;
        for(let i = 0; i < buffer.byteLength; i += 8){
            arr[count] = dataView.getUint32(buffer.byteOffset + i, true);
            count++;
        }
        return arr;
    }
    getDoubleArray(column_name) {
        const buffer = this.getColumnBuffer(column_name);
        const dataView = new DataView(buffer.buffer);
        const arr = new Float64Array(buffer.length / 8);
        let count = 0;
        for(let i = 0; i < buffer.byteLength; i += 8){
            arr[count] = dataView.getFloat64(buffer.byteOffset + i, true);
            count++;
        }
        return arr;
    }
    getVec3DoubleArray(column_name) {
        const buffer = this.getColumnBuffer(column_name);
        const dataView = new DataView(buffer.buffer);
        const arr = new Array(buffer.length / 24);
        let count = 0;
        for(let i = 0; i < buffer.byteLength; i += 24){
            const vec = new Float64Array(3);
            vec[0] = dataView.getFloat64(buffer.byteOffset + i, true);
            vec[1] = dataView.getFloat64(buffer.byteOffset + i + 8, true);
            vec[2] = dataView.getFloat64(buffer.byteOffset + i + 16, true);
            arr[count] = vec;
            count++;
        }
        return arr;
    }
    getVec6Uint32Array(column_name) {
        const buffer = this.getColumnBuffer(column_name);
        const arr = new Array(buffer.length / 24);
        const dataView = new DataView(buffer.buffer);
        let count = 0;
        for(let i = 0; i < buffer.length; i += 24){
            const vec = new Uint32Array(6);
            vec[0] = dataView.getUint32(buffer.byteOffset + i, true);
            vec[1] = dataView.getUint32(buffer.byteOffset + i + 4, true);
            vec[2] = dataView.getUint32(buffer.byteOffset + i + 8, true);
            vec[3] = dataView.getUint32(buffer.byteOffset + i + 12, true);
            vec[4] = dataView.getUint32(buffer.byteOffset + i + 16, true);
            vec[5] = dataView.getUint32(buffer.byteOffset + i + 20, true);
            arr[count] = vec;
            count++;
        }
        return arr;
    }
    getVec3Int32Array(column_name) {
        const buffer = this.getColumnBuffer(column_name);
        const arr = new Array(buffer.length / 12);
        const dataView = new DataView(buffer.buffer);
        let count = 0;
        for(let i = 0; i < buffer.length; i += 12){
            const vec = new Int32Array(3);
            vec[0] = dataView.getInt32(buffer.byteOffset + i, true);
            vec[1] = dataView.getInt32(buffer.byteOffset + i + 4, true);
            vec[2] = dataView.getInt32(buffer.byteOffset + i + 8, true);
            arr[count] = vec;
            count++;
        }
        return arr;
    }
    getPanelNumbers() {
        return this.getUint32Array("panel");
    }
    getXYZObs() {
        return this.getVec3DoubleArray("xyzobs.px.value");
    }
    containsXYZObs() {
        return this.containsColumn("xyzobs.px.value");
    }
    getXYZCal() {
        return this.getVec3DoubleArray("xyzcal.px");
    }
    containsXYZCal() {
        return this.containsColumn("xyzcal.px");
    }
    getBoundingBoxes() {
        return this.getVec6Uint32Array("bbox");
    }
    containsMillerIndices() {
        return this.containsColumn("miller_index");
    }
    getMillerIndices() {
        return this.getVec3Int32Array("miller_index");
    }
    isValidMillerIndex(idx) {
        return Math.pow(idx[0], 2) + Math.pow(idx[1], 2) + Math.pow(idx[2], 2) > 1e-3;
    }
    loadReflectionData() {
        const panelNums = this.getPanelNumbers();
        var xyzObs;
        var xyzCal;
        var bboxes;
        var millerIndices;
        if (this.containsXYZObs()) xyzObs = this.getXYZObs();
        if (this.containsXYZCal()) xyzCal = this.getXYZCal();
        if (this.containsMillerIndices()) millerIndices = this.getMillerIndices();
        bboxes = this.getBoundingBoxes();
        console.assert(xyzObs || xyzCal);
        console.assert(bboxes);
        var numUnindexed = 0;
        var numIndexed = 0;
        for(var i = 0; i < panelNums.length; i++){
            const panel = panelNums[i];
            const refl = {
                "bbox": bboxes[i],
                "indexed": false
            };
            if (xyzObs) refl["xyzObs"] = xyzObs[i];
            if (xyzCal) refl["xyzCal"] = xyzCal[i];
            if (millerIndices) {
                refl["millerIdx"] = millerIndices[i];
                if (this.isValidMillerIndex(millerIndices[i])) {
                    refl["indexed"] = true;
                    refl["id"] = numIndexed;
                    this.indexedMap[numIndexed] = millerIndices[i];
                    numIndexed++;
                } else {
                    refl["id"] = numUnindexed;
                    numUnindexed++;
                }
            } else {
                refl["id"] = numUnindexed;
                numUnindexed++;
            }
            if (panel in this.reflData) this.reflData[panel].push(refl);
            else this.reflData[panel] = [
                refl
            ];
        }
        this.numReflections = panelNums.length;
    }
    getMillerIndexById(id) {
        return this.indexedMap[id];
    }
    getReflectionsForPanel(panelIdx) {
        console.assert(this.hasReflTable());
        return this.reflData[panelIdx];
    }
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"fD7H8","@ygoe/msgpack":"hqtYv"}],"hqtYv":[function(require,module,exports) {
(function() {
    "use strict";
    // Serializes a value to a MessagePack byte array.
    //
    // data: The value to serialize. This can be a scalar, array or object.
    // options: An object that defined additional options.
    // - multiple: Indicates whether multiple values in data are concatenated to multiple MessagePack arrays.
    // - invalidTypeReplacement: The value that is used to replace values of unsupported types, or a function that returns such a value, given the original value as parameter.
    function serialize(data, options) {
        if (options && options.multiple && !Array.isArray(data)) throw new Error("Invalid argument type: Expected an Array to serialize multiple values.");
        const pow32 = 0x100000000; // 2^32
        let floatBuffer, floatView;
        let array = new Uint8Array(128);
        let length = 0;
        if (options && options.multiple) for(let i = 0; i < data.length; i++)append(data[i]);
        else append(data);
        return array.subarray(0, length);
        function append(data, isReplacement) {
            switch(typeof data){
                case "undefined":
                    appendNull(data);
                    break;
                case "boolean":
                    appendBoolean(data);
                    break;
                case "number":
                    appendNumber(data);
                    break;
                case "string":
                    appendString(data);
                    break;
                case "object":
                    if (data === null) appendNull(data);
                    else if (data instanceof Date) appendDate(data);
                    else if (Array.isArray(data)) appendArray(data);
                    else if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) appendBinArray(data);
                    else if (data instanceof Int8Array || data instanceof Int16Array || data instanceof Uint16Array || data instanceof Int32Array || data instanceof Uint32Array || data instanceof Float32Array || data instanceof Float64Array) appendArray(data);
                    else appendObject(data);
                    break;
                default:
                    if (!isReplacement && options && options.invalidTypeReplacement) {
                        if (typeof options.invalidTypeReplacement === "function") append(options.invalidTypeReplacement(data), true);
                        else append(options.invalidTypeReplacement, true);
                    } else throw new Error("Invalid argument type: The type '" + typeof data + "' cannot be serialized.");
            }
        }
        function appendNull(data) {
            appendByte(0xc0);
        }
        function appendBoolean(data) {
            appendByte(data ? 0xc3 : 0xc2);
        }
        function appendNumber(data) {
            if (isFinite(data) && Math.floor(data) === data) {
                // Integer
                if (data >= 0 && data <= 0x7f) appendByte(data);
                else if (data < 0 && data >= -32) appendByte(data);
                else if (data > 0 && data <= 0xff) appendBytes([
                    0xcc,
                    data
                ]);
                else if (data >= -128 && data <= 0x7f) appendBytes([
                    0xd0,
                    data
                ]);
                else if (data > 0 && data <= 0xffff) appendBytes([
                    0xcd,
                    data >>> 8,
                    data
                ]);
                else if (data >= -32768 && data <= 0x7fff) appendBytes([
                    0xd1,
                    data >>> 8,
                    data
                ]);
                else if (data > 0 && data <= 0xffffffff) appendBytes([
                    0xce,
                    data >>> 24,
                    data >>> 16,
                    data >>> 8,
                    data
                ]);
                else if (data >= -2147483648 && data <= 0x7fffffff) appendBytes([
                    0xd2,
                    data >>> 24,
                    data >>> 16,
                    data >>> 8,
                    data
                ]);
                else if (data > 0 && data <= 0xffffffffffffffff) {
                    // Split 64 bit number into two 32 bit numbers because JavaScript only regards
                    // 32 bits for bitwise operations.
                    let hi = data / pow32;
                    let lo = data % pow32;
                    appendBytes([
                        0xd3,
                        hi >>> 24,
                        hi >>> 16,
                        hi >>> 8,
                        hi,
                        lo >>> 24,
                        lo >>> 16,
                        lo >>> 8,
                        lo
                    ]);
                } else if (data >= -9223372036854776000 && data <= 0x7fffffffffffffff) {
                    appendByte(0xd3);
                    appendInt64(data);
                } else if (data < 0) appendBytes([
                    0xd3,
                    0x80,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0
                ]);
                else appendBytes([
                    0xcf,
                    0xff,
                    0xff,
                    0xff,
                    0xff,
                    0xff,
                    0xff,
                    0xff,
                    0xff
                ]);
            } else {
                // Float
                if (!floatView) {
                    floatBuffer = new ArrayBuffer(8);
                    floatView = new DataView(floatBuffer);
                }
                floatView.setFloat64(0, data);
                appendByte(0xcb);
                appendBytes(new Uint8Array(floatBuffer));
            }
        }
        function appendString(data) {
            let bytes = encodeUtf8(data);
            let length = bytes.length;
            if (length <= 0x1f) appendByte(0xa0 + length);
            else if (length <= 0xff) appendBytes([
                0xd9,
                length
            ]);
            else if (length <= 0xffff) appendBytes([
                0xda,
                length >>> 8,
                length
            ]);
            else appendBytes([
                0xdb,
                length >>> 24,
                length >>> 16,
                length >>> 8,
                length
            ]);
            appendBytes(bytes);
        }
        function appendArray(data) {
            let length = data.length;
            if (length <= 0xf) appendByte(0x90 + length);
            else if (length <= 0xffff) appendBytes([
                0xdc,
                length >>> 8,
                length
            ]);
            else appendBytes([
                0xdd,
                length >>> 24,
                length >>> 16,
                length >>> 8,
                length
            ]);
            for(let index = 0; index < length; index++)append(data[index]);
        }
        function appendBinArray(data) {
            let length = data.length;
            if (length <= 0xf) appendBytes([
                0xc4,
                length
            ]);
            else if (length <= 0xffff) appendBytes([
                0xc5,
                length >>> 8,
                length
            ]);
            else appendBytes([
                0xc6,
                length >>> 24,
                length >>> 16,
                length >>> 8,
                length
            ]);
            appendBytes(data);
        }
        function appendObject(data) {
            let length = 0;
            for(let key in data)if (data[key] !== undefined) length++;
            if (length <= 0xf) appendByte(0x80 + length);
            else if (length <= 0xffff) appendBytes([
                0xde,
                length >>> 8,
                length
            ]);
            else appendBytes([
                0xdf,
                length >>> 24,
                length >>> 16,
                length >>> 8,
                length
            ]);
            for(let key in data){
                let value = data[key];
                if (value !== undefined) {
                    append(key);
                    append(value);
                }
            }
        }
        function appendDate(data) {
            let sec = data.getTime() / 1000;
            if (data.getMilliseconds() === 0 && sec >= 0 && sec < 0x100000000) appendBytes([
                0xd6,
                0xff,
                sec >>> 24,
                sec >>> 16,
                sec >>> 8,
                sec
            ]);
            else if (sec >= 0 && sec < 0x400000000) {
                let ns = data.getMilliseconds() * 1000000;
                appendBytes([
                    0xd7,
                    0xff,
                    ns >>> 22,
                    ns >>> 14,
                    ns >>> 6,
                    ns << 2 >>> 0 | sec / pow32,
                    sec >>> 24,
                    sec >>> 16,
                    sec >>> 8,
                    sec
                ]);
            } else {
                let ns = data.getMilliseconds() * 1000000;
                appendBytes([
                    0xc7,
                    12,
                    0xff,
                    ns >>> 24,
                    ns >>> 16,
                    ns >>> 8,
                    ns
                ]);
                appendInt64(sec);
            }
        }
        function appendByte(byte) {
            if (array.length < length + 1) {
                let newLength = array.length * 2;
                while(newLength < length + 1)newLength *= 2;
                let newArray = new Uint8Array(newLength);
                newArray.set(array);
                array = newArray;
            }
            array[length] = byte;
            length++;
        }
        function appendBytes(bytes) {
            if (array.length < length + bytes.length) {
                let newLength = array.length * 2;
                while(newLength < length + bytes.length)newLength *= 2;
                let newArray = new Uint8Array(newLength);
                newArray.set(array);
                array = newArray;
            }
            array.set(bytes, length);
            length += bytes.length;
        }
        function appendInt64(value) {
            // Split 64 bit number into two 32 bit numbers because JavaScript only regards 32 bits for
            // bitwise operations.
            let hi, lo;
            if (value >= 0) {
                // Same as uint64
                hi = value / pow32;
                lo = value % pow32;
            } else {
                // Split absolute value to high and low, then NOT and ADD(1) to restore negativity
                value++;
                hi = Math.abs(value) / pow32;
                lo = Math.abs(value) % pow32;
                hi = ~hi;
                lo = ~lo;
            }
            appendBytes([
                hi >>> 24,
                hi >>> 16,
                hi >>> 8,
                hi,
                lo >>> 24,
                lo >>> 16,
                lo >>> 8,
                lo
            ]);
        }
    }
    // Deserializes a MessagePack byte array to a value.
    //
    // array: The MessagePack byte array to deserialize. This must be an Array or Uint8Array containing bytes, not a string.
    // options: An object that defined additional options.
    // - multiple: Indicates whether multiple concatenated MessagePack arrays are returned as an array.
    function deserialize(array, options) {
        const pow32 = 0x100000000; // 2^32
        let pos = 0;
        if (array instanceof ArrayBuffer) array = new Uint8Array(array);
        if (typeof array !== "object" || typeof array.length === "undefined") throw new Error("Invalid argument type: Expected a byte array (Array or Uint8Array) to deserialize.");
        if (!array.length) throw new Error("Invalid argument: The byte array to deserialize is empty.");
        if (!(array instanceof Uint8Array)) array = new Uint8Array(array);
        let data;
        if (options && options.multiple) {
            // Read as many messages as are available
            data = [];
            while(pos < array.length)data.push(read());
        } else // Read only one message and ignore additional data
        data = read();
        return data;
        function read() {
            const byte = array[pos++];
            if (byte >= 0x00 && byte <= 0x7f) return byte; // positive fixint
            if (byte >= 0x80 && byte <= 0x8f) return readMap(byte - 0x80); // fixmap
            if (byte >= 0x90 && byte <= 0x9f) return readArray(byte - 0x90); // fixarray
            if (byte >= 0xa0 && byte <= 0xbf) return readStr(byte - 0xa0); // fixstr
            if (byte === 0xc0) return null; // nil
            if (byte === 0xc1) throw new Error("Invalid byte code 0xc1 found."); // never used
            if (byte === 0xc2) return false; // false
            if (byte === 0xc3) return true; // true
            if (byte === 0xc4) return readBin(-1, 1); // bin 8
            if (byte === 0xc5) return readBin(-1, 2); // bin 16
            if (byte === 0xc6) return readBin(-1, 4); // bin 32
            if (byte === 0xc7) return readExt(-1, 1); // ext 8
            if (byte === 0xc8) return readExt(-1, 2); // ext 16
            if (byte === 0xc9) return readExt(-1, 4); // ext 32
            if (byte === 0xca) return readFloat(4); // float 32
            if (byte === 0xcb) return readFloat(8); // float 64
            if (byte === 0xcc) return readUInt(1); // uint 8
            if (byte === 0xcd) return readUInt(2); // uint 16
            if (byte === 0xce) return readUInt(4); // uint 32
            if (byte === 0xcf) return readUInt(8); // uint 64
            if (byte === 0xd0) return readInt(1); // int 8
            if (byte === 0xd1) return readInt(2); // int 16
            if (byte === 0xd2) return readInt(4); // int 32
            if (byte === 0xd3) return readInt(8); // int 64
            if (byte === 0xd4) return readExt(1); // fixext 1
            if (byte === 0xd5) return readExt(2); // fixext 2
            if (byte === 0xd6) return readExt(4); // fixext 4
            if (byte === 0xd7) return readExt(8); // fixext 8
            if (byte === 0xd8) return readExt(16); // fixext 16
            if (byte === 0xd9) return readStr(-1, 1); // str 8
            if (byte === 0xda) return readStr(-1, 2); // str 16
            if (byte === 0xdb) return readStr(-1, 4); // str 32
            if (byte === 0xdc) return readArray(-1, 2); // array 16
            if (byte === 0xdd) return readArray(-1, 4); // array 32
            if (byte === 0xde) return readMap(-1, 2); // map 16
            if (byte === 0xdf) return readMap(-1, 4); // map 32
            if (byte >= 0xe0 && byte <= 0xff) return byte - 256; // negative fixint
            console.debug("msgpack array:", array);
            throw new Error("Invalid byte value '" + byte + "' at index " + (pos - 1) + " in the MessagePack binary data (length " + array.length + "): Expecting a range of 0 to 255. This is not a byte array.");
        }
        function readInt(size) {
            let value = 0;
            let first = true;
            while(size-- > 0)if (first) {
                let byte = array[pos++];
                value += byte & 0x7f;
                if (byte & 0x80) value -= 0x80; // Treat most-significant bit as -2^i instead of 2^i
                first = false;
            } else {
                value *= 256;
                value += array[pos++];
            }
            return value;
        }
        function readUInt(size) {
            let value = 0;
            while(size-- > 0){
                value *= 256;
                value += array[pos++];
            }
            return value;
        }
        function readFloat(size) {
            let view = new DataView(array.buffer, pos + array.byteOffset, size);
            pos += size;
            if (size === 4) return view.getFloat32(0, false);
            if (size === 8) return view.getFloat64(0, false);
        }
        function readBin(size, lengthSize) {
            if (size < 0) size = readUInt(lengthSize);
            let data = array.subarray(pos, pos + size);
            pos += size;
            return data;
        }
        function readMap(size, lengthSize) {
            if (size < 0) size = readUInt(lengthSize);
            let data = {};
            while(size-- > 0){
                let key = read();
                data[key] = read();
            }
            return data;
        }
        function readArray(size, lengthSize) {
            if (size < 0) size = readUInt(lengthSize);
            let data = [];
            while(size-- > 0)data.push(read());
            return data;
        }
        function readStr(size, lengthSize) {
            if (size < 0) size = readUInt(lengthSize);
            let start = pos;
            pos += size;
            return decodeUtf8(array, start, size);
        }
        function readExt(size, lengthSize) {
            if (size < 0) size = readUInt(lengthSize);
            let type = readUInt(1);
            let data = readBin(size);
            switch(type){
                case 255:
                    return readExtDate(data);
            }
            return {
                type: type,
                data: data
            };
        }
        function readExtDate(data) {
            if (data.length === 4) {
                let sec = (data[0] << 24 >>> 0) + (data[1] << 16 >>> 0) + (data[2] << 8 >>> 0) + data[3];
                return new Date(sec * 1000);
            }
            if (data.length === 8) {
                let ns = (data[0] << 22 >>> 0) + (data[1] << 14 >>> 0) + (data[2] << 6 >>> 0) + (data[3] >>> 2);
                let sec = (data[3] & 0x3) * pow32 + (data[4] << 24 >>> 0) + (data[5] << 16 >>> 0) + (data[6] << 8 >>> 0) + data[7];
                return new Date(sec * 1000 + ns / 1000000);
            }
            if (data.length === 12) {
                let ns = (data[0] << 24 >>> 0) + (data[1] << 16 >>> 0) + (data[2] << 8 >>> 0) + data[3];
                pos -= 8;
                let sec = readInt(8);
                return new Date(sec * 1000 + ns / 1000000);
            }
            throw new Error("Invalid data length for a date value.");
        }
    }
    // Encodes a string to UTF-8 bytes.
    function encodeUtf8(str) {
        // Prevent excessive array allocation and slicing for all 7-bit characters
        let ascii = true, length = str.length;
        for(let x = 0; x < length; x++)if (str.charCodeAt(x) > 127) {
            ascii = false;
            break;
        }
        // Based on: https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
        let i = 0, bytes = new Uint8Array(str.length * (ascii ? 1 : 4));
        for(let ci = 0; ci !== length; ci++){
            let c = str.charCodeAt(ci);
            if (c < 128) {
                bytes[i++] = c;
                continue;
            }
            if (c < 2048) bytes[i++] = c >> 6 | 192;
            else {
                if (c > 0xd7ff && c < 0xdc00) {
                    if (++ci >= length) throw new Error("UTF-8 encode: incomplete surrogate pair");
                    let c2 = str.charCodeAt(ci);
                    if (c2 < 0xdc00 || c2 > 0xdfff) throw new Error("UTF-8 encode: second surrogate character 0x" + c2.toString(16) + " at index " + ci + " out of range");
                    c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
                    bytes[i++] = c >> 18 | 240;
                    bytes[i++] = c >> 12 & 63 | 128;
                } else bytes[i++] = c >> 12 | 224;
                bytes[i++] = c >> 6 & 63 | 128;
            }
            bytes[i++] = c & 63 | 128;
        }
        return ascii ? bytes : bytes.subarray(0, i);
    }
    // Decodes a string from UTF-8 bytes.
    function decodeUtf8(bytes, start, length) {
        // Based on: https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
        let i = start, str = "";
        length += start;
        while(i < length){
            let c = bytes[i++];
            if (c > 127) {
                if (c > 191 && c < 224) {
                    if (i >= length) throw new Error("UTF-8 decode: incomplete 2-byte sequence");
                    c = (c & 31) << 6 | bytes[i++] & 63;
                } else if (c > 223 && c < 240) {
                    if (i + 1 >= length) throw new Error("UTF-8 decode: incomplete 3-byte sequence");
                    c = (c & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
                } else if (c > 239 && c < 248) {
                    if (i + 2 >= length) throw new Error("UTF-8 decode: incomplete 4-byte sequence");
                    c = (c & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
                } else throw new Error("UTF-8 decode: unknown multibyte start 0x" + c.toString(16) + " at index " + (i - 1));
            }
            if (c <= 0xffff) str += String.fromCharCode(c);
            else if (c <= 0x10ffff) {
                c -= 0x10000;
                str += String.fromCharCode(c >> 10 | 0xd800);
                str += String.fromCharCode(c & 0x3FF | 0xdc00);
            } else throw new Error("UTF-8 decode: code point 0x" + c.toString(16) + " exceeds UTF-16 reach");
        }
        return str;
    }
    // The exported functions
    let msgpack = {
        serialize: serialize,
        deserialize: deserialize,
        // Compatibility with other libraries
        encode: serialize,
        decode: deserialize
    };
    // Environment detection
    if (module && typeof module.exports === "object") // Node.js
    module.exports = msgpack;
    else // Global object
    window[window.msgpackJsName || "msgpack"] = msgpack;
})();

},{}]},["764mN","g6Vmg"], "g6Vmg", "parcelRequire9102")

//# sourceMappingURL=ExperimentViewer.8b7bab53.js.map
