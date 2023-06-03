import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from "gsap";
import { MeshLine, MeshLineMaterial, MeshLineRaycast } from 'three.meshline';
import { ExptParser } from "./ExptParser.js";
import { ReflParser } from "./ReflParser.js";

class ExperimentViewer{
	constructor(exptParser, reflParser){
		this.expt = exptParser;
		this.refl = reflParser;
		this.headerText = window.document.getElementById("headerText");
		this.footerText = window.document.getElementById("footerText");
		this.sidebar = window.document.getElementById("sidebar");
		this.panelMeshes = {};
		this.reflPointsObs = [];
		this.reflPositionsObs = [];
		this.reflPointsCal = [];
		this.reflPositionsCal = []
		this.bboxMeshes = [];
		this.beamMeshes = {};
		this.sampleMesh = null;

		this.closeExptButton = document.getElementById("closeExpt");
		this.closeReflButton = document.getElementById("closeRefl");
		this.observedReflsCheckbox = document.getElementById("observedReflections");
		this.calculatedReflsCheckbox = document.getElementById("calculatedReflections");
		this.boundingBoxesCheckbox = document.getElementById("boundingBoxes");
		this.reflectionSize = document.getElementById("reflectionSize");


		this.hightlightColor = new THREE.Color(ExperimentViewer.colors()["highlight"]);
		this.panelColor = new THREE.Color(ExperimentViewer.colors()["panel"]);

		this.displayingImageFilenames = false;

		this.updateReflectionCheckboxStatus();
		this.setDefaultReflectionsDisplay();

	}


	static colors(){
		return {
			"background": 0x222222,
			"sample" : 0xfdf6e3,
			"reflectionObs" : 0xe74c3c,
			"reflectionCal" : 0xFFFFFF,
			"panel" : 0x119dff,
			"highlight" : 0xFFFFFF,
			"beam" : 0xFFFFFF,
			"bbox" : 0xFFFFFF
		};
	}

