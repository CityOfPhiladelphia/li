var phillyapi = phillyapi || {};
phillyapi = {
    options: {
    	phillyapi: {
			base: "http://services.phila.gov/PhillyApi/data/v0.7/"
			,summary: "HelperService.svc/GetLocationHistory?$format=json&AddressKey="
			,permit: "Service.svc/permits('%id%')?$format=json"
			,license: "Service.svc/licenses('%id%')?$format=json"
			,_case: "Service.svc/violationdetails?$filter=case_number%20eq%20'%id%'&$expand=cases&$format=json"
			,zoningboardappeal: "Service.svc/zoningboardappeals?$filter=appeal_number%20eq%20'%id%'&$format=json"
			,zbahearingdecisions: "Service.svc/zbahearingdecisions?$filter=appeal_id%20eq%20%id%&$format=json"
			,zbacourtdetails: "Service.svc/zbacourtdetails?$filter=appeal_id%20eq%20%id%&$format=json"
			,buildingboardappeal: "Service.svc/buildingboardappeals?$filter=appeal_number%20eq%20'%id%'&$format=json"
			,bbshearingdecisions: "Service.svc/bbshearingdecisions?$filter=appeal_id%20eq%20%id%&$format=json"
			,bbscourtdetails: "Service.svc/bbscourtdetails?$filter=appeal_id%20eq%20%id%&$format=json"
			,lireviewboardappeal: "Service.svc/lireviewboardappeals?$filter=appeal_number%20eq%20'%id%'&$format=json"
			,lirbhearingdecisions: "Service.svc/lirbhearingdecisions?$filter=appeal_id%20eq%20%id%&$format=json"
			,lirbcourtdetails: "Service.svc/lirbcourtdetails?$filter=appeal_id%20eq%20%id%&$format=json"
			,timeout: 20000
		}
		,ulrs311: {
			base: "http://services.phila.gov/ULRS311/Data/"
			,addressKey: "LIAddressKey/"
			,timeout: 20000
		}
	}

	,getAddressKey: function(input, successCallback, errorCallback) {
		var url = phillyapi.options.ulrs311.base + phillyapi.options.ulrs311.addressKey + encodeURIComponent(input);
		$.jsonp({
			url: url
			,cache: true
			,timeout: phillyapi.options.ulrs311.timeout
			,error: errorCallback
			,success: function(data) {
				if("TopicID" in data) {
					var addressKey = data.TopicID;
    				// Clean up the address. Default format is something like " 01234    MARKET ST" - needs to be "1234 MARKET ST" - Anyone have a better regex for it?
					var address = data.AddressRef ? $.trim(data.AddressRef.replace(/ +(?= )/g,"")).replace(/^0+/, "") : null;
					successCallback(addressKey, address);
				}
			}
		});
	}

	,getSummary: function(addressKey, successCallback, errorCallback, sorted) {
		var url = phillyapi.options.phillyapi.base + phillyapi.options.phillyapi.summary + addressKey;
		phillyapi.fetch(url, function(data) {
			successCallback(sorted ? phillyapi.sortSummary(data) : data);
		}, errorCallback);
	}
	
	,getPermit: function(id, successCallback, errorCallback) {
		var url = phillyapi.options.phillyapi.base + phillyapi.options.phillyapi.permit.replace("%id%", id);
		phillyapi.fetch(url, successCallback, errorCallback);
	}
	
	,getLicense: function(id, successCallback, errorCallback) {
		var url = phillyapi.options.phillyapi.base + phillyapi.options.phillyapi.license.replace("%id%", id);
		phillyapi.fetch(url, successCallback, errorCallback);
	}
	
	,getCase: function(id, successCallback, errorCallback, sorted) {
		var url = phillyapi.options.phillyapi.base + phillyapi.options.phillyapi._case.replace("%id%", id);
		phillyapi.fetch(url, function(data) {
			successCallback(sorted ? phillyapi.sortCase(data) : data);
		}, errorCallback);
	}
	
	/*
		Due to a known issue in the API, we have to do 3 calls here instead of 1. Also, since the Summary gives us the appeal
		number rather than appeal id, we have to wait for the first call to finish in order to get the appeal id for the second two
	*/
	,getAppeal: function(type, id, successCallback, errorCallback) {
		var sortedData = {}, urlKeys = [];
		switch(type) {
			case "zoningboardappeals":
				urlKeys = ["zoningboardappeal", "zbahearingdecisions", "zbacourtdetails"];
				break;
			case "buildingboardappeals":
				urlKeys = ["buildingboardappeal", "bbshearingdecisions", "bbscourtdetails"];
				break;
			case "lireviewboardappeals":
				urlKeys = ["lireviewboardappeal", "lirbhearingdecisions", "lirbcourtdetails"];
				break;
		}
		
		// Appeal Details
		var url1 = phillyapi.options.phillyapi.base + phillyapi.options.phillyapi[urlKeys[0]].replace("%id%", id);
		phillyapi.fetch(url1, function(data) {
			sortedData.d = data.d.results[0];
			var requestsPending = 0;
			
			// Hearing Decisions
			requestsPending++;
			var url2 = phillyapi.options.phillyapi.base + phillyapi.options.phillyapi[urlKeys[1]].replace("%id%", data.d.results[0].appeal_id);
			phillyapi.fetch(url2, function(data) {
				sortedData.d.hearingdecisions = data.d.results;
				requestsPending--;
				if(requestsPending < 1) successCallback(sortedData);
			}, errorCallback);
			// Court History
			requestsPending++;
			var url3 = phillyapi.options.phillyapi.base + phillyapi.options.phillyapi[urlKeys[2]].replace("%id%", data.d.results[0].appeal_id);
			phillyapi.fetch(url3, function(data) {
				sortedData.d.courtdetails = data.d.results;
				requestsPending--;
				if(requestsPending < 1) successCallback(sortedData);
			}, errorCallback);
		}, errorCallback);
	}

	,fetch: function(url, successCallback, errorCallback) {
		$.jsonp({
			url: url
			,cache: true
			,timeout: phillyapi.options.phillyapi.timeout
			,callbackParameter: "$callback"
			,success: successCallback
			,error: errorCallback
		});
	}
	
	// Sort summary data into categories
	,sortSummary: function(data) {
		var sortedData = {};
		for(var i = 0; i < data.length; i++) {
			switch(data[i].category) {
				case "Violation":
					if(sortedData.cases === undefined) {
						sortedData.cases = {};
					}
					if(sortedData.cases[data[i].id] === undefined) {
						sortedData.cases[data[i].id] = {
							"case_number": data[i].id
							,"violations": []
							,"entity": data[i].entity
						}
					}
					sortedData.cases[data[i].id].violations.push(data[i].type);
					break;
				case "Permit":
					if(sortedData.permits === undefined) {
						sortedData.permits = [];
					}
					sortedData.permits.push({
						"permit_number": data[i].id
						,"permit_type_name": data[i].type
						,"entity": data[i].entity
					});
					break;
				case "Business":
					if(sortedData.licenses === undefined) {
						sortedData.licenses = [];
					}
					sortedData.licenses.push({
						"license_number": data[i].id
						,"license_type_name": data[i].type
						,"entity": data[i].entity
					});
					break;
				case "Appeal":
					if(sortedData.appeals === undefined) {
						sortedData.appeals = [];
					}
					sortedData.appeals.push({
						"appeal_number": data[i].id
						,"appeal_type_name": data[i].type
						,"entity": data[i].entity
					});
					break;
				default:
					if(sortedData.other === undefined) {
						sortedData.other = [];
					}
					sortedData.other.push({
						"number": data[i].id
						,"type_name": data[i].type
					});
					break;
			}
		}
		if(sortedData.cases !== undefined) sortedData.cases = phillyapi.objToArray(sortedData.cases);
		return sortedData;
	}
	
	/*
		This is a work-around for a known issue in the API. Ideally we'd do a call to the case and expand the violationdetails,
		but since that gives an error, we do a call to the violation details of the case and expand the case.
		That gives the case details multiple times, but at least it's only one ajax call. This function shuffles the data
		around to be the case with a violationdetails array.
	*/
	,sortCase: function(data) {
		var sortedData = {};
		sortedData.d = data.d.results[0].cases;
		for(var i = 0; i < data.d.results.length; i++) {
			if(data.d.results[i].cases !== undefined) delete data.d.results[i].cases;
		}
		sortedData.d.violationdetails = data.d.results;
		return sortedData;
	}
	
	// Stock function
	,objToArray: function(obj) {
		var arr = []
		for(var key in obj) {
			arr.push(obj[key]);
		}
		return arr;
	}
};