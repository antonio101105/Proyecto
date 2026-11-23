/*!
 * jQuery.EventSource (jQuery.eventsource)
 *
 * Copyright (c) 2011 Rick Waldron
 * Dual licensed under the MIT and GPL licenses.
 */
!function(jQuery, global) {
  jQuery.extend(jQuery.ajaxSettings.accepts, {
    stream: "text/event-stream"
  });
  var stream = {
    defaults: {
      label: null,
      url: null,
      open: jQuery.noop,
      error: jQuery.noop,
      message: jQuery.noop
    },
    setup: {
      stream: {},
      lastEventId: 0,
      isHostApi: !1,
      retry: 500,
      options: {}
    },
    cache: {}
  }, pluginFns = {
    "public": {
      close: function(label) {
        var tmp = {};
        if (!label || "*" === label) {
          for (var prop in stream.cache) stream.cache[prop].isHostApi && stream.cache[prop].stream.close();
          return stream.cache = {}, stream.cache;
        }
        for (var prop in stream.cache) label !== prop ? tmp[prop] = stream.cache[prop] : stream.cache[prop].isHostApi ? stream.cache[prop].stream.close() : stream.cache[prop].isClosed = !0;
        return stream.cache = tmp, stream.cache;
      },
      removeEventListener: function(label, evtType) {
        if (!label || "*" === label) {
          for (var prop in stream.cache) stream.cache[prop].isHostApi ? stream.cache[prop].stream.removeEventListener(evtType, stream.cache[prop][evtType + "Callback"]) : stream.cache[prop].options[evtType] = $.noop;
          return !0;
        }
        for (var prop in stream.cache) label == prop && (stream.cache[prop].isHostApi ? (stream.cache[prop].stream.removeEventListener(evtType, stream.cache[prop][evtType + "Callback"]), 
        stream.cache[prop].options[evtType + "Callback"] = jQuery.noop) : stream.cache[prop].options[evtType] = $.noop);
        return !0;
      },
      addEventListener: function(label, evtType, callback) {
        if (stream.cache[label][evtType + "Callback"] = function(event) {
          var streamData = [];
          stream.cache[label] && (this.label = label, "message" === evtType ? (streamData[streamData.length] = JSON.parse(event.data), 
          stream.cache[label].lastEventId = +event.lastEventId, callback.call(this, streamData[0] ? streamData[0] : null, {
            data: streamData,
            lastEventId: stream.cache[label].lastEventId
          }, event)) : callback.call(this, event));
        }, stream.cache[label].options[evtType + "Callback"] = callback, !label || "*" === label) {
          for (var prop in stream.cache) stream.cache[prop].isHostApi ? stream.cache[prop].stream.addEventListener(evtType, stream.cache[prop][evtType + "Callback"], !1) : (stream.cache[prop].options[evtType] = $.noop, 
          stream.cache[prop].options[evtType] = callback);
          return !0;
        }
        for (var prop in stream.cache) label == prop && (stream.cache[prop].isHostApi ? stream.cache[prop].stream.addEventListener(evtType, stream.cache[label][evtType + "Callback"], !1) : (stream.cache[prop].options[evtType] = $.noop, 
        stream.cache[prop].options[evtType] = callback));
        return !0;
      },
      streams: function(label) {
        return label && "*" !== label ? stream.cache[label] || {} : stream.cache;
      }
    },
    _private: {
      openEventSource: function(options) {
        var label = options.label;
        return stream.cache[label].openCallback = function(event) {
          stream.cache[label] && (this.label = label, stream.cache[label].options.open.call(this, event));
        }, stream.cache[label].errorCallback = function(event) {
          stream.cache[label] && (this.label = label, stream.cache[label].options.error.call(this, event));
        }, stream.cache[label].messageCallback = function(event) {
          var streamData = [];
          stream.cache[label] && (streamData[streamData.length] = JSON.parse(event.data), 
          this.label = label, stream.cache[label].lastEventId = +event.lastEventId, stream.cache[label].options.message.call(this, streamData[0] ? streamData[0] : null, {
            data: streamData,
            lastEventId: stream.cache[label].lastEventId
          }, event));
        }, stream.cache[label].stream.addEventListener("open", stream.cache[label].openCallback, !1), 
        stream.cache[label].stream.addEventListener("error", stream.cache[label].errorCallback, !1), 
        stream.cache[label].stream.addEventListener("message", stream.cache[label].messageCallback, !1), 
        stream.cache[label].stream;
      },
      openPollingSource: function(options) {
        var source, label = options.label;
        if (stream.cache[label]) {
          if (stream.cache[label].isClosed) return void stream.cache[label].options.error.call(this, {
            eventPhase: 2,
            type: "error",
            data: "readyState:closed"
          });
          source = jQuery.ajax({
            type: "GET",
            url: options.url,
            data: options.data,
            beforeSend: function(xhr) {
              stream.cache[label] && (this.label = label, stream.cache[label].options.open.call(this)), 
              xhr.setRequestHeader("Last-Event-ID", stream.cache[label].lastEventId);
            },
            success: function(data) {
              var tempdata, retries, label = options.label, streamData = jQuery.map(data.split("\n\n"), function(sdata, i) {
                return !!sdata && sdata;
              }), idx = 0, length = streamData.length, reTrim = /^(\s|\u00A0)+|(\s|\u00A0)+$/g;
              if (Array.isArray(streamData)) for (;length > idx; idx++) if (streamData[idx]) {
                for (var parts = streamData[idx].split("\n"), eventType = "message", data = [], i = 0, line = ""; i < parts.length; i++) if (line = parts[i].replace(reTrim, ""), 
                0 == line.indexOf("event")) eventType = line.replace(/event:?\s*/, ""); else if (0 == line.indexOf("retry")) retries = parseInt(line.replace(/retry:?\s*/, "")), 
                !isNaN(retries) && stream.cache[label] && (stream.cache[label].retry = stream.cache[label].options.retry = retries); else if (0 == line.indexOf("data")) data.push(line.replace(/data:?\s*/, "")); else if (0 == line.indexOf("id:")) {
                  var lastEventId = line.replace(/id:?\s*/, "");
                  !isNaN(lastEventId) && stream.cache[label] && (stream.cache[label].lastEventId = +lastEventId);
                } else 0 == line.indexOf("id") && stream.cache[label] && (stream.cache[label].lastEventId = null);
                if (tempdata = data.join(""), tempdata.length > 0 && stream.cache[label]) if ("json" === options.dataType) try {
                  tempdata = JSON.parse(tempdata), stream.cache[label].options.message.call(this, tempdata, {
                    data: tempdata,
                    lastEventId: stream.cache[label].lastEventId
                  });
                } catch (e) {
                  stream.cache[label].options.error.call(this, {
                    eventPhase: 0,
                    type: "error",
                    data: {
                      errorThrown: e.message
                    }
                  });
                } else stream.cache[label].options.message.call(this, tempdata, {
                  data: tempdata,
                  lastEventId: stream.cache[label].lastEventId
                });
              }
              stream.cache[label] && (this.label = label, setTimeout(function() {
                pluginFns._private.openPollingSource.call(this, options);
              }, stream.cache[label] && stream.cache[label].retry || 4e3));
            },
            error: function(jqXHR, textStatus, errorThrown) {
              if (stream.cache[label] && stream.cache[label].options.error.call(this, {
                eventPhase: 2,
                type: "error",
                data: {
                  readyState: jqXHR.readyState,
                  textStatus: textStatus,
                  errorThrown: errorThrown
                }
              }), 403 === jqXHR.status && jqXHR.responseText.indexOf("JS_ERR_LOST_SESSION") > -1) try {
                iLOGlobal.topPage.doLogout({
                  langKey: "login.sessionExp",
                  text: "Session expired."
                }, 0);
              } catch (e) {} else setTimeout(function() {
                pluginFns._private.openPollingSource.call(this, options);
              }, stream.cache[label] && stream.cache[label].retry || 4e3);
            },
            complete: function(jqXHR, textStatus) {
              stream.cache[label] && stream.cache[label].options.error.call(this, {
                eventPhase: 0,
                type: "error",
                data: {
                  readyState: jqXHR.readyState,
                  textStatus: textStatus
                }
              });
            },
            cache: !1,
            timeout: 5e4
          });
        }
        return source;
      }
    }
  }, isHostApi = global.EventSource ? !0 : !1;
  jQuery.eventsource = function(options) {
    var streamType, opts;
    if (options && !jQuery.isPlainObject(options) && pluginFns["public"][options]) return pluginFns["public"][options](arguments[1] ? arguments[1] : "*", arguments[2], arguments[3]);
    if (options.data = options.data && jQuery.isPlainObject(options.data) ? jQuery.param(options.data) : options.data, 
    !options.url || "string" != typeof options.url) throw new SyntaxError("Not enough arguments: Must provide a url");
    return options.label = options.label ? options.label : options.url + "?" + options.data, 
    opts = jQuery.extend({}, stream.defaults, options), stream.cache[opts.label] = {
      options: opts
    }, streamType = isHostApi ? new EventSource(opts.url + (opts.data ? "?" + opts.data : "")) : pluginFns._private.openPollingSource(opts), 
    stream.cache[opts.label] = jQuery.extend({}, stream.setup, {
      stream: streamType,
      isHostApi: isHostApi,
      options: opts
    }), isHostApi && pluginFns._private.openEventSource(opts), stream.cache;
  }, jQuery.each([ "close", "streams", "addEventListener", "removeEventListener" ], function(idx, name) {
    jQuery.eventsource[name] = function(arg) {
      return jQuery.eventsource(name, arg || "*");
    };
  });
}(jQuery, window);