import * as THREE from "https://threejs.org/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js";
import { gsap } from "https://cdn.skypack.dev/gsap@3.9.1";
import * as meshline from './THREE.MeshLine.js';
import { ExptParser } from "./ExptParser.js";
import { ReflParser } from "./ReflParser.js";

class ExperimentViewer{
	constructor(exptParser, reflParser){
		this.expt = exptParser;
		this.refl = reflParser;
		this.headerText = window.document.getElementById("headerText");
		this.footerText = window.document.getElementById("footerText");
		this.sidebar = window.document.getElementById("sidebar");
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

		this.closeExptButton = document.getElementById("closeExpt");
		this.closeReflButton = document.getElementById("closeRefl");
		this.observedIndexedReflsCheckbox = document.getElementById("observedIndexedReflections");
		this.observedUnindexedReflsCheckbox = document.getElementById("observedUnindexedReflections");
		this.calculatedReflsCheckbox = document.getElementById("calculatedReflections");
		this.boundingBoxesCheckbox = document.getElementById("boundingBoxes");
		this.axesCheckbox = document.getElementById("showAxes");
		this.reflectionSize = document.getElementById("reflectionSize");


		this.hightlightColor = new THREE.Color(ExperimentViewer.colors()["highlight"]);
		this.panelColor = new THREE.Color(ExperimentViewer.colors()["panel"]);

		this.displayingTextFromHTMLEvent = false;

		this.updateReflectionCheckboxStatus();
		this.setDefaultReflectionsDisplay();

	}


	static colors(){
		return {
			"background": 0x222222,
			"sample" : 0xfdf6e3,
			"reflectionObsUnindexed" : 0xFFFFFF,
			"reflectionObsIndexed" : 0xe74c3c,
			"reflectionCal" : 0xffaaaa,
			"panel" : 0x119dff,
			"highlight" : 0xFFFFFF,
			"beam" : 0xFFFFFF,
			"bbox" : 0xFFFFFF,
			"axes": [0xffaaaa, 0xaaffaa, 0xaaaaff]
		};
	}

	static cameraPositions(){
		return {
			"default" : new THREE.Vector3(0, 0, -1000),
			"defaultWithExperiment" : new THREE.Vector3(-1000, 0, 0),
			"centre" : new THREE.Vector3(0, 0, 0)
		};
	}

	static text(){
		return {
			"default" : "To view an experiment, drag .expt and .refl files into the browser",
			"defaultWithExpt" : null
		}
	}

	toggleSidebar(){
		this.sidebar.style.display = this.sidebar.style.display  === 'block' ? 'none' : 'block';
	}
	
	showSidebar(){
		this.sidebar.style.display = 'block';
	}

	updateObservedIndexedReflections(val=null){
		if (val !== null){
			this.observedIndexedReflsCheckbox.checked = val;
		}
		this.reflPointsObsIndexed[0].visible = this.observedIndexedReflsCheckbox.checked;
		const showBbox = this.observedIndexedReflsCheckbox.checked && this.boundingBoxesCheckbox.checked;

		for (var i = 0; i < this.bboxMeshesIndexed.length; i++){
			this.bboxMeshesIndexed[i].visible = showBbox;
		}
		this.requestRender();
	}

	updateObservedUnindexedReflections(val=null){
		if (val !== null){
			this.observedUnindexedReflsCheckbox.checked = val;
		}
		this.reflPointsObsUnindexed[0].visible = this.observedUnindexedReflsCheckbox.checked;
		const showBbox = this.observedUnindexedReflsCheckbox.checked && this.boundingBoxesCheckbox.checked;

		for (var i = 0; i < this.bboxMeshesUnindexed.length; i++){
			this.bboxMeshesUnindexed[i].visible = showBbox;
		}
		this.requestRender();
	}

	updateCalculatedReflections(val=null){
		if (val !== null){
			this.calculatedReflsCheckbox.checked = val;
		}
		for (var i = 0; i < this.reflPointsCal.length; i++){
			this.reflPointsCal[i].visible = this.calculatedReflsCheckbox.checked;
		}
		this.requestRender();
	}

