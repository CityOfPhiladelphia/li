var DEBUG = false;
var FATAL_ERROR = 'There was an issue fetching the summary data for <strong>%s</strong> from the server, please check the address and try again';
var cache = {
  summary: null,
  details: null
};

/**
 * Because sometimes AIS returns different values for one Address
 * this functions looks for the most similar one and takes that one 
 * as the source of truth. 
 */

function returnMostSimilar(response, address) {
  let features = {};
  if (response.features.length > 1) {
    // Now we need to get the most similar address
    let precentage = 0;
    for (let i = 0; i < response.features.length; i += 1) {
      let similarity = phillyapi.similarity(address, response.features[i].properties.opa_address);
      if (similarity > precentage) {
        precentage = similarity;
        features = response.features[i];
      }
    }
  } else {
    features = response.features[0];
  }

  return features;
}

/**
 * Fix Form redirect not working (Ni idea por qué =/)
 */
$('form').on('submit', function () {
  if (!_.isEmpty($('input[name="address"]', this).val())) {
    $.mobile.navigate($(this).attr('action') + '?' + $(this).serialize());
  }
  return false;
});

/*
 * L&I Property History
 * City of Philadelphia
 */
var checkDone = {
  'permits': false,
  'licenses': false,
  'violations': false,
  'appeals': false,
  check: function (type) {
    checkDone[type] = true;
    if (DEBUG) console.log('done', type);
    if (checkDone.permits && checkDone.licenses && checkDone.violations && checkDone.appeals) {
      setTimeout(function () {
        headerInfo.populateNav()
      }, 250);
      setLoading(false);
    }
  }
}

var headerInfo = {
  options: null,
  address: null,
  exe_populate: function () {

    headerInfo.clear();
    if (!_.isEmpty(headerInfo.options)) {
      var data = headerInfo.options;

      // Pass data to template for rendering
      if (DEBUG) console.log('Address', data);

      if (!_.isEmpty(data.opa_owners)) {
        $.each(data.opa_owners, function () {
          $('.light-blue h2').append($('<span>').text(this));
        });
      }

      if (!_.isEmpty(data.zip_code))
        $($('<span>').text(data.zip_code + " - " + data.zip_4)).insertAfter($('.mailing h3'));

      if (!_.isEmpty(data.street_address)) {
        $($('<span>').text(data.street_address)).insertAfter($('.mailing h3'));
      }
    }
  },
  populate: function (the_address, options) {
    if (!_.isEmpty(the_address) && !_.isEmpty(options)) {
      headerInfo.address = the_address;
      headerInfo.options = options;
      headerInfo.exe_populate();
      return true;
    }

    if (!_.isEmpty(the_address) && the_address != headerInfo.address) {
      headerInfo.reset();
      headerInfo.address = the_address;

      phillyapi.getAddressInfo($.trim(decodeURIComponent(the_address.replace(/\+/g, "%20"))).replace(/\.+$/, ""), function (response) {
        headerInfo.clear();

        try {
          // var addressobjectid = String(response.features[0].properties.li_address_key).replace(/\|/g, ',');
          // var street_address = String(response.features[0].properties.street_address);

          let features = returnMostSimilar(response, the_address);
          headerInfo.populate(the_address, features.properties);

        } catch (err) {
          headerInfo.clear();
          $('.light-blue h2, .mailing').append($('<small>').text('No address data found.'));
          if (DEBUG) console.error('Err:', err);
        }
      }, function (xOptions, textStatus) {
        headerInfo.clear();
        $('.light-blue h2, .mailing').append($('<small>').text('No address data found.'));
      });

    } else if (!_.isEmpty(the_address) && the_address == headerInfo.address) {
      headerInfo.exe_populate();
    } else {
      headerInfo.reset();
    }
  },
  clear: function () {
    $('.light-blue span, .light-blue small').remove();
  },
  reset: function () {
    headerInfo.clear();
    $('.light-blue h2, .mailing').append($('<span>').text('xxxx'));
  },
  setupDetail: function (nav, address) {
    $('.pheader form').hide();
    $('.pheader').show();
    $('.pheader header h1').text("...");
    $('.pheader .owner-top').show();
    $('.pheader .nav-arrows').hide();

    if (!_.isEmpty(address)) {
      $('.blast').text(decodeURIComponent(address));
      $('.bresults').attr('href', vsprintf('#summary?address=%s', [address]));
    } else {
      $('.blast').text("");
      $('.bresults').attr('href', '#search');
    }

    if (nav) {
      if (DEBUG) console.log('Current', nav);

      next = headerInfo.navNext(nav);
      if (next) $('.nav-next').attr('href', next).show();

      prev = headerInfo.navPrev(nav);
      if (prev) $('.nav-prev').attr('href', prev).show();
    }
  },
  clearNav: function (type, data) {
    store.remove('nav');
  },
  populateNav: function () {
    var nav = {};
    headerInfo.clearNav();

    $('a[data-eid]').map(function () {
      var idx = "nv_" + $(this).data('eid');
      nav[idx] = $(this).attr('href');
    });

    store.set('nav', nav);
  },
  navNext: function (key) {
    var db = store.get('nav');
    if (!db) return undefined;
    var keys = Object.keys(db),
      i = keys.indexOf("nv_" + key);
    return i !== -1 && keys[i + 1] && db[keys[i + 1]];
  },
  navPrev: function (key) {
    var db = store.get('nav');
    if (!db) return undefined;
    var keys = Object.keys(db),
      i = keys.indexOf("nv_" + key);
    return i !== -1 && keys[i - 1] && db[keys[i - 1]];
  }
}

