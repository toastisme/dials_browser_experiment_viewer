import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from "gsap";
import { MeshLine, MeshLineMaterial, MeshLineRaycast } from 'three.meshline';
import { ExptParser } from './ExptParser';

export class ExperimentViewer {
  constructor(exptParser, reflParser, isStandalone, colors = null) {

    /*
     * if isStandalone, the user can add and remove .expt and .refl files
     * manually. Else controlled via websocket
     */

    this.isStandalone = isStandalone;

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

    // Html elements
    this.headerText = window.document.getElementById("headerText");
    this.footerText = window.document.getElementById("footerText");
    this.sidebar = window.document.getElementById("sidebar");
    this.closeExptButton = document.getElementById("closeExpt");
    this.closeReflButton = document.getElementById("closeRefl");
    this.observedIndexedReflsCheckbox = document.getElementById("observedIndexedReflections");
    this.observedUnindexedReflsCheckbox = document.getElementById("observedUnindexedReflections");
    this.calculatedReflsCheckbox = document.getElementById("calculatedReflections");
    this.boundingBoxesCheckbox = document.getElementById("boundingBoxes");
    this.axesCheckbox = document.getElementById("showAxes");
    this.reflectionSize = document.getElementById("reflectionSize");

    // Bookkeeping for meshes
    this.panelOutlineMeshes = {};
    this.panelMeshes = [];
    this.reflPointsObsUnindexed = [];
    this.reflPositionsUnindexed = [];
    this.reflPointsObsIndexed = [];
    this.reflPositionsIndexed = [];
    this.reflPointsCal = [];
    this.reflPositionsCal = []
    this.bboxMeshesUnindexed = [];
    this.bboxMeshesIndexed = [];
    this.beamMeshes = [];
    this.axesMeshes = [];
    this.sampleMesh = null;
    this.highlightReflectionMesh = null;
    this.visibleExpts = [];

    this.preventMouseClick = false;
    this.cursorActive = true;
    this.lastClickedPanelPosition = null
    this.loadingImages = false;

    this.hightlightColor = new THREE.Color(this.colors["highlight"]);
    this.panelColor = new THREE.Color(this.colors["panel"]);
    this.reflSprite = new THREE.TextureLoader().load("resources/disc.png");

    this.displayingTextFromHTMLEvent = false;

    this.updateReflectionCheckboxStatus();
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
        "command": "update_lineplot",
        "panel_idx": panelIdx,
        "panel_pos": panelPos,
        "name": name
      }
    );
    this.serverWS.send(data);
  }

  static defaultColors() {
    return {
      "background": 0x222222,
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
      "panel" : 0x5d7d99,
      "highlight": 0xFFFFFF,
      "beam": 0xFFFFFF,
      "bbox": 0xFFFFFF,
      "axes": [0xffaaaa, 0xaaffaa, 0xaaaaff],
      "highlightBbox": 0x59b578
    };
  }

  static cameraPositions() {
    return {
      "default": new THREE.Vector3(0, 0, -1000),
      "defaultWithExperiment": new THREE.Vector3(-1000, 0, 0),
      "centre": new THREE.Vector3(0, 0, 0)
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
      "highlightBboxSize": 4
    };
  }

  toggleSidebar() {
    this.sidebar.style.display = this.sidebar.style.display === 'block' ? 'none' : 'block';
  }

  showSidebar() {
    this.sidebar.style.display = 'block';
  }

  updateObservedIndexedReflections(val = null) {
    if (val !== null) {
      this.observedIndexedReflsCheckbox.checked = val;
    }
    const showBbox = this.observedIndexedReflsCheckbox.checked && this.boundingBoxesCheckbox.checked;
    for (var i = 0; i < this.reflPointsObsIndexed.length; i++){
      this.reflPointsObsIndexed[i][0].visible = this.observedIndexedReflsCheckbox.checked && this.visibleExpts[i];
    }
    this.requestRender();
  }

  updateObservedUnindexedReflections(val = null) {
    if (val !== null) {
      this.observedUnindexedReflsCheckbox.checked = val;
    }
    const showBbox = this.observedUnindexedReflsCheckbox.checked && this.boundingBoxesCheckbox.checked;
    for (var i = 0; i < this.reflPointsObsUnindexed.length; i++){
      this.reflPointsObsUnindexed[i][0].visible = this.observedUnindexedReflsCheckbox.checked && this.visibleExpts[i];
    }
    this.requestRender();
  }


  updateCalculatedReflections(val = null) {
    if (val !== null) {
      this.calculatedReflsCheckbox.checked = val;
    }
    for (var i = 0; i < this.reflPointsCal.length; i++) {
      this.reflPointsCal[i].visible = this.calculatedReflsCheckbox.checked;
    }
    this.requestRender();
  }

  updateBoundingBoxes(val = null) {
    if (val !== null) {
      this.boundingBoxesCheckbox.checked = val;
    }
    if (this.observedIndexedReflsCheckbox.checked && this.boundingBoxesCheckbox.checked) {
      for (var i = 0; i < this.bboxMeshesIndexed.length; i++) {
        for (var j = 0; j < this.bboxMeshesIndexed[i].length; j++){
          this.bboxMeshesIndexed[i][j].visible = this.visibleExpts[i];
        }
      }
    }
    else {
      for (var i = 0; i < this.bboxMeshesIndexed.length; i++) {
        for (var j = 0; j < this.bboxMeshesIndexed[i].length; j++){
          this.bboxMeshesIndexed[i][j].visible = false;
        }
      }
    }
    if (this.observedUnindexedReflsCheckbox.checked && this.boundingBoxesCheckbox.checked) {
      for (var i = 0; i < this.bboxMeshesUnindexed.length; i++) {
        for (var j = 0; j < this.bboxMeshesUnindexed[i].length; j++){
          this.bboxMeshesUnindexed[i][j].visible = this.visibleExpts[i];

        }
      }
    }
    else {
      for (var i = 0; i < this.bboxMeshesUnindexed.length; i++) {
        for (var j = 0; j < this.bboxMeshesUnindexed[i].length; j++){
          this.bboxMeshesUnindexed[i][j].visible = false;
        }
      }
    }
    this.requestRender();
  }

  updateAxes(val = null) {
    if (val !== null) {
      this.axesCheckbox.checked = val;
    }
    for (var i = 0; i < this.axesMeshes.length; i++) {
      this.axesMeshes[i].visible = this.axesCheckbox.checked;
    }
    this.requestRender();
  }

  updateReflectionSize() {
    if (!this.hasReflectionTable()) {
      return;
    }
    if (this.refl.hasXYZObsData()) {
      if (this.reflPointsObsUnindexed) {
        const reflPointsUnindexed = [];
        for (var i = 0; i < this.reflPositionsUnindexed.length; i++){
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
        for (var p = 0; p < reflPointsUnindexed.length; p++){
          window.scene.add(reflPointsUnindexed[p][0]);
        }
        this.reflPointsObsUnindexed = reflPointsUnindexed;
        this.updateObservedUnindexedReflections();
      }
      if (this.reflPointsObsIndexed) {
        const reflPointsObsIndexed = [];

        for (var i = 0; i < this.reflPositionsIndexed.length; i++){
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
        for (var p = 0; p < reflPointsObsIndexed.length; p++){
          window.scene.add(reflPointsObsIndexed[p][0]);
        }
        this.reflPointsObsIndexed = reflPointsObsIndexed;
        this.updateObservedIndexedReflections();
      }
    }

    if (this.refl.hasXYZCalData() && this.reflPositionsCal) {
      const reflGeometryCal = new THREE.BufferGeometry();
      reflGeometryCal.setAttribute(
        "position", new THREE.Float32BufferAttribute(this.reflPositionsCal, 3)
      );

      const reflMaterialCal = new THREE.PointsMaterial({
        size: this.reflectionSize.value,
        transparent: true,
        map: this.reflSprite,
        color: this.colors["reflectionCal"]
      });
      const pointsCal = new THREE.Points(reflGeometryCal, reflMaterialCal);
      this.clearReflPointsCal();
      window.scene.add(pointsCal);
      this.reflPointsCal = [pointsCal];
      this.updateCalculatedReflections();
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

    for (var i = 0; i < this.panelMeshes.length; i++) {
      window.scene.remove(this.panelMeshes[i]);
      this.panelMeshes[i].geometry.dispose();
      this.panelMeshes[i].material.dispose();
    }
    this.panelMeshes = [];

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

    this.expt.clearExperiment();
    this.hideCloseExptButton();

    this.clearReflectionTable();
    this.clearExperimentList();
    this.requestRender();
  }

  addExperiment = async (file) => {
    this.clearExperiment();
    this.clearReflectionTable();
    await this.expt.parseExperiment(file);
    console.assert(this.hasExperiment());
    for (var i = 0; i < this.expt.getNumDetectorPanels(); i++) {
      this.addDetectorPanelOutline(i);
    }
    this.addBeam();
    this.addSample();
    this.setCameraToDefaultPositionWithExperiment();
    this.showSidebar();
    if (this.isStandalone) {
      this.showCloseExptButton();
    }
    this.requestRender();
    this.updateExperimentList();
  }

  addExperimentFromJSONString = async (jsonString) => {
    this.clearExperiment();
    this.clearReflectionTable();
    await this.expt.parseExperimentJSON(jsonString);
    console.assert(this.hasExperiment());
    for (var i = 0; i < this.expt.getNumDetectorPanels(); i++) {
      this.addDetectorPanelOutline(i);
    }
    this.addBeam();
    this.addSample();
    this.setCameraToDefaultPositionWithExperiment();
    this.showSidebar();
    if (this.isStandalone) {
      this.showCloseExptButton();
    }
    this.requestRender();
    this.loadingImages=false;
    this.displayDefaultHeaderText();
    this.updateExperimentList();
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
      window.scene.remove(this.reflPointsCal[i]);
      this.reflPointsCal[i].geometry.dispose();
      this.reflPointsCal[i].material.dispose();
    }
    this.reflPointsCal = [];
  }

  clearBoundingBoxes() {
    for (var i = 0; i < this.bboxMeshesIndexed.length; i++) {
      for (var j = 0; j < this.bboxMeshesIndexed[i].length; j++) {
        window.scene.remove(this.bboxMeshesIndexed[i][j]);
        this.bboxMeshesIndexed[i][j].geometry.dispose();
        this.bboxMeshesIndexed[i][j].material.dispose();
    }
  }
    this.bboxMeshesIndexed = [];

    for (var i = 0; i < this.bboxMeshesUnindexed.length; i++) {
      for (var j = 0; j < this.bboxMeshesUnindexed[i].length; j++) {
        window.scene.remove(this.bboxMeshesUnindexed[i][j]);
        this.bboxMeshesUnindexed[i][j].geometry.dispose();
        this.bboxMeshesUnindexed[i][j].material.dispose();
    }
  }
    this.bboxMeshesUnindexed = [];
  }

  clearReflectionTable() {
    this.clearReflPointsObsIndexed();
    this.clearReflPointsObsUnindexed();
    this.clearReflPointsCal();
    this.clearBoundingBoxes();
    this.refl.clearReflectionTable();
    this.updateReflectionCheckboxStatus();
    this.setDefaultReflectionsDisplay();
    this.hideCloseReflButton();
    this.requestRender();
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

  getBboxMesh(bbox, bboxMaterial, viewer, pOrigin, fa, sa, pxSize) {
    const c1 = viewer.mapPointToGlobal([bbox[0], bbox[2]], pOrigin, fa, sa, pxSize);
    const c2 = viewer.mapPointToGlobal([bbox[1], bbox[2]], pOrigin, fa, sa, pxSize);
    const c3 = viewer.mapPointToGlobal([bbox[1], bbox[3]], pOrigin, fa, sa, pxSize);
    const c4 = viewer.mapPointToGlobal([bbox[0], bbox[3]], pOrigin, fa, sa, pxSize);
    const corners = [c1, c2, c3, c4, c1];

    const bboxGeometry = new THREE.BufferGeometry().setFromPoints(corners);
    const bboxLines = new THREE.Line(bboxGeometry, bboxMaterial);
    return bboxLines;
  }

  addReflectionsFromData(reflData) {

    if (!this.hasExperiment()) {
      console.warn("Tried to add reflections but no experiment has been loaded");
      this.clearReflectionTable();
      return;
    }

    this.clearReflectionTable();

    this.refl.reflData = reflData;
    this.refl.refl = "reflData";
    const indexedMap = {};
    var numIndexed = 0;

    const positionsObsIndexed = new Array();
    const positionsObsUnindexed = new Array();
    const positionsCal = new Array();
    const bboxMaterial = new THREE.LineBasicMaterial({ color: this.colors["bbox"] });

    const panelKeys = Object.keys(reflData);
    const refl = reflData[panelKeys[0]][0];

    const containsXYZObs = "xyzObs" in refl;
    const containsXYZCal = "xyzCal" in refl;
    const containsMillerIndices = "millerIdx" in refl;

    for (var i = 0; i < panelKeys.length; i++) {
      const panelIdx = parseInt(panelKeys[i])

      const panelReflections = reflData[panelKeys[i]];
      const panelData = this.expt.getPanelDataByIdx(panelIdx);

      const fa = panelData["fastAxis"];
      const sa = panelData["slowAxis"];
      const pOrigin = panelData["origin"];
      const pxSize = [panelData["pxSize"].x, panelData["pxSize"].y];

      for (var j = 0; j < panelReflections.length; j++) {

        if (containsXYZObs) {

          const xyzObs = panelReflections[j]["xyzObs"];
          const globalPosObs = this.mapPointToGlobal(xyzObs, pOrigin, fa, sa, pxSize);

          const bboxMesh = this.getBboxMesh(panelReflections[j]["bbox"], bboxMaterial, this, pOrigin, fa, sa, pxSize);

          if (containsMillerIndices && panelReflections[j]["indexed"]) {
            positionsObsIndexed.push(globalPosObs.x);
            positionsObsIndexed.push(globalPosObs.y);
            positionsObsIndexed.push(globalPosObs.z);
            this.bboxMeshesIndexed.push(bboxMesh);
            indexedMap[numIndexed] = panelReflections[j]["millerIdx"];
            numIndexed++;
          }
          else {
            positionsObsUnindexed.push(globalPosObs.x);
            positionsObsUnindexed.push(globalPosObs.y);
            positionsObsUnindexed.push(globalPosObs.z);
            this.bboxMeshesUnindexed.push(bboxMesh);
          }
          window.scene.add(bboxMesh);

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

        const reflGeometryObsIndexed = new THREE.BufferGeometry();
        reflGeometryObsIndexed.setAttribute(
          "position", new THREE.Float32BufferAttribute(positionsObsIndexed, 3)
        );

        const reflMaterialObsIndexed = new THREE.PointsMaterial({
          size: this.reflectionSize.value,
          map: this.reflSprite,
          transparent: true,
          color: this.colors["reflectionObsIndexed"]
        });
        const pointsObsIndexed = new THREE.Points(reflGeometryObsIndexed, reflMaterialObsIndexed);
        window.scene.add(pointsObsIndexed);
        this.reflPointsObsIndexed = [pointsObsIndexed];
        this.reflPositionsIndexed = positionsObsIndexed;

      }
      const reflGeometryObsUnindexed = new THREE.BufferGeometry();
      reflGeometryObsUnindexed.setAttribute(
        "position", new THREE.Float32BufferAttribute(positionsObsUnindexed, 3)
      );

      const reflMaterialObsUnindexed = new THREE.PointsMaterial({
        size: this.reflectionSize.value,
        transparent: true,
        map: this.reflSprite,
        color: this.colors["reflectionObsUnindexed"]
      });
      const pointsObsUnindexed = new THREE.Points(reflGeometryObsUnindexed, reflMaterialObsUnindexed);
      window.scene.add(pointsObsUnindexed);
      this.reflPointsObsUnindexed = [pointsObsUnindexed];
      this.reflPositionsUnindexed = positionsObsUnindexed;
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

    this.updateReflectionCheckboxStatus();
    this.setDefaultReflectionsDisplay();
    if (this.lastClickedPanelPosition != null) {
      this.sendClickedPanelPosition(
        this.lastClickedPanelPosition["panelIdx"],
        this.lastClickedPanelPosition["panelPos"],
        this.lastClickedPanelPosition["name"]

      );
    }
    this.refl.indexedMap = indexedMap;
  }

  addReflections() {

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


    for (var i = 0; i < this.expt.numExperiments(); i++){
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

    for (var i = 0; i < this.expt.getNumDetectorPanels(); i++) {

      const panelReflections = this.refl.getReflectionsForPanel(i);
      if (panelReflections == undefined){continue;}
      const panelData = this.expt.getPanelDataByIdx(i);

      const fa = panelData["fastAxis"];
      const sa = panelData["slowAxis"];
      const pOrigin = panelData["origin"];
      const pxSize = [panelData["pxSize"].x, panelData["pxSize"].y];

      for (var j = 0; j < panelReflections.length; j++) {

        const exptID = panelReflections[j]["exptID"];

        if (containsXYZObs) {

          const xyzObs = panelReflections[j]["xyzObs"];
          const globalPosObs = this.mapPointToGlobal(xyzObs, pOrigin, fa, sa, pxSize);

          const bboxMesh = this.getBboxMesh(panelReflections[j]["bbox"], bboxMaterial, this, pOrigin, fa, sa, pxSize);

          if (containsMillerIndices && panelReflections[j]["indexed"]) {
            positionsObsIndexed[exptID].push(globalPosObs.x);
            positionsObsIndexed[exptID].push(globalPosObs.y);
            positionsObsIndexed[exptID].push(globalPosObs.z);
            bboxMeshesIndexed[exptID].push(bboxMesh);
          }
          else {
            positionsObsUnindexed[exptID].push(globalPosObs.x);
            positionsObsUnindexed[exptID].push(globalPosObs.y);
            positionsObsUnindexed[exptID].push(globalPosObs.z);
            bboxMeshesUnindexed[exptID].push(bboxMesh);
          }
          window.scene.add(bboxMesh);

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

        for (var exptID = 0; exptID < positionsObsIndexed.length; exptID++){
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
      for (var exptID = 0; exptID < positionsObsUnindexed.length; exptID++){
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

    this.updateReflectionCheckboxStatus();
    this.setDefaultReflectionsDisplay();
  }

  highlightReflection(reflData, focusOnPanel = true) {

    const bboxSize = ExperimentViewer.sizes()["highlightBboxSize"];
    const pos = reflData["panelPos"];
    const panelName = reflData["name"];

    if (focusOnPanel) {
      var panel = this.panelMeshes[reflData["panelIdx"]];
      window.viewer.zoomInOnPanel(panel, 1.1, panelName, pos);
    }


    if (this.highlightReflectionMesh) {
      window.scene.remove(this.highlightReflectionMesh);
      this.highlightReflectionMesh.geometry.dispose();
      this.highlightReflectionMesh.material.dispose();
      this.highlightReflectionMesh = null;
    }

    const panelData = this.expt.getPanelDataByIdx(reflData["panelIdx"]);
    const bbox = [
      pos[1] - bboxSize,
      pos[1] + bboxSize,
      pos[0] - bboxSize,
      pos[0] + bboxSize
    ]

    const bboxMaterial = new THREE.LineBasicMaterial({ color: this.colors["highlightBbox"] });

    const mesh = this.getBboxMesh(
      bbox,
      bboxMaterial,
      this,
      panelData["origin"],
      panelData["fastAxis"],
      panelData["slowAxis"],
      [panelData["pxSize"]["x"], panelData["pxSize"]["y"]]
    );

    window.scene.add(mesh);
    this.highlightReflectionMesh = mesh;

  }

  mapPointToGlobal(point, pOrigin, fa, sa, scaleFactor = [1, 1]) {
    const pos = pOrigin.clone();
    pos.add(fa.clone().normalize().multiplyScalar(point[0] * scaleFactor[0]));
    pos.add(sa.clone().normalize().multiplyScalar(point[1] * scaleFactor[1]));
    return pos;
  }

  setDefaultReflectionsDisplay() {

    /**
     * If both observed and calculated reflections are available,
     * show observed by default.
     */

    if (!this.hasReflectionTable()) {
      this.observedIndexedReflsCheckbox.checked = false;
      this.observedUnindexedReflsCheckbox.checked = false;
      this.calculatedReflsCheckbox.checked = false;
      this.boundingBoxesCheckbox.checked = false;
      return;
    }

    if (this.reflPointsObsIndexed.length > 0) {
      this.updateObservedIndexedReflections(true);
      this.observedIndexedReflsCheckbox.checked = true;
      this.updateCalculatedReflections(false);
      this.calculatedReflsCheckbox.checked = false;
    }
    if (this.reflPointsObsUnindexed.length > 0) {
      this.updateObservedUnindexedReflections(true);
      this.observedUnindexedReflsCheckbox.checked = true;
      this.updateCalculatedReflections(false);
      this.calculatedReflsCheckbox.checked = false;
    }
    else if (this.reflPointsCal.length > 0) {
      this.updateCalculatedReflections(true);
      this.calculatedReflsCheckbox.checked = false;
      this.observedIndexedReflsCheckbox.checked = false;
      this.observedUnindexedReflsCheckbox.checked = false;
    }
    /*
     * Bboxes off by default as they can be expensive for 
     * large numbers of reflections
     */
    this.updateBoundingBoxes(false);
    this.boundingBoxesCheckbox.checked = false;

  }

  updateReflectionCheckboxStatus() {
    if (!this.hasReflectionTable()) {
      this.observedIndexedReflsCheckbox.disabled = true;
      this.observedUnindexedReflsCheckbox.disabled = true;
      this.calculatedReflsCheckbox.disabled = true;
      this.boundingBoxesCheckbox.disabled = true;
      return;
    }
    this.observedUnindexedReflsCheckbox.disabled = !this.refl.hasXYZObsData();
    this.observedIndexedReflsCheckbox.disabled = !this.refl.hasMillerIndicesData();
    this.calculatedReflsCheckbox.disabled = !this.refl.hasXYZCalData();
    this.boundingBoxesCheckbox.disabled = !this.refl.hasBboxData();
  }

  getPanelTexture(idx) {

    const imageData = this.expt.imageData[0][idx];
    const panelSize = this.expt.imageData[1];

    var canvas = document.createElement('canvas');
    canvas.width = panelSize[0];
    canvas.height = panelSize[1];
    var context = canvas.getContext('2d');
    context.fillRect(0, 0, canvas.width, canvas.height);
    const contextData = context.getImageData(
      0, 0, canvas.width, canvas.height
    );
    const data = contextData.data;
    var idx = 0
    for (var i = 0; i < data.length; i += 4) {
      data[i] = imageData[idx] * 255; // red
      data[i + 1] = imageData[idx] * 255; // green
      data[i + 2] = imageData[idx] * 255; // blue
      idx++;
    }
    context.putImageData(contextData, 0, 0);

    var texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;

  }

  addDetectorPanelOutline(idx) {

    var corners = this.expt.getDetectorPanelCorners(idx);
    corners.push(corners[0]);
    var panelName = this.expt.getDetectorPanelName(idx);

    const panelGeometry = new THREE.PlaneGeometry(192, 192);
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
      const panelTexture = this.getPanelTexture(idx);
      panelMaterial = new THREE.MeshBasicMaterial({
        map: panelTexture
      })
    }
    const plane = new THREE.Mesh(panelGeometry, panelMaterial);
    plane.name = panelName;


    var count = 0;
    var idxs = [1, 2, 0, 3]

    // Rotate if not facing the origin
    var normalVec = this.expt.getDetectorPanelNormal(idx);
    var posVec = corners[0].clone();
    posVec.add(corners[1].clone());
    posVec.add(corners[2].clone());
    posVec.add(corners[3].clone());
    posVec.divideScalar(4).normalize();
    if (posVec.dot(normalVec) < 0) {
      idxs = [0, 3, 1, 2];
    }

    const scaleFactor = 1.01 // ensure reflections appear in front of image
    for (var i = 0; i < 12; i += 3) {
      plane.geometry.attributes.position.array[i] = corners[idxs[count]].x * scaleFactor;
      plane.geometry.attributes.position.array[i + 1] = corners[idxs[count]].y * scaleFactor;
      plane.geometry.attributes.position.array[i + 2] = corners[idxs[count]].z * scaleFactor;
      count++;
    }

    window.scene.add(plane);
    this.panelMeshes.push(plane);

    const line = new MeshLine();
    line.setPoints(corners);
    const material = new MeshLineMaterial({
      lineWidth: 7,
      color: this.colors["panel"],
      fog: true
    });
    const mesh = new THREE.Mesh(line, material);
    this.panelOutlineMeshes[panelName] = mesh;
    window.scene.add(mesh);

  }

  addBeam() {
    var beamLength = 800.;
    var bd = this.expt.getBeamDirection();;

    var incidentVertices = []
    incidentVertices.push(
      new THREE.Vector3(bd.x * -beamLength, bd.y * -beamLength, bd.z * -beamLength)
    );
    incidentVertices.push(
      new THREE.Vector3(bd.x * -beamLength * .5, bd.y * -beamLength * .5, bd.z * -beamLength * .5)
    );
    incidentVertices.push(new THREE.Vector3(0, 0, 0));
    const incidentLine = new MeshLine();
    incidentLine.setPoints(incidentVertices);
    const incidentMaterial = new MeshLineMaterial({
      lineWidth: 5,
      color: this.colors["beam"],
      fog: true,
      transparent: true,
      opacity: 0.25,
      depthWrite: false
    });
    const incidentMesh = new THREE.Mesh(incidentLine, incidentMaterial);
    incidentMesh.raycast = MeshLineRaycast;
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
    const outgoingLine = new MeshLine();
    outgoingLine.setPoints(outgoingVertices);
    const outgoingMaterial = new MeshLineMaterial({
      lineWidth: 5,
      color: this.colors["beam"],
      transparent: true,
      opacity: 0.0,
      fog: true,
      depthWrite: false
    });
    const outgoingMesh = new THREE.Mesh(outgoingLine, outgoingMaterial);
    outgoingMesh.raycast = MeshLineRaycast;
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
      const line = new MeshLine();
      line.setPoints(vertices);
      const Material = new MeshLineMaterial({
        lineWidth: 5,
        color: color,
        fog: true,
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
    this.axesCheckbox.disabled = false;
  }

  setCameraSmooth(position) {
    this.rotateToPos(position);
    window.controls.update();
  }

  setCameraToDefaultPosition() {
    this.setCameraSmooth(ExperimentViewer.cameraPositions()["default"]);
  }

  setCameraToDefaultPositionWithExperiment() {
    this.setCameraSmooth(ExperimentViewer.cameraPositions()["defaultWithExperiment"]);
  }

  setCameraToCentrePosition() {
    this.setCameraSmooth(ExperimentViewer.cameraPositions()["centre"]);
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
    this.displayHeaderText(this.expt.imageFilenames);
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
    const intersects = window.rayCaster.intersectObjects(this.panelMeshes);
    window.rayCaster.setFromCamera(window.mousePosition, window.camera);
    if (intersects.length > 0) {
      const name = intersects[0].object.name;
      const panelIdx = this.expt.getPanelIdxByName(name);
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

  showLoadingImagesMsg(){
    this.displayHeaderText("Loading images...");
    this.loadingImages = true;
  }

  updateGUIInfo() {

    function updatePanelInfo(viewer) {
      const intersects = window.rayCaster.intersectObjects(viewer.panelMeshes);
      window.rayCaster.setFromCamera(window.mousePosition, window.camera);
      if (intersects.length > 0) {
        const name = intersects[0].object.name;
        viewer.displayHeaderText(name + " [" + viewer.getPanelPositionAsString(intersects[0].point, name) + "]");
        viewer.highlightObject(viewer.panelOutlineMeshes[name]);
      }
    }

    function updateReflectionInfo(viewer) {
      if (!viewer.observedIndexedReflsCheckbox.checked){return;}
      for (var i = 0; i < viewer.reflPointsObsIndexed.length; i++){
        const intersects = window.rayCaster.intersectObjects(viewer.reflPointsObsIndexed[i]);
        window.rayCaster.setFromCamera(window.mousePosition, window.camera);
        if (intersects.length > 0) {
          for (var i = 0; i < intersects.length; i++) {
            const millerIdx = viewer.refl.getMillerIndexById(intersects[i].index);
            viewer.appendHeaderText(" (" + millerIdx[0] + ", " + millerIdx[1] + ", " + millerIdx[2] + ")");
          }
        }
    }
  }

    function updateBeamInfo(viewer) {
      if (viewer.beamHidden()) {
        return;
      }
      const intersects = window.rayCaster.intersectObjects(viewer.beamMeshes);
      window.rayCaster.setFromCamera(window.mousePosition, window.camera);
      if (intersects.length > 0) {
        const text = "<b>beam: </b>" + viewer.expt.getBeamSummary();
        viewer.displayHeaderText(text);
      }
    }

    function updateCrystalInfo(viewer) {
      if (viewer.sampleHidden()) {
        return;
      }
      if (viewer.expt.getCrystalSummary() == null) {
        return;
      }
      const intersects = window.rayCaster.intersectObjects([viewer.sampleMesh]);
      window.rayCaster.setFromCamera(window.mousePosition, window.camera);
      if (intersects.length > 0) {
        const text = "<b>crystal: </b>" + viewer.expt.getCrystalSummary();
        viewer.displayHeaderText(text);
      }

    }

    if (this.displayingTextFromHTMLEvent) { return; }
    if (!this.cursorActive) { return; }
    if (this.loadingImages) { return; }
    this.displayDefaultHeaderText();
    updatePanelInfo(this);
    updateReflectionInfo(this);
    updateBeamInfo(this);
    updateCrystalInfo(this);
  }

  getPanelPosition(globalPos, panelName) {
    const data = this.expt.getPanelDataByName(panelName);
    const pos = data["origin"].sub(globalPos);
    const fa = data["fastAxis"].normalize();
    const sa = data["slowAxis"].normalize();
    const panelX = (pos.x * fa.x + pos.y * fa.y + pos.z * fa.z) / data["pxSize"].x;
    const panelY = (pos.x * sa.x + pos.y * sa.y + pos.z * sa.z) / data["pxSize"].y;
    return [Math.floor(-panelY), Math.floor(-panelX)];

  }

  getPanelPositionAsString(globalPos, panelName) {
    const [panelX, panelY] = this.getPanelPosition(globalPos, panelName);
    return panelX + ", " + panelY;

  }

  getPanelCentroid(panelName) {
    return this.expt.getPanelCentroid(panelName);
  }

  resetPanelColors() {
    for (var i in this.panelOutlineMeshes) {
      this.panelOutlineMeshes[i].material.color = this.panelColor;
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
    const intersects = rayCaster.intersectObjects(this.panelMeshes);
    if (intersects.length > 0) {
      return intersects[0].point;
    }

  }

  getClickedPanelCentroid() {
    window.rayCaster.setFromCamera(window.mousePosition, window.camera);
    const intersects = rayCaster.intersectObjects(this.panelMeshes);
    if (intersects.length > 0) {
      return window.viewer.getPanelCentroid(intersects[0].object.name);
    }
  }

  getClickedPanelMesh() {
    window.rayCaster.setFromCamera(window.mousePosition, window.camera);
    const intersects = rayCaster.intersectObjects(this.panelMeshes);
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
      onUpdate: function() {
        window.camera.lookAt(pos);
        window.viewer.requestRender();
      }
    });
  }

  zoomInOnPanel(panel, fitOffset = 0.1, panelName = null, panelPos = null) {

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    const box = new THREE.Box3();

    box.makeEmpty();
    box.expandByObject(panel);

    box.getSize(size);
    box.getCenter(center);

    const maxSize = Math.max(size.x, size.y, size.z);
    const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * window.camera.fov / 360));
    const fitWidthDistance = fitHeightDistance / window.camera.aspect;
    const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);

    const direction = center.clone()
      .normalize()
      .multiplyScalar(distance);

    const target = direction.clone().multiplyScalar(-1);
    gsap.to(window.camera.position, {
      duration: 1,
      x: target.x,
      y: target.y,
      z: target.z,
      onUpdate: function() {
        window.camera.lookAt(target);
        window.viewer.requestRender();
      },
      onComplete: function() {
        if (panelName != null && panelPos != null) {
          window.viewer.displayHeaderText(panelName + " [" + panelPos[0] + ", " + panelPos[1] + "]");
        }

      }

    });
    window.controls.update();
  }

	toggleExperimentList(){
		document.getElementById("experimentDropdown").classList.toggle("show");
    var dropdownIcon = document.getElementById("dropdownIcon");
    dropdownIcon.classList.toggle("fa-chevron-down");
    dropdownIcon.classList.toggle("fa-chevron-right"); 
	}

  toggleExptVisibility(exptIDLabel){
    var exptID = parseInt(exptIDLabel.split("-").pop());
    this.visibleExpts[exptID] = !this.visibleExpts[exptID];
    this.updateObservedIndexedReflections();
    this.updateObservedUnindexedReflections();
    this.updateBoundingBoxes();
    var dropdownIcon = document.getElementById("exptID-dropdown-icon-"+exptID.toString());
    dropdownIcon.classList.toggle("fa-check");
  }

  toggleAllExptVisibility(){
    var dropdownIcon = document.getElementById("exptID-dropdown-icon-all");
    dropdownIcon.classList.toggle("fa-check");
    var visible = dropdownIcon.classList.contains("fa-check");
    for (var exptID = 0; exptID < this.visibleExpts.length; exptID++){
      this.visibleExpts[exptID] = visible;
      var dropdownIcon = document.getElementById("exptID-dropdown-icon-"+exptID.toString());
      if (dropdownIcon.classList.contains("fa-check") !== visible){
        dropdownIcon.classList.toggle("fa-check");
      }
    }
    this.updateObservedIndexedReflections();
    this.updateObservedUnindexedReflections();
    this.updateBoundingBoxes();
  }

  clearExperimentList(){
    var dropdownContent = document.getElementById("experimentDropdown");
    dropdownContent.innerHTML = ""; 
  }

  updateExperimentList() {
    var maxLabelSize = 22;
    var minNumForAllButton = 4;

    var exptIDs = this.expt.getExptIDs();
    var exptLabels = this.expt.getExptLabels();
    var addAllButton = exptLabels.length > minNumForAllButton;
    var firstLabel = null;
    const visibleExpts = [];
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
        icon.id = "exptID-dropdown-icon-"+exptIDs[i];
        if (i !== 0){
          icon.classList.toggle("fa-check");
        }

        
        var exptLabel = exptLabels[i];
        if (exptLabel.length > maxLabelSize){
          exptLabel = exptLabel.slice(0,19) + "...";
        }
        label.textContent = exptLabel;
        label.id = "exptID-"+exptIDs[i];
        
        label.appendChild(icon);
        
        label.addEventListener('click', (event) => {
            this.toggleExptVisibility(event.target.id);
        });

        if (addAllButton && firstLabel === null){
          firstLabel = label;
        }

        dropdownContent.appendChild(label);
        dropdownContent.appendChild(document.createElement("br"));
        visibleExpts.push(i === 0 ? true : false);
    }
    if (addAllButton){
      console.assert(firstLabel !== null);
      var label = document.createElement("label");
      label.classList.add("experiment-label"); 
      
      var icon = document.createElement("i");
      icon.classList.add("fa", "fa-check"); 
      icon.style.float = "right"; 
      icon.id = "exptID-dropdown-icon-all";
      icon.classList.toggle("fa-check");
      
      var exptLabel = "All";
      label.textContent = exptLabel;
      label.id = "exptID-all";
      
      label.appendChild(icon);
      
      label.addEventListener('click', (event) => {
          this.toggleAllExptVisibility();
      });

      dropdownContent.insertBefore(label, firstLabel);
      dropdownContent.insertBefore(label, firstLabel);

    }
    this.visibleExpts = visibleExpts;
  }


  animate() {
    if (!this.renderRequested) {
      return;
    }
    window.viewer.resetPanelColors();
    window.viewer.updateOriginObjectsOpacity();
    window.viewer.updateGUIInfo();
    window.controls.update();
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
    100,
    10000
  );
  window.renderer.render(window.scene, window.camera);
  window.rayCaster = new THREE.Raycaster(); // used for all raycasting

  // Controls
  window.controls = new OrbitControls(window.camera, window.renderer.domElement);
  window.controls.maxDistance = 3000;
  window.controls.enablePan = false;
  window.controls.update();
  window.controls.addEventListener("change", function() { window.viewer.requestRender(); });

  // Events
  window.mousePosition = new THREE.Vector2();
  window.addEventListener("mousemove", function(e) {
    window.mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
    window.mousePosition.y = - (e.clientY / window.innerHeight) * 2 + 1;
    window.viewer.requestRender();
  });

  window.addEventListener("resize", function() {
    window.camera.aspect = window.innerWidth / window.innerHeight;
    window.camera.updateProjectionMatrix();
    window.renderer.setSize(window.innerWidth, window.innerHeight);
    window.viewer.requestRender();
  });

  window.addEventListener("dragstart", (event) => {
    dragged = event.target;
  });

  window.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  window.addEventListener('drop', function(event) {

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

  window.addEventListener('dblclick', function(event) {
    var panel = window.viewer.getClickedPanelMesh();
    if (panel) {
      window.viewer.zoomInOnPanel(panel);
    }
  });

  window.addEventListener('click', function(event) {
    if (event.button === 0) {
      window.viewer.onLeftClick();
    }
  });

  window.addEventListener('mousedown', function(event) {
    if (event.button == 2) {
      window.viewer.rotateToPos(ExperimentViewer.cameraPositions()["defaultWithExperiment"]);
    }
  });

  window.addEventListener('mouseout', function(event) {
    this.window.viewer.cursorActive = false;
  });

  window.addEventListener('mouseover', function(event) {
    this.window.viewer.cursorActive = true;
  });

  window.addEventListener('keydown', function(event) {
    if (event.key === "s") {
      window.viewer.toggleSidebar();
    }
  });
  window.viewer.addAxes();
  window.viewer.updateAxes(false);
  window.viewer.setCameraToDefaultPosition();
  window.viewer.requestRender();
}
