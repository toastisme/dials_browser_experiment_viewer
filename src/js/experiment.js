import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from "gsap";
import { MeshLine, MeshLineMaterial, MeshLineRaycast } from 'three.meshline';
import {decode} from "msgpack-lite";

class ExptParser{

	constructor(){
		this.exptJSON = null;
		this.NameIdxMap = {};
		this.panelCentroids = {};
	}

	hasExptJSON(){
		return this.exptJSON != null;
	}

	static isDIALSExpt(file, content){
		const fileExt = file.name.split(".").pop() ;
		if (fileExt === "expt" && content[0] === "{"){
			return true;
		}
		return false;
	}

	parseExperiment = (file) => {
		const reader = new FileReader();

		return new Promise((resolve, reject) => {
			reader.onerror = () => {
				reader.abort();
				reject(new DOMException("Problem parsing input file."));
			};

			reader.onloadend = () => {
				resolve(reader.result);
				if (ExptParser.isDIALSExpt(file, reader.result)){
					this.exptJSON = JSON.parse(reader.result);
					this.loadPanelData();
				}
			};
			reader.readAsText(file);    
		});
	};

	loadPanelData(){
		for (var i = 0; i < this.getNumDetectorPanels(); i++){
			const data = this.getPanelDataByIdx(i);
			const name = this.getDetectorPanelName(i);
			this.NameIdxMap[name] = i;
			const centroid = data["origin"];
			centroid.add(data["fastAxis"].multiplyScalar(.5));
			centroid.add(data["slowAxis"].multiplyScalar(.5));
			this.panelCentroids[name] = centroid;
		}
	}

	getPanelCentroid(name){
		return this.panelCentroids[name];
	}

	getDetectorPanelData(){
		return this.exptJSON["detector"][0]["panels"];
	}

	getBeamData(){
		return this.exptJSON["beam"][0];
	}

	getPanelDataByName(name){
		const idx = this.NameIdxMap[name];
		const data = this.getPanelDataByIdx(idx);
		return data;
	}

	getPanelDataByIdx(idx){

		/**
		 * Returns dictionary of panel data in mm
		 */

		const panelData = this.getDetectorPanelData()[idx];
		var pxSize = new THREE.Vector2(panelData["pixel_size"][0], panelData["pixel_size"][1]);
		var pxs = new THREE.Vector2(panelData["image_size"][0], panelData["image_size"][1]);
		var panelSize = new THREE.Vector2(pxSize.x*pxs.x, pxSize.y*pxs.y);
		var fa = new THREE.Vector3(panelData["fast_axis"][0], panelData["fast_axis"][1], panelData["fast_axis"][2]).multiplyScalar(panelSize.x);
		var sa = new THREE.Vector3(panelData["slow_axis"][0], panelData["slow_axis"][1], panelData["slow_axis"][2]).multiplyScalar(panelSize.y);
		var o = new THREE.Vector3(panelData["origin"][0], panelData["origin"][1], panelData["origin"][2]);
		return {
			"panelSize" : panelSize,
			"pxSize" : pxSize,
			"pxs" : pxs,
			"fastAxis" : fa,
			"slowAxis" : sa,
			"origin" : o
		}

	}

	getBeamDirection(){
		const beamData = this.getBeamData();
		return new THREE.Vector3(
			beamData["direction"][0], 
			beamData["direction"][1], 
			beamData["direction"][2]
		);
	}

	getNumDetectorPanels(){
		return this.getDetectorPanelData().length;
	}

	getDetectorPanelName(idx){
		return this.getDetectorPanelData()[idx]["name"];
	}

	getDetectorPanelCorners(idx){

		const vecs = this.getPanelDataByIdx(idx);

		// Corners
		var c1 = vecs["origin"].clone();
		var c2 = vecs["origin"].clone().add(vecs["fastAxis"]);
		var c3 = vecs["origin"].clone().add(vecs["fastAxis"]).add(vecs["slowAxis"]);
		var c4 = vecs["origin"].clone().add(vecs["slowAxis"]);
		return [c1, c2, c3, c4];
	}


}

class ReflParser{

	constructor(){
		this.refl = null;
		this.reflData = {};
	}

	hasReflTable(){
		return (this.refl != null);
	}

