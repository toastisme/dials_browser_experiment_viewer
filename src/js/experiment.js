import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
//import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
//import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';

// Params
const defaultCameraPosition = new THREE.Vector3(-10, 30, 30);
const defaultCentreCameraPosition = new THREE.Vector3(-10, 30, 30);
const backgroundColor = 0x222222;
const sampleColor = 0xfdf6e3;
const beamColor = 0xdff0e4;
const panelColor = 0x119dff;

/*
const loader = new FontLoader();

loader.load( 'three/examples/fonts/helvetiker_regular.typeface.json', function ( font ) {

	const geometry = new TextGeometry( 'Hello three.js!', {
		font: font,
		size: 80,
		height: 5,
		curveSegments: 12
	} );
} );
*/

// Setup
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
	45,
	window.innerWidth / window.innerHeight,
	0.0001,
	1000
);
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxDistance = 30;
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.1;
camera.position.z = -5;
controls.update();

// Events
const mousePosition = new THREE.Vector2();
window.addEventListener("mousemove", function (e) {
	mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
	mousePosition.y = - (e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("resize", function() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
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
		if (isDIALSExpt(this.result)){
			var data = JSON.parse(this.result);
			var panels = getDetectorPanels(data);
			console.log(panels);
		}
	};

	reader.readAsText(event.dataTransfer.files[0]);    
	event.preventDefault();
});

function isDIALSExpt(fileString){
	return (fileString[0] === '{');
}

function getDetectorPanels(exptJSON){
	return exptJSON["detector"][0]["panels"]
}

const rayCaster = new THREE.Raycaster();

renderer.setClearColor(backgroundColor);

const axesHelper = new THREE.AxesHelper(3);

scene.add(axesHelper);

function addDetectorPanel() {
	const planeGeometry = new THREE.PlaneGeometry(30, 30);
	const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
	const plane = new THREE.Mesh(planeGeometry, planeMaterial);
	plane.name = "panel";
	scene.add(plane);
}

function addSample() {
	const sphereGeometry = new THREE.SphereGeometry(4);
	const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x0000FF, wireframe: true });
	const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
	sphere.name = "sample";
	scene.add(sphere);
}

function setCameraSmooth(position) {
	camera.position = position;
}

function setCameraToDefaultPosition() {
	setCameraSmooth(defaultCameraPosition);
}

function setCameraToDefaultCentrePosition() {
	setCameraSmooth(defaultCentreCameraPosition);
}

function displayName(name){
	console.log(name)
}

function highlightObject(obj){

}

function updateGUIInfo() {
	rayCaster.setFromCamera(mousePosition, camera);
	const intersects = rayCaster.intersectObjects(scene.children);
	if (intersects.length > 0) {
		displayName(intersects[0].object.name);
		highlightObject();
	}
}


function animate() {
	updateGUIInfo();
	controls.update();
	renderer.render(scene, camera);
}


addDetectorPanel();
addSample();

renderer.setAnimationLoop(animate);
