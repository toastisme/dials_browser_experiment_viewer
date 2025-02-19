import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from "gsap";
import { MeshLine, MeshLineMaterial, MeshLineRaycast } from 'three.meshline';
import pako from 'pako';

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
    this.reflectionSize = document.getElementById("reflectionSize");
    this.userContrast = document.getElementById("userContrast");

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
    this.reflSprite = new THREE.TextureLoader().load("resources/disc.png");

    this.displayingTextFromHTMLEvent = false;

    this.updateReflectionCheckboxEnabledStatus();
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
        "command": "clicked_on_panel",
        "panel_idx": panelIdx,
        "panel_pos": panelPos,
        "name": name,
        "expt_id": this.visibleExptID
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
      "reflectionIntegrated": 0xffc25c,
      "panel": 0x5d7d99,
      "highlight": 0xFFFFFF,
      "beam": 0xFFFFFF,
      "bbox": 0xFFFFFF,
      "axes": [0xffaaaa, 0xaaffaa, 0xaaaaff],
      "highlightBbox": 0x59b578,
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
      "highlightBboxSize": 2
    };
  }

  toggleSidebar() {
    this.sidebar.style.display = this.sidebar.style.display === 'block' ? 'none' : 'block';
  }

  showSidebar() {
    this.sidebar.style.display = 'block';
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

    this.requestRender();
  }

  updateObservedIndexedReflections(val = null) {
    if (val !== null) {
      this.observedIndexedReflsCheckbox.checked = val;
    }
    for (var i = 0; i < this.reflPointsObsIndexed.length; i++) {
      this.reflPointsObsIndexed[i][0].visible = this.observedIndexedReflsCheckbox.checked && this.visibleExptID === i;
    }
    this.requestRender();
  }

  updateObservedUnindexedReflections(val = null) {
    if (val !== null) {
      this.observedUnindexedReflsCheckbox.checked = val;
    }
    for (var i = 0; i < this.reflPointsObsUnindexed.length; i++) {
      this.reflPointsObsUnindexed[i][0].visible = this.observedUnindexedReflsCheckbox.checked && this.visibleExptID === i;
    }
    this.requestRender();
  }


  updateCalculatedReflections(val = null) {
    if (val !== null) {
      this.calculatedReflsCheckbox.checked = val;
    }
    for (var i = 0; i < this.reflPointsCal.length; i++) {
      this.reflPointsCal[i][0].visible = this.calculatedReflsCheckbox.checked && this.visibleExptID === i;
    }
    this.requestRender();
  }

  updateIntegratedReflections(val = null) {
    if (val !== null) {
      this.integratedReflsCheckbox.checked = val;
    }
    for (var i = 0; i < this.reflPointsIntegrated.length; i++) {
      this.reflPointsIntegrated[i][0].visible = this.integratedReflsCheckbox.checked && this.visibleExptID === i;
    }
    this.requestRender();
  }

  updateBoundingBoxes(val = null) {
    if (val !== null) {
      this.boundingBoxesCheckbox.checked = val;
    }
    if (this.observedIndexedReflsCheckbox.checked && this.boundingBoxesCheckbox.checked) {
      for (var i = 0; i < this.bboxMeshesIndexed.length; i++) {
        for (var j = 0; j < this.bboxMeshesIndexed[i].length; j++) {
          this.bboxMeshesIndexed[i][j].visible = this.visibleExptID === i;
        }
      }
    }
    else {
      for (var i = 0; i < this.bboxMeshesIndexed.length; i++) {
        for (var j = 0; j < this.bboxMeshesIndexed[i].length; j++) {
          this.bboxMeshesIndexed[i][j].visible = false;
        }
      }
    }
    if (this.observedUnindexedReflsCheckbox.checked && this.boundingBoxesCheckbox.checked) {
      for (var i = 0; i < this.bboxMeshesUnindexed.length; i++) {
        for (var j = 0; j < this.bboxMeshesUnindexed[i].length; j++) {
          this.bboxMeshesUnindexed[i][j].visible = this.visibleExptID === i;

        }
      }
    }
    else {
      for (var i = 0; i < this.bboxMeshesUnindexed.length; i++) {
        for (var j = 0; j < this.bboxMeshesUnindexed[i].length; j++) {
          this.bboxMeshesUnindexed[i][j].visible = false;
        }
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
    if (this.refl.hasXYZObsData()) {
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
    }

    if (this.refl.hasXYZCalData() && this.reflPositionsCal) {
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

    this.expt.clearExperiment();
    this.hideCloseExptButton();

    this.clearReflectionTable();
    this.clearExperimentList();
    this.requestRender();
    this.updateReflectionCheckboxEnabledStatus();
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
    this.showSidebar();
    if (this.isStandalone) {
      this.showCloseExptButton();
    }
    this.requestRender();
    this.updateExperimentList();
    this.updatePanelMeshes();
  }

  addExperimentFromJSONString = async (jsonString, imageData=null) => {
    this.clearExperiment();
    this.clearReflectionTable();
    await this.expt.parseExperimentJSON(jsonString);
    if (imageData !== null){
      await this.expt.parseImageData(imageData);
    }
    console.assert(this.hasExperiment());

    this.allPanelMeshes = {};

    for (var panelIdx = 0; panelIdx < this.expt.getNumDetectorPanels(); panelIdx++) {
      for (var exptID = 0; exptID < this.expt.numExperiments(); exptID++) {
        this.addDetectorPanel(panelIdx, exptID, imageData !== null);
      }
    }
    this.addBeam();
    this.addSample();
    this.setCameraToDefaultPositionWithExperiment();
    this.showSidebar();
    if (this.isStandalone) {
      this.showCloseExptButton();
    }
    this.requestRender();
    this.loading = false;
    this.displayDefaultHeaderText();
    this.updateExperimentList();
    this.updatePanelMeshes();
  }

  updateImageData = async (imageData, panelIdx=null, exptID=null) => {
    console.assert(this.hasExperiment());
    await this.expt.parseImageData(imageData, panelIdx, exptID);
    
    for (var i in this.panelMeshes) {
      window.scene.remove(this.panelMeshes[i]);
      this.panelMeshes[i].geometry.dispose();
      this.panelMeshes[i].material.dispose();
    }
    this.allPanelMeshes = {};
    for (var i = 0; i < this.expt.numExperiments(); i++) {
      this.allPanelMeshes.push([]);
    }
    for (var i = 0; i < this.expt.getNumDetectorPanels(); i++) {
      for (var j = 0; j < this.expt.numExperiments(); j++) {
        this.addDetectorPanel(i, j);
      }
    }
    this.requestRender()
    this.loading = false;
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
    this.clearReflPointsIntegrated();
    this.clearBoundingBoxes();
    this.refl.clearReflectionTable();
    this.calculatedIntegratedRefl.clearReflectionTable();
    this.updateReflectionCheckboxEnabledStatus();
    this.setDefaultReflectionsDisplay();
    this.hideCloseReflButton();
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

  addReflectionsFromJSONMsgpack(reflMsgpack){
    if (!this.hasExperiment()) {
      console.warn("Tried to add reflections but no experiment has been loaded");
      this.clearReflectionTable();
      return;
    }

    this.clearReflectionTable();
    this.refl.parseReflectionTableFromJSONMsgpack(reflMsgpack);

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
    const exptIDs = this.refl.getExperimentIDs();
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
    const bboxMeshesIndexed = [];
    const bboxMeshesUnindexed = [];


    for (let i = 0; i < this.expt.numExperiments(); i++) {
      pointsObsUnindexed.push([]);
      positionsObsUnindexed.push([]);
      positionsObsIndexed.push([]);
      pointsObsIndexed.push([]);
      pointsCal.push([]);
      positionsCal.push([]);
      pointsIntegrated.push([]);
      positionsIntegrated.push([]);
      bboxMeshesIndexed.push([]);
      bboxMeshesUnindexed.push([]);
    }

    const uniquePanelIdxs = new Set(panelNumbers);
    let panelData = {};
    for (const panelIdx of uniquePanelIdxs){
      panelData[panelIdx] = this.expt.getPanelDataByIdx(panelIdx);
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
          panelData[reflPanel]["fastAxis"], 
          panelData[reflPanel]["slowAxis"], 
          panelData[reflPanel]["pxSize"])

        // Bbox
        let bboxMesh = null;
        if (bboxes !== null){
          bboxMesh = this.getBboxMesh(
            bboxes[reflIdx], 
            bboxMaterial, 
            this, 
            panelData[reflPanel]["origin"], 
            panelData[reflPanel]["fastAxis"], 
            panelData[reflPanel]["slowAxis"], 
            panelData[reflPanel]["pxSize"]);
        }

        // Miller idx
        if (millerIndices !== null && this.refl.isValidMillerIndex(millerIndices[reflIdx])){

            positionsObsIndexed[exptID].push(globalPosObs.x);
            positionsObsIndexed[exptID].push(globalPosObs.y);
            positionsObsIndexed[exptID].push(globalPosObs.z);
            if (bboxMesh !== null){
              bboxMeshesIndexed[exptID].push(bboxMesh);
            }
            indexedMap[numIndexed] = millerIndices[reflIdx];
            numIndexed++;

        }

        else {
          positionsObsUnindexed[exptID].push(globalPosObs.x);
          positionsObsUnindexed[exptID].push(globalPosObs.y);
          positionsObsUnindexed[exptID].push(globalPosObs.z);
          if (bboxMesh !== null){
            bboxMeshesUnindexed[exptID].push(bboxMesh);
          }
        }
        if (bboxMesh !== null){
          window.scene.add(bboxMesh);
        }
      } // xyzObs

      // xyzCal
      if (xyzCal !== null) {

        const reflXyzCal = xyzCal[reflIdx];
        const globalPosCal = this.mapPointToGlobal(
          reflXyzCal, 
          panelData[reflPanel]["origin"], 
          panelData[reflPanel]["fastAxis"], 
          panelData[reflPanel]["slowAxis"], 
          panelData[reflPanel]["pxSize"]);

        positionsCal[exptID].push(globalPosCal.x);
        positionsCal[exptID].push(globalPosCal.y);
        positionsCal[exptID].push(globalPosCal.z);

        if (this.refl.isSummationIntegrated(flags[reflIdx])) {
          positionsIntegrated[exptID].push(globalPosCal.x);
          positionsIntegrated[exptID].push(globalPosCal.y);
          positionsIntegrated[exptID].push(globalPosCal.z);
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

    const bboxMaterial = new THREE.LineBasicMaterial({ color: this.colors["bbox"] });

    const pointsObsUnindexed = [];
    const positionsObsUnindexed = [];
    const positionsObsIndexed = [];
    const pointsObsIndexed = [];
    const pointsCal = [];
    const positionsCal = [];
    const pointsIntegrated = [];
    const positionsIntegrated = [];
    const bboxMeshesIndexed = [];
    const bboxMeshesUnindexed = [];


    for (var i = 0; i < this.expt.numExperiments(); i++) {
      pointsObsUnindexed.push([]);
      positionsObsUnindexed.push([]);
      positionsObsIndexed.push([]);
      pointsObsIndexed.push([]);
      pointsCal.push([]);
      positionsCal.push([]);
      pointsIntegrated.push([]);
      positionsIntegrated.push([]);
      bboxMeshesIndexed.push([]);
      bboxMeshesUnindexed.push([]);
    }

    const panelKeys = Object.keys(reflData);
    const refl = reflData[panelKeys[0]][0];

    const containsXYZObs = "xyzObs" in refl;
    const containsXYZCal = "xyzCal" in refl;
    const containsMillerIndices = "millerIdx" in refl;
    const containsBBoxes = "bbox" in refl;

    for (var i = 0; i < panelKeys.length; i++) {
      const panelIdx = parseInt(panelKeys[i])

      const panelReflections = reflData[panelKeys[i]];
      if (panelReflections === undefined) { continue; }
      const panelData = this.expt.getPanelDataByIdx(panelIdx);

      const fa = panelData["fastAxis"];
      const sa = panelData["slowAxis"];
      const pOrigin = panelData["origin"];
      const pxSize = [panelData["pxSize"].x, panelData["pxSize"].y];

      for (var j = 0; j < panelReflections.length; j++) {

        const exptID = panelReflections[j]["exptID"];

        if (containsXYZObs) {

          const xyzObs = panelReflections[j]["xyzObs"];
          const globalPosObs = this.mapPointToGlobal(xyzObs, pOrigin, fa, sa, pxSize);

          let bboxMesh = null;
          if (containsBBoxes){
            const bboxMesh = this.getBboxMesh(panelReflections[j]["bbox"], bboxMaterial, this, pOrigin, fa, sa, pxSize);
          }

          if (containsMillerIndices && panelReflections[j]["indexed"]) {
            positionsObsIndexed[exptID].push(globalPosObs.x);
            positionsObsIndexed[exptID].push(globalPosObs.y);
            positionsObsIndexed[exptID].push(globalPosObs.z);
            if (bboxMesh !== null){
              bboxMeshesIndexed[exptID].push(bboxMesh);
            }
            indexedMap[numIndexed] = panelReflections[j]["millerIdx"];
            numIndexed++;
          }
          else {
            positionsObsUnindexed[exptID].push(globalPosObs.x);
            positionsObsUnindexed[exptID].push(globalPosObs.y);
            positionsObsUnindexed[exptID].push(globalPosObs.z);
            if (bboxMesh !== null){
              bboxMeshesUnindexed[exptID].push(bboxMesh);
            }
          }
          if (bboxMesh !== null){
            window.scene.add(bboxMesh);
          }

        }
        if (containsXYZCal) {
          const xyzCal = panelReflections[j]["xyzCal"];
          const globalPosCal = this.mapPointToGlobal(xyzCal, pOrigin, fa, sa, pxSize);
          positionsCal[exptID].push(globalPosCal.x);
          positionsCal[exptID].push(globalPosCal.y);
          positionsCal[exptID].push(globalPosCal.z);
          if ("summedIntensity" in panelReflections[j]) {
            positionsIntegrated[exptID].push(globalPosCal.x);
            positionsIntegrated[exptID].push(globalPosCal.y);
            positionsIntegrated[exptID].push(globalPosCal.z);
          }
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

  addCalculatedIntegratedReflectionsFromJSONMsgpack(reflMsgpack){
    if (!this.hasExperiment()) {
      console.warn("Tried to add reflections but no experiment has been loaded");
      this.clearReflectionTable();
      return;
    }

    this.clearReflectionTable();
    this.calculatedIntegratedRefl.parseReflectionTableFromJSONMsgpack(reflMsgpack);

    // Get relevant data
    const panelNumbers = this.calculatedIntegratedRefl.getPanelNumbers();
    // Assume all reflection tables contain panel info
    if (panelNumbers === null){
      console.warn("Tried to add reflections but no data was parsed in refl file");
    }
    
    const pointsIntegrated = [];
    const positionsIntegrated = [];


    for (var i = 0; i < this.expt.numExperiments(); i++) {
      pointsIntegrated.push([]);
      positionsIntegrated.push([]);
    }

    const xyzCal = this.calculatedIntegratedRefl.getXYZCal();
    const millerIndices = this.calculatedIntegratedRefl.getMillerIndices();
    const exptIDs = this.calculatedIntegratedRefl.getExperimentIDs();

    const uniquePanelIdxs = new Set(panelNumbers);
    let panelData = {};
    for (const panelIdx of uniquePanelIdxs){
      panelData[panelIdx] = this.expt.getPanelDataByIdx(panelIdx);
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
          panelData[reflPanel]["fastAxis"], 
          panelData[reflPanel]["slowAxis"], 
          panelData[reflPanel]["pxSize"]);

          positionsIntegrated[exptID].push(globalPosCal.x);
          positionsIntegrated[exptID].push(globalPosCal.y);
          positionsIntegrated[exptID].push(globalPosCal.z);

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
      const panelData = this.expt.getPanelDataByIdx(panelIdx);

      const fa = panelData["fastAxis"];
      const sa = panelData["slowAxis"];
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

    for (var i = 0; i < this.expt.getNumDetectorPanels(); i++) {

      const panelReflections = this.refl.getReflectionsForPanel(i);
      if (panelReflections == undefined) { continue; }
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
    
    if (focusOnPanel) {
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
    
    const panelData = this.expt.getPanelDataByIdx(reflData["panelIdx"]);
    
    // Create circle using Line segments
    const segments = 32;
    let points = [];
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        let circlePoint = [
          pos[1] + Math.cos(theta) * baseRadius,
          pos[0] + Math.sin(theta) * baseRadius,
        ];
        circlePoint = this.mapPointToGlobal(
          circlePoint, panelData["origin"],
          panelData["fastAxis"],
          panelData["slowAxis"],
          panelData["pxSize"]
        );
        points.push(
          circlePoint
        );
    }
    points.push(points[0]);

    const line = new MeshLine();
    points = points.map(point => new THREE.Vector3(point.x, point.y, point.z));
    line.setPoints(points);
    const material = new MeshLineMaterial({
      lineWidth: 2,
      color: this.colors["highlightBbox"],
      fog: true
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
      this.boundingBoxesCheckbox.checked = false;
      return;
    }

    if (this.reflPointsObsIndexed.length > 0) {
      this.observedIndexedReflsCheckbox.checked = true;
    }
    if (this.reflPointsObsUnindexed.length > 0) {
      this.observedUnindexedReflsCheckbox.checked = true;
    }
    /*
     * Bboxes off by default as they can be expensive for 
     * large numbers of reflections
     */
    this.updateBoundingBoxes(false);
    this.boundingBoxesCheckbox.checked = false;

  }

  updateReflectionVisibility() {
    this.updateObservedIndexedReflections();
    this.updateObservedUnindexedReflections();
    this.updateCalculatedReflections();
    this.updateIntegratedReflections();
  }

  updateReflectionCheckboxEnabledStatus() {
    if (!this.hasReflectionTable()) {
      this.observedIndexedReflsCheckbox.disabled = true;
      this.observedUnindexedReflsCheckbox.disabled = true;
      this.calculatedReflsCheckbox.disabled = true;
      this.integratedReflsCheckbox.disabled = true;
      this.boundingBoxesCheckbox.disabled = true;
      return;
    }
    this.observedUnindexedReflsCheckbox.disabled = !this.refl.containsXYZObs();
    this.observedIndexedReflsCheckbox.disabled = !this.refl.containsMillerIndices();
    this.calculatedReflsCheckbox.disabled = !this.refl.containsXYZCal();
    this.integratedReflsCheckbox.disabled = this.integrationDataEmpty();
    this.boundingBoxesCheckbox.disabled = !this.refl.containsBoundingBoxes();
  }

  integrationDataEmpty(){
    return this.reflPositionsIntegrated.every(function(subArr) {
      return subArr.length === 0;
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
      for (let i = 0; i < this.allPanelMeshes[exptID].length; i++){
        const newTexture = this.getPanelTexture(i, exptID);
        this.allPanelMeshes[exptID][i].material.map = newTexture;
        this.allPanelMeshes[exptID][i].material.map.needsUpdate = true;
      }
    }
    this.requestRender();
  }

  getPanelTexture(idx, exptID, imageData=null) {
    if (imageData == null){
      imageData = this.expt.imageData[exptID][idx];
    }
    let panelSize = this.expt.imageSize;
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
    for (var y = 0; y < imageData.length; y++) {
      for (var x = 0; x < imageData[0].length; x++) {
        let value = imageData[y][x] * this.userContrast.value *  255;
        value = Math.min(255, Math.max(0, value));

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

  addPanelImageData(imageData, panelIdx, exptID, imageDimensions){
    this.expt.parseImageData(imageData, panelIdx, exptID, imageDimensions);
    this.clearDetectorMesh(panelIdx, exptID);
    this.addDetectorMesh(panelIdx, exptID);
    this.updatePanelMeshes();
  }

  addExptImageData(imageData, exptID, imageDimensions){
		console.assert(imageData.length === imageDimensions.length);
    this.expt.parseExptImageData(imageData, exptID, imageDimensions);

    for (let panelIdx = 0; panelIdx < imageData.length; panelIdx++){
      this.clearDetectorMesh(panelIdx, exptID);
      this.addDetectorMesh(panelIdx, exptID);
    }
    this.updatePanelMeshes();
  }

  addDebugPanelImageData(imageData, maskData, panelIdx, exptID, imageDimensions){
    if (exptID !== this.visibleExptID){
      this.clearDebugPanelMeshes();
    }
    else if (panelIdx in this.debugPanelMeshes){
      window.scene.remove(this.debugPanelMeshes[panelIdx]);
      this.debugPanelMeshes[panelIdx].geometry.dispose();
      this.debugPanelMeshes[panelIdx].material.dispose();
      delete this.debugPanelMeshes[panelIdx]
      window.scene.remove(this.debugPanelThresholdMeshes[panelIdx]);
      this.debugPanelThresholdMeshes[panelIdx].geometry.dispose();
      this.debugPanelThresholdMeshes[panelIdx].material.dispose();
      delete this.debugPanelThresholdMeshes[panelIdx]
    }
    const decompressedImageData = this.expt.decompressImageData(
      imageData, imageDimensions, "float")
    const decompressedMaskData = this.expt.decompressImageData(
      maskData, imageDimensions, "int")
    this.addDebugDetectorMesh(panelIdx, decompressedImageData, decompressedMaskData);
    this.updatePanelMeshes();
  }
  
  addDebugImageData(imageData, maskData, imageDimensions){
		console.assert(imageData.length === imageDimensions.length);
    this.clearDebugPanelMeshes();

    for (let panelIdx = 0; panelIdx < imageData.length; i++){
      const decompressedImageData = this.expt.decompressImageData(
        imageData[panelIdx], imageDimensions[panelIdx], "float")
      const decompressedMaskData = this.expt.decompressImageData(
        maskData[panelIdx], imageDimensions[panelIdx], "int")
      this.addDebugDetectorMesh(panelIdx, decompressedImageData, decompressedMaskData);
    }
    this.updatePanelMeshes();
  }


  addDebugDetectorMesh(panelIdx, imageData, maskData){
    const panelSize = this.expt.imageData;
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
    var panelName = this.expt.getDetectorPanelName(panelIdx);
    plane.name = panelName;
    const thresholdPlane = new THREE.Mesh(panelGeometry, panelThresholdMaterial);

    thresholdPlane.name = panelName;
    var corners = this.expt.getDetectorPanelCorners(panelIdx);
    var idxs = [1, 2, 0, 3]

    // Rotate if not facing the origin
    var normalVec = this.expt.getDetectorPanelNormal(panelIdx);
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
      const panelSize = this.expt.imageSize;
      const panelGeometry = new THREE.PlaneGeometry(panelSize[1], panelSize[0]);
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
      var panelName = this.expt.getDetectorPanelName(panelIdx);
      plane.name = panelName;

    var corners = this.expt.getDetectorPanelCorners(panelIdx);

    var idxs = [1, 2, 0, 3]

    // Rotate if not facing the origin
    var normalVec = this.expt.getDetectorPanelNormal(panelIdx);
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

    window.scene.add(plane);
    if (!(exptID in this.allPanelMeshes)){
      this.allPanelMeshes[exptID] = {}
    }
    this.allPanelMeshes[exptID][panelIdx] = plane;
    this.requestRender();

  }

  addDetectorPanel(idx, exptID, addTexture=true) {

    var panelName = this.expt.getDetectorPanelName(idx);
    if (panelName in this.panelOutlineMeshes){
      return;
    }

    var corners = this.expt.getDetectorPanelCorners(idx);
    corners.push(corners[0]);
    corners = corners.map(corner => new THREE.Vector3(corner.x, corner.y, corner.z));

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

    if (addTexture){
      this.addDetectorMesh(idx, exptID);
    }
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
      transparent: true,
      opacity: 0.0,
      fog: true,
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
      fog: true,
      transparent: true,
      opacity: 0.25,
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
    if (this.creatingReflection && !this.drawingReflection) {
      window.viewer.disableReflectionCreation();
      return;
    }
    const intersects = window.rayCaster.intersectObjects(Object.values(this.panelMeshes));
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
      const intersects = window.rayCaster.intersectObjects(Object.values(viewer.panelMeshes));
      window.rayCaster.setFromCamera(window.mousePosition, window.camera);
      if (intersects.length > 0) {
        const name = intersects[0].object.name;
        viewer.displayHeaderText(name + " [" + viewer.getPanelPositionAsString(intersects[0].point, name) + "]");
        viewer.highlightObject(viewer.panelOutlineMeshes[name]);
      }
    }

    function updateReflectionInfo(viewer) {
      if (!viewer.observedIndexedReflsCheckbox.checked) { return; }
      for (var i = 0; i < viewer.reflPointsObsIndexed.length; i++) {
        const intersects = window.rayCaster.intersectObjects(viewer.reflPointsObsIndexed[i]);
        window.rayCaster.setFromCamera(window.mousePosition, window.camera);
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
    if (this.loading) { return; }
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
        "command": "update_experiment_description",
        "expt_id": exptID,
        "in_debug_mode": (this.debugImageMode || this.debugThresholdMode)
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
    const intersects = window.rayCaster.intersectObjects(Object.values(this.panelMeshes));
    window.rayCaster.setFromCamera(window.mousePosition, window.camera);
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
    const panelIdx = this.expt.getPanelIdxByName(name);
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
    const panelIdx = this.expt.getPanelIdxByName(this.userReflection.panelName);
    const panelData = this.expt.getPanelDataByIdx(panelIdx);
    const mesh = this.getBboxMesh(
      bbox,
      this.userReflection.lineMaterial,
      this,
      panelData["origin"],
      panelData["fastAxis"],
      panelData["slowAxis"],
      [panelData["pxSize"]["x"], panelData["pxSize"]["y"]]
    );
    this.userReflection.addBboxMesh(mesh);

    this.serverWS.send(JSON.stringify({
      "channel": "server",
      "command": "new_reflection_xy",
      "panel_idx": panelIdx,
      "expt_id": this.visibleExptID,
      "bbox": bbox,
      "panel_name": this.userReflection.panelName
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
      "command": "cancel_new_reflection"
    }));
  }

  updateNewReflection() {
    const intersects = window.rayCaster.intersectObjects(Object.values(this.panelMeshes));
    window.rayCaster.setFromCamera(window.mousePosition, window.camera);
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
    var panel = window.viewer.getClickedPanelMesh();
    if (panel) {
      window.viewer.zoomInOnPanel(panel);
    }
  });

  window.addEventListener('click', function (event) {
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
    if (event.button === 0 && event.altKey) {
      window.viewer.enableReflectionCreation();
    }
    if (event.button == 2) {
      window.viewer.setCameraToDefaultPositionWithExperiment();
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