	updateBoundingBoxes(val=null){
		if (val !== null){
			this.boundingBoxesCheckbox.checked = val;
		}
		if (this.observedIndexedReflsCheckbox.checked && this.boundingBoxesCheckbox.checked){
			for (var i = 0; i < this.bboxMeshesIndexed.length; i++){
				this.bboxMeshesIndexed[i].visible = true;
			}
		}
		else{
			for (var i = 0; i < this.bboxMeshesIndexed.length; i++){
				this.bboxMeshesIndexed[i].visible = false;
			}
		}
		if (this.observedUnindexedReflsCheckbox.checked && this.boundingBoxesCheckbox.checked){
			for (var i = 0; i < this.bboxMeshesUnindexed.length; i++){
				this.bboxMeshesUnindexed[i].visible = true;
			}
		}
		else{
			for (var i = 0; i < this.bboxMeshesUnindexed.length; i++){
				this.bboxMeshesUnindexed[i].visible = false;
			}
		}
		this.requestRender();
	}

	updateAxes(val=null){
		if (val !== null){
			this.axesCheckbox.checked = val;
		}
		for (var i = 0; i < this.axesMeshes.length; i++){
			this.axesMeshes[i].visible = this.axesCheckbox.checked;
		}
		this.requestRender();
	}

	updateReflectionSize(){
		if (!this.hasReflectionTable()){
			return;
		}
		if (this.refl.containsXYZObs()){
			if (this.reflPointsObsUnindexed){
				const reflGeometryObs = new THREE.BufferGeometry();
				reflGeometryObs.setAttribute(
					"position", new THREE.Float32BufferAttribute(this.reflPositionsUnindexed, 3)
				);

				const reflMaterialObs = new THREE.PointsMaterial({
					size: this.reflectionSize.value,
					transparent:true,
					color: ExperimentViewer.colors()["reflectionObsUnindexed"]
				});
				const pointsObs = new THREE.Points(reflGeometryObs, reflMaterialObs);
				this.clearReflPointsObsUnindexed();
				window.scene.add(pointsObs);
				this.reflPointsObsUnindexed = [pointsObs];
				this.updateObservedUnindexedReflections();
			}
			if (this.reflPointsObsIndexed){
				const reflGeometryObs = new THREE.BufferGeometry();
				reflGeometryObs.setAttribute(
					"position", new THREE.Float32BufferAttribute(this.reflPositionsIndexed, 3)
				);

				const reflMaterialObs = new THREE.PointsMaterial({
					size: this.reflectionSize.value,
					transparent:true,
					color: ExperimentViewer.colors()["reflectionObsIndexed"]
				});
				const pointsObs = new THREE.Points(reflGeometryObs, reflMaterialObs);
				this.clearReflPointsObsIndexed();
				window.scene.add(pointsObs);
				this.reflPointsObsIndexed = [pointsObs];
				this.updateObservedIndexedReflections();
			}
		}

		if (this.refl.containsXYZCal() && this.reflPositionsCal){
			const reflGeometryCal = new THREE.BufferGeometry();
			reflGeometryCal.setAttribute(
				"position", new THREE.Float32BufferAttribute(this.reflPositionsCal, 3)
			);

			const reflMaterialCal = new THREE.PointsMaterial({
				size: this.reflectionSize.value,
				transparent:true,
				color: ExperimentViewer.colors()["reflectionCal"]
			});
			const pointsCal = new THREE.Points(reflGeometryCal, reflMaterialCal);
			this.clearReflPointsCal();
			window.scene.add(pointsCal);
			this.reflPointsCal = [pointsCal];
			this.updateCalculatedReflections();
		}
		this.requestRender();

	}

	hasExperiment(){
		return (this.expt.hasExptJSON());
	}

