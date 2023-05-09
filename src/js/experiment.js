import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import gsap from "gsap";
import { MeshLine, MeshLineMaterial, MeshLineRaycast } from 'three.meshline';

class ExperimentViewer{
	constructor(){
		this.setup();
		window.renderer.setAnimationLoop(this.animate);
	}

	addExperiment(exptJSON){
		this.exptJSON = exptJSON;
		this.panelData = this.getDetectorPanels(exptJSON);
		for (var i = 0; i < this.panelData.length; i++){
			this.addDetectorPanelOutline(this.panelData[i]);
		}
		this.beamData = this.getBeam(exptJSON);
		this.addBeam(this.beamData);
		this.setCameraToDefaultPosition();

	}

	setup(){
		window.renderer.setClearColor(ExperimentViewer.colors()["background"]);
	}

	static isDIALSExpt(fileString){
		return (fileString[0] === '{');
	}

	static colors(){
		return {
			"background": 0x222222,
			"sample" : 0xfdf6e3,
			"beam" : 0xdff0e4,
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

	getDetectorPanels(exptJSON){
		return exptJSON["detector"][0]["panels"];
	}

	getBeam(exptJSON){
		return exptJSON["beam"][0];
	}

	getPanelCorners(panelData){
		var pxSize = new THREE.Vector2(panelData["pixel_size"][0], panelData["pixel_size"][1]);
		var pxs = new THREE.Vector2(panelData["image_size"][0], panelData["image_size"][1]);
		var panelSize = new THREE.Vector2(pxSize.x*pxs.x, pxSize.y*pxs.y);
		var fa = new THREE.Vector3(panelData["fast_axis"][0], panelData["fast_axis"][1], panelData["fast_axis"][2]).multiplyScalar(panelSize.x);
		var sa = new THREE.Vector3(panelData["slow_axis"][0], panelData["slow_axis"][1], panelData["slow_axis"][2]).multiplyScalar(panelSize.y);
		var o = new THREE.Vector3(panelData["origin"][0], panelData["origin"][1], panelData["origin"][2]);

		// Corners
		var c1 = o.clone();
		var c2 = o.clone().add(fa);
		var c3 = o.clone().add(fa).add(sa);
		var c4 = o.clone().add(sa);
		return [c1, c2, c3, c4];
	}

	addDetectorPanelOutline(panelData){

		var corners = this.getPanelCorners(panelData);
		corners.push(corners[0]);

		const planeGeometry = new THREE.PlaneGeometry(192, 192);
		const planeMaterial = new THREE.MeshPhongMaterial({
			color : ExperimentViewer.colors()["panel"],
			opacity: 0.0,
			transparent: true,
		});
		const plane = new THREE.Mesh(planeGeometry, planeMaterial);
		plane.name = panelData["name"];

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
		window.scene.add(mesh);

	}

	addBeam(beamData){
		var beam_length = 2000.;
		var bd = new THREE.Vector3(beamData["direction"][0], beamData["direction"][1], beamData["direction"][2]);

		var incidentVertices = []
		incidentVertices.push(
			new THREE.Vector3(bd.x * -beam_length, bd.y * -beam_length, bd.z * -beam_length),
		);
		incidentVertices.push(new THREE.Vector3(0,0,0));
		const incidentLine = new MeshLine();
		incidentLine.setPoints(incidentVertices);
		const incidentMaterial = new MeshLineMaterial({
			lineWidth:5,
			color: ExperimentViewer.colors()["beam"],
			fog: true
		});
		const incidentMesh = new THREE.Mesh(incidentLine, incidentMaterial);
		window.scene.add(incidentMesh);

		var outgoingVertices = []
		outgoingVertices.push(new THREE.Vector3(0,0,0));
		outgoingVertices.push(
			new THREE.Vector3(bd.x * beam_length, bd.y * beam_length, bd.z * beam_length)
		);
		const outgoingLine = new MeshLine();
		outgoingLine.setPoints(outgoingVertices);
		const outgoingMaterial = new MeshLineMaterial({
			lineWidth:5,
			color: ExperimentViewer.colors()["beam"],
			transparent: true,
			opacity: .25,
			fog: true
		});
		const outgoingMesh = new THREE.Mesh(outgoingLine, outgoingMaterial);
		window.scene.add(outgoingMesh);

	}

	addSample() {
		const sphereGeometry = new THREE.SphereGeometry(4);
		const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x0000FF, wireframe: true });
		const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
		sphere.name = "sample";
		window.scene.add(sphere);
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

	static displayName(name){
		console.log(name)
	}

	static highlightObject(obj){

	}

	static updateGUIInfo() {
		window.rayCaster.setFromCamera(window.mousePosition, window.camera);
		const intersects = rayCaster.intersectObjects(window.scene.children);
		if (intersects.length > 0) {
			ExperimentViewer.displayName(intersects[0].object.name);
			//console.log(intersects[0].point);
			/*
			if (window.viewer){
				console.log(
					window.viewer.getPanelPosition(intersects[0].point, intersects[0].object.name)
				);
			}
			*/
			ExperimentViewer.highlightObject();
		}
	}

	getPanelPosition(globalPos, panelName){
		for (var i = 0; i < this.panelData.length; i++){
			if (this.panelData[i]["name"] == panelName){
				var origin = new THREE.Vector3(
					this.panelData[i]["origin"][0], 
					this.panelData[i]["origin"][1], 
					this.panelData[i]["origin"][2]
				);
				var panelPos = origin.sub(globalPos);
				return panelPos;
			}
		}
	}

	static getClickedPanelPos(){
		window.rayCaster.setFromCamera(window.mousePosition, window.camera);
		const intersects = rayCaster.intersectObjects(window.scene.children);
		if (intersects.length > 0) {
			console.log(intersects[0]);
			return intersects[0].point;
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
		ExperimentViewer.updateGUIInfo();
		window.controls.update();
		window.renderer.render(window.scene, window.camera);
	}
}

/* Global Setup */

window.renderer = new THREE.WebGLRenderer();
window.renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(window.renderer.domElement);

window.scene = new THREE.Scene()
window.scene.fog = new THREE.Fog(ExperimentViewer.colors()["background"], 500, 3000);
window.camera = new THREE.PerspectiveCamera(
	45,
	window.innerWidth / window.innerHeight,
	0.0001,
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

	var reader = new FileReader();
	reader.onloadend = function() {
		if (ExperimentViewer.isDIALSExpt(this.result)){
			var data = JSON.parse(this.result);
			window.viewer.addExperiment(data);
		}
	};

	reader.readAsText(event.dataTransfer.files[0]);    
	event.preventDefault();
});

window.addEventListener('dblclick', function(event){
	var pos = ExperimentViewer.getClickedPanelPos();
	ExperimentViewer.rotateToPos(pos);
});

window.addEventListener('mousedown', function(event){
	if (event.button == 2) { 
		ExperimentViewer.rotateToPos(ExperimentViewer.cameraPositions()["default"]);
	}
});

window.viewer = new ExperimentViewer();

