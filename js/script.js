/*
 * L&I Property History
 * City of Philadelphia
 */
var DEBUG = false;
var cache = {summary: null, details: null};

/*
 * The controller methods are called by the router, interact with the model (phillyapi),
 * and render to the template using underscore.js
 */
var controller = {
	/*
	 * Search - focus on the address box
	 */
	search: function() {
		$("#search form input").eq(0).focus();
	}
	/*
	 * Summary - read the address querystring, get the L&I address key, then get history summary
	 */
	,summary: function(eventType, matchObj, ui, page, evt) {
		// Sanitize the user's input (the address)
		var input = decodeURIComponent(matchObj[1].replace(/\+/g, "%20")).replace(/^\s+|\s+$/g, "");
		
		// If we were just looking at this page, it's already rendered so don't do anything
		if(cache.summary != matchObj[0]) {
			$("[data-role=\"content\"]", page).empty();
			setLoading(true);
			
			// Get the L&I Address Key from the address
			phillyapi.getAddressKey(input, function(addressKey, address) {
				if(addressKey) {
					// Get the history summary
					phillyapi.getSummary(addressKey, function(data) {
						if(DEBUG) console.log(data);
						if(_.isEmpty(data)) {
							controller.error("No history found for this address", page);
						} else {
							// Pass data to template for rendering
							$("[data-role=\"content\"]", page).html(_.template($("#template-summary").html(), {address: address, data: data}));
							
							// jQuery Mobile enhance list we just created
							$("[data-role=\"listview\"]", page).listview();
							
							// Tell the cache that this is the page that's currently rendered so we can come back to it easily
							cache.summary = matchObj[0];
							setLoading(false);
						}
					}, function(xhr, status, error) {
						controller.error("There was an issue fetching the summary data from the server", page, xhr);
					}, true);
				} else {
					controller.error("The address entered is not a valid L&I address", page);
				}
			});
		}
	}
	/*
	 * View a permit
	 */
	,permit: function(eventType, matchObj, ui, page, evt) {
		// If we were just looking at this page, it's already rendered so don't do anything
		if(cache.details != matchObj[0]) {
			$("[data-role=\"content\"]", page).empty();
			setLoading(true);
			
			// Get the details of this item
			phillyapi.getPermit(matchObj[1], function(data) {
				if(DEBUG) console.log(data);
				
				// Pass data to template for rendering
				$("[data-role=\"content\"]", page).html(_.template($("#template-details-permit").html(), {data: data.d}));
				
				// Tell the cache that this is the page that's currently rendered so we can come back to it easily
				cache.details = matchObj[0];
				setLoading(false);
			}, function(xhr, status, error) {
				controller.error("There was an issue fetching the permit data from the server", page, xhr);
			});
		}
	}
	/*
	 * View a license
	 */
	,license: function(eventType, matchObj, ui, page, evt) {
		if(cache.details != matchObj[0]) {
			$("[data-role=\"content\"]", page).empty();
			setLoading(true);
			phillyapi.getLicense(matchObj[1], function(data) {
				if(DEBUG) console.log(data);
				$("[data-role=\"content\"]", page).html(_.template($("#template-details-license").html(), {data: data.d}));
				cache.details = matchObj[0];
				setLoading(false);
			}, function(xhr, status, error) {
				controller.error("There was an issue fetching the license data from the server", page, xhr);
			});
		}
	}
	/*
	 * View a violation/case
	 */
	,_case: function(eventType, matchObj, ui, page, evt) {
		if(cache.details != matchObj[0]) {
			$("[data-role=\"content\"]", page).empty();
			setLoading(true);
			phillyapi.getCase(matchObj[1], function(data) {
				if(DEBUG) console.log(data);
				$("[data-role=\"content\"]", page).html(_.template($("#template-details-case").html(), {data: data.d}));
				$("[data-role=\"collapsible-set\"]", page).collapsibleset();
				cache.details = matchObj[0];
				setLoading(false);
			}, function(xhr, status, error) {
				controller.error("There was an issue fetching the case data from the server", page, xhr);
			}, true);
		}
	}
	/*
	 * View an appeal
	 */
	,appeal: function(eventType, matchObj, ui, page, evt) {
		if(cache.details != matchObj[0]) {
			$("[data-role=\"content\"]", page).empty();
			setLoading(true);
			phillyapi.getAppeal(matchObj[1] + "appeals", matchObj[2], function(data) {
				if(DEBUG) console.log(data);
				$("[data-role=\"content\"]", page).html(_.template($("#template-details-appeal").html(), {data: data.d}));
				$("[data-role=\"collapsible-set\"]", page).collapsibleset();
				cache.details = matchObj[0];
				setLoading(false);
			}, function(xhr, status, error) {
				controller.error("There was an issue fetching the appeal data from the server", page, xhr);
			});
		}
	}
	/*
	 * Show an error
	 */
	,error: function(errorMsg, page, xhr) {
		$("[data-role=\"content\"]", page).html(_.template($("#template-details-error").html(), {errorMsg: errorMsg, xhr: xhr}));
		setLoading(false);
	}
};

/*
 * Interpret the various URLs and routes them to the controller
 * Using azicchetti's awesome jquerymobile-router
 * https://github.com/azicchetti/jquerymobile-router
 */
new $.mobile.Router({
	"#search": { handler: "search", events: "s" }
	,"#summary\\?address=(.*)": { handler: "summary", events: "bs" }
	,"#details\\?entity=permits&eid=(\\d*)": { handler: "permit", events: "bs" }
	,"#details\\?entity=licenses&eid=(\\d*)": { handler: "license", events: "bs" }
	,"#details\\?entity=violationdetails&eid=(\\d*)": { handler: "_case", events: "bs" }
	,"#details\\?entity=(.*)appeals&eid=(\\d*)": { handler: "appeal", events: "bs" }
}, controller);

/*
 * DOM hook to ensure user has input an address before pressing search
 */
$(document).ready(function() {
	$("#search form").submit(function(e) {
		var inputNode = $("input[name=\"address\"]", $(this));
		if( ! $.trim(inputNode.val())) {
			inputNode.focus();
			return false;
		}
	});
});

/*
 * Necessary because v1.1.0 of jQuery Mobile doesn't seem to let you show the loading message during pagebeforeshow
 */
function setLoading(on) {
	if(on) $("body").addClass("ui-loading");
	else $("body").removeClass("ui-loading");
}

/*
 * Stock function to show user friendly date
 */
function display_date(input, show_time){
	var str;
	if(input) {
		var UNIX_timestamp = input.replace(/\D/g, "") / 1000;
		var a = new Date(UNIX_timestamp*1000);
		var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
		var year = a.getFullYear();
		var month = a.getMonth()+1;
		var date = a.getDate();
		str = month+"/"+date+"/"+year;
		if(show_time) {
			var hour = a.getHours();
			var min = ("0" + a.getMinutes()).slice(-2);
			var sec = ("0" + a.getSeconds()).slice(-2);
			str += hour+":"+min+":"+sec;
		}
	}
	return str;
}