	parseReflectionTable = (file) => {
		const reader = new FileReader();

		return new Promise((resolve, reject) => {
			reader.onerror = () => {
				reader.abort();
				reject(new DOMException("Problem parsing input file."));
			};

			reader.onloadend = () => {
				resolve(reader.result);
				const decoded = decode(Buffer.from(reader.result));
				this.refl = decoded[2]["data"];
				this.loadReflectionData();
			};
			reader.readAsArrayBuffer(file);    
		});
	};

	getColumnBuffer(column_name){
		return this.refl[column_name][1][1];
	}

	getUint32Array(column_name){
		const buffer = this.getColumnBuffer(column_name);
		const arr = new Uint32Array(buffer.length/8);
		let count = 0;
		for (let i = 0; i < buffer.length; i+=8) {
			arr[count] = buffer.readUInt32LE(i);
			count++;
		}
		return arr;

	}

	getDoubleArray(column_name){
		const buffer = this.getColumnBuffer(column_name);
		const arr = new Float64Array(buffer.length/8);
		let count = 0;
		for (let i = 0; i < buffer.length; i+=8) {
		arr[count] = buffer.readDoubleLE(i);
		count++;
		}
		return arr;
	};

	getVec3DoubleArray(column_name){
		const buffer = this.getColumnBuffer(column_name);
		const arr = new Array(buffer.length/(8*3));
		let count = 0;
		for (let i = 0; i < buffer.length; i+=24){
			const vec = new Float64Array(3);
			vec[0] = buffer.readDoubleLE(i);
			vec[1] = buffer.readDoubleLE(i+8);
			vec[2] = buffer.readDoubleLE(i+16);
			arr[count] = vec;
			count++;
		}
		return arr;
	}

	getVec6Uint32Array(column_name){
		const buffer = this.getColumnBuffer(column_name);
		const arr = new Array(buffer.length/(8*3));
		let count = 0;
		for (let i = 0; i < buffer.length; i+=24){
			const vec = new Uint32Array(6);
			vec[0] = buffer.readUInt32LE(i);
			vec[1] = buffer.readUInt32LE(i+4);
			vec[2] = buffer.readUInt32LE(i+8);
			vec[3] = buffer.readUInt32LE(i+12);
			vec[4] = buffer.readUInt32LE(i+16);
			vec[5] = buffer.readUInt32LE(i+20);
			arr[count] = vec;
			count++;
		}
		return arr;
	}

	getPanelNumbers(){
		return this.getUint32Array("panel");
	}

	getXYZObs(){
		return this.getVec3DoubleArray("xyzobs.mm.value");
	}

	getXYZCal(){
		return this.getVec3DoubleArray("xyzcal.px");
	}

	getBoundingBoxes(){
		return this.getVec6Uint32Array("bbox");
	}

	loadReflectionData(){
		const panelNums = this.getPanelNumbers();
		const xyzObs = this.getXYZObs();
		const bboxes = this.getBoundingBoxes();

		for (var i = 0; i < panelNums.length; i++){
			const panel = panelNums[i];
			const refl = {
				"xyzObs" : xyzObs[i],
				"bbox" : bboxes[i]
			};
			if (panel in this.reflData){
				this.reflData[panel].push(refl);
			}
			else{
				this.reflData[panel] = [refl];
			}
		}
	}

	getReflectionsForPanel(panelIdx){
		console.assert(this.hasReflTable());
		return this.reflData[panelIdx];
	}
}


class ExperimentViewer{
	constructor(exptParser, reflParser){
		this.setupScene();
		this.expt = exptParser;
		this.refl = reflParser;
		this.tooltip = window.document.getElementById("tooltip");
		this.help = window.document.getElementById("help");
		this.panelMeshes = {};
		this.reflMeshes = {};
		this.beamMeshes = {};
		this.textMesh = null;

		this.hightlightColor = new THREE.Color(ExperimentViewer.colors()["highlight"]);
		this.panelColor = new THREE.Color(ExperimentViewer.colors()["panel"]);

		window.renderer.setAnimationLoop(this.animate);
	}

