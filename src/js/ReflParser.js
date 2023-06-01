//import {decode} from "msgpack-js-browser";
import {decode} from "msgpack-lite";

export class ReflParser{

	constructor(){
		this.refl = null;
		this.reflData = {};
		this.filename = null;
		this.numReflections = null
	}

	hasReflTable(){
		return (this.refl != null);
	}

	clearReflectionTable(){
		this.refl = null;
		this.reflData = {};
		this.filename = null;
		this.numReflections = null;
	}

	hasXyzObsData(){
		if (!this.hasReflTable()){
			return false;
		}
		for (var i in this.reflData){
			if (!("xyzObs" in this.reflData[i][0])){
				return false;
			}
		}
		return true;
	}

	hasXyzCalData(){
		if (!this.hasReflTable()){
			return false;
		}
		for (var i in this.reflData){
			if (!("xyzCal" in this.reflData[i][0])){
				return false;
			}
		}
		return true;
	}

	hasBboxData(){
		if (!this.hasReflTable()){
			return false;
		}
		for (var i in this.reflData){
			if (!("bbox" in this.reflData[i][0])){
				return false;
			}
		}
		return true;
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
				/*
				var arr = new Uint8Array(reader.result);
				var buffer = arr.buffer;
				console.log(arr);
				console.log(buffer)
				const decoded = decode(buffer);
				console.log("decodedBuffer", decoded);
				*/
				const decoded = decode(new Uint8Array(reader.result));
				this.refl = decoded[2]["data"];
				this.loadReflectionData();
			};
			reader.readAsArrayBuffer(file);    
			this.filename = file.name;
		});
	};

	containsColumn(column_name){
		return (column_name in this.refl);
	}

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
		return this.getVec3DoubleArray("xyzobs.px.value");
	}

	containsXYZObs(){
		return this.containsColumn("xyzobs.px.value");
	}

	getXYZCal(){
		return this.getVec3DoubleArray("xyzcal.px");
	}

	containsXYZCal(){
		return this.containsColumn("xyzcal.px");
	}

	getBoundingBoxes(){
		return this.getVec6Uint32Array("bbox");
	}

	loadReflectionData(){
		const panelNums = this.getPanelNumbers();
		var xyzObs;
		var xyzCal;
		var bboxes;
		if (this.containsXYZObs()){
			xyzObs = this.getXYZObs();
		}
		if (this.containsXYZCal()){
			xyzCal = this.getXYZCal();
		}	
		bboxes = this.getBoundingBoxes();

		console.assert(xyzObs || xyzCal);
		console.assert(bboxes);

		for (var i = 0; i < panelNums.length; i++){
			const panel = panelNums[i];
			const refl = {
				"bbox" : bboxes[i]
			};
			if (xyzObs){
				refl["xyzObs"] = xyzObs[i];
			}
			if (xyzCal){
				refl["xyzCal"] = xyzCal[i];
			}
			if (panel in this.reflData){
				this.reflData[panel].push(refl);
			}
			else{
				this.reflData[panel] = [refl];
			}
		}

		this.numReflections = panelNums.length;
	}

	getReflectionsForPanel(panelIdx){
		console.assert(this.hasReflTable());
		return this.reflData[panelIdx];
	}
}
