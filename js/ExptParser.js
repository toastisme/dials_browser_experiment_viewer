import * as THREE from "https://threejs.org/build/three.module.js";

export class ExptParser{

	constructor(){
		this.exptJSON = null;
		this.nameIdxMap = {};
		this.panelCentroids = {};
		this.filename = null;
		this.imageFilenames = null;
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

	clearExperiment(){
		this.exptJSON = null;
		this.nameIdxMap = {};
		this.panelCentroids = {};
		this.filename = null;
		this.imageFilenames = null;
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
					this.filename = file.name;
					this.imageFilenames = this.getImageFilenames();
				}
			};
			reader.readAsText(file);    
		});
	};

	getImageFilenames(){
		return this.exptJSON["imageset"][0]["template"];
	}

	loadPanelData(){
		for (var i = 0; i < this.getNumDetectorPanels(); i++){
			const data = this.getPanelDataByIdx(i);
			const name = this.getDetectorPanelName(i);
			this.nameIdxMap[name] = i;
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
		const idx = this.nameIdxMap[name];
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

	getDetectorPanelNormal(idx){
		const vecs = this.getPanelDataByIdx(idx);
		return vecs["fastAxis"].cross(vecs["slowAxis"]).normalize();

	}



}