	setupScene(){
		window.renderer = new THREE.WebGLRenderer();
		window.renderer.setClearColor(ExperimentViewer.colors()["background"]);
		window.renderer.setSize(window.innerWidth, window.innerHeight);
		document.body.appendChild(window.renderer.domElement);
		tooltip = window.document.getElementById("tooltip")
		help = window.document.getElementById("help")
		window.scene = new THREE.Scene()
		window.scene.fog = new THREE.Fog(ExperimentViewer.colors()["background"], 500, 3000);
		window.camera = new THREE.PerspectiveCamera(
			45,
			window.innerWidth / window.innerHeight,
			.00001,
			10000
		);
		window.renderer.render(window.scene, window.camera);
		window.rayCaster = new THREE.Raycaster();

		// Controls
		window.controls = new OrbitControls(window.camera, window.renderer.domElement);
		window.controls.maxDistance = 3000;
		window.controls.enablePan = false;
		window.controls.enableDamping = true;
		window.controls.dampingFactor = 0.1;
		window.controls.update();

		// Events
		window.mousePosition = new THREE.Vector2();
		window.addEventListener("mousemove", function (e) {
			window.mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
			window.mousePosition.y = - (e.clientY / window.innerHeight) * 2 + 1;
		});

		window.addEventListener("resize", function() {
			window.camera.aspect = window.innerWidth / window.innerHeight;
			window.camera.updateProjectionMatrix();
			window.renderer.setSize(window.innerWidth, window.innerHeight);
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
			var pos = ExperimentViewer.getClickedPanelCentroid();
			if (pos){
				ExperimentViewer.rotateToPos(pos);
			}
		});

		window.addEventListener('mousedown', function(event){
			if (event.button == 2) { 
				ExperimentViewer.rotateToPos(ExperimentViewer.cameraPositions()["default"]);
			}
		});
		window.addEventListener('keydown', function(event){
			if (event.key === "h"){
				window.viewer.toggleHelp();
			}
		});

	}

	static colors(){
		return {
			"background": 0x222222,
			"sample" : 0xfdf6e3,
			"beam" : 0xdff0e4,
			"reflection" : 0x00bc8c,
			"bbox" : 0xe74c3c,
			"panel" : 0x119dff,
			"highlight" : 0xFFFFFF
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
			"defaultWithExpt" : null, 
			"help" :   ['<b>controls:</b>',
						'H                 = toggle help',
						'left click        = navigate',
						'double left click = focus on panel',
						'right click       = reset view',
						'mouse wheel       = zoom'].join('\n')
		}
	}

	static sizes(){
		return {"reflection" : 5};
	}

	toggleHelp(){
		this.help.style.display = this.help.style.display  === 'block' ? 'none' : 'block';
	}

	hasExperiment(){
		return (this.expt.hasExptJSON());
	}

	addExperiment = async (file) => {
		await this.expt.parseExperiment(file);
		console.assert(this.hasExperiment());
		for (var i = 0; i < this.expt.getNumDetectorPanels(); i++){
			this.addDetectorPanelOutline(i);
		}
		this.addBeam();
		this.setCameraToDefaultPosition();
		this.toggleHelp();
	}

	hasReflectionTable(){
		return (this.refl.hasReflTable());
	}

	addReflectionTable = async (file) => {
		await this.refl.parseReflectionTable(file);
		this.addReflections();
	}

	addReflections(){
		if (!this.hasReflectionTable()){
			console.warn("Tried to add reflections but no table has been loaded");
			return;
		}
		if (!this.hasExperiment()){
			console.warn("Tried to add reflections but no experiment has been loaded");
			return;
		}
		for (var i = 0; i < this.expt.getNumDetectorPanels(); i++){
			const panelReflections = this.refl.getReflectionsForPanel(i);
			const panelData = this.expt.getPanelDataByIdx(i);
			this.addReflectionsForPanel(panelReflections, panelData);
		}

	}

