import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from "gsap";
import { MeshLineGeometry,  MeshLineMaterial, raycast } from 'meshline';
import { ExptParser } from "dials_javascript_parser/ExptParser.js";

class UserReflection {
  constructor(origin, panelName, lineColor) {
    this.positions = [origin];
    this.panelName = panelName;
    this.lineMesh = null;
    this.bboxMesh = null;
    this.lineMaterial = new THREE.LineBasicMaterial({ color: lineColor });
  }

  addBboxMesh(mesh) {
    this.clearLineMesh();
    this.bboxMesh = mesh;
    window.scene.add(mesh);
  }

  clearLineMesh() {
    if (this.lineMesh) {
      window.scene.remove(this.lineMesh);
      this.lineMesh.geometry.dispose();
      this.lineMesh.material.dispose();
      this.lineMesh = null;
    }
  }

  clearBboxMesh() {
    if (this.bboxMesh) {
      window.scene.remove(this.bboxMesh);
      this.bboxMesh.geometry.dispose();
      this.bboxMesh.material.dispose();
      this.bboxMesh = null;
    }
  }

  clear() {
    this.clearLineMesh();
    this.clearBboxMesh();
  }

  updateUserOutline(newPos) {
    this.positions.push(newPos);
    this.clearLineMesh();
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(this.positions);
    this.lineMesh = new THREE.Line(lineGeometry, this.lineMaterial);
    window.scene.add(this.lineMesh);
  }

}


export class ExperimentViewer {
  constructor(exptParser, reflParser, calculatedIntegratedReflParser, isStandalone, colors = null) {

    /*
     * if isStandalone, the user can add and remove .expt and .refl files
     * manually. Else controlled via websocket
     */

    this.isStandalone = isStandalone;
    this.debugImageMode = false;
    this.debugThresholdMode = false;

    this.serverWS = null;

    this.colors = null;
    if (colors != null) {
      this.colors = colors;
    }
    else {
      this.colors = ExperimentViewer.defaultColors();
    }

    // Data parsers
    this.expt = exptParser;
    this.refl = reflParser;
    this.calculatedIntegratedRefl = calculatedIntegratedReflParser;

    // Html elements
    this.headerText = window.document.getElementById("headerText");
    this.footerText = window.document.getElementById("footerText");
    this.sidebar = window.document.getElementById("sidebar");
    this.closeExptButton = document.getElementById("closeExpt");
    this.closeReflButton = document.getElementById("closeRefl");
    this.observedIndexedReflsCheckbox = document.getElementById("observedIndexedReflections");
    this.observedUnindexedReflsCheckbox = document.getElementById("observedUnindexedReflections");
    this.calculatedReflsCheckbox = document.getElementById("calculatedReflections");
    this.integratedReflsCheckbox = document.getElementById("integratedReflections");
    this.boundingBoxesCheckbox = document.getElementById("boundingBoxes");
    this.integratedBoundingBoxesCheckbox = document.getElementById("integratedBoundingBoxes");
    this.observedUnindexedReflsRow = document.getElementById("observedUnindexedReflectionsRow");
    this.observedIndexedReflsRow = document.getElementById("observedIndexedReflectionsRow");
    this.calculatedReflsRow = document.getElementById("calculatedReflectionsRow");
    this.integratedReflsRow = document.getElementById("integratedReflectionsRow");
    this.boundingBoxesRow = document.getElementById("boundingBoxesRow");
    this.integratedBoundingBoxesRow = document.getElementById("integratedBoundingBoxesRow");
    this.reflectionSizeContainer = document.getElementById("reflectionSizeContainer");
    this.reflectionSize = document.getElementById("reflectionSizeSlider");
    this.userContrast = document.getElementById("userContrast");
    this.contrastMethod = "exponential";

    // Image number controls (images image to image + stack - 1 are summed)
    this.imageControls = document.getElementById("imageControls");
    this.imageSlider = document.getElementById("imageSlider");
    this.imageNumberInput = document.getElementById("imageNumber");
    this.imageStackInput = document.getElementById("imageStack");
    this.imagePrevButton = document.getElementById("imagePrev");
    this.imageNextButton = document.getElementById("imageNext");
    this.numImagesText = document.getElementById("numImagesText");
    this.numImages = 0;
    this.imageNumber = 1;
    this.imageStack = 1;
    this.imageRequestTimeout = null;
    this.lastImageRequestTime = 0;
    this.setupImageControls();

    // 2D view: one panel face on, with its own camera (see setupScene)
    this.view2D = false;
    this.panel2DIdx = 0;
    this.panel2DFrame = null;
    this.viewToggle = document.getElementById("viewToggle");
    this.view3DButton = document.getElementById("view3DButton");
    this.view2DButton = document.getElementById("view2DButton");
    this.panelControls = document.getElementById("panelControls");
    this.panelPrevButton = document.getElementById("panelPrev");
    this.panelNextButton = document.getElementById("panelNext");
    this.panelName2D = document.getElementById("panelName2D");
    this.setupViewControls();

    // Bookkeeping for meshes
    this.panelOutlineMeshes = {};
    this.panelMeshes = {}; // visible meshes that are involved in raycasting
    this.allPanelMeshes = {}; // visible and invisible meshes
    this.debugPanelMeshes = {};
    this.debugPanelThresholdMeshes = {};
    this.reflPointsObsUnindexed = [];
    this.reflPositionsUnindexed = [];
    this.reflPointsObsIndexed = [];
    this.reflPositionsIndexed = [];
    this.reflPointsIntegrated = [];
    this.reflPositionsIntegrated = [];
    this.reflPointsCal = [];
    this.reflPositionsCal = []
    this.bboxMeshesUnindexed = [];
    this.bboxMeshesIndexed = [];
    this.bboxMeshesIntegrated = [];
    this.beamMeshes = [];
    this.axesMeshes = [];
    this.sampleMesh = null;
    this.highlightReflectionMesh = null;
    this.createReflectionMesh = null;
    this.creatingReflection = false;
    this.drawingReflection = false;
    this.userReflection = null;
    this.visibleExptID = 0;

    this.preventMouseClick = false;
    this.cursorActive = true;
    this.lastClickedPanelPosition = null
    this.loading = false;
    this.isPanning = false;
    this.startMousePosition = { x: 0, y: 0 };
    this.panelFocusAxes = null;

    this.hightlightColor = new THREE.Color(this.colors["highlight"]);
    this.panelColor = new THREE.Color(this.colors["panel"]);
    this.reflSprite = new THREE.TextureLoader().load("disc.png");

    this.displayingTextFromHTMLEvent = false;

    this.updateReflectionCheckboxEnabledStatus();
    this.updateBoundingBoxes(false);
    this.setDefaultReflectionsDisplay();

  }

  sendClickedPanelPosition(panelIdx, panelPos, name) {
    this.lastClickedPanelPosition = {
      "panelIdx": panelIdx,
      "panelPos": panelPos,
      "name": name
    };
    const data = JSON.stringify(
      {
        "channel": "server",
        "type": "lineplot.update",
        "payload": {
          "panel_idx": panelIdx,
          "panel_pos": panelPos,
          "name": name,
          "expt_id": this.visibleExptID
        }
      }
    );
    this.serverWS.send(data);
  }

  static defaultColors() {
    return {
			"background": 0x020817,
      "backgroundLight": 0x222222,
      "sample": 0xfdf6e3,
      "reflectionObsUnindexed": [
        0x96f97b,
        0x75bbfd,
        0xbf77f6,
        0x13eac9,
        0xffb07c,
        0xffd1df,
        0xd0fefe,
        0xffff84,
        0xffffff,
        0xff9408,
        0x01f9c6,
        0xaefd6c,
        0xfe0002,
        0x990f4b,
        0x78d1b6,
        0xfff917,
        0xff0789,
        0xd4ffff,
        0x69d84f,
        0x56ae57
      ],
      "reflectionObsIndexed": 0xe74c3c,
      "reflectionCal": 0xffaaaa,
      "reflectionIntegrated": 0xffc25c,
      "panel": 0x7aa8cc,
      "panelLight": 0x2a5a7a,
      "highlight": 0xb8ddf5,
      "highlightLight": 0x1a3a5c,
      "beam": 0xFFFFFF,
      "bbox": 0xFFFFFF,
      "axes": [0xffaaaa, 0xaaffaa, 0xaaaaff],
      "highlightBbox": 0x96f97b,
      "createNewReflectionBbox": 0xffb07c
    };
  }

  static cameraPositions() {
    return {
      "default": {
        position: new THREE.Vector3(0, 0, 1000), 
        target: new THREE.Vector3(0, 0, 0),  
      },
      "defaultWithExperiment": {
        position: new THREE.Vector3(1000, 0, 0),
        target: new THREE.Vector3(0, 0, 0)},
    };
  }

  static text() {
    return {
      "default": "To view an experiment, drag .expt and .refl files into the browser",
      "defaultWithExpt": null
    }
  }

  static sizes() {
    return {
      "highlightBboxSize": 2,
      "bboxLineWidth" : .3,
    };
  }

  toggleSidebar() {
    this.sidebar.classList.toggle("hidden");
  }