	static cameraPositions(){
		return {
			"default" : new THREE.Vector3(-1000, 0, 0),
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

	updateObservedReflections(val=null){
		if (val){
			this.observedReflsCheckbox.checked = val;
		}
		for (var i = 0; i < this.reflPointsObs.length; i++){
			this.reflPointsObs[i].visible = this.observedReflsCheckbox.checked;
		}
		this.requestRender();
	}

	updateCalculatedReflections(val=null){
		if (val){
			this.calculatedReflsCheckbox.checked = val;
		}
		for (var i = 0; i < this.reflPointsCal.length; i++){
			this.reflPointsCal[i].visible = this.calculatedReflsCheckbox.checked;
		}
		this.requestRender();
	}

	updateBoundingBoxes(val=null){
		if (val){
			this.boundingBoxesCheckbox.checked = val;
		}
		for (var i = 0; i < this.bboxMeshes.length; i++){
			this.bboxMeshes[i].visible = this.boundingBoxesCheckbox.checked;
		}
		this.requestRender();
	}

	updateReflectionSize(){
		if (!this.hasReflectionTable()){
			return;
		}
		if (this.refl.containsXYZObs() && this.reflPositionsObs){
			const reflGeometryObs = new THREE.BufferGeometry();
			reflGeometryObs.setAttribute(
				"position", new THREE.Float32BufferAttribute(this.reflPositionsObs, 3)
			);

			const reflMaterialObs = new THREE.PointsMaterial({
				size: this.reflectionSize.value,
				transparent:true,
				color: ExperimentViewer.colors()["reflectionObs"]
			});
			const pointsObs = new THREE.Points(reflGeometryObs, reflMaterialObs);
			this.clearReflPointsObs();
			window.scene.add(pointsObs);
			this.reflPointsObs = [pointsObs];
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
		}
		this.requestRender();

	}

	hasExperiment(){
		return (this.expt.hasExptJSON());
	}

	clearExperiment(){
		
		for (const i in this.panelMeshes){
			window.scene.remove(this.panelMeshes[i]);
			this.panelMeshes[i].geometry.dispose();
			this.panelMeshes[i].material.dispose();
		}
		this.panelMeshes = {};

		for (const i in this.beamMeshes){
			window.scene.remove(this.beamMeshes[i]);
			this.beamMeshes[i].geometry.dispose();
			this.beamMeshes[i].material.dispose();
		}
		this.beamMeshes = {};
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
		this.setCameraToDefaultPosition();
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

	clearReflPointsObs(){
		for (var i = 0; i < this.reflPointsObs.length; i++){
			window.scene.remove(this.reflPointsObs[i]);
			this.reflPointsObs[i].geometry.dispose();
			this.reflPointsObs[i].material.dispose();
		}
		this.reflPointsObs = [];
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
		for (var i = 0; i < this.bboxMeshes.length; i++){
			window.scene.remove(this.bboxMeshes[i]);
			this.bboxMeshes[i].geometry.dispose();
			this.bboxMeshes[i].material.dispose();
		}
		this.bboxMeshes = [];
	}

	clearReflectionTable(){
		this.clearReflPointsObs();
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
		if (!this.hasReflectionTable()){
			console.warn("Tried to add reflections but no table has been loaded");
			return;
		}
		if (!this.hasExperiment()){
			console.warn("Tried to add reflections but no experiment has been loaded");
			this.clearReflectionTable();
			return;
		}

		const positionsObs = new Array();
		const positionsCal = new Array();
		const bboxMaterial = new THREE.LineBasicMaterial( { color: ExperimentViewer.colors()["bbox"] } );
		const containsXYZObs = this.refl.containsXYZObs();
		const containsXYZCal = this.refl.containsXYZCal();

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
					positionsObs.push(globalPosObs.x);
					positionsObs.push(globalPosObs.y);
					positionsObs.push(globalPosObs.z);

				}
				if (containsXYZCal){
					const xyzCal = panelReflections[j]["xyzCal"];
					const globalPosCal = this.mapPointToGlobal(xyzCal, pOrigin, fa, sa, pxSize);
					positionsCal.push(globalPosCal.x);
					positionsCal.push(globalPosCal.y);
					positionsCal.push(globalPosCal.z);
				}

				// bbox (1 mesh per reflection, so more expensive to render) 
				const bbox = panelReflections[j]["bbox"];
				const c1 = this.mapPointToGlobal([bbox[0], bbox[2]], pOrigin, fa, sa, pxSize);
				const c2 = this.mapPointToGlobal([bbox[1], bbox[2]], pOrigin, fa, sa, pxSize);
				const c3 = this.mapPointToGlobal([bbox[1], bbox[3]], pOrigin, fa, sa, pxSize);
				const c4 = this.mapPointToGlobal([bbox[0], bbox[3]], pOrigin, fa, sa, pxSize);
				const corners = [c1, c2, c3, c4, c1];
				const bboxGeometry = new THREE.BufferGeometry().setFromPoints( corners );
				const bboxLines = new THREE.Line( bboxGeometry, bboxMaterial );
				this.bboxMeshes.push(bboxLines);
				window.scene.add(bboxLines);
			}
		}

		if (containsXYZObs){
			const reflGeometryObs = new THREE.BufferGeometry();
			reflGeometryObs.setAttribute(
				"position", new THREE.Float32BufferAttribute(positionsObs, 3)
			);

			const reflMaterialObs = new THREE.PointsMaterial({
				size: this.reflectionSize.value,
				transparent:true,
				color: ExperimentViewer.colors()["reflectionObs"]
			});
			const pointsObs = new THREE.Points(reflGeometryObs, reflMaterialObs);
			window.scene.add(pointsObs);
			this.reflPointsObs = [pointsObs];
			this.reflPositionsObs = positionsObs;
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
			this.observedReflsCheckbox.checked = false;
			this.calculatedReflsCheckbox.checked = false;
			this.boundingBoxesCheckbox.checked = false;
			return;
		}

		if (this.reflPointsObs.length > 0){
			this.updateObservedReflections(true);
			this.observedReflsCheckbox.checked = true;
			this.updateCalculatedReflections(false);
			this.calculatedReflsCheckbox.checked = false;
		}
		else if (this.reflPointsCal.length > 0){
			this.showCalculatedReflections(true);
			this.calculatedReflsCheckbox.checked = true;
			this.observedReflsChecbox.checked = false;
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
			this.observedReflsCheckbox.disabled = true;
			this.calculatedReflsCheckbox.disabled = true;
			this.boundingBoxesCheckbox.disabled = true;
			return;
		}
		this.observedReflsCheckbox.disabled = !this.refl.hasXYZObsData();
		this.calculatedReflsCheckbox.disabled = !this.refl.hasXYZCalData();
		this.boundingBoxesCheckbox.disabled = !this.refl.hasBboxData();

	}

