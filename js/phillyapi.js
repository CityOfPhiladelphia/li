var permits = ["BP_ADDITON", "BP_ADMINST", "BP_ALTER", "BP_DEMO", "BP_FIRESUP", "BP_MECH", "BP_NEWCNST", "BP_SIGN", "EP_ELECTRL", "L_FFORM", "L_PREPLUM", "PP_PLUMBNG", "PPTY CERT", "ZP_ADMIN", "ZP_USE", "ZP_ZON/USE", "ZP_ZONING"];
var cases = ["CD ENFORCE", "DANGEROUS", "L_CLIP", "L_DANGBLDG", "L_ENCAPS", "L_HOUSING", "L_PREPLUMX"];

var phillyapi = phillyapi || {};
phillyapi = {
  options: {
    query: {
      permits: "SELECT * FROM LI_PERMITS WHERE addresskey IN ('%s') ORDER BY permittype", // I used the IN sentence because there could be multiple address key separated by comma (,)
      licenses: "SELECT * FROM LI_BUSINESS_LICENSES WHERE eclipse_addressobjectid = '%s' ORDER BY licensetype",
      violations: "SELECT * FROM LI_VIOLATIONS WHERE addresskey IN ('%s') ORDER BY casenumber DESC",
      appeals: "SELECT * FROM LI_APPEALS WHERE addresskey IN ('%s') ORDER BY date_scheduled DESC",

      permitsdetail: "SELECT * FROM LI_PERMITS WHERE permitnumber = '%s' AND addresskey IN ('%s')",
      licencesdetail: "SELECT * FROM LI_BUSINESS_LICENSES WHERE licensenum = '%s'",
      violationsdetail: "SELECT *  FROM LI_VIOLATIONS WHERE casenumber = '%s' AND addresskey IN ('%s')  ORDER BY violationdate DESC",
      appealdetail: "SELECT * FROM LI_APPEALS WHERE appeal_key = '%s' AND addresskey IN ('%s') ORDER BY decisiondate DESC LIMIT 1 OFFSET 0",
      desitionshistory: "SELECT * FROM LI_BOARD_DECISIONS WHERE appealkey = '%s' ORDER BY decisiondate DESC",
      courthistory: "SELECT * FROM LI_COURT_APPEALS WHERE appealkey = '%s' ORDER BY courtactiondate DESC",

      address: "SELECT owner_1,owner_2,mailing_zip,mailing_city_state,mailing_street,mailing_address_1,mailing_address_2,mailing_care_of FROM opa_properties_public WHERE upper(location) LIKE CONCAT('%%', upper('%s'), '%%')  LIMIT 1 OFFSET 0"
    },
    prepare: function () {
      if (!arguments || arguments.length == 0) {
        return "";
      }
      var a = Array.from(arguments);
      var q = a.shift();
      return encodeURIComponent(vsprintf(q, a));
    },
    searchURL: "https://api.phila.gov/ais/v1/search/%s/?gatekeeperKey=44e6f0081ba0144ea3a69628e2ba6328",
    serviceURL: "https://data.phila.gov/carto/api/v2/sql?q=",
    timeout: 20000
  },

  getSummary: function (query, successCallback, errorCallback, type) {
    var url = phillyapi.options.serviceURL + query;
    phillyapi.fetch(url, function (data) {
      if ('appeals' == type && !_.isEmpty(data.rows)) {
        data.rows = phillyapi.sortAppeals(data.rows);
      }
      if ('licenses' == type && !_.isEmpty(data.rows)) {
        data.rows = phillyapi.sort(data.rows, 'licensetype');
      }
      if ('permits' == type && !_.isEmpty(data.rows)) {
        data.rows = phillyapi.sort(data.rows, 'permittype');
      }
      if ('violations' == type && !_.isEmpty(data.rows)) {
        data.rows = phillyapi.sortViolations(data.rows);
      }

      successCallback(data);
    }, errorCallback);
  },

  getAddressInfo: function (address, successCallback, errorCallback) {
    var url = vsprintf(phillyapi.options.searchURL, [encodeURIComponent(address)]);
    phillyapi.fetch(url, successCallback, errorCallback);
  },

  getPermit: function (id, address, successCallback, errorCallback) {
    var url = phillyapi.options.serviceURL + phillyapi.options.prepare(phillyapi.options.query.permitsdetail, id, address);
    phillyapi.fetch(url, function (data) {

      if (data.rows && data.rows[0]) {
        data.rows[0].permitissuedate = phillyapi.serverDate(data.rows[0].permitissuedate).toDateString();
      }

      successCallback(data);
    }, errorCallback);
  },

  getLicense: function (id, successCallback, errorCallback) {
    var url = phillyapi.options.serviceURL + phillyapi.options.prepare(phillyapi.options.query.licencesdetail, id);
    phillyapi.fetch(url, function (data) {

      if (data.rows && data.rows[0]) {
        data.rows[0].initialissuedate = phillyapi.serverDate(data.rows[0].initialissuedate).toDateString();
      }

      successCallback(data);
    }, errorCallback);
  },

  getCase: function (id, address, successCallback, errorCallback) {
    var url = phillyapi.options.serviceURL + phillyapi.options.prepare(phillyapi.options.query.violationsdetail, id, address);
    phillyapi.fetch(url, function (data) {
      if (data.rows && data.rows[0]) {
        for (i = 0; i < data.rows.length; i++) {
          data.rows[i].mostrecentinsp = (!_.isEmpty(data.rows[i].mostrecentinsp)) ?
            phillyapi.serverDate(data.rows[i].mostrecentinsp).toDateString() :
            " - ";

          data.rows[i].caseresolutiondate = (!_.isEmpty(data.rows[i].caseresolutiondate)) ?
            phillyapi.serverDate(data.rows[i].caseresolutiondate).toDateString() :
            " - ";

          data.rows[i].caseaddeddate = (!_.isEmpty(data.rows[i].caseaddeddate)) ?
            phillyapi.serverDate(data.rows[i].caseaddeddate).toDateString() :
            " - ";

          data.rows[i].violationdate = (!_.isEmpty(data.rows[i].violationdate)) ?
            phillyapi.serverDate(data.rows[i].violationdate).toDateString() :
            " - ";
        }

        var row2 = jQuery.extend(true, {}, data.rows[0]);

        // Patch; The case status is wrongly displayed. So, I have to push this patch
        // to parse the resolution code to a human readable cse resolution code.
        // Rolling back this patch, it is not needed anymore.
        // if (_.isEmpty(row2.caseresolutioncode)) {
        //   row2.caseresolutiontext = 'OPEN';
        // } else if (row2.caseresolutioncode == 'ABATE' || row2.caseresolutioncode == 'ENCAP') {
        //   row2.caseresolutiontext = 'CLEAN AND SEAL';
        // } else if (row2.caseresolutioncode == 'DEMO') {
        //   row2.caseresolutiontext = 'DEMOLISHED';
        // } else {
        //   row2.caseresolutiontext = 'CLOSED';
        // }

        if (_.isEmpty(row2.casestatus)) {
          row2.casestatus = '-';
        }

        row2.violationdetails = data.rows;
        data.rows = row2;
      }
      successCallback(data);
    }, errorCallback);
  },

  getAppeal: function (id, address, successCallback, errorCallback) {
    var url = phillyapi.options.serviceURL + phillyapi.options.prepare(phillyapi.options.query.appealdetail, id, address);
    phillyapi.fetch(url, function (data) {
      data.rows = phillyapi.sortAppeal(data.rows);
      successCallback(data);
    }, errorCallback);
  },

  getDesitionHistory: function (id, successCallback, errorCallback) {
    var url = phillyapi.options.serviceURL + phillyapi.options.prepare(phillyapi.options.query.desitionshistory, id);
    phillyapi.fetch(url, function (data) {
      var results = (!_.isEmpty(data.rows)) ?
        data.rows : [];

      if (results.length) {
        for (i = 0; i < results.length; i++) {
          results[i].decisiondate = (!_.isEmpty(results[i].decisiondate)) ?
            phillyapi.serverDate(results[i].decisiondate).toDateString() :
            " - ";
        }

      }

      successCallback(results);
    }, errorCallback);
  },

  getCourtHistory: function (id, successCallback, errorCallback) {
    var url = phillyapi.options.serviceURL + phillyapi.options.prepare(phillyapi.options.query.courthistory, id);
    phillyapi.fetch(url, function (data) {
      var results = (!_.isEmpty(data.rows)) ?
        data.rows : [];

      if (results.length) {
        for (i = 0; i < results.length; i++) {
          results[i].courtactiondate = (!_.isEmpty(results[i].courtactiondate)) ?
            phillyapi.serverDate(results[i].courtactiondate).toDateString() :
            " - ";
        }

      }
      successCallback(results);
    }, errorCallback);
  },

  getAddress: function (address, successCallback, errorCallback) {
    var url = phillyapi.options.serviceURL + phillyapi.options.prepare(phillyapi.options.query.address, address);
    phillyapi.fetch(url, function (data) {
      successCallback(data);
    }, errorCallback);
  },

  fetch: function (url, successCallback, errorCallback) {
    $.ajax({
      type: 'GET',
      url: url,
      dataType: 'json',
      cache: true,
      timeout: phillyapi.options.timeout,
      success: successCallback,
      error: errorCallback
    });
  },

  sortAppeal: function (rows) {
    var row2 = jQuery.extend(true, {}, rows[0]);
    return row2;
  },

  sortCase: function (rows) {
    var row2 = jQuery.extend(true, {}, rows[0]);
    row2.violationdetails = rows;
    return row2;
  },

  sort: function (rows, by) {
    var sorted = [];
    var sorting = [];
    var temp = null;

    $.each(rows, function () {
      if (this[by] != temp && temp != null) {
        sorted.push(sorting);
        sorting = [];
      }

      sorting.push(this);
      temp = this[by];
    });

    if (sorting.length > 0) {
      sorted.push(sorting);
    }

    return sorted;
  },

  sortViolations: function (rows) {
    $.each(rows, function (index, obj) {
      if (DEBUG) console.log("VIOLATION TYPE ", rows[index].pctype);
      rows[index].pctype = (jQuery.inArray(String(obj.aptype).toUpperCase(), cases) != -1) ?
        'Case' :
        'Permit';
    });
    rows = phillyapi.sort(rows, 'casenumber');
    return rows;
  },

  sortAppeals: function (rows) {
    //I will do some stuff here to group it.

    $.each(rows, function (index, obj) {
      rows[index].appeal_type_name = phillyapi.getAppealTypeName(obj.applictype);
    });

    rows = phillyapi.sort(rows, 'appeal_key');

    return rows;
  },

  getAppealTypeName: function (type) {
    switch (type) {
      case 'RB_BBS':
        return 'Building Board Appeals';
      case 'RB_LIRB':
        return 'L&mp;I Review Board';
      case 'RB_ZBA':
        return 'Zoning Board';
      default:
        return 'OTHER';
    }
  },

  printOwner: function (temp) {
    $.each(temp, function () {
      if (!this.length) {
        if (DEBUG) console.log({
          owner: this.ownername,
          legalname: this.legalname,
          legalfirstname: this.legalfirstname,
          legallastname: this.legallastname
        });
      } else {
        phillyapi.printOwner(this);
      }
    });
  },

  serverDate: function (date) {
    var startTime = new Date(date);
    return new Date(startTime.getTime() + (startTime.getTimezoneOffset() * 60000));
  }
}