  setupImageControls() {
    if (!this.imageControls) { return; }

    // Keep clicks and keys (e.g. "s") from reaching the scene handlers
    for (const type of ["click", "dblclick", "mousedown", "keydown"]) {
      this.imageControls.addEventListener(type, (event) => event.stopPropagation());
    }

    this.imageSlider.addEventListener("input", () => {
      this.setImageNumber(Number(this.imageSlider.value));
    });
    this.imagePrevButton.addEventListener("click", () => {
      this.setImageNumber(this.imageNumber - 1);
    });
    this.imageNextButton.addEventListener("click", () => {
      this.setImageNumber(this.imageNumber + 1);
    });
    this.imageNumberInput.addEventListener("change", () => {
      this.setImageNumber(Number(this.imageNumberInput.value));
    });
    this.imageStackInput.addEventListener("change", () => {
      this.setImageStack(Number(this.imageStackInput.value));
    });
    for (const input of [this.imageNumberInput, this.imageStackInput]) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { input.blur(); }
      });
    }
  }

  clampImageValue(value, fallback) {
    if (!Number.isFinite(value)) { return fallback; }
    return Math.min(Math.max(Math.round(value), 1), Math.max(this.numImages, 1));
  }

  setImageRange(numImages, image, stack) {
    // Shows the range the server sent, without requesting it again
    if (!this.imageControls) { return; }
    this.numImages = numImages;
    this.imageNumber = this.clampImageValue(image, 1);
    this.imageStack = this.clampImageValue(stack, 1);
    this.imageSlider.max = numImages;
    this.imageNumberInput.max = numImages;
    this.imageStackInput.max = numImages;
    this.numImagesText.textContent = "/ " + numImages;
    this.imageControls.style.display = numImages > 0 ? "" : "none";
    this.updateImageControls();
  }

  setImageNumber(value) {
    const image = this.clampImageValue(value, this.imageNumber);
    const changed = image !== this.imageNumber;
    this.imageNumber = image;
    this.updateImageControls();
    if (changed) { this.requestImage(); }
  }

  setImageStack(value) {
    const stack = this.clampImageValue(value, this.imageStack);
    const changed = stack !== this.imageStack;
    this.imageStack = stack;
    this.updateImageControls();
    if (changed) { this.requestImage(); }
  }

  updateImageControls() {
    this.imageSlider.value = this.imageNumber;
    this.imageNumberInput.value = this.imageNumber;
    this.imageStackInput.value = this.imageStack;
    this.imagePrevButton.disabled = this.imageNumber <= 1;
    this.imageNextButton.disabled = this.imageNumber >= this.numImages;
  }

  hideImageControls() {
    if (!this.imageControls) { return; }
    clearTimeout(this.imageRequestTimeout);
    this.numImages = 0;
    this.imageControls.style.display = "none";
  }

  requestImage() {
    // Throttled while dragging; the last value is always sent
    const interval = 50;
    clearTimeout(this.imageRequestTimeout);
    const wait = this.lastImageRequestTime + interval - Date.now();
    this.imageRequestTimeout = setTimeout(() => {
      this.lastImageRequestTime = Date.now();
      if (!this.serverWS || this.serverWS.readyState !== WebSocket.OPEN) { return; }
      this.serverWS.send(JSON.stringify({
        "channel": "server",
        "type": "viewer.show_image",
        "payload": {
          "image": this.imageNumber,
          "stack": this.imageStack
        }
      }));
    }, Math.max(wait, 0));
  }

  setupViewControls() {
    if (!this.viewToggle) { return; }
    for (const el of [this.viewToggle, this.panelControls]) {
      for (const type of ["click", "dblclick", "mousedown"]) {
        el.addEventListener(type, (event) => event.stopPropagation());
      }
    }
    this.view3DButton.addEventListener("click", () => this.setView2D(false));
    this.view2DButton.addEventListener("click", () => this.setView2D(true));
    this.panelPrevButton.addEventListener("click", () => this.show2DPanel(this.panel2DIdx - 1));
    this.panelNextButton.addEventListener("click", () => this.show2DPanel(this.panel2DIdx + 1));
  }

  numPanels() {
    return this.hasExperiment() ? this.expt.getNumDetectorPanels(this.visibleExptID) : 0;
  }

  setView2D(view2D) {
    if (!this.viewToggle || !window.camera2D) { return; }
    if (view2D && this.numPanels() === 0) { return; }
    this.view2D = view2D;
    window.camera = view2D ? window.camera2D : window.camera3D;
    window.controls = view2D ? window.controls2D : window.controls3D;
    window.controls3D.enabled = !view2D;
    window.controls2D.enabled = view2D;

    for (const mesh of this.beamMeshes) { mesh.visible = !view2D; }
    // Panel images are drawn 1% further out (getPanelPlaneVertices); in 2D the
    // outline is moved out to just in front of the image so it traces its edge
    for (const name in this.panelOutlineMeshes) {
      this.panelOutlineMeshes[name].visible = true;
      this.panelOutlineMeshes[name].scale.setScalar(view2D ? 1.0099 : 1);
    }
    this.view3DButton.classList.toggle("active", !view2D);
    this.view2DButton.classList.toggle("active", view2D);
    this.view3DButton.setAttribute("aria-pressed", String(!view2D));
    this.view2DButton.setAttribute("aria-pressed", String(view2D));
    this.panelControls.style.display = view2D ? "" : "none";
    this.updateLineWidths();

    if (view2D) {
      if (this.lastClickedPanelPosition !== null) {
        this.panel2DIdx = this.lastClickedPanelPosition["panelIdx"];
      }
      this.show2DPanel(this.panel2DIdx);
    }
    else {
      this.panel2DFrame = null;
      this.updatePanelMeshes();
    }
  }

  show2DPanel(panelIdx) {
    // Shows the whole of panelIdx, face on
    const numPanels = this.numPanels();
    if (!this.view2D || numPanels === 0) { return; }
    panelIdx = Math.min(Math.max(panelIdx, 0), numPanels - 1);
    this.panel2DIdx = panelIdx;

    const v = this.getPanelPlaneVertices(this.visibleExptID, panelIdx);
    const center = v[0].clone().add(v[1]).add(v[2]).add(v[3]).divideScalar(4);
    const data = this.expt.getDetectorPanelDataByIdx(this.visibleExptID, panelIdx);
    const right = data["fastAxis"].clone().normalize();
    const up = data["slowAxis"].clone().normalize().negate();
    const toSample = center.clone().negate().normalize();
    if (new THREE.Vector3().crossVectors(right, up).dot(toSample) < 0) {
      up.negate();
    }
    const normal = new THREE.Vector3().crossVectors(right, up).normalize();
    const extent = (axis) => {
      const d = v.map(p => p.dot(axis));
      return Math.max(...d) - Math.min(...d);
    };
    const width = extent(right);
    const height = extent(up);

    // Near and far only reach the panel plane, so other panels are not drawn
    const distance = 0.05 * center.length() + 5;
    this.panel2DFrame = { center, right, up, normal, width, height, distance };

    const camera = window.camera2D;
    camera.near = 0.1;
    camera.far = 2 * distance;
    camera.up.copy(up);
    camera.position.copy(center).addScaledVector(normal, distance);
    camera.lookAt(center);
    camera.zoom = 1;
    window.controls2D.target.copy(center);
    this.update2DFrustum();
    window.controls2D.update();

    this.panelName2D.textContent = this.expt.getDetectorPanelName(this.visibleExptID, panelIdx)
      + " (" + (panelIdx + 1) + "/" + numPanels + ")";
    this.panelName2D.title = this.panelName2D.textContent;
    this.panelPrevButton.disabled = panelIdx <= 0;
    this.panelNextButton.disabled = panelIdx >= numPanels - 1;
    this.updatePanelMeshes();
  }

  update2DFrustum() {
    // Zoom 1 fits the whole panel and its outline in the window
    const frame = this.panel2DFrame;
    if (!frame || !window.camera2D) { return; }
    const aspect = window.innerWidth / window.innerHeight;
    const margin = 1.03;
    const halfHeight = margin * Math.max(frame.height / 2, frame.width / (2 * aspect));
    const camera = window.camera2D;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    this.clamp2DView();
  }

  clamp2DView() {
    // Keeps the view inside the panel edges (and its outline)
    const frame = this.panel2DFrame;
    if (!frame) { return; }
    const camera = window.camera2D;
    const target = window.controls2D.target;
    const visibleHalfWidth = camera.right / camera.zoom;
    const visibleHalfHeight = camera.top / camera.zoom;
    const outlinePixels = 6;
    const margin = outlinePixels * 2 * visibleHalfHeight / window.innerHeight;
    const limitX = Math.max(frame.width / 2 + margin - visibleHalfWidth, 0);
    const limitY = Math.max(frame.height / 2 + margin - visibleHalfHeight, 0);
    const offset = new THREE.Vector3().subVectors(target, frame.center);
    const x = Math.min(Math.max(offset.dot(frame.right), -limitX), limitX);
    const y = Math.min(Math.max(offset.dot(frame.up), -limitY), limitY);
    target.copy(frame.center).addScaledVector(frame.right, x).addScaledVector(frame.up, y);
    camera.position.copy(target).addScaledVector(frame.normal, frame.distance);
  }

  focus2DOnPoint(panelIdx, point) {
    // Shows panelIdx zoomed in on point
    if (panelIdx !== this.panel2DIdx || !this.panel2DFrame) {
      this.show2DPanel(panelIdx);
    }
    window.camera2D.zoom = Math.max(window.camera2D.zoom, 4);
    window.camera2D.updateProjectionMatrix();
    window.controls2D.target.copy(point);
    this.clamp2DView();
    this.requestRender();
  }

  meshLineWidth(width3D, pixels2D) {
    // MeshLine widths are in clip space, which is not scaled by depth in 2D,
    // so there the width is set in pixels
    if (!this.view2D) { return width3D; }
    return 2 * pixels2D * (window.innerWidth / window.innerHeight) / window.innerHeight;
  }

  highlightLineWidth() {
    return this.meshLineWidth(3, 3);
  }

  updateLineWidths() {
    if (this.highlightReflectionMesh) {
      this.highlightReflectionMesh.material.lineWidth = this.highlightLineWidth();
    }
    for (const name in this.panelOutlineMeshes) {
      this.panelOutlineMeshes[name].material.lineWidth = this.meshLineWidth(6, 3);
    }
  }

  applyPanel2DVisibility() {
    // Only the 2D panel and its outline are shown, and only it can be clicked
    const meshes = this.panelMeshes;
    for (const key of Object.keys(meshes)) {
      meshes[key].visible = Number(key) === this.panel2DIdx;
    }
    const panelName = this.expt.getDetectorPanelName(this.visibleExptID, this.panel2DIdx);
    for (const name in this.panelOutlineMeshes) {
      this.panelOutlineMeshes[name].visible = name === panelName;
    }
    this.panelMeshes = this.panel2DIdx in meshes ? { [this.panel2DIdx]: meshes[this.panel2DIdx] } : {};
  }

  updateTheme(theme){
    const isLight = theme === "light";
    this.lightTheme = isLight;
    const color = isLight ? this.colors["backgroundLight"] : this.colors["background"];
    window.renderer.setClearColor(color);
    if (window.scene.fog) {
      window.scene.fog.color.setHex(color);
    }
    this.panelColor = new THREE.Color(
      isLight ? this.colors["panelLight"] : this.colors["panel"]
    );
    this.hightlightColor = new THREE.Color(
      isLight ? this.colors["highlightLight"] : this.colors["highlight"]
    );
    this.resetPanelColors();
    this.updatePanelTextures();
    this.requestRender();
  }

  updatePanelMeshes() {
    this.panelMeshes = {};

    if (!this.debugImageMode && !this.debugThresholdMode){
      for (const i of Object.keys(this.allPanelMeshes)) {
        const exptID = parseInt(i);
        for (const j of Object.keys(this.allPanelMeshes[i])) {
          this.allPanelMeshes[i][j].visible = (exptID === this.visibleExptID);
        }
        if (exptID === this.visibleExptID) {
          this.panelMeshes = this.allPanelMeshes[i];
        }
      }
      for (const i of Object.keys(this.debugPanelMeshes)) {
        this.debugPanelMeshes[i].visible = false;
      }
      for (const i of Object.keys(this.debugPanelThresholdMeshes)) {
        this.debugPanelThresholdMeshes[i].visible = false;
      }
    }
    else{
      for (const i of Object.keys(this.allPanelMeshes)) {
        for (const j of Object.keys(this.allPanelMeshes[i])) {
          this.allPanelMeshes[i][j].visible = false;
        }
      }
      if (this.debugImageMode){
        for (const i of Object.keys(this.debugPanelMeshes)) {
          this.debugPanelMeshes[i].visible = true;
        }
        for (const i of Object.keys(this.debugPanelThresholdMeshes)) {
          this.debugPanelThresholdMeshes[i].visible = false;
        }
        this.panelMeshes = this.debugPanelMeshes;
      }
      else if (this.debugThresholdMode){
        for (const i of Object.keys(this.debugPanelThresholdMeshes)) {
          this.debugPanelThresholdMeshes[i].visible = true;
        }
        for (const i of Object.keys(this.debugPanelMeshes)) {
          this.debugPanelMeshes[i].visible = false;
        }
        this.panelMeshes = this.debugPanelThresholdMeshes;
      }

    }

    if (this.view2D) {
      this.applyPanel2DVisibility();
    }

    this.requestRender();
  }

  updateObservedIndexedReflections(val = null) {
    if (val !== null) {
      this.observedIndexedReflsCheckbox.checked = val;
    }
    for (var i = 0; i < this.reflPointsObsIndexed.length; i++) {
      this.reflPointsObsIndexed[i][0].visible = this.observedIndexedReflsCheckbox.checked && this.visibleExptID === i;
    }
    this.updateBoundingBoxes();
    this.requestRender();
  }

  updateObservedUnindexedReflections(val = null) {
    if (val !== null) {
      this.observedUnindexedReflsCheckbox.checked = val;
    }
    for (var i = 0; i < this.reflPointsObsUnindexed.length; i++) {
      this.reflPointsObsUnindexed[i][0].visible = this.observedUnindexedReflsCheckbox.checked && this.visibleExptID === i;
    }
    this.updateBoundingBoxes();
    this.requestRender();
  }


  updateCalculatedReflections(val = null) {
    if (val !== null) {
      this.calculatedReflsCheckbox.checked = val;
    }
    for (var i = 0; i < this.reflPointsCal.length; i++) {
      this.reflPointsCal[i][0].visible = this.calculatedReflsCheckbox.checked && this.visibleExptID === i;
    }
    this.updateBoundingBoxes();
    this.requestRender();
  }

  updateIntegratedReflections(val = null) {
    if (val !== null) {
      this.integratedReflsCheckbox.checked = val;
    }
    for (var i = 0; i < this.reflPointsIntegrated.length; i++) {
      this.reflPointsIntegrated[i][0].visible = this.integratedReflsCheckbox.checked && this.visibleExptID === i;
    }
    this.updateBoundingBoxes();
    this.updateIntegratedBoundingBoxes();
    this.requestRender();
  }

  updateIntegratedBoundingBoxes(val = null) {
    if (val !== null) {
      this.integratedBoundingBoxesCheckbox.checked = val;
    }
    const visible = this.integratedBoundingBoxesCheckbox.checked;
    for (var i = 0; i < this.bboxMeshesIntegrated.length; i++) {
      for (var j in this.bboxMeshesIntegrated[i]) {
        this.bboxMeshesIntegrated[i][j].visible = visible && this.visibleExptID === i;
      }
    }
    this.requestRender();
  }

  updateBoundingBoxes(val = null) {
    if (val !== null) {
      this.boundingBoxesCheckbox.checked = val;
    }
    const visible = this.boundingBoxesCheckbox.checked;
    for (var i = 0; i < this.bboxMeshesIndexed.length; i++) {
      for (var j in this.bboxMeshesIndexed[i]) {
        this.bboxMeshesIndexed[i][j].visible = visible && this.visibleExptID === i;
      }
    }
    for (var i = 0; i < this.bboxMeshesUnindexed.length; i++) {
      for (var j in this.bboxMeshesUnindexed[i]) {
        this.bboxMeshesUnindexed[i][j].visible = visible && this.visibleExptID === i;
      }
    }
    this.requestRender();
  }

  updateAxes(val = null) {
    if (val === null) {
      return;
    }
    for (var i = 0; i < this.axesMeshes.length; i++) {
      this.axesMeshes[i].visible = val;
    }
    this.requestRender();
  }

  updateReflectionSize() {
    if (!this.hasReflectionTable()) {
      return;
    }
      if (this.reflPointsObsUnindexed) {
        const reflPointsUnindexed = [];
        for (var i = 0; i < this.reflPositionsUnindexed.length; i++) {
          const reflGeometryObs = new THREE.BufferGeometry();
          reflGeometryObs.setAttribute(
            "position", new THREE.Float32BufferAttribute(this.reflPositionsUnindexed[i], 3)
          );

          const reflMaterialObs = new THREE.PointsMaterial({
            size: this.reflectionSize.value,
            transparent: true,
            map: this.reflSprite,
            color: this.colors["reflectionObsUnindexed"][i % this.colors["reflectionObsUnindexed"].length],
          });
          const pointsObs = new THREE.Points(reflGeometryObs, reflMaterialObs);
          reflPointsUnindexed.push([pointsObs]);
        }
        this.clearReflPointsObsUnindexed();
        for (var p = 0; p < reflPointsUnindexed.length; p++) {
          window.scene.add(reflPointsUnindexed[p][0]);
        }
        this.reflPointsObsUnindexed = reflPointsUnindexed;
        this.updateObservedUnindexedReflections();
      }
      if (this.reflPointsObsIndexed) {
        const reflPointsObsIndexed = [];

        for (var i = 0; i < this.reflPositionsIndexed.length; i++) {
          const reflGeometryObs = new THREE.BufferGeometry();
          reflGeometryObs.setAttribute(
            "position", new THREE.Float32BufferAttribute(this.reflPositionsIndexed[i], 3)
          );

          const reflMaterialObs = new THREE.PointsMaterial({
            size: this.reflectionSize.value,
            transparent: true,
            map: this.reflSprite,
            color: this.colors["reflectionObsIndexed"]
          });
          const pointsObs = new THREE.Points(reflGeometryObs, reflMaterialObs);
          reflPointsObsIndexed.push([pointsObs]);
        }

        this.clearReflPointsObsIndexed();
        for (var p = 0; p < reflPointsObsIndexed.length; p++) {
          window.scene.add(reflPointsObsIndexed[p][0]);
        }
        this.reflPointsObsIndexed = reflPointsObsIndexed;
        this.updateObservedIndexedReflections();
      }

    if (this.reflPositionsCal) {
      const reflPointsCal = [];
      for (let i = 0; i < this.reflPositionsCal.length; i++){
        const reflGeometryCal = new THREE.BufferGeometry();
        reflGeometryCal.setAttribute(
          "position", new THREE.Float32BufferAttribute(this.reflPositionsCal[i], 3)
        );

        const reflMaterialCal = new THREE.PointsMaterial({
          size: this.reflectionSize.value,
          transparent: true,
          map: this.reflSprite,
          color: this.colors["reflectionCal"]
        });
        const pointsCal = new THREE.Points(reflGeometryCal, reflMaterialCal);
        reflPointsCal.push([pointsCal]);
      }
      this.clearReflPointsCal();
      for (let p = 0; p < reflPointsCal.length; p++){
        window.scene.add(reflPointsCal[p][0]);
      }
      this.reflPointsCal = reflPointsCal;
      this.updateCalculatedReflections();

      if (this.reflPointsIntegrated) {
        const reflPointsIntegrated = [];
        for (let i = 0; i < this.reflPositionsIntegrated.length; i++){
          const reflGeometryIntegrated = new THREE.BufferGeometry();
          reflGeometryIntegrated.setAttribute(
            "position", new THREE.Float32BufferAttribute(this.reflPositionsIntegrated[i], 3)
          );

          const reflMaterialIntegrated = new THREE.PointsMaterial({
            size: this.reflectionSize.value,
            transparent: true,
            map: this.reflSprite,
            color: this.colors["reflectionIntegrated"]
          });
          const pointsIntegrated = new THREE.Points(reflGeometryIntegrated, reflMaterialIntegrated);
          reflPointsIntegrated.push([pointsIntegrated]);
        }

        this.clearReflPointsIntegrated();
        for (let p = 0; p < reflPointsIntegrated.length; p++) {
          window.scene.add(reflPointsIntegrated[p][0]);
        }
        this.reflPointsIntegrated = reflPointsIntegrated;
        this.updateIntegratedReflections();
      }
    }
    this.requestRender();

  }

  hasExperiment() {
    return (this.expt.hasExptJSON());
  }

  clearExperiment() {

    for (const i in this.panelOutlineMeshes) {
      window.scene.remove(this.panelOutlineMeshes[i]);
      this.panelOutlineMeshes[i].geometry.dispose();
      this.panelOutlineMeshes[i].material.dispose();
    }
    this.panelOutlineMeshes = {};

    this.clearDebugPanelMeshes();

    for (const i in this.panelMeshes) {
      window.scene.remove(this.panelMeshes[i]);
      this.panelMeshes[i].geometry.dispose();
      this.panelMeshes[i].material.dispose();
    }
    
    for (const exptID in this.allPanelMeshes){
      for (const panelIdx in this.allPanelMeshes[exptID]){
        this.clearDetectorMesh(panelIdx, exptID);
      }
    }

    this.allPanelMeshes = {};
    this.panelMeshes = {};

    for (var i = 0; i < this.beamMeshes.length; i++) {
      window.scene.remove(this.beamMeshes[i]);
      this.beamMeshes[i].geometry.dispose();
      this.beamMeshes[i].material.dispose();
    }
    this.beamMeshes = [];
    if (this.sampleMesh) {
      window.scene.remove(this.sampleMesh);
      this.sampleMesh.geometry.dispose();
      this.sampleMesh.material.dispose();
      this.sampleMesh = null;
    }

    if (this.highlightReflectionMesh) {
      window.scene.remove(this.highlightReflectionMesh);
      this.highlightReflectionMesh.geometry.dispose();
      this.highlightReflectionMesh.material.dispose();
      this.highlightReflectionMesh = null;
    }

    this.setView2D(false);
    if (this.viewToggle) { this.viewToggle.style.display = "none"; }
    this.expt.clearExperiment();
    this.hideCloseExptButton();
    this.hideImageControls();

    this.clearReflectionTable();
    this.clearExperimentList();
    this.requestRender();
    this.updateReflectionCheckboxEnabledStatus();
    this.updateBoundingBoxes(false);
    this.setDefaultReflectionsDisplay();

  }

  addExperiment = async (file) => {
    this.clearExperiment();
    this.clearReflectionTable();
    await this.expt.parseExperiment(file);
    console.assert(this.hasExperiment());
    for (var i = 0; i < this.expt.getNumDetectorPanels(); i++) {
      for (var j = 0; j < this.expt.numExperiments(); j++) {
        this.addDetectorPanel(i, j, imageData !== null);
      }
    }
    this.addBeam();
    this.addSample();
    this.setCameraToDefaultPositionWithExperiment();
    if (this.isStandalone) {
      this.showCloseExptButton();
    }
    this.requestRender();
    this.updateExperimentList();
    this.updatePanelMeshes();
  }

  addExperimentFromJSONString = async (jsonString) => {
    this.clearExperiment();
    this.clearReflectionTable();
    await this.expt.parseExperimentJSON(jsonString);
    console.assert(this.hasExperiment());

    this.allPanelMeshes = {};

    for (var panelIdx = 0; panelIdx < this.expt.getNumDetectorPanels(0); panelIdx++) {
      for (var exptID = 0; exptID < this.expt.numExperiments(); exptID++) {
        this.addDetectorPanel(panelIdx, exptID, false);
      }
    }
    this.addBeam();
    this.addSample();
    this.setCameraToDefaultPositionWithExperiment();
    if (this.isStandalone) {
      this.showCloseExptButton();
    }
    this.requestRender();
    this.loading = false;
    this.displayDefaultHeaderText();
    this.updateExperimentList();
    this.updatePanelMeshes();
    if (this.viewToggle) { this.viewToggle.style.display = ""; }
  }


  showCloseExptButton() {
    this.closeExptButton.style.display = "inline";
    this.closeExptButton.innerHTML = "<b>" + this.expt.filename + ' <i class="fa fa-trash"></i>';
  }

  hideCloseExptButton() {
    this.closeExptButton.style.display = "none";
  }

  hasReflectionTable() {
    return (this.refl.hasReflTable());
  }

  clearReflPointsObsIndexed() {
    for (var i = 0; i < this.reflPointsObsIndexed.length; i++) {
      window.scene.remove(this.reflPointsObsIndexed[i][0]);
      this.reflPointsObsIndexed[i][0].geometry.dispose();
      this.reflPointsObsIndexed[i][0].material.dispose();
    }
    this.reflPointsObsIndexed = [];
  }

  clearReflPointsObsUnindexed() {
    for (var i = 0; i < this.reflPointsObsUnindexed.length; i++) {
      window.scene.remove(this.reflPointsObsUnindexed[i][0]);
      this.reflPointsObsUnindexed[i][0].geometry.dispose();
      this.reflPointsObsUnindexed[i][0].material.dispose();
    }
    this.reflPointsObsUnindexed = [];
  }

  clearReflPointsCal() {
    for (var i = 0; i < this.reflPointsCal.length; i++) {
      window.scene.remove(this.reflPointsCal[i][0]);
      this.reflPointsCal[i][0].geometry.dispose();
      this.reflPointsCal[i][0].material.dispose();
    }
    this.reflPointsCal = [];
  }

  clearReflPointsIntegrated() {
    for (var i = 0; i < this.reflPointsIntegrated.length; i++) {
      window.scene.remove(this.reflPointsIntegrated[i][0]);
      this.reflPointsIntegrated[i][0].geometry.dispose();
      this.reflPointsIntegrated[i][0].material.dispose();
    }
    this.reflPointsIntegrated = [];
  }

  clearBoundingBoxes() {
    for (var i = 0; i < this.bboxMeshesUnindexed.length; i++) {
      for (var j in this.bboxMeshesUnindexed[i]) {
        if (this.bboxMeshesUnindexed[i][j].length === 0){continue;}
        window.scene.remove(this.bboxMeshesUnindexed[i][j]);
        this.bboxMeshesUnindexed[i][j].geometry.dispose();
        this.bboxMeshesUnindexed[i][j].material.dispose();
      }
    }
    this.bboxMeshesUnindexed = [];

    for (var i = 0; i < this.bboxMeshesIndexed.length; i++) {
      for (var j in this.bboxMeshesIndexed[i]) {
        if (this.bboxMeshesIndexed[i][j].length === 0){continue;}
        window.scene.remove(this.bboxMeshesIndexed[i][j]);
        this.bboxMeshesIndexed[i][j].geometry.dispose();
        this.bboxMeshesIndexed[i][j].material.dispose();
      }
    }
    this.bboxMeshesIndexed = [];

  }

  clearBboxMeshesIntegrated() {
    for (var i = 0; i < this.bboxMeshesIntegrated.length; i++) {
      for (var j in this.bboxMeshesIntegrated[i]) {
        if (this.bboxMeshesIntegrated[i][j].length === 0){continue;}
        window.scene.remove(this.bboxMeshesIntegrated[i][j]);
        this.bboxMeshesIntegrated[i][j].geometry.dispose();
        this.bboxMeshesIntegrated[i][j].material.dispose();
      }
    }
    this.bboxMeshesIntegrated = [];
  }

  clearReflectionTable() {
    this.clearReflPointsObsIndexed();
    this.clearReflPointsObsUnindexed();
    this.clearReflPointsCal();
    this.clearReflPointsIntegrated();
    this.clearBoundingBoxes();
    this.clearBboxMeshesIntegrated();
    this.refl.clearReflectionTable();
    this.calculatedIntegratedRefl.clearReflectionTable();
    this.updateReflectionCheckboxEnabledStatus();
    this.setDefaultReflectionsDisplay();
    this.hideCloseReflButton();
    this.requestRender();
  }

  clearCalculatedIntegratedReflectionTable(){
    this.clearReflPointsIntegrated();
    this.clearBboxMeshesIntegrated();
    this.calculatedIntegratedRefl.clearReflectionTable();
    this.requestRender();
  }

  clearDebugPanelMeshes(){

    for (const i in this.debugPanelMeshes) {
      window.scene.remove(this.debugPanelMeshes[i]);
      this.debugPanelMeshes[i].geometry.dispose();
      this.debugPanelMeshes[i].material.dispose();
    }
    for (const i in this.debugPanelThresholdMeshes) {
      window.scene.remove(this.debugPanelThresholdMeshes[i]);
      this.debugPanelThresholdMeshes[i].geometry.dispose();
      this.debugPanelThresholdMeshes[i].material.dispose();
    }
    this.debugPanelMeshes = {};
    this.debugPanelThresholdMeshes = {};
  }

  showCloseReflButton() {
    this.closeReflButton.style.display = "inline";
    this.closeReflButton.innerHTML = "<b>" + this.refl.filename + ' <i class="fa fa-trash"></i>';

  }

  hideCloseReflButton() {
    this.closeReflButton.style.display = "none";
  }

  addReflectionTable = async (file) => {
    this.clearReflectionTable();
    await this.refl.parseReflectionTable(file);
    this.addReflections();
    if (this.hasReflectionTable() && this.isStandalone) {
      this.showCloseReflButton();
    }
    this.requestRender();
  }


  getBboxTexture(bboxes, panelSize, lineWidth = 2, color = null) {

    const canvas = document.createElement('canvas');
    const scale = 20; //
    canvas.width = panelSize.x * scale;
    canvas.height = panelSize.y * scale;
    const context = canvas.getContext('2d');
    context.scale(scale, scale);

    context.clearRect(0, 0, canvas.width, canvas.height);

    const hexColor = (color !== null ? color : this.colors["bbox"]).toString(16).padStart(6, '0');
    context.strokeStyle = '#' + hexColor;
    context.lineWidth = lineWidth;
  
    for (const bbox of bboxes) {
      const height = bbox[1] - bbox[0];
      const width = bbox[3] - bbox[2];
      const y = panelSize.y - bbox[0] - height; 
      const x = bbox[2];
      context.strokeRect(x, y, width, height);
    }
  
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    texture.transparent = true;
    texture.minFilter = THREE.LinearFilter;  
    texture.magFilter = THREE.LinearFilter;  
    texture.generateMipmaps = false;
    document.body.appendChild(canvas);
  
    return texture;
  }

  getPanelPlaneVertices(exptID, panelIdx) {
    /*
     * Panel corners in PlaneGeometry vertex order (top left, top right,
     * bottom left, bottom right of the image), facing the sample
     */
    var corners = this.expt.getDetectorPanelCorners(exptID, panelIdx);

    var idxs = [1, 2, 0, 3]

    // Rotate if not facing the origin
    var normalVec = this.expt.getDetectorPanelNormal(exptID, panelIdx);
    var posVec = corners[0].clone();
    posVec.add(corners[1].clone());
    posVec.add(corners[2].clone());
    posVec.add(corners[3].clone());
    posVec.divideScalar(4).normalize();
    if (posVec.dot(normalVec) < 0) {
      idxs = [0, 3, 1, 2];
    }

    const scaleFactor = 1.01 // ensure reflections appear in front of image
    return idxs.map(i => new THREE.Vector3(
      corners[i].x * scaleFactor,
      corners[i].y * scaleFactor,
      corners[i].z * scaleFactor
    ));
  }

  getBboxMesh(bboxes, exptID, panelIdx, lineWidth = 2, color = null){
      const panelSize = this.expt.experiments[exptID].detectorPanelData[panelIdx]["pxs"];
      const panelGeometry = new THREE.PlaneGeometry(panelSize[0], panelSize[1]);
      var panelMaterial;
      const panelTexture = this.getBboxTexture(bboxes, panelSize, lineWidth, color);
      panelMaterial = new THREE.MeshBasicMaterial({
        map: panelTexture,
        transparent: true
      })

      const plane = new THREE.Mesh(panelGeometry, panelMaterial);
      var panelName = this.expt.getDetectorPanelName(exptID, panelIdx);
      plane.name = panelName;

    const vertices = this.getPanelPlaneVertices(exptID, panelIdx);
    for (var i = 0; i < 4; i++) {
      plane.geometry.attributes.position.array[3 * i] = vertices[i].x;
      plane.geometry.attributes.position.array[3 * i + 1] = vertices[i].y;
      plane.geometry.attributes.position.array[3 * i + 2] = vertices[i].z;
    }
    plane.userData.corners = [
      new THREE.Vector3(
        plane.geometry.attributes.position.array[0],
        plane.geometry.attributes.position.array[1],
        plane.geometry.attributes.position.array[2],
      ),
      new THREE.Vector3(
        plane.geometry.attributes.position.array[3],
        plane.geometry.attributes.position.array[4],
        plane.geometry.attributes.position.array[5],
      ),
      new THREE.Vector3(
        plane.geometry.attributes.position.array[6],
        plane.geometry.attributes.position.array[7],
        plane.geometry.attributes.position.array[8],
      ),
      new THREE.Vector3(
        plane.geometry.attributes.position.array[9],
        plane.geometry.attributes.position.array[10],
        plane.geometry.attributes.position.array[11],
      ),
    ]

    return plane;

  }

  async addReflectionsFromJSONMsgpack(reflMsgpack){
    if (!this.hasExperiment()) {
      console.warn("Tried to add reflections but no experiment has been loaded");
      this.clearReflectionTable();
      return;
    }

    this.clearReflectionTable();
    // Table may be msgpack or HDF5 (HDF5 parsing is async)
    await this.refl.parseReflectionTableFromJSONMsgpack(reflMsgpack);

    // Get relevant data
    const panelNumbers = this.refl.getPanelNumbers();
    // Assume all reflection tables contain panel info
    if (panelNumbers === null){
      console.warn("Tried to add reflections but no data was parsed in refl file");
    }
    const xyzObs = this.refl.getXYZObs();
    const xyzCal = this.refl.getXYZCal();
    const bboxes = this.refl.getBoundingBoxes();
    const millerIndices = this.refl.getMillerIndices();
    const exptIDs = this.refl.getImagesetIDs();
    const flags = this.refl.getFlags();

    // Setup variables for holding graphical data
    const indexedMap = {};
    var numIndexed = 0;

    const bboxMaterial = new THREE.LineBasicMaterial({ color: this.colors["bbox"] });

    const pointsObsUnindexed = [];
    const positionsObsUnindexed = [];
    const positionsObsIndexed = [];
    const pointsObsIndexed = [];
    const pointsCal = [];
    const positionsCal = [];
    const pointsIntegrated = [];
    const positionsIntegrated = [];
    const bboxesUnindexed = [];
    const bboxesIndexed = [];
    const bboxesIntegrated = [];


    for (let i = 0; i < this.expt.numExperiments(); i++) {
      pointsObsUnindexed.push([]);
      positionsObsUnindexed.push([]);
      positionsObsIndexed.push([]);
      pointsObsIndexed.push([]);
      pointsCal.push([]);
      positionsCal.push([]);
      pointsIntegrated.push([]);
      positionsIntegrated.push([]);
      bboxesIndexed.push({});
      bboxesUnindexed.push({});
      bboxesIntegrated.push({});
    }

    const uniquePanelIdxs = new Set(panelNumbers);
    let panelData = {};
    for (const panelIdx of uniquePanelIdxs){
      panelData[panelIdx] = this.expt.getDetectorPanelDataByIdx(0, panelIdx);
      for (let i = 0; i < this.expt.numExperiments(); i++) {
        bboxesIndexed[i][panelIdx] = [];
        bboxesUnindexed[i][panelIdx] = [];
        bboxesIntegrated[i][panelIdx] = [];
      }
    }


    // Get positions of all reflections
    for (let reflIdx = 0; reflIdx < panelNumbers.length; reflIdx++){

      const reflPanel = panelNumbers[reflIdx];

      // exptID
      let exptID;
      if (exptIDs !== null){
        exptID = exptIDs[reflIdx];
      }
      else{
        exptID = 0;
      }

      // xyzObs
      if (xyzObs !== null){

        const reflXyzObs = xyzObs[reflIdx];
        const globalPosObs = this.mapPointToGlobal(
          reflXyzObs, 
          panelData[reflPanel]["origin"], 
          panelData[reflPanel]["scaledFastAxis"], 
          panelData[reflPanel]["scaledSlowAxis"], 
          panelData[reflPanel]["pxSize"])

        // Miller idx
        if (millerIndices !== null && this.refl.isValidMillerIndex(millerIndices[reflIdx])){

            positionsObsIndexed[exptID].push(globalPosObs.x);
            positionsObsIndexed[exptID].push(globalPosObs.y);
            positionsObsIndexed[exptID].push(globalPosObs.z);
            indexedMap[numIndexed] = millerIndices[reflIdx];
            bboxesIndexed[exptID][reflPanel].push(bboxes[reflIdx]); 
            numIndexed++;

        }

        else {
          positionsObsUnindexed[exptID].push(globalPosObs.x);
          positionsObsUnindexed[exptID].push(globalPosObs.y);
          positionsObsUnindexed[exptID].push(globalPosObs.z);
          bboxesUnindexed[exptID][reflPanel].push(bboxes[reflIdx]); 
        }
      } // xyzObs

      // xyzCal
      if (xyzCal !== null) {

        const reflXyzCal = xyzCal[reflIdx];
        const globalPosCal = this.mapPointToGlobal(
          reflXyzCal, 
          panelData[reflPanel]["origin"], 
          panelData[reflPanel]["scaledFastAxis"], 
          panelData[reflPanel]["scaledSlowAxis"], 
          panelData[reflPanel]["pxSize"]);

        positionsCal[exptID].push(globalPosCal.x);
        positionsCal[exptID].push(globalPosCal.y);
        positionsCal[exptID].push(globalPosCal.z);

        if (this.refl.isSummationIntegrated(flags[reflIdx])) {
          positionsIntegrated[exptID].push(globalPosCal.x);
          positionsIntegrated[exptID].push(globalPosCal.y);
          positionsIntegrated[exptID].push(globalPosCal.z);
          bboxesIntegrated[exptID][reflPanel].push(bboxes[reflIdx]);
        }
      } // xyzCal

    } // Get positions of all reflections

    // Create mesh objects based on reflection positions

    if (xyzObs !== null) {
      if (millerIndices !== null) {

        for (var exptID = 0; exptID < positionsObsIndexed.length; exptID++) {
          const reflGeometryObsIndexed = new THREE.BufferGeometry();
          reflGeometryObsIndexed.setAttribute(
            "position", new THREE.Float32BufferAttribute(positionsObsIndexed[exptID], 3)
          );

          const reflMaterialObsIndexed = new THREE.PointsMaterial({
            size: this.reflectionSize.value,
            transparent: true,
            map: this.reflSprite,
            color: this.colors["reflectionObsIndexed"]
          });
          const points = new THREE.Points(reflGeometryObsIndexed, reflMaterialObsIndexed);
          window.scene.add(points);
          pointsObsIndexed[exptID].push(points);
        }
        this.reflPointsObsIndexed = pointsObsIndexed;
        this.reflPositionsIndexed = positionsObsIndexed;

      }
      for (var exptID = 0; exptID < positionsObsUnindexed.length; exptID++) {
        const reflGeometryObsUnindexed = new THREE.BufferGeometry();
        reflGeometryObsUnindexed.setAttribute(
          "position", new THREE.Float32BufferAttribute(positionsObsUnindexed[exptID], 3)
        );

        const reflMaterialObsUnindexed = new THREE.PointsMaterial({
          size: this.reflectionSize.value,
          transparent: true,
          map: this.reflSprite,
          color: this.colors["reflectionObsUnindexed"][exptID % this.colors["reflectionObsUnindexed"].length],
        });
        const points = new THREE.Points(reflGeometryObsUnindexed, reflMaterialObsUnindexed);
        window.scene.add(points);
        pointsObsUnindexed[exptID].push(points);
      }

      this.reflPointsObsUnindexed = pointsObsUnindexed;
      this.reflPositionsUnindexed = positionsObsUnindexed;
    }

    if (xyzCal !== null) {
      for (var exptID = 0; exptID < positionsCal.length; exptID++) {
        const reflGeometryCal = new THREE.BufferGeometry();
        reflGeometryCal.setAttribute(
          "position", new THREE.Float32BufferAttribute(positionsCal[exptID], 3)
        );

        const reflMaterialCal = new THREE.PointsMaterial({
          size: this.reflectionSize.value,
          transparent: true,
          map: this.reflSprite,
          color: this.colors["reflectionCal"]
        });
        const points = new THREE.Points(reflGeometryCal, reflMaterialCal);
        window.scene.add(points);
        pointsCal[exptID].push(points);
      }
      this.reflPointsCal = pointsCal;
      this.reflPositionsCal = positionsCal;


      if (positionsIntegrated.length !== 0) {
        for (var exptID = 0; exptID < positionsIntegrated.length; exptID++) {
          const reflGeometryIntegrated = new THREE.BufferGeometry();
          reflGeometryIntegrated.setAttribute(
            "position", new THREE.Float32BufferAttribute(positionsIntegrated[exptID], 3)
          );

          const reflMaterialIntegrated = new THREE.PointsMaterial({
            size: this.reflectionSize.value,
            transparent: true,
            map: this.reflSprite,
            color: this.colors["reflectionIntegrated"]
          });
          const points = new THREE.Points(reflGeometryIntegrated, reflMaterialIntegrated);
          window.scene.add(points);
          pointsIntegrated[exptID].push(points);
        }
        this.reflPointsIntegrated = pointsIntegrated;
        this.reflPositionsIntegrated = positionsIntegrated;

      }
    }

    const bboxLineWidth = ExperimentViewer.sizes()["bboxLineWidth"];
    for (let i = 0; i < bboxesUnindexed.length; i++){
      for (const j in bboxesUnindexed[i]){
        if (bboxesUnindexed[i][j].length == 0){
          continue;
        }
        const bboxUnindexedMesh = this.getBboxMesh(
          bboxesUnindexed[i][j], i, parseInt(j), bboxLineWidth);
        bboxesUnindexed[i][j] = bboxUnindexedMesh;
        window.scene.add(bboxUnindexedMesh);
      }
    }

    for (let i = 0; i < bboxesIndexed.length; i++){
      for (const j in bboxesIndexed[i]){
        if (bboxesIndexed[i][j].length == 0){
          continue;
        }
        const bboxIndexedMesh = this.getBboxMesh(
          bboxesIndexed[i][j], i, parseInt(j), bboxLineWidth);
        bboxesIndexed[i][j] = bboxIndexedMesh;
        window.scene.add(bboxIndexedMesh);
      }
    }
    for (let i = 0; i < bboxesIntegrated.length; i++){
      for (const j in bboxesIntegrated[i]){
        if (bboxesIntegrated[i][j].length == 0){
          continue;
        }
        const bboxIntegratedMesh = this.getBboxMesh(
          bboxesIntegrated[i][j], i, parseInt(j), bboxLineWidth, this.colors["reflectionIntegrated"]);
        bboxesIntegrated[i][j] = bboxIntegratedMesh;
        window.scene.add(bboxIntegratedMesh);
      }
    }

    this.bboxMeshesUnindexed = bboxesUnindexed;
    this.bboxMeshesIndexed = bboxesIndexed;
    this.bboxMeshesIntegrated = bboxesIntegrated;

    this.updateReflectionCheckboxEnabledStatus();
    this.setDefaultReflectionsDisplay();
    this.updateReflectionVisibility();
    if (this.lastClickedPanelPosition != null) {
      this.sendClickedPanelPosition(
        this.lastClickedPanelPosition["panelIdx"],
        this.lastClickedPanelPosition["panelPos"],
        this.lastClickedPanelPosition["name"]

      );
    }
    this.refl.indexedMap = indexedMap;
    this.loading = false;
    this.requestRender();
  }

  async addCalculatedIntegratedReflectionsFromJSONMsgpack(reflMsgpack){
    if (!this.hasExperiment()) {
      console.warn("Tried to add reflections but no experiment has been loaded");
      this.clearCalculatedIntegratedReflectionTable();
      return;
    }

    this.clearCalculatedIntegratedReflectionTable();
    await this.calculatedIntegratedRefl.parseReflectionTableFromJSONMsgpack(reflMsgpack);

    // Get relevant data
    const panelNumbers = this.calculatedIntegratedRefl.getPanelNumbers();
    // Assume all reflection tables contain panel info
    if (panelNumbers === null){
      console.warn("Tried to add reflections but no data was parsed in refl file");
    }
    
    const pointsIntegrated = [];
    const positionsIntegrated = [];
    const bboxesIntegrated = [];


    for (var i = 0; i < this.expt.numExperiments(); i++) {
      pointsIntegrated.push([]);
      positionsIntegrated.push([]);
      bboxesIntegrated.push({});
    }

    const xyzCal = this.calculatedIntegratedRefl.getXYZCal();
    const millerIndices = this.calculatedIntegratedRefl.getMillerIndices();
    const exptIDs = this.calculatedIntegratedRefl.getExperimentIDs();
    const bboxes = this.calculatedIntegratedRefl.getBoundingBoxes();

    const uniquePanelIdxs = new Set(panelNumbers);
    let panelData = {};
    for (const panelIdx of uniquePanelIdxs){
      panelData[panelIdx] = this.expt.getDetectorPanelDataByIdx(0, panelIdx);
      for (let i = 0; i < this.expt.numExperiments(); i++) {
        bboxesIntegrated[i][panelIdx] = [];
      }
    }

    // Get positions of all reflections
    for (let reflIdx = 0; reflIdx < panelNumbers.length; reflIdx++){

      const reflPanel = panelNumbers[reflIdx];

      // exptID
      let exptID;
      if (exptIDs !== null){
        exptID = exptIDs[reflIdx];
      }
      else{
        exptID = 0;
      }

      if (xyzCal !== null) {
        const reflXyzCal = xyzCal[reflIdx];
        const globalPosCal = this.mapPointToGlobal(
          reflXyzCal,
          panelData[reflPanel]["origin"],
          panelData[reflPanel]["scaledFastAxis"],
          panelData[reflPanel]["scaledSlowAxis"],
          panelData[reflPanel]["pxSize"]);

          positionsIntegrated[exptID].push(globalPosCal.x);
          positionsIntegrated[exptID].push(globalPosCal.y);
          positionsIntegrated[exptID].push(globalPosCal.z);

      }

      if (bboxes !== null) {
        bboxesIntegrated[exptID][reflPanel].push(bboxes[reflIdx]);
      }

    }

    if (positionsIntegrated.length !== 0) {
      for (var exptID = 0; exptID < positionsIntegrated.length; exptID++) {
        const reflGeometryIntegrated = new THREE.BufferGeometry();
        reflGeometryIntegrated.setAttribute(
          "position", new THREE.Float32BufferAttribute(positionsIntegrated[exptID], 3)
        );

        const reflMaterialIntegrated = new THREE.PointsMaterial({
          size: this.reflectionSize.value,
          transparent: true,
          map: this.reflSprite,
          color: this.colors["reflectionIntegrated"]
        });
        const points = new THREE.Points(reflGeometryIntegrated, reflMaterialIntegrated);
        window.scene.add(points);
        pointsIntegrated[exptID].push(points);
      }
      this.reflPointsIntegrated = pointsIntegrated;
      this.reflPositionsIntegrated = positionsIntegrated;
    }

    if (bboxes !== null) {
      const bboxLineWidth = ExperimentViewer.sizes()["bboxLineWidth"];
      for (let i = 0; i < bboxesIntegrated.length; i++){
        for (const j in bboxesIntegrated[i]){
          if (bboxesIntegrated[i][j].length == 0){
            continue;
          }
          const bboxIntegratedMesh = this.getBboxMesh(
            bboxesIntegrated[i][j], i, parseInt(j), bboxLineWidth, this.colors["reflectionIntegrated"]);
          bboxesIntegrated[i][j] = bboxIntegratedMesh;
          window.scene.add(bboxIntegratedMesh);
        }
      }
      this.bboxMeshesIntegrated = bboxesIntegrated;
    }

    this.updateReflectionCheckboxEnabledStatus();
    this.updateReflectionVisibility();
    if (this.lastClickedPanelPosition != null) {
      this.sendClickedPanelPosition(
        this.lastClickedPanelPosition["panelIdx"],
        this.lastClickedPanelPosition["panelPos"],
        this.lastClickedPanelPosition["name"]
      );
    }
    this.loading = false;
    this.requestRender();

  }

  addCalculatedIntegratedReflectionsFromData(reflData) {

    if (!this.hasExperiment()) {
      console.warn("Tried to add reflections but no experiment has been loaded");
      this.clearReflectionTable();
      return;
    }

    this.clearReflPointsIntegrated();

    const pointsIntegrated = [];
    const positionsIntegrated = [];


    for (var i = 0; i < this.expt.numExperiments(); i++) {
      pointsIntegrated.push([]);
      positionsIntegrated.push([]);
    }

    const panelKeys = Object.keys(reflData);
    const refl = reflData[panelKeys[0]][0];

    const containsXYZCal = "xyzCal" in refl;
    const containsMillerIndices = "millerIdx" in refl;

    for (var i = 0; i < panelKeys.length; i++) {
      const panelIdx = parseInt(panelKeys[i])

      const panelReflections = reflData[panelKeys[i]];
      if (panelReflections === undefined) { continue; }
      const panelData = this.expt.getDetectorPanelDataByIdx(0, panelIdx);

      const fa = panelData["scaledFastAxis"];
      const sa = panelData["scaledSlowAxis"];
      const pOrigin = panelData["origin"];
      const pxSize = [panelData["pxSize"].x, panelData["pxSize"].y];

      for (var j = 0; j < panelReflections.length; j++) {

        const exptID = panelReflections[j]["exptID"];

        if (containsXYZCal) {
          const xyzCal = panelReflections[j]["xyzCal"];
          const globalPosCal = this.mapPointToGlobal(xyzCal, pOrigin, fa, sa, pxSize);
          positionsIntegrated[exptID].push(globalPosCal.x);
          positionsIntegrated[exptID].push(globalPosCal.y);
          positionsIntegrated[exptID].push(globalPosCal.z);
        }
      }
    }

    if (containsXYZCal) {
      if (positionsIntegrated.length !== 0) {
        for (var exptID = 0; exptID < positionsIntegrated.length; exptID++) {
          const reflGeometryIntegrated = new THREE.BufferGeometry();
          reflGeometryIntegrated.setAttribute(
            "position", new THREE.Float32BufferAttribute(positionsIntegrated[exptID], 3)
          );

          const reflMaterialIntegrated = new THREE.PointsMaterial({
            size: this.reflectionSize.value,
            transparent: true,
            map: this.reflSprite,
            color: this.colors["reflectionIntegrated"]
          });
          const points = new THREE.Points(reflGeometryIntegrated, reflMaterialIntegrated);
          window.scene.add(points);
          pointsIntegrated[exptID].push(points);
        }
        this.reflPointsIntegrated = pointsIntegrated;
        this.reflPositionsIntegrated = positionsIntegrated;
      }
    }

    if (this.reflPointsIntegrated.length !== 0){
      this.integratedReflsCheckbox.disabled = false;
    }
    this.updateReflectionVisibility();
    if (this.lastClickedPanelPosition != null) {
      this.sendClickedPanelPosition(
        this.lastClickedPanelPosition["panelIdx"],
        this.lastClickedPanelPosition["panelPos"],
        this.lastClickedPanelPosition["name"]
      );
    }
    this.loading = false;
    this.requestRender();
  }

  addReflections() {

    console.error("No longer implemented.");
    return;

    if (!this.hasReflectionTable()) {
      console.warn("Tried to add reflections but no table has been loaded");
      return;
    }
    if (!this.hasExperiment()) {
      console.warn("Tried to add reflections but no experiment has been loaded");
      this.clearReflectionTable();
      return;
    }


    const pointsObsUnindexed = [];
    const positionsObsUnindexed = [];
    const positionsObsIndexed = [];
    const pointsObsIndexed = [];
    const positionsCal = [];
    const bboxMeshesIndexed = [];
    const bboxMeshesUnindexed = [];


    for (var i = 0; i < this.expt.numExperiments(); i++) {
      pointsObsUnindexed.push([]);
      positionsObsUnindexed.push([]);
      positionsObsIndexed.push([]);
      pointsObsIndexed.push([]);
      bboxMeshesIndexed.push([]);
      bboxMeshesUnindexed.push([]);
    }

    const bboxMaterial = new THREE.LineBasicMaterial({ color: this.colors["bbox"] });
    const containsXYZObs = this.refl.containsXYZObs();
    const containsXYZCal = this.refl.containsXYZCal();
    const containsMillerIndices = this.refl.containsMillerIndices();
    const containsBboxes = this.refl.containsBboxes();

    for (var i = 0; i < this.expt.getNumDetectorPanels(0); i++) {

      const panelReflections = this.refl.getReflectionsForPanel(i);
      if (panelReflections == undefined) { continue; }
      const panelData = this.expt.getDetectorPanelDataByIdx(0, i);

      const fa = panelData["scaledFastAxis"];
      const sa = panelData["scaledSlowAxis"];
      const pOrigin = panelData["origin"];
      const pxSize = [panelData["pxSize"].x, panelData["pxSize"].y];

      for (var j = 0; j < panelReflections.length; j++) {

        const exptID = panelReflections[j]["exptID"];

        if (containsXYZObs) {

          const xyzObs = panelReflections[j]["xyzObs"];
          const globalPosObs = this.mapPointToGlobal(xyzObs, pOrigin, fa, sa, pxSize);

          if (containsMillerIndices && panelReflections[j]["indexed"]) {
            positionsObsIndexed[exptID].push(globalPosObs.x);
            positionsObsIndexed[exptID].push(globalPosObs.y);
            positionsObsIndexed[exptID].push(globalPosObs.z);
          }
          else {
            positionsObsUnindexed[exptID].push(globalPosObs.x);
            positionsObsUnindexed[exptID].push(globalPosObs.y);
            positionsObsUnindexed[exptID].push(globalPosObs.z);
          }

        }
        if (containsXYZCal) {
          const xyzCal = panelReflections[j]["xyzCal"];
          const globalPosCal = this.mapPointToGlobal(xyzCal, pOrigin, fa, sa, pxSize);
          positionsCal.push(globalPosCal.x);
          positionsCal.push(globalPosCal.y);
          positionsCal.push(globalPosCal.z);
        }
      }
    }

    if (containsXYZObs) {
      if (containsMillerIndices) {

        for (var exptID = 0; exptID < positionsObsIndexed.length; exptID++) {
          const reflGeometryObsIndexed = new THREE.BufferGeometry();
          reflGeometryObsIndexed.setAttribute(
            "position", new THREE.Float32BufferAttribute(positionsObsIndexed[exptID], 3)
          );

          const reflMaterialObsIndexed = new THREE.PointsMaterial({
            size: this.reflectionSize.value,
            transparent: true,
            map: this.reflSprite,
            color: this.colors["reflectionObsIndexed"]
          });
          const points = new THREE.Points(reflGeometryObsIndexed, reflMaterialObsIndexed);
          window.scene.add(points);
          pointsObsIndexed[exptID].push(points);
        }
        this.reflPointsObsIndexed = pointsObsIndexed;
        this.reflPositionsIndexed = positionsObsIndexed;
        this.bboxMeshesIndexed = bboxMeshesIndexed;
      }
      for (var exptID = 0; exptID < positionsObsUnindexed.length; exptID++) {
        const reflGeometryObsUnindexed = new THREE.BufferGeometry();
        reflGeometryObsUnindexed.setAttribute(
          "position", new THREE.Float32BufferAttribute(positionsObsUnindexed[exptID], 3)
        );

        const reflMaterialObsUnindexed = new THREE.PointsMaterial({
          size: this.reflectionSize.value,
          transparent: true,
          map: this.reflSprite,
          color: this.colors["reflectionObsUnindexed"][exptID % this.colors["reflectionObsUnindexed"].length],
        });
        const points = new THREE.Points(reflGeometryObsUnindexed, reflMaterialObsUnindexed);
        window.scene.add(points);
        pointsObsUnindexed[exptID].push(points);
      }
      this.reflPointsObsUnindexed = pointsObsUnindexed;
      this.reflPositionsUnindexed = positionsObsUnindexed;
      this.bboxMeshesUnindexed = bboxMeshesUnindexed;
    }

    if (containsXYZCal) {
      const reflGeometryCal = new THREE.BufferGeometry();
      reflGeometryCal.setAttribute(
        "position", new THREE.Float32BufferAttribute(positionsCal, 3)
      );

      const reflMaterialCal = new THREE.PointsMaterial({
        size: this.reflectionSize.value,
        transparent: true,
        map: this.reflSprite,
        color: this.colors["reflectionCal"]
      });
      const pointsCal = new THREE.Points(reflGeometryCal, reflMaterialCal);
      window.scene.add(pointsCal);
      this.reflPointsCal = [pointsCal];
      this.reflPositionsCal = positionsCal;
    }

    this.updateReflectionCheckboxEnabledStatus();
    this.setDefaultReflectionsDisplay();
    this.loading = false;
  }