	addDetectorPanelOutline(idx){

		var corners = this.expt.getDetectorPanelCorners(idx);
		corners.push(corners[0]);

		const planeGeometry = new THREE.PlaneGeometry(192, 192);
		const planeMaterial = new THREE.MeshPhongMaterial({
			color : ExperimentViewer.colors()["panel"],
			opacity: 0.0,
			transparent: true,
		});
		const plane = new THREE.Mesh(planeGeometry, planeMaterial);
		plane.name = this.expt.getDetectorPanelName(idx);

		window.scene.add(plane);
		var count = 0;
		var idxs = [1,2,0,3]
		for (var i = 0; i < 12; i+=3){
			plane.geometry.attributes.position.array[i] = corners[idxs[count]].x;
			plane.geometry.attributes.position.array[i+1] = corners[idxs[count]].y;
			plane.geometry.attributes.position.array[i+2] = corners[idxs[count]].z;
			count++;
		}

		const line = new MeshLine();
		line.setPoints(corners);
		const material = new MeshLineMaterial({
			lineWidth:7,
			color: ExperimentViewer.colors()["panel"],
			fog:true
		});
		const mesh = new THREE.Mesh(line, material);
		this.panelMeshes[this.expt.getDetectorPanelName(idx)] = mesh;
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
		const incidentLine = new MeshLine();
		incidentLine.setPoints(incidentVertices);
		const incidentMaterial = new MeshLineMaterial({
			lineWidth:5,
			color: ExperimentViewer.colors()["beam"],
			fog: true,
			transparent: true,
			opacity: 0.
		});
		const incidentMesh = new THREE.Mesh(incidentLine, incidentMaterial);
		this.beamMeshes["incident"] = incidentMesh;
		window.scene.add(incidentMesh);

		var outgoingVertices = []
		outgoingVertices.push(new THREE.Vector3(0,0,0));
		outgoingVertices.push(
			new THREE.Vector3(bd.x * beamLength*.5, bd.y * beamLength*.5, bd.z * beamLength*.5)
		);
		outgoingVertices.push(
			new THREE.Vector3(bd.x * beamLength, bd.y * beamLength, bd.z * beamLength)
		);
		const outgoingLine = new MeshLine();
		outgoingLine.setPoints(outgoingVertices);
		const outgoingMaterial = new MeshLineMaterial({
			lineWidth:5,
			color: ExperimentViewer.colors()["beam"],
			transparent: true,
			opacity: .25,
			fog: true,
		});
		const outgoingMesh = new THREE.Mesh(outgoingLine, outgoingMaterial);
		this.beamMeshes["outgoing"] = outgoingMesh;
		window.scene.add(outgoingMesh);
	}