	addReflectionsForPanel(panelReflections, panelData){

		function mapPointToGlobal(point, pOrigin, fa, sa, scaleFactor=[1,1]){
			const pos = pOrigin.clone();
			pos.add(fa.clone().normalize().multiplyScalar(point[0] * scaleFactor[0]));
			pos.add(sa.clone().normalize().multiplyScalar(point[1] * scaleFactor[1]));
			return pos;
		}

		function mapPxPointToGlobal(point, pOrigin, fa, sa){
			const pos = pOrigin.clone();
			pos.add(fa.clone().multiplyScalar(point[0]));
			pos.add(sa.clone().multiplyScalar(point[1]));
			return pos;
		}

		const fa = panelData["fastAxis"];
		const sa = panelData["slowAxis"];
		const pOrigin = panelData["origin"];
		const pxSize = [panelData["pxSize"].x, panelData["pxSize"].y];
		const positions = new Array();
        const sizes = new Array()
		const size = ExperimentViewer.sizes()["reflection"];

		for (var i = 0; i < panelReflections.length; i++){
			const xyz = panelReflections[i]["xyzObs"];
			const pos = mapPointToGlobal(xyz, pOrigin, fa, sa);
			positions.push(pos.x);
			positions.push(pos.y);
			positions.push(pos.z);
			sizes.push(size);

			// bbox corners
			const bbox = panelReflections[i]["bbox"];
			const c1 = mapPointToGlobal([bbox[0], bbox[2]], pOrigin, fa, sa, pxSize);
			const c2 = mapPointToGlobal([bbox[1], bbox[2]], pOrigin, fa, sa, pxSize);
			const c3 = mapPointToGlobal([bbox[1], bbox[3]], pOrigin, fa, sa, pxSize);
			const c4 = mapPointToGlobal([bbox[0], bbox[3]], pOrigin, fa, sa, pxSize);
			const corners = [c1, c2, c3, c4, c1];
			const line = new MeshLine();
			line.setPoints(corners);
			const material = new MeshLineMaterial({
				lineWidth:1,
				color: ExperimentViewer.colors()["reflection"],
				fog:true
			});
			const mesh = new THREE.Mesh(line, material);
			window.scene.add(mesh);

		}
		const reflGeometry = new THREE.BufferGeometry();
		reflGeometry.setAttribute(
			"position", new THREE.Float32BufferAttribute(positions, 3)
		);
		reflGeometry.setAttribute(
			"size", new THREE.Float32BufferAttribute(sizes, 1)
		);

		const sprite = new THREE.TextureLoader().load( "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AYht+mFkupONhBxCFDdbIgKuKoVShChVArtOpgcukfNGlIUlwcBdeCgz+LVQcXZ10dXAVB8AfE1cVJ0UVK/C4ptIjxjuMe3vvel7vvAKFZZZrVMw5oum1mUkkxl18Ve18RQpRmGBGZWcacJKXhO77uEeD7XYJn+df9OfrUgsWAgEg8ywzTJt4gnt60Dc77xDFWllXic+Ixky5I/Mh1xeM3ziWXBZ4ZM7OZeeIYsVjqYqWLWdnUiKeI46qmU76Q81jlvMVZq9ZZ+578hdGCvrLMdVrDSGERS5AgQkEdFVRhI0G7ToqFDJ0nffxDrl8il0KuChg5FlCDBtn1g//B795axckJLymaBEIvjvMxAvTuAq2G43wfO07rBAg+A1d6x19rAjOfpDc6WvwI6N8GLq47mrIHXO4Ag0+GbMquFKQlFIvA+xl9Ux4YuAUia17f2uc4fQCy1Kv0DXBwCIyWKHvd593h7r79W9Pu3w/nSHJv205xcAAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB+cFDAwuJQy6lV0AAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAQK0lEQVRYCQEgEN/vAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOdMPP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGbTEAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAedMPP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOdMPP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGbTEAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOIgKrA07WukAAAAASUVORK5CYII=" );
		sprite.colorSpace = THREE.SRGBColorSpace;
		const reflMaterial = new THREE.PointsMaterial({
			size: 15,
			map: sprite,
			transparent:true,
		});
		const points = new THREE.Points(reflGeometry, reflMaterial);
		window.scene.add(points);

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
		var beamLength = 2000.;
		var bd = this.expt.getBeamDirection();;

		var incidentVertices = []
		incidentVertices.push(
			new THREE.Vector3(bd.x * -beamLength, bd.y * -beamLength, bd.z * -beamLength),
		);
		incidentVertices.push(
			new THREE.Vector3(bd.x * -beamLength*.5, bd.y * -beamLength*.5, bd.z * -beamLength*.5),
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
		const sphereGeometry = new THREE.SphereGeometry(4);
		const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x0000FF, wireframe: true });
		const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
		sphere.name = "sample";
		window.scene.add(sphere);
	}

	addTextCanvas(){
		const canvas = document.createElement('canvas')
		const context = canvas.getContext('2d')
		context.fillStyle = 'green'
		context.font = '60px sans-serif'
		context.fillText('Hello World!', 0, 60)
		// canvas contents are used for a texture
		const texture = new THREE.Texture(canvas)
		texture.needsUpdate = true
		var material = new THREE.MeshBasicMaterial({
		map: texture,
		side: THREE.DoubleSide,
		})
		material.transparent = true
		var mesh = new THREE.Mesh(new THREE.PlaneGeometry(50, 10), material)
		this.textMesh = mesh;
		window.scene.add(mesh);

	}

	setCameraSmooth(position) {
		ExperimentViewer.rotateToPos(position);
		window.controls.update();
	}

	setCameraToDefaultPosition() {
		this.setCameraSmooth(ExperimentViewer.cameraPositions()["default"]);
	}

	setCameraToCentrePosition() {
		this.setCameraSmooth(ExperimentViewer.cameraPositions()["centre"]);
	}

	static displayText(text){
		ExperimentViewer.showText();
		tooltip.textContent = text;
	}

	static hideText(){
		tooltip.style.display = "none";
	}

	static showText(){
		tooltip.style.display = "block";
	}

	static displayDefaultText(){
		if (window.viewer.hasExperiment()){
			ExperimentViewer.hideText();
		}
		else{
			ExperimentViewer.displayText(ExperimentViewer.text()["default"]);
		}
	}

	static highlightObject(obj){
		obj.material.color = new THREE.Color(ExperimentViewer.colors()["highlight"]);
	}

	static updateGUIInfo() {
		window.rayCaster.setFromCamera(window.mousePosition, window.camera);
		const intersects = rayCaster.intersectObjects(window.scene.children);
		if (intersects.length > 0) {
			const name = intersects[0].object.name;
			if (name in window.viewer.panelMeshes){
				ExperimentViewer.displayText(name + " (" + window.viewer.getPanelPosition(intersects[0].point, name) + ")");
				if (name in window.viewer.panelMeshes){
					ExperimentViewer.highlightObject(window.viewer.panelMeshes[name]);
				}
			}
		}
		else{
			ExperimentViewer.displayDefaultText();
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

	updateBeamOpacity(){
		if (!this.hasExperiment()){
			return;
		}
		const minCameraDistance = 55000;
		const maxCameraDistance = 1000000;
		const cameraPos = window.camera.position;
		const cameraDistance = Math.pow(cameraPos.x, 2) + Math.pow(cameraPos.y, 2) + Math.pow(cameraPos.z, 2);
	 	var beamOpacity = ((cameraDistance - minCameraDistance) / (maxCameraDistance - minCameraDistance));
		beamOpacity = Math.min(1., Math.max(beamOpacity, 0.))
		this.beamMeshes["incident"].material.opacity = beamOpacity;
		this.beamMeshes["outgoing"].material.opacity = beamOpacity*.25;
	}

	static getClickedPanelPos(){
		window.rayCaster.setFromCamera(window.mousePosition, window.camera);
		const intersects = rayCaster.intersectObjects(window.scene.children);
		if (intersects.length > 0) {
			return intersects[0].point;
		}

	}

	static getClickedPanelCentroid(){
		window.rayCaster.setFromCamera(window.mousePosition, window.camera);
		const intersects = rayCaster.intersectObjects(window.scene.children);
		if (intersects.length > 0) {
			return window.viewer.getPanelCentroid(intersects[0].object.name);
		}

	}

	static rotateToPos(pos){
		gsap.to( window.camera.position, {
			duration: 1,
			x: -pos.x,
			y: -pos.y,
			z: -pos.z, 
			onUpdate: function() {
				window.camera.lookAt( pos );
			}
		} );
	}

	animate() {
		window.viewer.resetPanelColors();
		window.viewer.updateBeamOpacity();
		ExperimentViewer.updateGUIInfo();
		window.controls.update();
		window.renderer.render(window.scene, window.camera);
	}

}

window.viewer = new ExperimentViewer(new ExptParser(), new ReflParser());

