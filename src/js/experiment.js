import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class ExperimentViewer{
	constructor(exptJSON){
		this.setup();
		this.panelData = this.getDetectorPanels(exptJSON);
		console.log(this.panelData);
		this.addDetectorPanel();
		this.addSample();
		window.renderer.setAnimationLoop(this.animate);
	}

	setup(){
		window.renderer.setClearColor(ExperimentViewer.colors["background"]);
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
			"default" : new THREE.Vector3(-10, 30, 30),
			"centre" : new THREE.Vector3(-10, 30, 30)
		};
	}

	getDetectorPanels(exptJSON){
		return exptJSON["detector"][0]["panels"]
	}

	addDetectorPanel() {
		const planeGeometry = new THREE.PlaneGeometry(30, 30);
		const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
		const plane = new THREE.Mesh(planeGeometry, planeMaterial);
		plane.name = "panel";
		window.scene.add(plane);
	}

	addSample() {
		const sphereGeometry = new THREE.SphereGeometry(4);
		const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x0000FF, wireframe: true });
		const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
		sphere.name = "sample";
		window.scene.add(sphere);
	}

	setCameraSmooth(position) {
		window.camera.position = position;
	}

	setCameraToDefaultPosition() {
		this.setCameraSmooth(ExperimentViewer.cameraPositions["default"]);
	}

	setCameraToCentrePosition() {
		this.setCameraSmooth(ExperimentViewer.cameraPositions["centre"]);
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
			ExperimentViewer.highlightObject();
		}
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
window.renderer.setClearColor(ExperimentViewer.colors["background"]);

window.scene = new THREE.Scene();
window.camera = new THREE.PerspectiveCamera(
	45,
	window.innerWidth / window.innerHeight,
	0.0001,
	1000
);
window.renderer.render(window.scene, window.camera);
window.rayCaster = new THREE.Raycaster();

// Controls
window.controls = new OrbitControls(window.camera, window.renderer.domElement);
window.controls.maxDistance = 30;
window.controls.enablePan = false;
window.controls.enableDamping = true;
window.controls.dampingFactor = 0.1;
window.camera.position.z = -5;
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
  console.log("dragover");
});

window.addEventListener('drop', function(event) {

	console.log("dropped");
	var reader = new FileReader();
	reader.onloadend = function() {
		if (ExperimentViewer.isDIALSExpt(this.result)){
			var data = JSON.parse(this.result);
			window.viewer = new ExperimentViewer(data);
		}
	};

	reader.readAsText(event.dataTransfer.files[0]);    
	event.preventDefault();
});