highlightReflection(reflData, focusOnPanel = true) {
    const baseRadius = ExperimentViewer.sizes()["highlightBboxSize"];
    const pos = reflData["panelPos"];
    
    if ("focusOnPanel" in reflData) {
        focusOnPanel = reflData["focusOnPanel"];
    }
    
    if (focusOnPanel && this.view2D) {
        const data = this.expt.getDetectorPanelDataByIdx(0, reflData["panelIdx"]);
        const point = this.mapPointToGlobal(
          [pos[1], pos[0]], data["origin"], data["scaledFastAxis"],
          data["scaledSlowAxis"], data["pxSize"]
        );
        this.focus2DOnPoint(reflData["panelIdx"], point);
    }
    else if (focusOnPanel) {
        const panelName = reflData["name"];
        var panel = this.panelMeshes[reflData["panelIdx"]];
        window.viewer.zoomInOnPanel(panel, -1, panelName, pos);
    }
    
    // Clear existing highlights
    if (this.userReflection) {
        this.userReflection.clear();
        this.userReflection = null;
    }
    
    if (this.highlightReflectionMesh) {
        window.scene.remove(this.highlightReflectionMesh);
        this.highlightReflectionMesh.geometry.dispose();
        this.highlightReflectionMesh.material.dispose();
        this.highlightReflectionMesh = null;
    }
    
    const panelData = this.expt.getDetectorPanelDataByIdx(0, reflData["panelIdx"]);
    
    // Create circle using Line segments
    const segments = 64;
    let points = [];
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        let circlePoint = [
          pos[1] + Math.cos(theta) * baseRadius,
          pos[0] + Math.sin(theta) * baseRadius,
        ];
        circlePoint = this.mapPointToGlobal(
          circlePoint, panelData["origin"],
          panelData["scaledFastAxis"],
          panelData["scaledSlowAxis"],
          panelData["pxSize"]
        );
        points.push(
          circlePoint
        );
    }
    points.push(points[0]);

    const line = new MeshLineGeometry();
    points = points.map(point => new THREE.Vector3(point.x, point.y, point.z));
    line.setPoints(points);
    const material = new MeshLineMaterial({
      lineWidth: this.highlightLineWidth(),
      color: this.colors["highlightBbox"],
    });

    const circle = new THREE.Mesh(line, material);
    
    window.scene.add(circle);
    this.highlightReflectionMesh = circle;
    this.requestRender();
    
}

  mapPointToGlobal(point, pOrigin, fa, sa, scaleFactor = {x:1, y:1}) {
    const pos = pOrigin.clone();
    pos.add(fa.clone().normalize().multiplyScalar(point[0] * scaleFactor.x));
    pos.add(sa.clone().normalize().multiplyScalar(point[1] * scaleFactor.y));
    return pos;
  }

  setDefaultReflectionsDisplay() {

    if (!this.hasReflectionTable()) {
      this.observedIndexedReflsCheckbox.checked = false;
      this.observedUnindexedReflsCheckbox.checked = false;
      this.calculatedReflsCheckbox.checked = false;
      this.integratedReflsCheckbox.checked = false;
      return;
    }

    if (this.reflPointsObsIndexed.length > 0) {
      this.observedIndexedReflsCheckbox.checked = true;
    }
    if (this.reflPointsObsUnindexed.length > 0) {
      this.observedUnindexedReflsCheckbox.checked = true;
    }
    this.updateBoundingBoxes();
  }

  updateReflectionVisibility() {
    this.updateObservedIndexedReflections();
    this.updateObservedUnindexedReflections();
    this.updateCalculatedReflections();
    this.updateIntegratedReflections();
    this.updateBoundingBoxes();
  }

  updateReflectionCheckboxEnabledStatus() {
    if (!this.hasReflectionTable()) {
      this.observedIndexedReflsCheckbox.disabled = true;
      this.observedUnindexedReflsCheckbox.disabled = true;
      this.calculatedReflsCheckbox.disabled = true;
      this.integratedReflsCheckbox.disabled = true;
      this.boundingBoxesCheckbox.disabled = true;
      this.integratedBoundingBoxesCheckbox.disabled = true;

      this.observedUnindexedReflsRow.style.display = "none";
      this.observedIndexedReflsRow.style.display = "none";
      this.calculatedReflsRow.style.display = "none";
      this.integratedReflsRow.style.display = "none";
      this.boundingBoxesRow.style.display = "none";
      this.integratedBoundingBoxesRow.style.display = "none";
      this.reflectionSizeContainer.style.display = "none";
      return;
    }

    const hasUnindexed = this.refl.containsXYZObs();
    const hasIndexed = this.refl.containsMillerIndices();
    const hasCalculated = this.refl.containsXYZCal();
    const hasIntegrated = !this.integrationDataEmpty();
    const hasBoundingBoxes = this.refl.containsBoundingBoxes();
    const hasIntegratedBoundingBoxes = !this.integratedBoundingBoxesEmpty();

    this.observedUnindexedReflsCheckbox.disabled = !hasUnindexed;
    this.observedIndexedReflsCheckbox.disabled = !hasIndexed;
    this.calculatedReflsCheckbox.disabled = !hasCalculated;
    this.integratedReflsCheckbox.disabled = !hasIntegrated;
    this.boundingBoxesCheckbox.disabled = !hasBoundingBoxes;
    this.integratedBoundingBoxesCheckbox.disabled = !hasIntegratedBoundingBoxes;

    this.observedUnindexedReflsRow.style.display = hasUnindexed ? "" : "none";
    this.observedIndexedReflsRow.style.display = hasIndexed ? "" : "none";
    this.calculatedReflsRow.style.display = hasCalculated ? "" : "none";
    this.integratedReflsRow.style.display = hasIntegrated ? "" : "none";
    this.boundingBoxesRow.style.display = hasBoundingBoxes ? "" : "none";
    this.integratedBoundingBoxesRow.style.display = hasIntegratedBoundingBoxes ? "" : "none";
    this.reflectionSizeContainer.style.display = "";
  }

  integrationDataEmpty(){
    return this.reflPositionsIntegrated.every(function(subArr) {
      return subArr.length === 0;
    });
  }

  integratedBoundingBoxesEmpty(){
    return this.bboxMeshesIntegrated.every(function(panelMap) {
      return Object.values(panelMap).every(function(entry) {
        // Panels with no integrated reflections are left as empty arrays;
        // only panels with an actual bbox mesh get replaced with one.
        return Array.isArray(entry);
      });
    });
  }

  updatePanelTextures(){
    if (Object.keys(this.allPanelMeshes).length === 0){return;}
    if (this.visibleExptID === undefined){ return;}

    // Update visible exptID first
    for (const i of Object.keys(this.allPanelMeshes[this.visibleExptID])){
      const newTexture = this.getPanelTexture(i, this.visibleExptID);
      this.allPanelMeshes[this.visibleExptID][i].material.map = newTexture;
      this.allPanelMeshes[this.visibleExptID][i].material.map.needsUpdate = true;
    }

    this.requestRender();

    if (Object.keys(this.allPanelMeshes).length === 1){return;}

    for (const exptID of Object.keys(this.allPanelMeshes)){
      if (parseInt(exptID) === this.visibleExptID){continue;}
      for (const i of Object.keys(this.allPanelMeshes[exptID])){
        const newTexture = this.getPanelTexture(i, exptID);
        this.allPanelMeshes[exptID][i].material.map = newTexture;
        this.allPanelMeshes[exptID][i].material.map.needsUpdate = true;
      }
    }
    this.requestRender();
  }

  gammaContrast(value, contrast) {
    const gamma = 1 / (contrast * 2);
    return Math.pow(value, gamma);
  }

  logarithmicContrast(value, contrast) {
    return Math.log(1 + value * contrast) / Math.log(1 + contrast);
  }

  exponentialContrast(value, contrast) {
    return (Math.exp(value * contrast) - 1) / (Math.exp(contrast) - 1);
  }

  getContrast(value, contrast){
    if (this.lightTheme) {
      return 1 - this.exponentialContrast(1 - value, contrast);
    }
    switch(this.contrastMethod){
      case "exponential":
        return this.exponentialContrast(value, contrast);
      case "logarithmic":
        return this.logarithmicContrast(value, contrast);
      case "gamma":
        return this.gammaContrast(value, contrast);
    }
  }

  getPanelTexture(idx, exptID, imageData=null) {
    if (imageData == null){
      imageData = this.expt.experiments[exptID].imageData[idx];
    }
    let panelSize = this.expt.getDetectorPanelSize(exptID, idx);
    if (imageData[0].length !== panelSize[0]){
      panelSize = (panelSize[1], panelSize[0]);
    }


    var canvas = document.createElement('canvas');
    canvas.width = imageData[0].length;
    canvas.height = imageData.length;
    var context = canvas.getContext('2d');
    context.fillRect(0, 0, canvas.width, canvas.height);
    const contextData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = contextData.data;

    var dataIdx = 0;
    for (var x = 0; x < imageData.length; x++) {
      for (var y = 0; y < imageData[0].length; y++) {
        let value = this.getContrast(imageData[x][y], this.userContrast.value) * 255;
        value = Math.min(255, Math.max(0, value));
        if (this.lightTheme) { value = 255 - value; }

        data[dataIdx] = value;     // red
        data[dataIdx + 1] = value; // green
        data[dataIdx + 2] = value; // blue
        data[dataIdx + 3] = 255;   // alpha
        dataIdx += 4;
      }
    }

    context.putImageData(contextData, 0, 0);

    var texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  clearDetectorMesh(panelIdx, exptID){
    if (exptID === this.visibleExptID){
      if (panelIdx in this.panelMeshes){
        window.scene.remove(this.panelMeshes[panelIdx]);
        this.panelMeshes[panelIdx].geometry.dispose();
        this.panelMeshes[panelIdx].material.dispose();
        delete this.panelMeshes[panelIdx];
      }
    }
    if (exptID in this.allPanelMeshes){
      if (panelIdx in this.allPanelMeshes[exptID]){
        window.scene.remove(this.allPanelMeshes[exptID][panelIdx]);
        this.allPanelMeshes[exptID][panelIdx].geometry.dispose();
        this.allPanelMeshes[exptID][panelIdx].material.dispose();
        delete this.allPanelMeshes[exptID][panelIdx];
      }
    }
    this.requestRender();
  }

  toggleDebugMode(debugMode){
    if (debugMode === true){
      if (this.debugImageMode === false && this.debugThresholdMode == false){
        this.debugImageMode = true;
      }
    }
    else{
      this.debugImageMode = false;
      this.debugThresholdMode = false;
    }
    this.updatePanelMeshes();
  }

  setDebugToImage(){
    this.debugImageMode = true;
    this.debugThresholdMode = false;
    this.updatePanelMeshes();
  }

  setDebugToThreshold(){
    this.debugImageMode = false;
    this.debugThresholdMode = true;
    this.updatePanelMeshes();
  }

  addPanelImageData(imageData, panelIdx, exptID){ this.expt.parseImageData(imageData, panelIdx, exptID);
    this.clearDetectorMesh(panelIdx, exptID);
    this.addDetectorMesh(panelIdx, exptID);
    this.updatePanelMeshes();
  }

  addExptImageData(imageData, exptID){
    this.expt.parseExptImageData(imageData, exptID);

    for (let panelIdx = 0; panelIdx < imageData.length; panelIdx++){
      this.clearDetectorMesh(panelIdx, exptID);
      this.addDetectorMesh(panelIdx, exptID);
    }
    this.updatePanelMeshes();
  }

    addDebugImageData(imageData, maskData){
    this.clearDebugPanelMeshes();

    for (let panelIdx = 0; panelIdx < imageData.length; panelIdx++){
      const decompressedImageData = ExptParser.decompressImageData(
        imageData[panelIdx])
      const decompressedMaskData = ExptParser.decompressImageData(
        maskData[panelIdx])
      this.addDebugDetectorMesh(panelIdx, decompressedImageData, decompressedMaskData);
    }
    this.updatePanelMeshes();
  }


  addDebugDetectorMesh(panelIdx, imageData, maskData){
    const panelSize = this.expt.getDetectorPanelSize(0, panelIdx);
    const panelGeometry = new THREE.PlaneGeometry(panelSize[1], panelSize[0]);
    var panelMaterial;
    var panelThresholdMaterial;
    var uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    panelGeometry.setAttribute('uvs', new THREE.BufferAttribute(uvs, 2));

    const panelTexture = this.getPanelTexture(panelIdx, 0, imageData);
    const panelThresholdTexture = this.getPanelTexture(panelIdx, 0, maskData);

    panelMaterial = new THREE.MeshBasicMaterial({
      map: panelTexture
    })
    panelThresholdMaterial = new THREE.MeshBasicMaterial({
      map: panelThresholdTexture
    })


    const plane = new THREE.Mesh(panelGeometry, panelMaterial);
    var panelName = this.expt.getDetectorPanelName(0, panelIdx);
    plane.name = panelName;
    const thresholdPlane = new THREE.Mesh(panelGeometry, panelThresholdMaterial);

    thresholdPlane.name = panelName;
    var corners = this.expt.getDetectorPanelCorners(0, panelIdx);
    var idxs = [1, 2, 0, 3]

    // Rotate if not facing the origin
    var normalVec = this.expt.getDetectorPanelNormal(0, panelIdx);
    var posVec = corners[0].clone();
    posVec.add(corners[1].clone());
    posVec.add(corners[2].clone());
    posVec.add(corners[3].clone());
    posVec.divideScalar(4).normalize();
    if (posVec.dot(normalVec) < 0) {
      idxs = [0, 3, 1, 2];
    }

    const scaleFactor = 1.01 // ensure reflections appear in front of image
    var count = 0;
    for (var i = 0; i < 12; i += 3) {
      plane.geometry.attributes.position.array[i] = corners[idxs[count]].x * scaleFactor;
      plane.geometry.attributes.position.array[i + 1] = corners[idxs[count]].y * scaleFactor;
      plane.geometry.attributes.position.array[i + 2] = corners[idxs[count]].z * scaleFactor;
      count++;
    }
    plane.userData.corners = [
      new THREE.Vector3(
        plane.geometry.attributes.position.array[0],
        plane.geometry.attributes.position.array[1],
        plane.geometry.attributes.position.array[2],
      ),
      new THREE.Vector3(
        plane.geometry.attributes.position.array[3],
        plane.geometry.attributes.position.array[4],
        plane.geometry.attributes.position.array[5],
      ),
      new THREE.Vector3(
        plane.geometry.attributes.position.array[6],
        plane.geometry.attributes.position.array[7],
        plane.geometry.attributes.position.array[8],
      ),
      new THREE.Vector3(
        plane.geometry.attributes.position.array[9],
        plane.geometry.attributes.position.array[10],
        plane.geometry.attributes.position.array[11],
      ),
    ]

    count = 0;
    for (var i = 0; i < 12; i += 3) {
      thresholdPlane.geometry.attributes.position.array[i] = corners[idxs[count]].x * scaleFactor;
      thresholdPlane.geometry.attributes.position.array[i + 1] = corners[idxs[count]].y * scaleFactor;
      thresholdPlane.geometry.attributes.position.array[i + 2] = corners[idxs[count]].z * scaleFactor;
      count++;
    }
    thresholdPlane.userData.corners = [
      new THREE.Vector3(
        thresholdPlane.geometry.attributes.position.array[0],
        thresholdPlane.geometry.attributes.position.array[1],
        thresholdPlane.geometry.attributes.position.array[2],
      ),
      new THREE.Vector3(
        thresholdPlane.geometry.attributes.position.array[3],
        thresholdPlane.geometry.attributes.position.array[4],
        thresholdPlane.geometry.attributes.position.array[5],
      ),
      new THREE.Vector3(
        thresholdPlane.geometry.attributes.position.array[6],
        thresholdPlane.geometry.attributes.position.array[7],
        thresholdPlane.geometry.attributes.position.array[8],
      ),
      new THREE.Vector3(
        thresholdPlane.geometry.attributes.position.array[9],
        thresholdPlane.geometry.attributes.position.array[10],
        thresholdPlane.geometry.attributes.position.array[11],
      ),
    ]

    window.scene.add(plane);
    window.scene.add(thresholdPlane);
    this.debugPanelMeshes[panelIdx] = plane;
    this.debugPanelThresholdMeshes[panelIdx] = thresholdPlane;
  this.requestRender();
  }


  addDetectorMesh(panelIdx, exptID){
      const panelSize = this.expt.getDetectorPanelSize(exptID, panelIdx);
      const panelGeometry = new THREE.PlaneGeometry(panelSize[0], panelSize[1]);
      var panelMaterial;
      if (this.isStandalone) {
        panelMaterial = new THREE.MeshPhongMaterial({
          color: this.colors["panel"],
          opacity: 0.25,
          transparent: true,
          depthWrite: false
        });
      }
      else {
        var uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
        panelGeometry.setAttribute('uvs', new THREE.BufferAttribute(uvs, 2));
        const panelTexture = this.getPanelTexture(panelIdx, exptID);
        panelMaterial = new THREE.MeshBasicMaterial({
          map: panelTexture
        })
      }
      const plane = new THREE.Mesh(panelGeometry, panelMaterial);
      var panelName = this.expt.getDetectorPanelName(exptID, panelIdx);
      plane.name = panelName;

    const vertices = this.getPanelPlaneVertices(exptID, panelIdx);
    for (var i = 0; i < 4; i++) {
      plane.geometry.attributes.position.array[3 * i] = vertices[i].x;
      plane.geometry.attributes.position.array[3 * i + 1] = vertices[i].y;
      plane.geometry.attributes.position.array[3 * i + 2] = vertices[i].z;
    }
    plane.userData.corners = [
      new THREE.Vector3(
        plane.geometry.attributes.position.array[0],
        plane.geometry.attributes.position.array[1],
        plane.geometry.attributes.position.array[2],
      ),
      new THREE.Vector3(
        plane.geometry.attributes.position.array[3],
        plane.geometry.attributes.position.array[4],
        plane.geometry.attributes.position.array[5],
      ),
      new THREE.Vector3(
        plane.geometry.attributes.position.array[6],
        plane.geometry.attributes.position.array[7],
        plane.geometry.attributes.position.array[8],
      ),
      new THREE.Vector3(
        plane.geometry.attributes.position.array[9],
        plane.geometry.attributes.position.array[10],
        plane.geometry.attributes.position.array[11],
      ),
    ]

    window.scene.add(plane);
    if (!(exptID in this.allPanelMeshes)){
      this.allPanelMeshes[exptID] = {}
    }
    this.allPanelMeshes[exptID][panelIdx] = plane;
    this.requestRender();

  }

  addDetectorPanel(idx, exptID, addTexture=true) {

    var panelName = this.expt.getDetectorPanelName(exptID, idx);
    if (panelName in this.panelOutlineMeshes){
      return;
    }

    var corners = this.expt.getDetectorPanelCorners(exptID, idx);
    corners.push(corners[0]);
    corners = corners.map(corner => new THREE.Vector3(corner.x, corner.y, corner.z));

    var idxs = [1, 2, 0, 3]

    // Rotate if not facing the origin
    var normalVec = this.expt.getDetectorPanelNormal(exptID, idx);
    var posVec = corners[0].clone();
    posVec.add(corners[1].clone());
    posVec.add(corners[2].clone());
    posVec.add(corners[3].clone());
    posVec.divideScalar(4).normalize();
    if (posVec.dot(normalVec) < 0) {
      idxs = [0, 3, 1, 2];
    }

    const line = new MeshLineGeometry();
    line.setPoints(corners);
    const material = new MeshLineMaterial({
      lineWidth: 6,
      color: this.colors["panel"],
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(line, material);
    this.panelOutlineMeshes[panelName] = mesh;
    window.scene.add(mesh);

    if (addTexture){
      this.addDetectorMesh(idx, exptID);
    }
  }

  addBeam() {
    var beamLength = 800.;
    var bd = this.expt.getBeamDirection(0);

    var incidentVertices = []
    incidentVertices.push(
      new THREE.Vector3(bd.x * -beamLength, bd.y * -beamLength, bd.z * -beamLength)
    );
    incidentVertices.push(
      new THREE.Vector3(bd.x * -beamLength * .5, bd.y * -beamLength * .5, bd.z * -beamLength * .5)
    );
    incidentVertices.push(new THREE.Vector3(0, 0, 0));
    const incidentLine = new MeshLineGeometry();
    incidentLine.setPoints(incidentVertices);
    const incidentMaterial = new MeshLineMaterial({
      lineWidth: 5,
      color: this.colors["beam"],
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    const incidentMesh = new THREE.Mesh(incidentLine, incidentMaterial);
    incidentMesh.raycast = raycast;
    this.beamMeshes.push(incidentMesh);
    window.scene.add(incidentMesh);

    var outgoingVertices = []
    outgoingVertices.push(new THREE.Vector3(0, 0, 0));
    outgoingVertices.push(
      new THREE.Vector3(bd.x * beamLength * .5, bd.y * beamLength * .5, bd.z * beamLength * .5)
    );
    outgoingVertices.push(
      new THREE.Vector3(bd.x * beamLength, bd.y * beamLength, bd.z * beamLength)
    );
    const outgoingLine = new MeshLineGeometry();
    outgoingLine.setPoints(outgoingVertices);
    const outgoingMaterial = new MeshLineMaterial({
      lineWidth: 5,
      color: this.colors["beam"],
      transparent: true,
      opacity: 0.25,
      depthWrite: false
    });
    const outgoingMesh = new THREE.Mesh(outgoingLine, outgoingMaterial);
    outgoingMesh.raycast = raycast;
    this.beamMeshes.push(outgoingMesh);
    window.scene.add(outgoingMesh);
  }

  addSample() {
    const sphereGeometry = new THREE.SphereGeometry(5);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: this.colors["sample"],
      transparent: true,
      depthWrite: false
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.name = "sample";
    this.sampleMesh = sphere;
    window.scene.add(sphere);
  }

  addAxes() {
    function addAxis(viewer, vertices, color) {
      const line = new MeshLineGeometry();
      line.setPoints(vertices);
      const Material = new MeshLineMaterial({
        lineWidth: 5,
        color: color,
        transparent: true,
        opacity: 0.5,
        depthWrite: false
      });
      const Mesh = new THREE.Mesh(line, Material);
      viewer.axesMeshes.push(Mesh);
      window.scene.add(Mesh);
    }

    const length = 200.;
    this.axesMeshes = [];

    const xVertices = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(length, 0, 0)];
    const yVertices = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, length, 0)];
    const zVertices = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, length)];

    addAxis(this, xVertices, this.colors["axes"][0]);
    addAxis(this, yVertices, this.colors["axes"][1]);
    addAxis(this, zVertices, this.colors["axes"][2]);
  }

  setCameraSmooth(position, target) {
    gsap.to(window.camera.position, {
      duration: 1,
      x: position.x,
      y: position.y,
      z: position.z,
      onUpdate: () => {
        window.camera.lookAt(window.controls.target);
        window.viewer.requestRender();
      },
    });
  
    const startTarget = window.controls.target.clone(); 
    gsap.to(startTarget, {
      duration: 1,
      x: target.x,
      y: target.y,
      z: target.z,
      onUpdate: () => {
        window.controls.target.set(startTarget.x, startTarget.y, startTarget.z);
        window.camera.lookAt(window.controls.target);
        window.viewer.requestRender();
      },
      onComplete: () => {
        window.controls.update();
      },
    });
  }
  

  setCameraToDefaultPosition() {
    const { position, target } = ExperimentViewer.cameraPositions()["default"];
    this.setCameraSmooth(position, target);
  }
  

  setCameraToDefaultPositionWithExperiment() {
    const { position, target } = ExperimentViewer.cameraPositions()["defaultWithExperiment"];
    this.setCameraSmooth(position, target);
    this.panelFocusAxes = null;
  }

  displayHeaderText(text) {
    this.showHeaderText();
    this.headerText.innerHTML = text;
  }

  appendHeaderText(text) {
    this.headerText.innerHTML += text;
  }

  hideHeaderText() {
    this.headerText.style.display = "none";
  }

  showHeaderText() {
    this.headerText.style.display = "block";
  }

  displayFooterText(text) {
    this.showFooterText();
    this.footerText.textContent = text;
  }

  hideFooterText() {
    this.footerText.style.display = "none";
  }

  showFooterText() {
    this.footerText.style.display = "block";
  }

  displayDefaultHeaderText() {
    if (this.hasExperiment() || !this.isStandalone) {
      this.hideHeaderText();
    }
    else {
      this.displayHeaderText(ExperimentViewer.text()["default"]);
    }
  }

  displayImageFilenames() {
    this.displayHeaderText(this.expt.getImageFilenames(0));
    this.displayingTextFromHTMLEvent = true;
  }

  displayNumberOfReflections() {
    this.displayHeaderText(this.refl.numReflections + " reflections");
    this.displayingTextFromHTMLEvent = true;
  }

  stopDisplayingText() {
    this.displayingTextFromHTMLEvent = false;
  }


  highlightObject(obj) {
    obj.material.color = new THREE.Color(this.colors["highlight"]);
    obj.material.opacity = 0.9;
  }

  beamHidden() {
    if (this.beamMeshes.length === 0) {
      return true;
    }
    return this.beamMeshes[0].material.opacity < 0.01;
  }

  sampleHidden() {
    if (this.sampleMesh === null) {
      return true;
    }
    return this.sampleMesh.material.opacity < 0.01;
  }

  onLeftClick() {
    if (this.isStandalone) { return; }
    if (this.preventMouseClick) { return; }
    if (this.creatingReflection && !this.drawingReflection) {
      window.viewer.disableReflectionCreation();
      return;
    }
    window.rayCaster.setFromCamera(window.mousePosition, window.camera);
    const intersects = window.rayCaster.intersectObjects(Object.values(this.panelMeshes));
    if (intersects.length > 0) {
      const name = intersects[0].object.name;
      const panelIdx = this.expt.getDetectorPanelIdxByName(0, name);
      const panelPos = this.getPanelPosition(intersects[0].point, name);
      this.sendClickedPanelPosition(panelIdx, panelPos, name);
      this.highlightReflection({ "panelIdx": panelIdx, "panelPos": panelPos }, false);
    }
  }

  disableMouseClick() {

    this.preventMouseClick = true;
  }

  enableMouseClick() {
    this.preventMouseClick = false;
  }

  showLoadingImagesMsg() {
    this.displayHeaderText("Loading images...");
    this.loading = true;
  }

  showLoadingReflectionMsg() {
    this.displayHeaderText("Loading reflection...");
    this.loading = true;
  }

  updateGUIInfo() {

    function updatePanelInfo(viewer) {
      window.rayCaster.setFromCamera(window.mousePosition, window.camera);
      const intersects = window.rayCaster.intersectObjects(Object.values(viewer.panelMeshes));
      if (intersects.length > 0) {
        const name = intersects[0].object.name;
        viewer.displayHeaderText(name + " [" + viewer.getPanelPositionAsString(intersects[0].point, name) + "]");
        viewer.highlightObject(viewer.panelOutlineMeshes[name]);
      }
    }

    function updateReflectionInfo(viewer) {
      if (!viewer.observedIndexedReflsCheckbox.checked) { return; }
      for (var i = 0; i < viewer.reflPointsObsIndexed.length; i++) {
        window.rayCaster.setFromCamera(window.mousePosition, window.camera);
        const intersects = window.rayCaster.intersectObjects(viewer.reflPointsObsIndexed[i]);
        if (intersects.length > 0) {
          for (var j = 0; j < intersects.length; j++) {
            const millerIdx = viewer.refl.getMillerIndexById(intersects[j].index);
            viewer.appendHeaderText(" (" + millerIdx[0] + ", " + millerIdx[1] + ", " + millerIdx[2] + ")");
          }
        }
      }
    }

    function updateBeamInfo(viewer) {
      if (viewer.beamHidden()) {
        return;
      }
      window.rayCaster.setFromCamera(window.mousePosition, window.camera);
      const intersects = window.rayCaster.intersectObjects(viewer.beamMeshes);
      if (intersects.length > 0) {
        const text = "<b>beam: </b>" + viewer.expt.getBeamSummary(0);
        viewer.displayHeaderText(text);
      }
    }

    function updateCrystalInfo(viewer) {
      if (viewer.sampleHidden()) {
        return;
      }
      if (viewer.expt.getCrystalSummary(0) == null) {
        return;
      }
      window.rayCaster.setFromCamera(window.mousePosition, window.camera);
      const intersects = window.rayCaster.intersectObjects([viewer.sampleMesh]);
      if (intersects.length > 0) {
        const text = "<b>crystal: </b>" + viewer.expt.getCrystalSummary(0);
        viewer.displayHeaderText(text);
      }

    }

    if (this.displayingTextFromHTMLEvent) { return; }
    if (!this.cursorActive) { return; }
    if (this.loading) { return; }
    this.displayDefaultHeaderText();
    updatePanelInfo(this);
    updateReflectionInfo(this);
    updateBeamInfo(this);
    updateCrystalInfo(this);
  }

  getPanelPosition(globalPos, panelName) {
    const data = this.expt.getDetectorPanelDataByName(0, panelName);
    const pos = data["origin"].clone().sub(globalPos);
    const fa = data["fastAxis"];
    const sa = data["slowAxis"];
    const panelX = (pos.x * fa.x + pos.y * fa.y + pos.z * fa.z)/data["pxSize"].x;
    const panelY = (pos.x * sa.x + pos.y * sa.y + pos.z * sa.z)/data["pxSize"].y;
    return [Math.floor(-panelY), Math.floor(-panelX)];

  }

  getPanelPositionAsString(globalPos, panelName) {
    const [panelX, panelY] = this.getPanelPosition(globalPos, panelName);
    return panelX + ", " + panelY;

  }

  getPanelCentroid(panelName) {
    return this.expt.getDetectorPanelCentroidByName(0, panelName);
  }

  resetPanelColors() {
    for (var i in this.panelOutlineMeshes) {
      this.panelOutlineMeshes[i].material.color = this.panelColor;
      this.panelOutlineMeshes[i].material.opacity = 0.55;
    }
  }

  updateOriginObjectsOpacity() {
    if (!this.hasExperiment()) {
      return;
    }
    const minCameraDistance = 55000;
    const maxCameraDistance = 1000000;
    const cameraPos = window.camera.position;
    const cameraDistance = Math.pow(cameraPos.x, 2) + Math.pow(cameraPos.y, 2) + Math.pow(cameraPos.z, 2);
    var opacity = ((cameraDistance - minCameraDistance) / (maxCameraDistance - minCameraDistance));
    opacity = Math.min(1., Math.max(opacity, 0.))
    this.beamMeshes[0].material.opacity = opacity * .25;
    this.beamMeshes[1].material.opacity = opacity;
    this.sampleMesh.material.opacity = opacity;
    for (var i = 0; i < this.axesMeshes.length; i++) {
      this.axesMeshes[i].material.opacity = opacity * .5;
    }
  }

  getClickedPanelPos() {
    window.rayCaster.setFromCamera(window.mousePosition, window.camera);
    const intersects = rayCaster.intersectObjects(Object.values(this.panelMeshes));
    if (intersects.length > 0) {
      return intersects[0].point;
    }

  }

  getClickedPanelCentroid() {
    window.rayCaster.setFromCamera(window.mousePosition, window.camera);
    const intersects = rayCaster.intersectObjects(Object.values(this.panelMeshes));
    if (intersects.length > 0) {
      return window.viewer.getPanelCentroid(intersects[0].object.name);
    }
  }

  getClickedPanelMesh() {
    window.rayCaster.setFromCamera(window.mousePosition, window.camera);
    const intersects = rayCaster.intersectObjects(Object.values(this.panelMeshes));
    if (intersects.length > 0) {
      return intersects[0].object;
    }

  }

  rotateToPos(pos) {
    gsap.to(window.camera.position, {
      duration: 1,
      x: -pos.x,
      y: -pos.y,
      z: -pos.z,
      onUpdate: function () {
        window.camera.lookAt(pos);
        window.viewer.requestRender();
      }
    });
  }

  zoomInOnPanel(panel, fitOffset = -1, panelName = null, panelPos = null) {
    const box = new THREE.Box3().setFromObject(panel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
  
    const corners = panel.userData.corners; 
    if (!corners || corners.length < 4) {
      console.error("Panel corners are not properly defined.");
      return;
    }
  
    // Calculate normal vector of the panel
    const edge1 = new THREE.Vector3().subVectors(corners[1], corners[0]); 
    const edge2 = new THREE.Vector3().subVectors(corners[3], corners[0]);
    const edge3 = new THREE.Vector3().subVectors(corners[2], corners[0]);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

    // Save the local axes of the panel
    const panelX = edge3.clone().normalize();
    const panelY = edge1.clone().normalize();
    const panelNormal = normal;
  
    window.viewer.panelFocusAxes = { panelX, panelY, panelNormal, center };
  
    // Determine the distance based on the panel size and camera FOV
    const maxDim = Math.max(size.x, size.y, size.z);
    const fitHeightDistance = maxDim / (2 * Math.atan((Math.PI * window.camera.fov) / 360));
    const fitWidthDistance = fitHeightDistance / window.camera.aspect;
    const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);
  
    // Position the camera along the normal vector
    const newCameraPos = center.clone().add(normal.clone().multiplyScalar(distance));
  
    gsap.to(window.camera.position, {
      duration: 1,
      x: newCameraPos.x,
      y: newCameraPos.y,
      z: newCameraPos.z,
      onUpdate: () => {
        window.camera.lookAt(center);
        window.viewer.requestRender();
      },
      onComplete: () => {
        if (panelName && panelPos) {
          window.viewer.displayHeaderText(`${panelName} [${panelPos[0]}, ${panelPos[1]}]`);
        }
      },
    });
  
    window.controls.target.copy(center);
    window.controls.update();
  }
  
  toggleExperimentList() {
    document.getElementById("experimentDropdown").classList.toggle("show");
    var dropdownIcon = document.getElementById("dropdownIcon");
    dropdownIcon.classList.toggle("fa-chevron-down");
    dropdownIcon.classList.toggle("fa-chevron-right");
  }

  selectExpt(exptID){
    if (this.visibleExptID === exptID){
      return;
    }
    this.visibleExptID = exptID;
    for (var i = 0; i < this.expt.numExperiments(); i++) {
      if (i === exptID) {
        continue;
      }
      var otherDropdownIcon = document.getElementById("exptID-dropdown-icon-" + i.toString());
      if (otherDropdownIcon.classList.contains("fa-check")) {
        otherDropdownIcon.classList.toggle("fa-check");
      }
    }

    dropdownIcon.classList.toggle("fa-check");
    this.updatePanelMeshes();
    this.updateObservedIndexedReflections();
    this.updateObservedUnindexedReflections();
    this.updateCalculatedReflections();
    this.updateIntegratedReflections();
    this.updateBoundingBoxes();
  }

  toggleExptVisibility(exptIDLabel) {
    var exptID = parseInt(exptIDLabel.split("-").pop());
    var dropdownIcon = document.getElementById("exptID-dropdown-icon-" + exptID.toString());
    if (dropdownIcon.classList.contains("fa-check")) {
      this.visibleExptID = -1;
    }
    else {
      this.visibleExptID = exptID;
      this.serverWS.send(JSON.stringify({
        "channel": "server",
        "type": "file.set_description",
        "payload": {
          "expt_id": exptID,
          "in_debug_mode": (this.debugImageMode || this.debugThresholdMode)
        }
      }));
    }

    for (var i = 0; i < this.expt.numExperiments(); i++) {
      if (i === exptID) {
        continue;
      }
      var otherDropdownIcon = document.getElementById("exptID-dropdown-icon-" + i.toString());
      if (otherDropdownIcon.classList.contains("fa-check")) {
        otherDropdownIcon.classList.toggle("fa-check");
      }
    }

    dropdownIcon.classList.toggle("fa-check");
    this.updatePanelMeshes();
    this.updateObservedIndexedReflections();
    this.updateObservedUnindexedReflections();
    this.updateCalculatedReflections();
    this.updateIntegratedReflections();
    this.updateBoundingBoxes();
  }

  clearExperimentList() {
    var dropdownContent = document.getElementById("experimentDropdown");
    if (dropdownContent !== null) {
      dropdownContent.innerHTML = "";
    }
  }

  updateExperimentList() {
    var maxLabelSize = 22;

    var exptIDs = this.expt.getExptIDs();
    var exptLabels = this.expt.getExptLabels();

    var dropdownContent = document.getElementById("experimentDropdown");
    dropdownContent.innerHTML = "";

    for (var i = 0; i < exptIDs.length; i++) {
      var label = document.createElement("label");
      label.classList.add("experiment-label");
      const color = this.colors["reflectionObsUnindexed"][exptIDs[i] % this.colors["reflectionObsUnindexed"].length];
      var hexColor = '#' + color.toString(16).padStart(6, '0');
      label.style.color = hexColor;

      var icon = document.createElement("i");
      icon.classList.add("fa", "fa-check");
      icon.style.float = "right";
      icon.id = "exptID-dropdown-icon-" + exptIDs[i];
      if (i !== 0) {
        icon.classList.toggle("fa-check");
      }


      var exptLabel = exptLabels[i];
      if (exptLabel.length > maxLabelSize) {
        exptLabel = exptLabel.slice(0, 19) + "...";
      }
      label.textContent = exptLabel;
      label.id = "exptID-" + exptIDs[i];

      label.appendChild(icon);

      label.addEventListener('click', (event) => {
        this.toggleExptVisibility(event.target.id);
      });

      dropdownContent.appendChild(label);
      dropdownContent.appendChild(document.createElement("br"));
    }
  }

  enableReflectionCreation() {
    if (this.preventMouseClick) { return; }
    window.rayCaster.setFromCamera(window.mousePosition, window.camera);
    const intersects = window.rayCaster.intersectObjects(Object.values(this.panelMeshes));
    if (intersects.length === 0) { return; }

    if (this.userReflection) {
      this.userReflection.clearLineMesh();
      this.userReflection.clearBboxMesh();
      this.userReflection = null;
    }

    window.controls.enabled = false;
    this.creatingReflection = true;
    this.drawingReflection = true;

    const name = intersects[0].object.name;
    const panelIdx = this.expt.getDetectorPanelIdxByName(0, name);
    this.userReflection = new UserReflection(
      intersects[0].point, name, this.colors["createNewReflectionBbox"]);
  }

  onEndDrawingReflection() {
    window.viewer.drawingReflection = false;
    if (this.highlightReflectionMesh) {
      window.scene.remove(this.highlightReflectionMesh);
      this.highlightReflectionMesh.geometry.dispose();
      this.highlightReflectionMesh.material.dispose();
      this.highlightReflectionMesh = null;
    }
    var panelPositions = [];
    for (var i = 0; i < this.userReflection.positions.length; i++) {
      panelPositions.push(
        this.getPanelPosition(this.userReflection.positions[i],
          this.userReflection.panelName
        )
      );
    }

    const xValues = panelPositions.map(position => position[0]);
    const yValues = panelPositions.map(position => position[1]);

    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const bbox = [minY, maxY, maxX, minX];
    const panelIdx = this.expt.getDetectorPanelIdxByName(0, this.userReflection.panelName);
    const panelData = this.expt.getDetectorPanelDataByName(0, this.userReflection.panelName);

    this.serverWS.send(JSON.stringify({
      "channel": "server",
      "type": "reflections.new_xy",
      "payload": {
        "panel_idx": panelIdx,
        "expt_id": this.visibleExptID,
        "panel_name": this.userReflection.panelName
      }
    }));
  }

  disableReflectionCreation() {
    window.controls.enabled = true;
    this.creatingReflection = false;
    if (this.userReflection) {
      this.userReflection.clear();
      this.userReflection = null;
    }
    this.serverWS.send(JSON.stringify({
      "channel": "server",
      "type": "reflections.cancel_new",
      "payload": {}
    }));
  }

  updateNewReflection() {
    window.rayCaster.setFromCamera(window.mousePosition, window.camera);
    const intersects = window.rayCaster.intersectObjects(Object.values(this.panelMeshes));
    if (intersects.length === 0) { return; }
    if (this.userReflection) {
      this.userReflection.updateUserOutline(intersects[0].point);
    }
  }

  animate() {
    if (!this.renderRequested) {
      return;
    }
    if (this.drawingReflection) {
      this.updateNewReflection();
    }
    window.viewer.resetPanelColors();
    window.viewer.updateOriginObjectsOpacity();
    window.viewer.updateGUIInfo();
    window.renderer.render(window.scene, window.camera);
    this.renderRequested = false;
    window.viewer.enableMouseClick();
  }

  requestRender() {
    if (typeof window !== "undefined" && !this.renderRequested) {
      this.renderRequested = true;
      window.requestAnimationFrame(this.animate.bind(this));
    }
  }

}

