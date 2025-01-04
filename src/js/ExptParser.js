import * as THREE from 'three';
import pako from 'pako';

export class ExptParser{

	constructor(){
		this.exptJSON = null;
		this.nameIdxMap = {};
		this.panelCentroids = {};
		this.filename = null;
		this.imageFilenames = null;
		this.crystalSummary = null;
		this.imageData = {};
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

	static isExptJSON(data){
		try{
			return data["__id__"] == "ExperimentList";

		}catch(ex){
			return false;
		}
	}

	numExperiments(){
		if (this.exptJSON == null){
			return 0;
		}
		return this.exptJSON["imageset"].length;
	}

	getExptIDs(){
		var exptIDs=[];
		for (var i = 0; i < this.numExperiments(); i++){
			exptIDs.push(i);
		}
		return exptIDs;
	}

	getImageFilename(idx){
		return this.exptJSON["imageset"][idx]["template"];
	}

	getExptLabels(){
		var isWindows = (window.navigator.userAgent.indexOf("Windows") !== -1);
		var exptLabels = [];
		for (var i = 0; i < this.numExperiments(); i++){
			var label = this.getImageFilename(i);
			if (isWindows){
				exptLabels.push(label.split("\\").pop());
			}
			else{
				exptLabels.push(label.split("/").pop());
			}
		}
		return exptLabels;
	}

	clearExperiment(){
		this.exptJSON = null;
		this.nameIdxMap = {};
		this.panelCentroids = {};
		this.filename = null;
		this.imageFilenames = null;
		this.crystalSummary = null;
		this.imageData = {};
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
					this.loadCrystalSummary();
					this.filename = file.name;
					this.imageFilenames = this.getImageFilenames();
				}
			};
			reader.readAsText(file);    
		});
	};

	parseExperimentJSON(jsonString){
		const data = jsonString;
		this.exptJSON = data;
		this.imageSize = data["detector"][0]["panels"][0]["image_size"];
		this.loadCrystalSummary();
		this.loadPanelData();
	}
	
	parseImageData(imageData, panelIdx, exptID, imageDimensions){
		if (!(exptID in this.imageData)){
			this.imageData[exptID] = {};
		}

		const binary = atob(imageData);
		const compressedBuffer = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			compressedBuffer[i] = binary.charCodeAt(i);
		}
		const decompressedBuffer = pako.inflate(compressedBuffer);
		const floatArray = new Float64Array(decompressedBuffer.buffer);
		const array2D = Array.from({ length: imageDimensions[0] }, (_, i) => 
			floatArray.slice(i * imageDimensions[1], (i + 1) * imageDimensions[1])
		);
		this.imageData[exptID][panelIdx] = array2D;
	}

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

	getBeamSummary(){
		const beamData = this.getBeamData();
		const direction = beamData["direction"];
		const wavelength = beamData["wavelength"];
		var text = "direction: (" + direction + "), ";
		if (wavelength){
			text += " wavelength: " + wavelength;
		}
		return text;
	}

	getCrystalData(){
		return this.exptJSON["crystal"][0];
	}

	loadCrystalSummary(){
		const crystalData = this.getCrystalData();
		if (!crystalData){
			this.crystalSummary = null;
			return;
		}
		const aRaw = crystalData["real_space_a"];
		const aVec = new THREE.Vector3(aRaw[0], aRaw[1], aRaw[2]);
		const bRaw = crystalData["real_space_b"];
		const bVec = new THREE.Vector3(bRaw[0], bRaw[1], bRaw[2]);
		const cRaw = crystalData["real_space_c"];
		const cVec = new THREE.Vector3(cRaw[0], cRaw[1], cRaw[2]);

		const a = aVec.length().toFixed(3);
		const b = bVec.length().toFixed(3);
		const c = cVec.length().toFixed(3);

		const alpha = (bVec.angleTo(cVec) * (180./Math.PI)).toFixed(3);
		const beta = (aVec.angleTo(cVec) * (180./Math.PI)).toFixed(3);
		const gamma = (aVec.angleTo(bVec) * (180./Math.PI)).toFixed(3);

		var text = "a: " + a + " b: " + b + " c: " + c;
		text += " alpha: " + alpha + " beta: " + beta + " gamma: " + gamma;
		text += " (" + crystalData["space_group_hall_symbol"] + ")";
		this.crystalSummary = text;
	}

	getCrystalSummary(){
		return this.crystalSummary;
	}

	getPanelDataByName(name){
		const idx = this.nameIdxMap[name];
		const data = this.getPanelDataByIdx(idx);
		return data;
	}

	getPanelIdxByName(name){
		return this.nameIdxMap[name];
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