	addSample() {
		const sphereGeometry = new THREE.SphereGeometry(5);
		const sphereMaterial = new THREE.MeshBasicMaterial(
			{ color: ExperimentViewer.colors()["sample"], 
			transparent: true });
		const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
		sphere.name = "sample";
		this.sampleMesh = sphere;
		window.scene.add(sphere);
	}

	setCameraSmooth(position) {
		this.rotateToPos(position);
		window.controls.update();
	}

	setCameraToDefaultPosition() {
		this.setCameraSmooth(ExperimentViewer.cameraPositions()["default"]);
	}

	setCameraToCentrePosition() {
		this.setCameraSmooth(ExperimentViewer.cameraPositions()["centre"]);
	}

	displayHeaderText(text){
		this.showHeaderText();
		this.headerText.innerHTML = text;
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
		this.activelyDisplayingText = true;
	}

	displayNumberOfReflections(){
		this.displayHeaderText(this.refl.numReflections + " reflections");
		this.activelyDisplayingText = true;
	}

	stopDisplayingText(){
		this.activelyDisplayingText = false;
	}


	highlightObject(obj){
		obj.material.color = new THREE.Color(ExperimentViewer.colors()["highlight"]);
	}

	updateGUIInfo() {
		const intersects = rayCaster.intersectObjects(window.scene.children);
		if (this.activelyDisplayingText){
			return;
		}
		window.rayCaster.setFromCamera(window.mousePosition, window.camera);
		if (intersects.length > 0) {
			const name = intersects[0].object.name;
			if (name in this.panelMeshes){
				this.displayHeaderText(name + " (" + this.getPanelPosition(intersects[0].point, name) + ")");
				if (name in this.panelMeshes){
					this.highlightObject(this.panelMeshes[name]);
				}
			}
		}
		else{
			this.displayDefaultHeaderText();
		}
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
		for (var i in this.panelMeshes){
			this.panelMeshes[i].material.color = this.panelColor;
		}
	}

	updateBeamAndSampleOpacity(){
		if (!this.hasExperiment()){
			return;
		}
		const minCameraDistance = 55000;
		const maxCameraDistance = 1000000;
		const cameraPos = window.camera.position;
		const cameraDistance = Math.pow(cameraPos.x, 2) + Math.pow(cameraPos.y, 2) + Math.pow(cameraPos.z, 2);
	 	var opacity = ((cameraDistance - minCameraDistance) / (maxCameraDistance - minCameraDistance));
		opacity = Math.min(1., Math.max(opacity, 0.))
		this.beamMeshes["incident"].material.opacity = opacity;
		this.beamMeshes["outgoing"].material.opacity = opacity*.25;
		this.sampleMesh.material.opacity = opacity;
	}

	getClickedPanelPos(){
		window.rayCaster.setFromCamera(window.mousePosition, window.camera);
		const intersects = rayCaster.intersectObjects(window.scene.children);
		if (intersects.length > 0) {
			return intersects[0].point;
		}

	}

	getClickedPanelCentroid(){
		window.rayCaster.setFromCamera(window.mousePosition, window.camera);
		const intersects = rayCaster.intersectObjects(window.scene.children);
		if (intersects.length > 0) {
			return window.viewer.getPanelCentroid(intersects[0].object.name);
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

	animate() {
		if (!this.renderRequested){
			return;
		}
		window.viewer.resetPanelColors();
		window.viewer.updateBeamAndSampleOpacity();
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
		var pos = window.viewer.getClickedPanelCentroid();
		if (pos){
			window.viewer.rotateToPos(pos);
		}
	});

	window.addEventListener('mousedown', function(event){
		if (event.button == 2) { 
			window.viewer.rotateToPos(ExperimentViewer.cameraPositions()["default"]);
		}
	});
	window.addEventListener('keydown', function(event){
		if (event.key === "s"){
			window.viewer.toggleSidebar();
		}
	});
	window.viewer.requestRender();
}

window.viewer = new ExperimentViewer(new ExptParser(), new ReflParser());
setupScene();