export function setupScene() {

  /**
   * Sets the renderer, camera, controls
   */


  if (typeof window.viewer === "undefined") { return; }

  // Renderer
  window.renderer = new THREE.WebGLRenderer();
  window.renderer.setClearColor(window.viewer.colors["background"]);
  window.renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(window.renderer.domElement);

  window.scene = new THREE.Scene()
  window.scene.fog = new THREE.Fog(window.viewer.colors["background"], 500, 3000);
  window.camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    .1,
    10000
  );
  window.renderer.render(window.scene, window.camera);
  window.rayCaster = new THREE.Raycaster(); // used for all raycasting

  // Controls
  window.controls = new OrbitControls(window.camera, window.renderer.domElement);
  window.controls.mouseButtons.MIDDLE = THREE.MOUSE.NONE;
  window.controls.maxDistance = 3000;
  window.controls.enablePan = false;
  window.controls.update();
  window.controls.addEventListener("change", function () { window.viewer.requestRender(); });

  // 2D view (ExperimentViewer.setView2D): orthographic, pan and zoom only
  window.camera3D = window.camera;
  window.controls3D = window.controls;
  window.camera2D = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  window.controls2D = new OrbitControls(window.camera2D, window.renderer.domElement);
  window.controls2D.enableRotate = false;
  window.controls2D.screenSpacePanning = true;
  window.controls2D.zoomToCursor = true;
  window.controls2D.minZoom = 1;
  window.controls2D.maxZoom = 100;
  window.controls2D.mouseButtons = {
    LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: null
  };
  window.controls2D.enabled = false;
  window.controls2D.addEventListener("change", function () {
    window.viewer.clamp2DView();
    window.viewer.requestRender();
  });


  // Events
  window.mousePosition = new THREE.Vector2();
  window.addEventListener("mousemove", function (e) {
    window.mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
    window.mousePosition.y = - (e.clientY / window.innerHeight) * 2 + 1;
    window.viewer.requestRender();

    if (window.viewer.isPanning && this.window.viewer.panelFocusAxes !== null) {

      const { panelX, panelY, panelNormal, center } = window.viewer.panelFocusAxes;
      const deltaX = e.clientX - window.viewer.startMousePosition.x;
      const deltaY = e.clientY - window.viewer.startMousePosition.y;

      const panSpeed = .5; 

      const panOffsetX = panelX.clone().multiplyScalar(deltaX * panSpeed);
      const panOffsetY = panelY.clone().multiplyScalar(-deltaY * panSpeed);

      window.camera.position.add(panOffsetX).add(panOffsetY);
      window.controls.target.add(panOffsetX).add(panOffsetY);


      window.viewer.startMousePosition.x = e.clientX;
      window.viewer.startMousePosition.y = e.clientY;
    }
  });

  window.renderer.domElement.addEventListener("mouseup", (event) => {
    if (event.button === 1) { // Middle mouse button
      window.viewer.isPanning = false;
    }
  });

  window.renderer.domElement.addEventListener("mouseleave", () => {
    window.viewer.isPanning = false; // Stop panning if the mouse leaves the canvas
  });


  window.addEventListener("resize", function () {
    window.camera3D.aspect = window.innerWidth / window.innerHeight;
    window.camera3D.updateProjectionMatrix();
    window.viewer.update2DFrustum();
    window.viewer.updateLineWidths();
    window.renderer.setSize(window.innerWidth, window.innerHeight);
    window.viewer.requestRender();
  });

  window.addEventListener("dragstart", (event) => {
    dragged = event.target;
  });

  window.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  window.addEventListener('drop', function (event) {

    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files[0];
    const fileExt = file.name.split(".").pop();
    if (fileExt == "refl" && window.viewer.isStandalone) {
      window.viewer.addReflectionTable(file);
    }
    else if (fileExt == "expt" && window.viewer.isStandalone) {
      window.viewer.addExperiment(file);
    }
  });

  window.addEventListener('dblclick', function (event) {
    if (window.viewer.view2D) { return; }
    var panel = window.viewer.getClickedPanelMesh();
    if (panel) {
      window.viewer.zoomInOnPanel(panel);
    }
  });

  // In 2D, dragging pans, so a drag does not count as a click
  let mouseDownPos = null;
  window.addEventListener('click', function (event) {
    if (window.viewer.view2D && !window.viewer.drawingReflection && mouseDownPos !== null) {
      const moved = Math.hypot(event.clientX - mouseDownPos.x, event.clientY - mouseDownPos.y);
      if (moved > 3) { return; }
    }
    if (event.button === 0) {
      if (event.altKey && window.viewer.drawingReflection) {
        window.viewer.onEndDrawingReflection();
      }
      else {
        window.viewer.onLeftClick();
      }
    }
  });

  window.addEventListener('mousedown', function (event) {
    mouseDownPos = { x: event.clientX, y: event.clientY };
    if (event.button === 0 && event.altKey) {
      window.viewer.enableReflectionCreation();
    }
    if (event.button == 2) {
      if (window.viewer.view2D) {
        window.viewer.show2DPanel(window.viewer.panel2DIdx);
      }
      else {
        window.viewer.setCameraToDefaultPositionWithExperiment();
      }
    }
    if (event.button === 1) { // Middle mouse button
      window.viewer.isPanning = true;
      window.viewer.startMousePosition.x = event.clientX;
      window.viewer.startMousePosition.y = event.clientY;
    }
  });

  window.addEventListener('mouseout', function (event) {
    this.window.viewer.cursorActive = false;
  });

  window.addEventListener('mouseover', function (event) {
    this.window.viewer.cursorActive = true;
  });

  window.addEventListener('keydown', function (event) {
    if (event.key === "s") {
      window.viewer.toggleSidebar();
    }
  });
  window.viewer.addAxes();
  window.viewer.updateAxes(false);
  window.viewer.setCameraToDefaultPosition();
  window.viewer.requestRender();
}