	clearExperiment(){
		
		for (const i in this.panelOutlineMeshes){
			window.scene.remove(this.panelOutlineMeshes[i]);
			this.panelOutlineMeshes[i].geometry.dispose();
			this.panelOutlineMeshes[i].material.dispose();
		}
		this.panelOutlineMeshes = {};

		for (var i = 0; i < this.panelMeshes.length; i++){
			window.scene.remove(this.panelMeshes[i]);
			this.panelMeshes[i].geometry.dispose();
			this.panelMeshes[i].material.dispose();
		}
		this.panelMeshes = [];

		for (var i = 0; i < this.beamMeshes.length; i++){
			window.scene.remove(this.beamMeshes[i]);
			this.beamMeshes[i].geometry.dispose();
			this.beamMeshes[i].material.dispose();
		}
		this.beamMeshes = [];
		if (this.sampleMesh){
			window.scene.remove(this.sampleMesh);
			this.sampleMesh.geometry.dispose();
			this.sampleMesh.material.dispose();
			this.sampleMesh = null;
		}

		this.expt.clearExperiment();
		this.hideCloseExptButton();

		this.clearReflectionTable();
		this.requestRender();
	}

	addExperiment = async (file) => {
		this.clearExperiment();
		this.clearReflectionTable();
		await this.expt.parseExperiment(file);
		console.assert(this.hasExperiment());
		for (var i = 0; i < this.expt.getNumDetectorPanels(); i++){
			this.addDetectorPanelOutline(i);
		}
		this.addBeam();
		this.addSample();
		this.setCameraToDefaultPositionWithExperiment();
		this.showSidebar();
		this.showCloseExptButton();
		this.requestRender();

	}

	showCloseExptButton(){
		this.closeExptButton.style.display = "inline";
		this.closeExptButton.innerHTML = "<b>"+this.expt.filename  + ' <i class="fa fa-trash"></i>' ;
	}

	hideCloseExptButton(){
		this.closeExptButton.style.display = "none";
	}

	hasReflectionTable(){
		return (this.refl.hasReflTable());
	}

	clearReflPointsObsIndexed(){
		for (var i = 0; i < this.reflPointsObsIndexed.length; i++){
			window.scene.remove(this.reflPointsObsIndexed[i]);
			this.reflPointsObsIndexed[i].geometry.dispose();
			this.reflPointsObsIndexed[i].material.dispose();
		}
		this.reflPointsObsIndexed = [];
	}

	clearReflPointsObsUnindexed(){
		for (var i = 0; i < this.reflPointsObsUnindexed.length; i++){
			window.scene.remove(this.reflPointsObsUnindexed[i]);
			this.reflPointsObsUnindexed[i].geometry.dispose();
			this.reflPointsObsUnindexed[i].material.dispose();
		}
		this.reflPointsObsUnindexed = [];
	}

	clearReflPointsCal(){
		for (var i = 0; i < this.reflPointsCal.length; i++){
			window.scene.remove(this.reflPointsCal[i]);
			this.reflPointsCal[i].geometry.dispose();
			this.reflPointsCal[i].material.dispose();
		}
		this.reflPointsCal = [];
	}

	clearBoundingBoxes(){
		for (var i = 0; i < this.bboxMeshesIndexed.length; i++){
			window.scene.remove(this.bboxMeshesIndexed[i]);
			this.bboxMeshesIndexed[i].geometry.dispose();
			this.bboxMeshesIndexed[i].material.dispose();
		}
		this.bboxMeshesIndexed = [];

		for (var i = 0; i < this.bboxMeshesUnindexed.length; i++){
			window.scene.remove(this.bboxMeshesUnindexed[i]);
			this.bboxMeshesUnindexed[i].geometry.dispose();
			this.bboxMeshesUnindexed[i].material.dispose();
		}
		this.bboxMeshesUnindexed = [];
	}

