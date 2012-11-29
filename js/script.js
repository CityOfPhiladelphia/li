var DEBUG = false;
var cache = {summary: null, details: null};

var controller = {
    search: function() {
		$("#search form input").eq(0).focus();
	}
	,summary: function(eventType, matchObj, ui, page, evt) {
		var input = decodeURIComponent(matchObj[1].replace(/\+/g, "%20")).replace(/^\s+|\s+$/g, "");
		if(cache.summary != matchObj[0]) {
			$("[data-role=\"content\"]", page).empty();
			setLoading(true);
			phillyapi.getAddressKey(input, function(addressKey, address) {
				if(addressKey) {
					phillyapi.getSummary(addressKey, function(data) {
						if(DEBUG) console.log(data);
						if(_.isEmpty(data)) {
							controller.error("No history found for this address", page);
						} else {
							$("[data-role=\"content\"]", page).html(_.template($("#template-summary").html(), {address: address, data: data}));
							$("[data-role=\"listview\"]", page).listview();
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
	,permit: function(eventType, matchObj, ui, page, evt) {
		if(cache.details != matchObj[0]) {
			$("[data-role=\"content\"]", page).empty();
			setLoading(true);
			phillyapi.getPermit(matchObj[1], function(data) {
				if(DEBUG) console.log(data);
				$("[data-role=\"content\"]", page).html(_.template($("#template-details-permit").html(), {data: data.d}));
				cache.details = matchObj[0];
				setLoading(false);
			}, function(xhr, status, error) {
				controller.error("There was an issue fetching the permit data from the server", page, xhr);
			});
		}
	}
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
	,error: function(errorMsg, page, xhr) {
		$("[data-role=\"content\"]", page).html(_.template($("#template-details-error").html(), {errorMsg: errorMsg, xhr: xhr}));
		setLoading(false);
	}
};
new $.mobile.Router({
	"#search": { handler: "search", events: "s" }
	,"#summary\\?address=(.*)": { handler: "summary", events: "bs" }
	,"#details\\?entity=permits&eid=(\\d*)": { handler: "permit", events: "bs" }
	,"#details\\?entity=licenses&eid=(\\d*)": { handler: "license", events: "bs" }
	,"#details\\?entity=violationdetails&eid=(\\d*)": { handler: "_case", events: "bs" }
	,"#details\\?entity=(.*)appeals&eid=(\\d*)": { handler: "appeal", events: "bs" }
}, controller);

$(document).ready(function() {
    // Ensure user has input an address before pressing search
	$("#search form").submit(function(e) {
		var inputNode = $("input[name=\"address\"]", $(this));
		if( ! $.trim(inputNode.val())) {
			inputNode.focus();
			return false;
		}
	});
});

// Necessary because v1.1.0 of jQuery Mobile doesn't seem to let you show the loading message during pagebeforeshow
function setLoading(on) {
	if(on) $("body").addClass("ui-loading");
	else $("body").removeClass("ui-loading");
}

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