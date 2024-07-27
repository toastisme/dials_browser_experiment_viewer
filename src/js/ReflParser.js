import { deserialize } from "@ygoe/msgpack";

export class ReflParser{

	constructor(){
		this.refl = null;
		this.reflData = {};
		this.indexedMap = {};
		this.unindexedMap = {};
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

	hasXYZObsData(){
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

	hasXYZCalData(){
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

	hasIntegratedData(){
		if (!this.hasXYZCalData()){
			return false;
		}
		for (var i in this.reflData){
			if (("summedIntensity" in this.reflData[i][0])){
				return true;
			}
		}
		return false;
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

	hasMillerIndicesData(){
		if (!this.hasReflTable()){
			return false;
		}
		for (var i in this.reflData){
			if (!("millerIdx" in this.reflData[i][0])){
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
				const decoded = deserialize(new Uint8Array(reader.result));
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

	getUint32Array(column_name) {
		const buffer = this.getColumnBuffer(column_name);
		const dataView = new DataView(buffer.buffer);
		const arr = new Uint32Array(buffer.byteLength / 8);
		let count = 0;
		
		for (let i = 0; i < buffer.byteLength; i += 8) {
			arr[count] = dataView.getUint32(buffer.byteOffset + i, true); 
			count++;
		}
		return arr;
	}

	getInt32Array(column_name) {
		const buffer = this.getColumnBuffer(column_name);
		const dataView = new DataView(buffer.buffer);
		const arr = new Int32Array(buffer.byteLength / 4);
		let count = 0;
		
		for (let i = 0; i < buffer.byteLength; i += 4) {
			arr[count] = dataView.getInt32(buffer.byteOffset + i, true); 
			count++;
		}
		return arr;
	}

	getDoubleArray(column_name){
		const buffer = this.getColumnBuffer(column_name);
		const dataView = new DataView(buffer.buffer);
		const arr = new Float64Array(buffer.length/8);
		let count = 0;
		for (let i = 0; i < buffer.byteLength; i+=8) {
		arr[count] = dataView.getFloat64(buffer.byteOffset + i, true);
		count++;
		}
		return arr;
	};

	getVec3DoubleArray(column_name){
		const buffer = this.getColumnBuffer(column_name);
		const dataView = new DataView(buffer.buffer);
		const arr = new Array(buffer.length/(8*3));
		let count = 0;
		for (let i = 0; i < buffer.byteLength; i+=24){
			const vec = new Float64Array(3);
			vec[0] = dataView.getFloat64(buffer.byteOffset + i, true);
			vec[1] = dataView.getFloat64(buffer.byteOffset + i+8, true);
			vec[2] = dataView.getFloat64(buffer.byteOffset + i+16, true);
			arr[count] = vec;
			count++;
		}
		return arr;
	}

	getVec6Int32Array(column_name){
		const buffer = this.getColumnBuffer(column_name);
		const arr = new Array(buffer.length/(6*4));
		const dataView = new DataView(buffer.buffer);
		let count = 0;
		for (let i = 0; i < buffer.length; i+=24){
			const vec = new Int32Array(6);
			vec[0] = dataView.getInt32(buffer.byteOffset + i, true);
			vec[1] = dataView.getInt32(buffer.byteOffset + i+4, true);
			vec[2] = dataView.getInt32(buffer.byteOffset + i+8, true);
			vec[3] = dataView.getInt32(buffer.byteOffset + i+12, true);
			vec[4] = dataView.getInt32(buffer.byteOffset + i+16, true);
			vec[5] = dataView.getInt32(buffer.byteOffset + i+20, true);
			arr[count] = vec;
			count++;
		}
		return arr;
	}

	getVec3Int32Array(column_name){
		const buffer = this.getColumnBuffer(column_name);
		const arr = new Array(buffer.length/(3*4));
		const dataView = new DataView(buffer.buffer);
		let count = 0;
		for (let i = 0; i < buffer.length; i+=12){
			const vec = new Int32Array(3);
			vec[0] = dataView.getInt32(buffer.byteOffset + i, true);
			vec[1] = dataView.getInt32(buffer.byteOffset + i+4, true);
			vec[2] = dataView.getInt32(buffer.byteOffset + i+8, true);
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
		return this.getVec6Int32Array("bbox");
	}

	containsMillerIndices(){
		return this.containsColumn("miller_index");
	}

	getMillerIndices(){
		return this.getVec3Int32Array("miller_index");
	}

	isValidMillerIndex(idx){
		return Math.pow(idx[0], 2) + Math.pow(idx[1], 2) + Math.pow(idx[2], 2) > 1e-3;
	}

	containsExperimentIDs(){
		return this.containsColumn("id");
	}

	getExperimentIDs(){
		if (this.containsColumn("imageset_id")){
			return this.getInt32Array("imageset_id");
		}
		return this.getInt32Array("id");
	}

	loadReflectionData(){
		const panelNums = this.getPanelNumbers();
		var xyzObs;
		var xyzCal;
		var bboxes;
		var millerIndices;
		var experimentIDs;

		if (this.containsXYZObs()){
			xyzObs = this.getXYZObs();
		}
		if (this.containsXYZCal()){
			xyzCal = this.getXYZCal();
		}	
		if (this.containsMillerIndices()){
			millerIndices = this.getMillerIndices();
		}
		if (this.containsExperimentIDs()){
			experimentIDs =  this.getExperimentIDs();
		}

		bboxes = this.getBoundingBoxes();

		console.assert(xyzObs || xyzCal);
		console.assert(bboxes);

		var numUnindexed = 0;
		var numIndexed = 0;
		for (var i = 0; i < panelNums.length; i++){
			const panel = panelNums[i];
			const refl = {
				"bbox" : bboxes[i],
				"indexed" : false
			};

			if (experimentIDs != null){
				refl["exptID"] = experimentIDs[i];
			}
			else{
				refl["exptID"] = 0;
			}

			if (xyzObs){
				refl["xyzObs"] = xyzObs[i];
			}
			if (xyzCal){
				refl["xyzCal"] = xyzCal[i];
			}
			if (millerIndices){
				refl["millerIdx"] = millerIndices[i];
				if (this.isValidMillerIndex(millerIndices[i])){
					refl["indexed"] = true;
					refl["id"] = numIndexed;
					this.indexedMap[numIndexed] = millerIndices[i];
					numIndexed++; 
				}
				else{
					refl["id"] = numUnindexed;
					numUnindexed++;
				}
			}
			else{
				refl["id"] = numUnindexed;
				numUnindexed++;
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

	getMillerIndexById(id){
		return this.indexedMap[id];
	}

	getReflectionsForPanel(panelIdx){
		console.assert(this.hasReflTable());
		return this.reflData[panelIdx];
	}
}