	clearReflectionTable(){
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

	showCloseReflButton(){
		this.closeReflButton.style.display = "inline";
		this.closeReflButton.innerHTML = "<b>"+this.refl.filename  + ' <i class="fa fa-trash"></i>' ;

	}

	hideCloseReflButton(){
		this.closeReflButton.style.display = "none";
	}

	addReflectionTable = async (file) => {
		this.clearReflectionTable();
		await this.refl.parseReflectionTable(file);
		this.addReflections();
		if(this.hasReflectionTable()){
			this.showCloseReflButton();
		}
		this.requestRender();
	}

	addReflections(){

		function getBboxMesh(bbox, bboxMaterial, viewer, pOrigin, fa, sa, pxSize){
			const c1 = viewer.mapPointToGlobal([bbox[0], bbox[2]], pOrigin, fa, sa, pxSize);
			const c2 = viewer.mapPointToGlobal([bbox[1], bbox[2]], pOrigin, fa, sa, pxSize);
			const c3 = viewer.mapPointToGlobal([bbox[1], bbox[3]], pOrigin, fa, sa, pxSize);
			const c4 = viewer.mapPointToGlobal([bbox[0], bbox[3]], pOrigin, fa, sa, pxSize);
			const corners = [c1, c2, c3, c4, c1];
			const bboxGeometry = new THREE.BufferGeometry().setFromPoints( corners );
			const bboxLines = new THREE.Line( bboxGeometry, bboxMaterial );
			return bboxLines;
		}

		if (!this.hasReflectionTable()){
			console.warn("Tried to add reflections but no table has been loaded");
			return;
		}
		if (!this.hasExperiment()){
			console.warn("Tried to add reflections but no experiment has been loaded");
			this.clearReflectionTable();
			return;
		}

		const positionsObsIndexed = new Array();
		const positionsObsUnindexed = new Array();
		const positionsCal = new Array();
		const bboxMaterial = new THREE.LineBasicMaterial( { color: ExperimentViewer.colors()["bbox"] } );
		const containsXYZObs = this.refl.containsXYZObs();
		const containsXYZCal = this.refl.containsXYZCal();
		const containsMillerIndices = this.refl.containsMillerIndices();

		for (var i = 0; i < this.expt.getNumDetectorPanels(); i++){

			const panelReflections = this.refl.getReflectionsForPanel(i);
			const panelData = this.expt.getPanelDataByIdx(i);

			const fa = panelData["fastAxis"];
			const sa = panelData["slowAxis"];
			const pOrigin = panelData["origin"];
			const pxSize = [panelData["pxSize"].x, panelData["pxSize"].y];

			for (var j = 0; j < panelReflections.length; j++){
			
				if (containsXYZObs){

					const xyzObs = panelReflections[j]["xyzObs"];
					const globalPosObs = this.mapPointToGlobal(xyzObs, pOrigin, fa, sa, pxSize);

					const bboxMesh = getBboxMesh(panelReflections[j]["bbox"], bboxMaterial, this, pOrigin, fa, sa, pxSize);

					if (containsMillerIndices && panelReflections[j]["indexed"]){
						positionsObsIndexed.push(globalPosObs.x);
						positionsObsIndexed.push(globalPosObs.y);
						positionsObsIndexed.push(globalPosObs.z);
						this.bboxMeshesIndexed.push(bboxMesh);
					}
					else{
						positionsObsUnindexed.push(globalPosObs.x);
						positionsObsUnindexed.push(globalPosObs.y);
						positionsObsUnindexed.push(globalPosObs.z);
						this.bboxMeshesUnindexed.push(bboxMesh);
					}
					window.scene.add(bboxMesh);

				}
				if (containsXYZCal){
					const xyzCal = panelReflections[j]["xyzCal"];
					const globalPosCal = this.mapPointToGlobal(xyzCal, pOrigin, fa, sa, pxSize);
					positionsCal.push(globalPosCal.x);
					positionsCal.push(globalPosCal.y);
					positionsCal.push(globalPosCal.z);
				}
			}
		}

		if (containsXYZObs){
			if (containsMillerIndices){

				const reflGeometryObsIndexed = new THREE.BufferGeometry();
				reflGeometryObsIndexed.setAttribute(
					"position", new THREE.Float32BufferAttribute(positionsObsIndexed, 3)
				);

				const reflMaterialObsIndexed = new THREE.PointsMaterial({
					size: this.reflectionSize.value,
					transparent:true,
					color: ExperimentViewer.colors()["reflectionObsIndexed"]
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
				transparent:true,
				color: ExperimentViewer.colors()["reflectionObsUnindexed"]
			});
			const pointsObsUnindexed = new THREE.Points(reflGeometryObsUnindexed, reflMaterialObsUnindexed);
			window.scene.add(pointsObsUnindexed);
			this.reflPointsObsUnindexed = [pointsObsUnindexed];
			this.reflPositionsUnindexed = positionsObsUnindexed;
		}

		if (containsXYZCal){
			const reflGeometryCal = new THREE.BufferGeometry();
			reflGeometryCal.setAttribute(
				"position", new THREE.Float32BufferAttribute(positionsCal, 3)
			);

			const reflMaterialCal = new THREE.PointsMaterial({
				size: this.reflectionSize.value,
				transparent:true,
				color: ExperimentViewer.colors()["reflectionCal"]
			});
			const pointsCal = new THREE.Points(reflGeometryCal, reflMaterialCal);
			window.scene.add(pointsCal);
			this.reflPointsCal = [pointsCal];
			this.reflPositionsCal = positionsCal;
		}

		this.updateReflectionCheckboxStatus();
		this.setDefaultReflectionsDisplay();
	}

	mapPointToGlobal(point, pOrigin, fa, sa, scaleFactor=[1,1]){
		const pos = pOrigin.clone();
		pos.add(fa.clone().normalize().multiplyScalar(point[0] * scaleFactor[0]));
		pos.add(sa.clone().normalize().multiplyScalar(point[1] * scaleFactor[1]));
		return pos;
	}


	setDefaultReflectionsDisplay(){

		/**
		 * If both observed and calculated reflections are available,
		 * show observed by default.
		 */

		if (!this.hasReflectionTable()){
			this.observedIndexedReflsCheckbox.checked = false;
			this.observedUnindexedReflsCheckbox.checked = false;
			this.calculatedReflsCheckbox.checked = false;
			this.boundingBoxesCheckbox.checked = false;
			return;
		}

		if (this.reflPointsObsIndexed.length > 0){
			this.updateObservedIndexedReflections(true);
			this.observedIndexedReflsCheckbox.checked = true;
			this.updateCalculatedReflections(false);
			this.calculatedReflsCheckbox.checked = false;
		}
		if (this.reflPointsObsUnindexed.length > 0){
			this.updateObservedUnindexedReflections(true);
			this.observedUnindexedReflsCheckbox.checked = true;
			this.updateCalculatedReflections(false);
			this.calculatedReflsCheckbox.checked = false;
		}
		else if (this.reflPointsCal.length > 0){
			this.showCalculatedReflections(true);
			this.calculatedReflsCheckbox.checked = true;
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

	updateReflectionCheckboxStatus(){
		if (!this.hasReflectionTable()){
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

	addDetectorPanelOutline(idx){

		var corners = this.expt.getDetectorPanelCorners(idx);
		corners.push(corners[0]);
		var panelName = this.expt.getDetectorPanelName(idx);

		const planeGeometry = new THREE.PlaneGeometry(192, 192);
		const planeMaterial = new THREE.MeshPhongMaterial({
			color : ExperimentViewer.colors()["panel"],
			opacity: 0.25,
			transparent: true,
			depthWrite: false
		});
		const plane = new THREE.Mesh(planeGeometry, planeMaterial);
		plane.name = panelName;


		var count = 0;
		var idxs = [1,2,0,3]

		// Rotate if not facing the origin
		var normalVec = this.expt.getDetectorPanelNormal(idx);
		var posVec = corners[0].clone();
		posVec.add(corners[1].clone());
		posVec.add(corners[2].clone());
		posVec.add(corners[3].clone());
		posVec.divideScalar(4).normalize();
		if (posVec.dot(normalVec) < 0){
			idxs = [0,3,1,2];
		}

		for (var i = 0; i < 12; i+=3){
			plane.geometry.attributes.position.array[i] = corners[idxs[count]].x;
			plane.geometry.attributes.position.array[i+1] = corners[idxs[count]].y;
			plane.geometry.attributes.position.array[i+2] = corners[idxs[count]].z;
			count++;
		}

		window.scene.add(plane);
		this.panelMeshes.push(plane);

		const line = new meshline.MeshLine();
		line.setPoints(corners);
		const material = new meshline.MeshLineMaterial({
			lineWidth:7,
			color: ExperimentViewer.colors()["panel"],
			fog:true
		});
		const mesh = new THREE.Mesh(line, material);
		this.panelOutlineMeshes[panelName] = mesh;
		window.scene.add(mesh);

	}

	addBeam(){
		var beamLength = 800.;
		var bd = this.expt.getBeamDirection();;

		var incidentVertices = []
		incidentVertices.push(
			new THREE.Vector3(bd.x * -beamLength, bd.y * -beamLength, bd.z * -beamLength)
		);
		incidentVertices.push(
			new THREE.Vector3(bd.x * -beamLength*.5, bd.y * -beamLength*.5, bd.z * -beamLength*.5)
		);
		incidentVertices.push(new THREE.Vector3(0,0,0));
		const incidentLine = new meshline.MeshLine();
		incidentLine.setPoints(incidentVertices);
		const incidentMaterial = new meshline.MeshLineMaterial({
			lineWidth:5,
			color: ExperimentViewer.colors()["beam"],
			fog: true,
			transparent: true,
			opacity: 0.,
			depthWrite: false
		});
		const incidentMesh = new THREE.Mesh(incidentLine, incidentMaterial);
		incidentMesh.raycast = meshline.MeshLineRaycast;
		this.beamMeshes.push(incidentMesh);
		window.scene.add(incidentMesh);

		var outgoingVertices = []
		outgoingVertices.push(new THREE.Vector3(0,0,0));
		outgoingVertices.push(
			new THREE.Vector3(bd.x * beamLength*.5, bd.y * beamLength*.5, bd.z * beamLength*.5)
		);
		outgoingVertices.push(
			new THREE.Vector3(bd.x * beamLength, bd.y * beamLength, bd.z * beamLength)
		);
		const outgoingLine = new meshline.MeshLine();
		outgoingLine.setPoints(outgoingVertices);
		const outgoingMaterial = new meshline.MeshLineMaterial({
			lineWidth:5,
			color: ExperimentViewer.colors()["beam"],
			transparent: true,
			opacity: .25,
			fog: true,
			depthWrite: false
		});
		const outgoingMesh = new THREE.Mesh(outgoingLine, outgoingMaterial);
		outgoingMesh.raycast = meshline.MeshLineRaycast;
		this.beamMeshes.push(outgoingMesh);
		window.scene.add(outgoingMesh);
	}

	addSample() {
		const sphereGeometry = new THREE.SphereGeometry(5);
		const sphereMaterial = new THREE.MeshBasicMaterial({ 
			color: ExperimentViewer.colors()["sample"], 
			transparent: true, 
			depthWrite: false
		});
		const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
		sphere.name = "sample";
		this.sampleMesh = sphere;
		window.scene.add(sphere);
	}

	addAxes(){
		function addAxis(viewer, vertices, color){
			const line = new meshline.MeshLine();
			line.setPoints(vertices);
			const Material = new meshline.MeshLineMaterial({
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

		addAxis(this, xVertices, ExperimentViewer.colors()["axes"][0]);
		addAxis(this, yVertices, ExperimentViewer.colors()["axes"][1]);
		addAxis(this, zVertices, ExperimentViewer.colors()["axes"][2]);
		this.axesCheckbox.disabled = false;
	}

	setCameraSmooth(position) {
		this.rotateToPos(position);
		window.controls.update();
	}

	setCameraToDefaultPosition() {
		this.setCameraSmooth(ExperimentViewer.cameraPositions()["default"]);
	}

	setCameraToDefaultPositionWithExperiment(){
		this.setCameraSmooth(ExperimentViewer.cameraPositions()["defaultWithExperiment"]);
	}

	setCameraToCentrePosition() {
		this.setCameraSmooth(ExperimentViewer.cameraPositions()["centre"]);
	}

	displayHeaderText(text){
		this.showHeaderText();
		this.headerText.innerHTML = text;
	}

	appendHeaderText(text){
		this.headerText.innerHTML += text;
	}

	hideHeaderText(){
		this.headerText.style.display = "none";
	}

	showHeaderText(){
		this.headerText.style.display = "block";
	}

	displayFooterText(text){
		this.showFooterText();
		this.footerText.textContent = text;
	}

	hideFooterText(){
		this.footerText.style.display = "none";
	}

	showFooterText(){
		this.footerText.style.display = "block";
	}

	displayDefaultHeaderText(){
		if (this.hasExperiment()){
			this.hideHeaderText();
		}
		else{
			this.displayHeaderText(ExperimentViewer.text()["default"]);
		}
	}

	displayImageFilenames(){
		this.displayHeaderText(this.expt.imageFilenames);
		this.displayingTextFromHTMLEvent = true;
	}

	displayNumberOfReflections(){
		this.displayHeaderText(this.refl.numReflections + " reflections");
		this.displayingTextFromHTMLEvent = true;
	}

	stopDisplayingText(){
		this.displayingTextFromHTMLEvent = false;
	}


	highlightObject(obj){
		obj.material.color = new THREE.Color(ExperimentViewer.colors()["highlight"]);
	}

	beamHidden(){
		if (this.beamMeshes.length === 0){
			return true;
		}
		return this.beamMeshes[0].material.opacity < 0.01;
	}

	updateGUIInfo() {

		function updatePanelInfo(viewer){
			const intersects = window.rayCaster.intersectObjects(viewer.panelMeshes);
			window.rayCaster.setFromCamera(window.mousePosition, window.camera);
			if (intersects.length > 0) {
				const name = intersects[0].object.name;
				viewer.displayHeaderText(name + " [" + viewer.getPanelPosition(intersects[0].point, name) + "]");
				viewer.highlightObject(viewer.panelOutlineMeshes[name]);
			}
		}

		function updateReflectionInfo(viewer){
			const intersects = window.rayCaster.intersectObjects(viewer.reflPointsObsIndexed);
			window.rayCaster.setFromCamera(window.mousePosition, window.camera);
			if (intersects.length > 0) {
				for (var i = 0; i < intersects.length; i++){
					const millerIdx = viewer.refl.getMillerIndexById(intersects[i].index); 
					viewer.appendHeaderText(" (" + millerIdx+")");
				}
			}
		}

		function updateBeamInfo(viewer){
			if (viewer.beamHidden()){
				return;
			}
			const intersects = window.rayCaster.intersectObjects(viewer.beamMeshes);
			window.rayCaster.setFromCamera(window.mousePosition, window.camera);
			if (intersects.length > 0) {
				const beamData = viewer.expt.getBeamData();
				const direction = beamData["direction"];
				const wavelength = beamData["wavelength"];
				var text = "direction: (" + direction + "), ";
				if (wavelength){
					text += " wavelength: " + wavelength;
				}
				viewer.displayHeaderText(text);
			}
		}

		if (this.displayingTextFromHTMLEvent){ return; }
		this.displayDefaultHeaderText();
		updatePanelInfo(this);
		updateReflectionInfo(this);
		updateBeamInfo(this);
	}

	getPanelPosition(globalPos, panelName){

		const data = this.expt.getPanelDataByName(panelName);
		const pos = data["origin"].sub(globalPos);
		const fa = data["fastAxis"].normalize();
		const sa = data["slowAxis"].normalize();
		const panelX = (pos.x * fa.x + pos.y * fa.y + pos.z * fa.z) / data["pxSize"].x;  
		const panelY = (pos.x * sa.x + pos.y * sa.y + pos.z * sa.z) / data["pxSize"].y;  
		return ~~-panelX + ", " + ~~-panelY;

	}

	getPanelCentroid(panelName){
		return this.expt.getPanelCentroid(panelName);
	}

	resetPanelColors(){
		for (var i in this.panelOutlineMeshes){
			this.panelOutlineMeshes[i].material.color = this.panelColor;
		}
	}

	updateOriginObjectsOpacity(){
		if (!this.hasExperiment()){
			return;
		}
		const minCameraDistance = 55000;
		const maxCameraDistance = 1000000;
		const cameraPos = window.camera.position;
		const cameraDistance = Math.pow(cameraPos.x, 2) + Math.pow(cameraPos.y, 2) + Math.pow(cameraPos.z, 2);
	 	var opacity = ((cameraDistance - minCameraDistance) / (maxCameraDistance - minCameraDistance));
		opacity = Math.min(1., Math.max(opacity, 0.))
		this.beamMeshes[0].material.opacity = opacity;
		this.beamMeshes[1].material.opacity = opacity*.25;
		this.sampleMesh.material.opacity = opacity;
		for (var i = 0; i < this.axesMeshes.length; i++){
			this.axesMeshes[i].material.opacity = opacity * .5;
		}
	}

	getClickedPanelPos(){
		window.rayCaster.setFromCamera(window.mousePosition, window.camera);
		const intersects = rayCaster.intersectObjects(this.panelMeshes);
		if (intersects.length > 0) {
			return intersects[0].point;
		}

	}

	getClickedPanelCentroid(){
		window.rayCaster.setFromCamera(window.mousePosition, window.camera);
		const intersects = rayCaster.intersectObjects(this.panelMeshes);
		if (intersects.length > 0) {
			return window.viewer.getPanelCentroid(intersects[0].object.name);
		}
	}

	getClickedPanelMesh(){
		window.rayCaster.setFromCamera(window.mousePosition, window.camera);
		const intersects = rayCaster.intersectObjects(this.panelMeshes);
		if (intersects.length > 0) {
			return intersects[0].object;
		}

	}

	rotateToPos(pos){
		gsap.to( window.camera.position, {
			duration: 1,
			x: -pos.x,
			y: -pos.y,
			z: -pos.z, 
			onUpdate: function() {
				window.camera.lookAt( pos );
				window.viewer.requestRender();
			}
		} );
	}

	zoomInOnPanel(panel, fitOffset=1.1){

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

		const target = center.clone().sub(direction);
		gsap.to( window.camera.position, {
			duration: 1,
			x: target.x,
			y: target.y,
			z: target.z, 
			onUpdate: function() {
				window.camera.lookAt(target);
				window.viewer.requestRender();
			}
		} );
		window.controls.update();
	}

	animate() {
		if (!this.renderRequested){
			return;
		}
		window.viewer.resetPanelColors();
		window.viewer.updateOriginObjectsOpacity();
		window.viewer.updateGUIInfo();
		window.controls.update();
		window.renderer.render(window.scene, window.camera);
		this.renderRequested = false;
	}

	requestRender(){
		if (typeof window !== "undefined" && !this.renderRequested){
			this.renderRequested = true;
			window.requestAnimationFrame(this.animate.bind(this));
		}
	}

}

function setupScene(){

	/**
	 * Sets the renderer, camera, controls
	 */


	if (typeof window.viewer === "undefined"){ return;}

	// Renderer
	window.renderer = new THREE.WebGLRenderer();
	window.renderer.setClearColor(ExperimentViewer.colors()["background"]);
	window.renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(window.renderer.domElement);

	// Two elements used to write text to the screen
	headerText = window.document.getElementById("headerText")
	sidebar = window.document.getElementById("sidebar")

	window.scene = new THREE.Scene()
	window.scene.fog = new THREE.Fog(ExperimentViewer.colors()["background"], 500, 3000);
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
	window.controls.addEventListener("change", function(){window.viewer.requestRender();});

	// Events
	window.mousePosition = new THREE.Vector2();
	window.addEventListener("mousemove", function (e) {
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
		if (fileExt == "refl"){
			window.viewer.addReflectionTable(file);
		}
		else if (fileExt == "expt"){
			window.viewer.addExperiment(file);
		}
	});

	window.addEventListener('dblclick', function(event){
		var panel = window.viewer.getClickedPanelMesh();
		if (panel){
			window.viewer.zoomInOnPanel(panel);
		}
	});

	window.addEventListener('mousedown', function(event){
		if (event.button == 2) { 
			window.viewer.rotateToPos(ExperimentViewer.cameraPositions()["defaultWithExperiment"]);
		}
	});
	window.addEventListener('keydown', function(event){
		if (event.key === "s"){
			window.viewer.toggleSidebar();
		}
	});
	window.viewer.addAxes();
	window.viewer.updateAxes(false);
	window.viewer.setCameraToDefaultPosition();
	window.viewer.requestRender();
}

window.viewer = new ExperimentViewer(new ExptParser(), new ReflParser());
setupScene();