/*
 * The controller methods are called by the router, interact with the model (phillyapi),
 * and render to the template using underscore.js
 */
var controller = {

  /*
   * Search - focus on the address box
   */
  search: function () {
    $('.pheader').hide();
    $("#search form input").eq(0).focus();
  },

  /*
   * Summary - read the address querystring, get the L&I address key, then get history summary
   */
  summary: function (eventType, matchObj, ui, page, evt) {
    if (DEBUG) console.log("PAGE:", page);

    $('.pheader, .pheader form').show();
    $('.pheader .owner-top').hide();

    // Sanitize the user's input (the address)
    var raw_input = matchObj[1];
    var input = $.trim(decodeURIComponent(matchObj[1].replace(/\+/g, "%20"))).replace(/\.+$/, "");

    if (DEBUG) console.log('raw_input: ', raw_input);
    if (DEBUG) console.log('address: ', input);

    // If we were just looking at this page, it's already rendered so don't do anything
    if (cache.summary != matchObj[0]) {
      phillyapi.getAddressInfo(input, function (response) {
        if (DEBUG) console.log("AIS: ", response);
        try {

          let features = returnMostSimilar(response, input);

          var addressobjectid = String(features.properties.li_address_key);
          var street_address = String(features.properties.street_address);
          var eclipse_location_id = String(features.properties.eclipse_location_id)

          headerInfo.populate(input, features.properties);

          headerInfo.clearNav();
          $("[data-role=\"content\"]", page).empty();
          setLoading(true);

          $("[data-role=\"content\"]", page).html(_.template($("#template-header-sumary").html(), {
            'address': street_address
          }));

          //Load Permits
          phillyapi.getSummary(phillyapi.options.prepare(phillyapi.options.query.permits, addressobjectid.replace(/\,/g, '\',\'')), function (data) {

            if (DEBUG) console.log('Permits', data);
            $("#permits-data .data", page).html(_.template($("#template-permits").html(), {
              'permits': data.rows,
              'key': addressobjectid,
              'address': raw_input
            }));
            if (!_.isEmpty(data.rows)) {
              // jQuery Mobile enhance list we just created
              $("[data-role=\"collapsible\"]", page).collapsible();
              $("#permits-data [data-role=\"listview\"]", page).listview();
              $("#permits-data .data > ul.ui-listview > li:gt(4)", page).hide();

              if ($("#permits-data ul.ui-listview li:hidden").length > 0) {
                $("#permits-data .show-more-div").show();
              }

              // Tell the cache that this is the page that's currently rendered so we can come back to it easily
              // setLoading(false);
            }
            checkDone.check('permits');
          }, function (xOptions, textStatus) {
            checkDone.check('permits');
            controller.error(sprintf(FATAL_ERROR, input), page);
          }, 'permits');


          //Load Licenses
          if(_.isEmpty(eclipse_location_id)) {
            // It is empty, just skip the Query
            $("#licenses-data .data", page).html(_.template($("#template-licenses").html(), {
              'licenses': [],
              'key': eclipse_location_id,
              'address': raw_input
            }));
            checkDone.check('licenses');
          } else {
            phillyapi.getSummary(phillyapi.options.prepare(phillyapi.options.query.licenses, String(eclipse_location_id).replace(/\|/g, '\',\'')), function (data) {
              if (DEBUG) console.log('Licenses', data);
              $("#licenses-data .data", page).html(_.template($("#template-licenses").html(), {
                'licenses': data.rows,
                'key': eclipse_location_id,
                'address': raw_input
              }));
              if (!_.isEmpty(data.rows)) {
                // jQuery Mobile enhance list we just created
                $("[data-role=\"collapsible\"]", page).collapsible();
                $("#licenses-data [data-role=\"listview\"]", page).listview();
                $("#licenses-data .data > ul.ui-listview > li:gt(4)", page).hide();

                if ($("#licenses-data ul.ui-listview li:hidden").length > 0) {
                  $("#licenses-data .show-more-div").show();
                }
              }
              checkDone.check('licenses');
            }, function (xOptions, textStatus) {
              checkDone.check('licenses');
              controller.error(sprintf(FATAL_ERROR, input), page);
            }, 'licenses');
          }

          //Load Violations
          phillyapi.getSummary(phillyapi.options.prepare(phillyapi.options.query.violations, addressobjectid.replace(/\,/g, '\',\'')), function (data) {
            if (DEBUG) console.log('Violations', data);
            $("#violations-data .data", page).html(_.template($("#template-violations").html(), {
              'violations': data.rows,
              'key': addressobjectid,
              'address': raw_input
            }));
            if (!_.isEmpty(data.rows)) {
              // jQuery Mobile enhance list we just created
              $("#violations-data [data-role=\"listview\"]", page).listview();
              $("#violations-data .data > ul.ui-listview > li:gt(4)", page).hide();

              if ($("#violations-data ul.ui-listview li:hidden").length > 0) {
                $("#violations-data .show-more-div").show();
              }
            }
            checkDone.check('violations');

          }, function (xOptions, textStatus) {
            checkDone.check('violations');
            controller.error(sprintf(FATAL_ERROR, input), page);
          }, 'violations');


          //Load Appeals
          phillyapi.getSummary(phillyapi.options.prepare(phillyapi.options.query.appeals, addressobjectid.replace(/\,/g, '\',\'')), function (data) {
            if (DEBUG) console.log('Appeals', data);
            $("#appeals-data .data", page).html(_.template($("#template-appeals").html(), {
              'appeals': data.rows,
              'key': addressobjectid,
              'address': raw_input
            }));
            if (!_.isEmpty(data.rows)) {
              // jQuery Mobile enhance list we just created
              $("#appeals-data [data-role=\"listview\"]", page).listview();
              $("#appeals-data .data > ul.ui-listview > li:gt(4)", page).hide();

              if ($("#appeals-data ul.ui-listview li:hidden").length > 0) {
                $("#appeals-data .show-more-div").show();
              }
            }
            checkDone.check('appeals');
          }, function (xOptions, textStatus) {
            checkDone.check('appeals');
            controller.error(sprintf(FATAL_ERROR, input), page);
          }, 'appeals');




        } catch (err) {
          if (DEBUG) console.log("err: ", err);

          headerInfo.reset();
          controller.error(sprintf(FATAL_ERROR, input), page);
        }
      }, function (err) {
        if (DEBUG) console.log("err: ", err);

        headerInfo.reset();
        controller.error(sprintf(FATAL_ERROR, input), page);
      });
      cache.summary = matchObj[0];
    }
  },

  /*
   * View a permit
   */
  permit: function (eventType, matchObj, ui, page, evt) {
    // If we were just looking at this page, it's already rendered so don't do anything
    if (cache.details != matchObj[0]) {
      headerInfo.setupDetail(matchObj[1], matchObj[3]);

      $("[data-role=\"content\"]", page).empty();
      setLoading(true);
      // Get the details of this item
      phillyapi.getPermit(matchObj[1], String(matchObj[2]).replace(/\,/g, '\',\''), function (data) {
        if (DEBUG) console.log('Current Permit:', data);

        $('.pheader header h1').html("PERMIT NUMBER: " + data.rows[0].permitnumber + "<br>" + data.rows[0].permittype);

        // Pass data to template for rendering
        $("[data-role=\"content\"]", page).html(_.template($("#template-details-permit").html(), {
          data: data.rows[0]
        }));

        // Tell the cache that this is the page that's currently rendered so we can come back to it easily
        cache.details = matchObj[0];
        setLoading(false);
      }, function (xOptions, textStatus) {
        controller.error("There was an issue fetching the permit data from the server", page);
      });

      headerInfo.populate(matchObj[3]);
    }

    $('.pheader .owner-top').show();
  },

  /*
   * View a license
   */
  license: function (eventType, matchObj, ui, page, evt) {
    if (cache.details != matchObj[0]) {
      headerInfo.setupDetail(matchObj[1], matchObj[3]);

      $("[data-role=\"content\"]", page).empty();
      setLoading(true);
      phillyapi.getLicense(matchObj[1], function (data) {
        if (DEBUG) console.log('Current License:', data);

        $('.pheader header h1').html("LICENSE NUMBER: " + data.rows[0].licensenum + "<br>" + data.rows[0].licensetype);

        $("[data-role=\"content\"]", page).html(_.template($("#template-details-license").html(), {
          data: data.rows[0]
        }));
        cache.details = matchObj[0];
        setLoading(false);

      }, function (xOptions, textStatus) {
        controller.error("There was an issue fetching the license data from the server", page);
      });

      headerInfo.populate(matchObj[3]);
    }

    $('.pheader .owner-top').show();
  },

  /*
   * View a violation/case
   */
  _case: function (eventType, matchObj, ui, page, evt) {
    if (cache.details != matchObj[0]) {
      headerInfo.setupDetail(matchObj[1], matchObj[3]);

      $("[data-role=\"content\"]", page).empty();
      setLoading(true);
      phillyapi.getCase(matchObj[1], String(matchObj[2]).replace(/\,/g, '\',\''), function (data) {
        if (DEBUG) console.log('Current Violations:', data);

        $('.pheader header h1').html("CASE NUMBER: " + data.rows.casenumber + "<br>" + data.rows.aptype);

        $("[data-role=\"content\"]", page).html(_.template($("#template-details-case").html(), {
          data: data.rows
        }));
        $("[data-role=\"collapsibleset\"]", page).collapsibleset();
        cache.details = matchObj[0];
        setLoading(false);

      }, function (xOptions, textStatus) {
        controller.error("There was an issue fetching the case data from the server", page);
      }, true);

      headerInfo.populate(matchObj[3]);
    }

    $('.pheader .owner-top').show();
  },

  /**
   * Get Detailed Appeal
   */
  appeal: function (eventType, matchObj, ui, page, evt) {
    if (cache.details != matchObj[0]) {
      headerInfo.setupDetail(matchObj[1], matchObj[3]);

      $("[data-role=\"content\"]", page).empty();
      $(".desition-history-div").empty();
      $(".court-history-div").empty();

      setLoading(true);
      phillyapi.getAppeal(matchObj[1], String(matchObj[2]).replace(/\,/g, '\',\''), function (data) {
        if (DEBUG) console.log('Current Appeals:', data);

        $('.pheader header h1').html("APPEAL NUMBER: " + data.rows.appealnumber);
        $("[data-role=\"content\"]", page).html(_.template($("#template-details-appeal").html(), {
          data: data.rows
        }));

        if (!_.isEmpty(data.rows)) {
          /**
           * Get Desition History
           */
          phillyapi.getDesitionHistory(data.rows.internaljobid, function (desitionHistory) {
            if (DEBUG) console.log("Desition History:", desitionHistory);

            $(".desition-history-div").html(_.template($("#template-desition-history").html(), {
              desitionHistory: desitionHistory
            }));
            $(".desition-history-div [data-role=\"collapsibleset\"]").collapsibleset();
          }, function (response) {
            if (DEBUG) console.log("Desition History Error:", response);
          });

          /**
           * Get Court History
           */
          phillyapi.getCourtHistory(data.rows.internaljobid, function (courtHistory) {
            if (DEBUG) console.log("Court History:", courtHistory);

            $(".court-history-div").html(_.template($("#template-court-history").html(), {
              courtHistory: courtHistory
            }));
            $(".court-history-div [data-role=\"collapsibleset\"]").collapsibleset();
          }, function (response) {
            if (DEBUG) console.log("Court History Error:", response);
          });
        }

        cache.details = matchObj[0];
        setLoading(false);

      }, function (xOptions, textStatus) {
        controller.error("There was an issue fetching the appeal data from the server", page);
      });

      headerInfo.populate(matchObj[3]);
    }

    $('.pheader .owner-top').show();
  },

  error: function (errorMsg, page) {
    $('.pheader').show();
    $("[data-role=\"content\"]", page).html(_.template($("#template-details-error").html(), {
      errorMsg: errorMsg
    }));
    setLoading(false);
  }
};

/*
 * Interpret the various URLs and routes them to the controller
 * Using azicchetti's awesome jquerymobile-router
 * https://github.com/azicchetti/jquerymobile-router
 */
new $.mobile.Router({
  "#search": {
    handler: "search",
    events: "s"
  },
  "#summary\\?address=(.*)": {
    handler: "summary",
    events: "bs"
  },
  "#details\\?entity=permits&eid=(\\d*)&key=(.*)&address=(.*)": {
    handler: "permit",
    events: "bs"
  },
  "#details\\?entity=licenses&eid=(\\d*)&key=(.*)&address=(.*)": {
    handler: "license",
    events: "bs"
  },
  "#details\\?entity=violationdetails&eid=(\\d*)&key=(.*)&address=(.*)": {
    handler: "_case",
    events: "bs"
  },
  "#details\\?entity=appeals&eid=(\\d*)&key=(.*)&address=(.*)": {
    handler: "appeal",
    events: "bs"
  }
}, controller);

/*
 * Necessary because v1.1.0 of jQuery Mobile doesn't seem to let you show the loading message during pagebeforeshow
 */
$.mobile.loading({
  theme: "b",
  text: "Loading...",
  textonly: false
});

function setLoading(on) {
  if (on) $("body").addClass("ui-loading");
  else $("body").removeClass("ui-loading");
}

/*
 * Stock function to show user friendly date
 */
function display_date(input, show_time) {
  var str;
  if (input) {
    var UNIX_timestamp = input.replace(/\D/g, "") / 1000;
    var a = new Date(UNIX_timestamp * 1000);
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var year = a.getFullYear();
    var month = a.getMonth() + 1;
    var date = a.getDate();
    str = month + "/" + date + "/" + year;
    if (show_time) {
      var hour = a.getHours();
      var min = ("0" + a.getMinutes()).slice(-2);
      var sec = ("0" + a.getSeconds()).slice(-2);
      str += hour + ":" + min + ":" + sec;
    }
  }
  return str;
}