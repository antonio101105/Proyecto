function MsgBoxQueue(max_depth) {
  function formatTimerString(msgbox) {
    var msgBox = msgbox || curMsgBox, strMsg = iLO.translateString(msgBox.timerStringKey, msgBox.timerString), secType = msgBox.remaining > 1 ? "seconds" : "second", secStr = iLO.translateString("IRC.unit." + secType, secType);
    if ($.isValidString(msgBox.actionKey) || $.isValidString(msgBox.action)) {
      var actMsg = iLO.translateString(msgBox.actionKey, msgBox.action);
      return strMsg.replace("{0}", actMsg).replace("{1}", msgBox.remaining).replace("{2}", secStr);
    }
    return strMsg.replace("{0}", msgBox.remaining).replace("{1}", secStr);
  }
  function formatMessage(msgbox) {
    var msgBox = msgbox || curMsgBox, strMsg = iLO.translateString(msgBox.messageKey, msgBox.message);
    if (msgBox.messageInserts.length > 0) for (var i = 0; i < msgBox.messageInserts.length; i++) {
      var insert = msgBox.messageInserts[i];
      strMsg = strMsg.replace(insert.placeHolder, iLO.translateString(insert.valueKey, iLO.Html2Text(insert.value)));
    }
    return strMsg;
  }
  function countdown() {
    --curMsgBox.remaining > 0 ? $.isValidString(curMsgBox.timerString) && $(".msgbox-timer-msg").text(formatTimerString()) : (stopCountdown(), 
    me.pop());
  }
  function startCountdown() {
    stopCountdown(), timerId = window.setInterval(countdown, 1e3);
  }
  function stopCountdown() {
    timerId > 0 && (window.clearInterval(timerId), timerId = 0);
  }
  function escapeHandler(evt) {
    evt.keyCode == $.ui.keyCode.ESCAPE && msgBoxQueue.pop();
  }
  function getJqueryUiDialogOptions(elem) {
    var opts = $(elem).data().uiDialog ? $(elem).data().uiDialog.options : null;
    if (!opts) for (var prop in elem) if (elem[prop] && elem[prop].uiDialog && elem[prop].uiDialog.options) {
      opts = elem[prop].uiDialog.options;
      break;
    }
    return opts;
  }
  function overrideJqueryUiDialogControl() {
    jq_modal_count = 0, jq_options = new Array(), $("div.ui-dialog-content:visible").each(function() {
      var opts = getJqueryUiDialogOptions(this);
      opts && 0 == opts.disabled && (opts.disabled = !0, jq_options.push(opts)), opts && 1 == opts.modal && jq_modal_count++;
    });
  }
  function restoreJqueryUiDialogControl() {
    for (var i = 0; i < jq_options.length; i++) jq_options[i].disabled = !1;
  }
  function showNextMsg() {
    if (0 != queue.length) {
      var msgbox = queue[0];
      msgbox.id = msgBoxId++, $prevFocusElement = $(document.activeElement), overrideJqueryUiDialogControl(), 
      msgbox.$parent = $("#videoContainer .control").hasClass("fullscreenMode") ? $("#videoContainer") : $(".app-container"), 
      $(msgbox.$overlay).appendTo(msgbox.$parent).addClass("msgbox-overlay-" + (jq_modal_count > 0 ? "light" : "medium")).fadeIn("fast").css("display", "block !important"), 
      $(msgbox.$msgbox).appendTo(msgbox.$parent).fadeIn("fast", function() {
        $("svg", ".msgbox-contents").addClass("background-color-index-light"), $(".msgbox-contents .button--primary").trigger("focus");
      }).css("display", "block !important"), curMsgBox = msgbox, me.centerMsgBox(), msgbox.closeOnEscape ? (msgbox.closeOnClick && $(msgbox.$overlay).on("click", function(evt) {
        msgBoxQueue.pop();
      }), $(document).on("keydown", escapeHandler)) : $(document).off("keydown", escapeHandler), 
      curMsgBox.stayTime > 0 && startCountdown();
    }
  }
  function removeMsg() {
    stopCountdown(), $(".msgbox-wrapper, .msgbox-overlay").fadeOut(100, function() {
      $(this).remove();
    });
  }
  var me = this, maxDepth = max_depth || 5, timerId = 0, msgBoxId = 1, curMsgBox = null, queue = new Array(), $prevFocusElement = null, jq_modal_count = 0, jq_options = null;
  this.timerStringFormatter = function(msgbox) {
    return formatTimerString(msgbox);
  }, this.messageFormatter = function(msgbox) {
    return formatMessage(msgbox);
  }, this.push = function(msgbox) {
    queue.push(msgbox), 1 == queue.length ? showNextMsg() : queue.length > maxDepth && me.pop();
  }, this.pop = function(resp) {
    var msgbox = queue.shift();
    msgbox && (removeMsg(), iLO.isFunction(msgbox.callback) && (void 0 === resp && null !== msgbox.retvalOverride ? msgbox.callback(msgbox.retvalOverride) : msgbox.callback(resp))), 
    restoreJqueryUiDialogControl(), $prevFocusElement.trigger("focus"), showNextMsg();
  }, this.centerMsgBox = function() {
    var $msgWrapper = $(".msgbox-wrapper"), $wdw = $(window), w = $msgWrapper.width(), h = $msgWrapper.height();
    $msgWrapper.css({
      top: Math.max($wdw.height() / 2 - h / 2, 0) + "px",
      left: Math.max($wdw.width() / 2 - w / 2, 0) + "px"
    });
  }, this.moveMsgBox = function() {
    var isFullScreen = $("#videoContainer").fullScreen(), oldParent = isFullScreen ? ".app-container" : "#videoContainer", newParent = isFullScreen ? "#videoContainer" : ".app-container";
    $(oldParent + " .msgbox-overlay").length && $(".msgbox-overlay").appendTo(newParent), 
    $(oldParent + " .msgbox-wrapper").length && $(".msgbox-wrapper").appendTo(newParent), 
    $(".msgbox-contents .button--primary").trigger("focus");
  }, this.queueLength = function() {
    return queue.length;
  }, this.clear = function() {
    queue = new Array(), removeMsg();
  };
}

if (jQuery.isValidString = function(obj) {
  return "string" == typeof obj && obj.length > 0 && /\S/.test(obj);
}, jQuery.existsNonNull = function(arg) {
  return !("undefined" == typeof arg || null == arg);
}, jQuery.isNonZeroInteger = function(arg) {
  return "undefined" != typeof arg && null !== arg && !isNaN(arg) && 0 !== arg && parseInt(arg, 10) == parseFloat(arg);
}, jQuery.isValidIPAddress = function(address) {
  if (!jQuery.existsNonNull(address)) return !1;
  if (address = address.trim(), !jQuery.isValidString(address)) return !1;
  var addressValid = !0, ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/, ipArray = address.match(ipPattern);
  if (null === ipArray) addressValid = !1; else if (5 == ipArray.length) if ("255.255.255.255" != ipArray[0]) for (var i = 1; i < ipArray.length; i++) try {
    if (parseInt(ipArray[i], 10) > 255) {
      addressValid = !1;
      break;
    }
  } catch (e) {
    addressValid = !1;
  } else addressValid = !1; else addressValid = !1;
  return addressValid;
}, jQuery.isValidIPv6Address = function(address) {
  var i, mySplitResult = null, length = 0, pos = address.indexOf("/");
  if ("" == address) return !0;
  if (pos >= 0 && (mySplitResult = address.split("/"), address = mySplitResult[0], 
  !isValidIPv6AddressPrefix(mySplitResult[1]))) return !1;
  if (mySplitResult = address.split("::"), mySplitResult.length > 2) return !1;
  if (mySplitResult = address.split(":"), length = mySplitResult.length, 8 >= length) {
    for (i = 0; length > i; i++) if (null == mySplitResult[i].match(/^[0-9a-fA-F]{1,4}$/) && "" != mySplitResult[i]) return !1;
    return !0;
  }
  return !1;
}, jQuery.expr.pseudos.hasText = function(element, index) {
  return element.childNodes.length > 0 && 3 == element.firstChild.nodeType ? element.innerHTML.trim().length > 0 : "span" == element.nodeName.toLowerCase();
}, jQuery.log = function() {
  return iLOGlobal.debug && "undefined" != typeof window.console && iLO.isFunction(window.console.log) ? (console.log.apply(console, arguments), 
  !0) : !1;
}, jQuery.logWarn = function() {
  return iLOGlobal.debug && "undefined" != typeof window.console && iLO.isFunction(window.console.warn) ? (console.warn.apply(console, arguments), 
  !0) : !1;
}, jQuery.logError = function() {
  return iLOGlobal.debug && "undefined" != typeof window.console && iLO.isFunction(window.console.error) ? (console.error.apply(console, arguments), 
  !0) : !1;
}, String.prototype.trim || (String.prototype.trim = function() {
  return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
}), window.ie = !1, window.compute_ie = function() {
  for (var a = 3, b = document.createElement("b"), c = b.all || []; b.innerHTML = "<!--[if gt IE " + ++a + "]><i><![endif]-->", 
  c[0]; ) ;
  return a > 4 ? a : document.documentMode;
}(), "undefined" == typeof iLOGlobal || !iLOGlobal && self != top && parent.iLOGlobal) try {
  iLOGlobal = parent.iLOGlobal;
} catch (e) {}

if ("undefined" == typeof iLOGlobal || !iLOGlobal) {
  iLOGlobal = {
    constants: {
      HttpErrors: {
        None: "success",
        NoContent: 204,
        NotModified: 304,
        BadRequest: 400,
        Unauthorized: 401,
        Forbidden: 403,
        NotFound: 404,
        TimedOut: 408,
        InternalError: 500,
        BadGateway: 502
      },
      alt_mode: {
        HP: 0,
        Enabled: 1,
        ProfileError: 2,
        NANDError: 3,
        Errors: 2
      },
      alt_level: {
        Light: 0,
        Medium: 1,
        Heavy: 2
      }
    },
    remote_address: "ilo_service",
    logout_message: null,
    login_delay: 0,
    default_language: "en",
    accept_language: {},
    langData: {},
    isApplication: !1,
    pollingDialogDoc: null,
    topPage: self,
    content: "summary.html",
    reqPathPrefix: "../lang/",
    initialLink: "summary.html",
    initialTab: void 0,
    debug: !1,
    helpWin: {},
    features: {
      alt_mode: null,
      alt_mode_en: null,
      alt_mode_err: null,
      alt_level: null,
      alt_vnd: "",
      blade: 0,
      storage: 0
    },
    bay_num: 0,
    init: function() {
      jQuery.extend(iLOGlobal, {
        cache: {
          eventPoll: {
            timestamp: 0
          }
        },
        isFlashPolling: !1,
        uploading: 0,
        eventAttempts: 0,
        pollingDialogDoc: null,
        titleFrame: null,
        applicationDoc: null,
        setTitle: !1
      });
    },
    federation_filter: [],
    icons: {
      critical: '<svg class="status-icon status-icon-critical status-icon notification__status" viewBox="0 0 24 24" aria-labelledby="critical-title" role="img" version="1.1"><title id="critical-title"><span id="Critical">Critical</span></title><g class="status-icon__base" stroke="none"><path role="presentation" d="M12,0 L24,12 L12,24 L0,12 Z"></path></g><g class="status-icon__detail" fill="none"><path role="presentation" d="M8,8 L16,16" stroke-width="2"></path><path role="presentation" d="M8,16 L16,8" stroke-width="2"></path></g></svg>',
      power: '<svg viewBox="0 0 24 24" role="img" class="control-icon control-icon-power" aria-labelledby="power-title" version="1.1"><title id="power-title"><span id="power">power</span></title><g id="power"><rect id="_x2E_svg_104_" x="0" fill="none" width="24" height="24"></rect><path stroke="#000000" stroke-width="2" stroke-miterlimit="10" d="M15.6235,3.75 c3.7141,1.4494,6.3412,5.0548,6.3412,9.2853C21.9647,18.5431,17.5078,23,12,23s-9.9647-4.4569-9.9647-9.9647 c0-4.2305,2.6271-7.8359,6.3412-9.2853 M12,0v10"></path></g></svg>',
      indicator: '<svg version="1.1" viewBox="0 0 24 24" role="img" class="control-icon control-icon-indicator" aria-labelledby="indicator-title"><title id="indicator-title"><span id="indicator">indicator</span></title><g id="indicator"><rect id="_x2E_svg_239_" y="0.0117" fill="none" width="24" height="24"></rect><path stroke="#000000" stroke-width="2" stroke-miterlimit="10" d="M10,23.0117v-3 c0-3.0938-1.5745-5.6785-2.8975-7.0015C5.8184,11.7261,5,9.9653,5,8.0058c0-4.313,3.9007-7.7223,8.3667-6.8762 c2.7529,0.5216,4.9634,2.7423,5.4984,5.4927c0.4874,2.5056-0.3875,4.8077-1.9677,6.3878C15.5745,14.3332,14,16.918,14,20.0117v3h-2 H10z " fill="none"></path><path class="led" d="M12,5.0117c-1.6569,0-3,1.3431-3,3s1.3431,3,3,3s3-1.3431,3-3S13.6569,5.0117,12,5.0117z"></path></g></svg>',
      spinning: '<svg version="1.1" viewBox="0 0 48 48" role="img" style="max-width:24px;" class="icon-spinning"><title>Spinning</title><circle r="20" cy="24" cx="24" fill="none" stroke-dasharray="24px 8px" stroke-width="4" stroke="#ddd"></circle><circle r="20" cy="24" cx="24" fill="none" stroke-dasharray="24px 104px" stroke-width="4" stroke="#333"></circle></svg>'
    },
    ie: function() {
      return window.ie === !1 && (window.ie = window.compute_ie), window.ie;
    }()
  }, iLOGlobal.init();
  var ajax_settings = {
    async: $.ajaxSettings.async,
    cache: $.ajaxSettings.cache
  };
  $.ajaxSetup(ajax_settings);
}

if ("undefined" == typeof iLO || !iLO) {
  /*!
	* jQuery doTimeout: Like setTimeout, but better! - v1.0 - 3/3/2010
	* http://benalman.com/projects/jquery-dotimeout-plugin/
	*
	* Copyright (c) 2010 "Cowboy" Ben Alman
	* Dual licensed under the MIT and GPL licenses.
	* http://benalman.com/about/license/
	*/
  !function($) {
    function b(l) {
      function e() {
        l ? h.removeData(l) : f && delete a[f];
      }
      function o() {
        k.id = setTimeout(function() {
          k.fn();
        }, j);
      }
      var h, m = this, k = {}, g = l ? $.fn : $, n = arguments, i = 4, f = n[1], j = n[2], p = n[3];
      if ("string" != typeof f && (i--, f = l = 0, j = n[1], p = n[2]), l ? (h = m.eq(0), 
      h.data(l, k = h.data(l) || {})) : f && (k = a[f] || (a[f] = {})), k.id && clearTimeout(k.id), 
      delete k.id, p) k.fn = function(q) {
        try {
          "string" == typeof p && (p = g[p]), p.apply(m, d.call(n, i)) !== !0 || q ? e() : o();
        } catch (e) {}
      }, o(); else {
        if (k.fn) return void 0 === j ? e() : k.fn(j === !1), !0;
        e();
      }
    }
    var a = {}, c = "doTimeout", d = Array.prototype.slice;
    $[c] = function() {
      return b.apply(window, [ 0 ].concat(d.call(arguments)));
    }, $.fn[c] = function() {
      var f = d.call(arguments), e = b.apply(this, [ c + f[0] ].concat(f));
      return "number" == typeof f[0] || "number" == typeof f[1] ? this : e;
    };
  }(jQuery), /*!
	*jQuery table2csv plugin 0.1.0
	*Converts table html element to csv string
	*Copyright (c) 2009 Leonardo Rossetti motw.leo@gmail.com
	* Licensed under the MIT license (http://www.opensource.org/licenses/mit-license.php)
	*THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	*IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	*FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	*AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	*LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	*OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	*THE SOFTWARE.
	*/
  function($) {
    $.fn.table2csv = function(options) {
      var defaults = {
        delimiter: ",",
        callback: function(csv) {
          return csv;
        }
      }, settings = $.extend(defaults, options);
      return this.each(function() {
        var csv = "";
        $(this).find("thead tr:not('.tablesorter-ignoreRow') th:not('.csv_exclude')").each(function() {
          csv += '"' + $(this).text().replace(/(\")/gim, '\\"\\"') + '"' + settings.delimiter;
        }), csv += "\n", $(this).find("tbody tr:not('.tablesorter-scroller-spacer')").each(function() {
          $(this).find("td:not('.csv_exclude')").each(function() {
            csv += this.children.length && ($(this.children[0]).is("img") || $(this.children[0]).hasClass("status-icon")) ? '"' + $(this.children[0]).attr("title").replace(/(\")/gim, '\\"\\"') + '"' + settings.delimiter : settings.trim && (void 0 == iLO.getIEVersion() || iLO.getIEVersion() > 8) ? '"' + $(this).text().trim().replace(/(\")/gim, '\\"\\"') + '"' + settings.delimiter : '"' + $(this).text().replace(/(\")/gim, '\\"\\"') + '"' + settings.delimiter;
          }), csv += "\n";
        }), settings.callback(csv);
      });
    };
  }(jQuery), jQuery.fn.check = function(mode) {
    return "undefined" == typeof mode && (mode = 1), mode = mode === !1 || 0 === mode ? "off" : mode === !0 || 1 == mode || "man" == mode ? "on" : mode, 
    this.each(function() {
      switch (mode) {
       case "on":
       case "true":
        $(this).prop("checked", !0);
        break;

       case "off":
       case "false":
        $(this).prop("checked", !1);
        break;

       case "toggle":
        $(this).prop("checked", !$(this).is(":checked"));
      }
    });
  }, function($) {
    $.fn.extend({
      disable: function() {
        return this.each(function() {
          var $this = jQuery(this);
          $this.prop("disabled", !0);
          var type = $this.attr("type");
          if ($this.length > 0) if ("text" === type || "password" === type) {
            var temp = $this.val();
            $this.addClass("textfield_disabled"), jQuery.existsNonNull($this.attr("data-prev_value")) && $this.val($this.attr("data-prev_value")).attr("data-prev_value", temp);
          } else "checkbox" === type && ($this.attr("data-prev_checked", $this.is(":checked") ? "true" : "false"), 
          $this.check(!1));
        });
      },
      enable: function() {
        return this.each(function() {
          var $this = jQuery(this), type = $this.attr("type");
          if ($this.prop("disabled", !1), $this.length > 0) if ("text" === type || "password" === type) {
            $this.removeClass("textfield_disabled");
            var temp = $this.attr("data-prev_value");
            jQuery.existsNonNull(temp) && ($this.attr("data-prev_value", $this.val()), $this.val(temp));
          } else "checkbox" === type && jQuery.existsNonNull($this.attr("data-prev_checked")) && ($this.is(":checked") || $this.check("true" === $this.attr("data-prev_checked")), 
          $this.removeAttr("data-prev_checked"));
        });
      },
      toggleEnabled: function(enable) {
        switch (typeof enable) {
         case "boolean":
          break;

         case "number":
          enable = enable > 0;
          break;

         default:
          enable = this.is(":disabled");
        }
        return $(this)[enable ? "enable" : "disable"]();
      },
      toggleEnabledAll: function(enable) {
        switch (typeof enable) {
         case "boolean":
          break;

         case "number":
          enable = enable > 0;
          break;

         default:
          enable = this.is(":disabled");
        }
        return this.each(function() {
          $(this).find("*")[enable ? "enable" : "disable"]();
        });
      },
      toggleReadOnly: function(readOnly) {
        return this.each(function() {
          ("boolean" == typeof readOnly || "number" == typeof readOnly) && (readOnly ? $(this).prop("readonly", !0).addClass("textfield_readonly") : $(this).prop("readonly", !1).removeClass("textfield_readonly"));
        });
      },
      toggleShow: function() {
        return this.each(function() {
          var This = $(this);
          This.is(":hidden") ? This.show() : This.hide();
        });
      },
      translate: function(reqLang, reqPathPrefix) {
        return this.each(function() {
          var lang = reqLang ? reqLang : iLO.getLanguage(), pPrefix = reqPathPrefix ? reqPathPrefix : "en" == lang ? iLOGlobal.reqPathPrefix : "/lang/";
          $("[data-localize],[rel*=localize]", jQuery(this)).each(function() {
            var $elem = $(this);
            $elem.removeData();
            var key = $elem.attr("data-localize");
            "undefined" != typeof key || (key = $elem.attr("rel").match(/localize\[(.*?)\]/)[1]);
            var translatedText = iLO.translateString(key, null, pPrefix, lang);
            jQuery.isValidString(translatedText) && ("INPUT" == $elem.prop("tagName") ? $elem.val(translatedText) : $elem.html(translatedText));
          }), $("[langKey],[langAttr]").each(function() {
            var attribute = $(this).attr("langAttr") || $(this)[0].getAttribute("langAttr"), key = $(this).attr("langKey") || $(this)[0].getAttribute("langKey"), defaultText = $(this).attr(attribute) || $(this)[0].getAttribute(attribute), tableTitle = $(this).attr("data-th") || $(this)[0].getAttribute("data-th");
            try {
              tableTitle ? $(this).attr("data-th", iLO.translateString(key, attribute)) : $(this).attr(attribute, iLO.translateString(key, defaultText, pPrefix, lang));
            } catch (e) {
              key = key;
            }
          });
        });
      }
    });
  }(jQuery), function($) {
    function displayMessage(i, j, data, fn) {
      var langKey = "", translatedText = "", msg = "";
      jQuery.isPlainObject(this.message) ? ($.isValidString(this.message.langKey) && (langKey = this.message.langKey), 
      translatedText = iLO.translateString(langKey, this.message.text), "undefined" != typeof this.message.message && this.message.message && (msg = this.message.message)) : msg = this.message;
      var out = "";
      return out = '<div class="ui-widget"><div class="' + this["class"] + ' ui-corner-all"><table class="statusDisplayTable"><tbody><tr><td class="statusDisplay"></td><td class="msgText"><p><span rel="localize[' + langKey + ']">' + translatedText + "</span>" + msg + "</p></td></tr></tbody></table></div></div>";
    }
    displayMessage.jqote_id = 1, $.fn.extend({
      runEffect: function() {
        return this.each(function() {
          $(this).fadeIn();
        });
      },
      hideMessage: function() {
        return this.each(function() {
          $(this).fadeOut();
        });
      },
      displayError: function(o) {
        return this.each(function() {
          $(this).show().jqotesub(displayMessage, {
            "class": "ui-state-error",
            message: o
          }).runEffect();
        });
      },
      displayWarning: function(o) {
        return this.each(function() {
          $(this).show().jqotesub(displayMessage, {
            "class": "ui-state-warning",
            message: o
          }).runEffect();
        });
      },
      displayInformative: function(o) {
        return this.each(function() {
          $(this).show().jqotesub(displayMessage, {
            "class": "ui-state-highlight",
            message: o
          }).runEffect();
        });
      },
      displayNormal: function(o) {
        return this.each(function() {
          $(this).show().jqotesub(displayMessage, {
            "class": "ui-state-normal",
            message: o
          }).runEffect();
        });
      },
      addMessageText: function(o, type, force) {
        var iconClasses = [ "ui-state-highlight", "ui-state-normal", "ui-state-warning", "ui-state-error" ], iconClass = -1 == $.inArray(type, iconClasses) ? iconClasses[0] : type;
        return this.each(function() {
          if (this.children.length) {
            var langKey = "", translatedText = "", message = "";
            "undefined" != typeof o.langKey && o.langKey && (langKey = o.langKey), "undefined" != typeof o.text && o.text && (translatedText = iLO.translateString(langKey, o.text)), 
            "undefined" != typeof o.message && o.message && (message = o.message);
            var result = '<p style="margin: 10px 0px 0px 0px;">';
            result += "" != langKey ? '<span rel="localize[' + langKey + ']">' + translatedText + "</span>" : translatedText, 
            result += message + "</p>", (-1 == $(".msgText p span").text().indexOf(translatedText) || force) && $(".msgText", $(this)).append(result);
          } else $(this).show().jqotesub(displayMessage, {
            "class": iconClass,
            message: o
          }).runEffect();
        });
      },
      addNormal: function(o, force) {
        return $(this).addMessageText(o, "ui-state-normal", force);
      },
      addWarning: function(o, force) {
        return $(this).addMessageText(o, "ui-state-warning", force);
      },
      addInformative: function(o, force) {
        return $(this).addMessageText(o, "ui-state-highlight", force);
      },
      addError: function(o, force) {
        return $(this).addMessageText(o, "ui-state-error", force);
      },
      createWaitScreen: function(o) {
        var langKey = "", translatedText = "Loading...", spinner = iLOGlobal.icons.spinning, result = "";
        return "undefined" != typeof o && o || (o = {}), "undefined" != typeof o.langKey && o.langKey && (langKey = o.langKey), 
        "undefined" != typeof o.text && o.text && (translatedText = iLO.translateString(langKey, o.text)), 
        result = '<div class="spinner-wrapper" id="waitTextContainer"><div class="spinner-icon">' + spinner + '</div><div class="spinner-text" rel="localize[' + langKey + ']">' + translatedText + "</div></div>", 
        this.each(function() {
          $(this).html(result);
        });
      }
    });
  }(jQuery), /*!
	* jQote2 - client-side Javascript templating engine
	* Copyright (C) 2010, aefxx
	* http://aefxx.com/
	*
	* Dual licensed under the WTFPL v2 or MIT (X11) licenses
	* WTFPL v2 Copyright (C) 2004, Sam Hocevar
	*
	* Date: Thu, Oct 21st, 2010
	* Version: 0.9.7
	*/
  function($) {
    function raise(error, ext) {
      throw $.extend(error, ext), error;
    }
    function dotted_ns(fn) {
      var ns = [];
      if (type_of.call(fn) !== ARR) return !1;
      for (var i = 0, l = fn.length; l > i; i++) ns[i] = fn[i].jqote_id;
      return ns.length ? ns.sort().join(".").replace(/(\b\d+\b)\.(?:\1(\.|$))+/g, "$1$2") : !1;
    }
    function lambda(tmpl, t) {
      var f, fn = [], type = type_of.call(tmpl);
      if (t = t || tag, type === FUNC) return tmpl.jqote_id ? [ tmpl ] : !1;
      if (type !== ARR) return [ $.jqotec(tmpl, t) ];
      if (type === ARR) for (var i = 0, l = tmpl.length; l > i; i++) (f = lambda(tmpl[i], t)) && fn.push(f[0]);
      return fn.length ? fn : !1;
    }
    var JQOTE2_TMPL_UNDEF_ERROR = "UndefinedTemplateError", JQOTE2_TMPL_COMP_ERROR = "TemplateCompilationError", JQOTE2_TMPL_EXEC_ERROR = "TemplateExecutionError", ARR = "[object Array]", STR = "[object String]", FUNC = "[object Function]", n = 1, tag = "%", qreg = /^[^<]*(<[\w\W]+>)[^>]*$/, type_of = Object.prototype.toString;
    $.fn.extend({
      jqote: function(data, t) {
        var dom = "";
        return data = type_of.call(data) === ARR ? data : [ data ], this.each(function(i) {
          for (var fn = $.jqotec(this, t), j = 0; j < data.length; j++) dom += fn.call(data[j], i, j, data, fn);
        }), dom;
      }
    }), $.each({
      app: "append",
      pre: "prepend",
      sub: "html"
    }, function(name, method) {
      $.fn["jqote" + name] = function(elem, data, t) {
        var ns, regexp, str = $.jqote(elem, data, t), $$ = qreg.test(str) ? $ : function(str) {
          return $(document.createTextNode(str));
        };
        return (ns = dotted_ns(lambda(elem))) && (regexp = new RegExp("(^|\\.)" + ns.split(".").join("\\.(.*)?") + "(\\.|$)")), 
        this.each(function() {
          var dom = $$(str);
          $(this)[method](dom), (3 === dom[0].nodeType ? $(this) : dom).trigger("jqote." + name, [ dom, regexp ]);
        });
      };
    }), $.extend({
      jqote: function(elem, data, t) {
        var str = "", fn = lambda(elem);
        t = t || tag, fn === !1 && raise(new Error("Empty or undefined template passed to $.jqote"), {
          type: JQOTE2_TMPL_UNDEF_ERROR
        }), data = type_of.call(data) !== ARR ? [ data ] : data;
        for (var i = 0, l = fn.length; l > i; i++) for (var j = 0; j < data.length; j++) str += fn[i].call(data[j], i, j, data, fn[i]);
        return str;
      },
      jqotec: function(template, t) {
        var cache, elem, tmpl, type = type_of.call(template);
        if (t = t || tag, type === STR && qreg.test(template)) {
          if (elem = tmpl = template, cache = $.jqotecache[template]) return cache;
        } else if (elem = type === STR || template.nodeType ? $(template) : template instanceof jQuery ? template : null, 
        elem[0] && ((tmpl = elem[0].innerHTML) || (tmpl = elem.text())) || raise(new Error("Empty or undefined template passed to $.jqotec"), {
          type: JQOTE2_TMPL_UNDEF_ERROR
        }), cache = $.jqotecache[$.data(elem[0], "jqote_id")]) return cache;
        for (var index, str = "", arr = tmpl.replace(/\s*\/\*!\s*|\s*!\*\/\s*|\s*<!\[CDATA\[\s*|\s*\]\]>\s*|[\r\n\t]/g, "").split("<" + t).join(t + ">").split(t + ">"), m = 0, l = arr.length; l > m; m++) str += "" !== arr[m].charAt(0) ? "out+='" + arr[m].replace(/(\\|["'])/g, "\\$1") + "'" : "=" === arr[m].charAt(1) ? ";out+=(" + arr[m].substr(2) + ");" : "!" === arr[m].charAt(1) ? ";out+=$.jqotenc((" + arr[m].substr(2) + "));" : ";" + arr[m].substr(1);
        str = "try{" + ('var out="";' + str + ";return out;").split("out+='';").join("").split('var out="";out+=').join("var out=") + '}catch(e){e.type="' + JQOTE2_TMPL_EXEC_ERROR + '";e.args=arguments;e.template=arguments.callee.toString();throw e;}';
        try {
          var fn = new Function("i, j, data, fn", str);
        } catch (e) {
          raise(e, {
            type: JQOTE2_TMPL_COMP_ERROR
          });
        }
        return index = elem instanceof jQuery ? $.data(elem[0], "jqote_id", n) : elem, $.jqotecache[index] = (fn.jqote_id = n++, 
        fn);
      },
      jqotefn: function(elem) {
        var type = type_of.call(elem), index = type === STR && qreg.test(elem) ? elem : $.data($(elem)[0], "jqote_id");
        return $.jqotecache[index] || !1;
      },
      jqotetag: function(str) {
        type_of.call(str) === STR && (tag = str);
      },
      jqotenc: function(str) {
        return jQuery.existsNonNull(str) && str.toString && jQuery.isValidString(str.toString()) ? str.toString().replace(/&(?!\w+;)/g, "&#38;").split("<").join("&#60;").split(">").join("&#62;").split('"').join("&#34;").split("'").join("&#39;") : "";
      },
      jqotecache: {}
    }), $.event.special.jqote = {
      add: function(obj) {
        var ns, handler = obj.handler, data = obj.data ? type_of.call(obj.data) !== ARR ? [ obj.data ] : obj.data : [];
        obj.namespace || (obj.namespace = "app.pre.sub"), data.length && (ns = dotted_ns(lambda(data))) && (obj.handler = function(event, dom, regexp) {
          return !regexp || regexp.test(ns) ? handler.apply(this, [ event, dom ]) : null;
        });
      }
    };
  }(jQuery);
  /*! jquery.cookies.2.2.0.min.js */
  /*!
	 * Copyright (c) 2005 - 2010, James Auldridge
	 * All rights reserved.
	 *
	 * Licensed under the BSD, MIT, and GPL (your choice!) Licenses:
	 *  http://code.google.com/p/cookies/wiki/License
	 */
  var jaaulde = window.jaaulde || {};
  jaaulde.utils = jaaulde.utils || {}, jaaulde.utils.cookies = function() {
    var resolveOptions, assembleOptionsString, parseCookies, constructor, defaultOptions = {
      expiresAt: null,
      path: "/",
      domain: null,
      secure: !1
    };
    return resolveOptions = function(options) {
      var returnValue, expireDate;
      return "object" != typeof options || null === options ? returnValue = defaultOptions : (returnValue = {
        expiresAt: defaultOptions.expiresAt,
        path: defaultOptions.path,
        domain: defaultOptions.domain,
        secure: defaultOptions.secure
      }, "object" == typeof options.expiresAt && options.expiresAt instanceof Date ? returnValue.expiresAt = options.expiresAt : "number" == typeof options.hoursToLive && 0 !== options.hoursToLive && (expireDate = new Date(), 
      expireDate.setTime(expireDate.getTime() + 60 * options.hoursToLive * 60 * 1e3), 
      returnValue.expiresAt = expireDate), "string" == typeof options.path && "" !== options.path && (returnValue.path = options.path), 
      "string" == typeof options.domain && "" !== options.domain && (returnValue.domain = options.domain), 
      options.secure === !0 && (returnValue.secure = options.secure)), returnValue;
    }, assembleOptionsString = function(options) {
      return options = resolveOptions(options), ("object" == typeof options.expiresAt && options.expiresAt instanceof Date ? "; expires=" + options.expiresAt.toGMTString() : "") + "; path=" + options.path + ("string" == typeof options.domain ? "; domain=" + options.domain : "") + (options.secure === !0 ? "; secure" : "");
    }, parseCookies = function() {
      var i, pair, name, value, unparsedValue, cookies = {}, separated = document.cookie.split(";");
      for (i = 0; i < separated.length; i += 1) {
        pair = separated[i].split("="), name = pair[0].replace(/^\s*/, "").replace(/\s*$/, "");
        try {
          value = decodeURIComponent(pair[1]);
        } catch (e1) {
          value = pair[1];
        }
        if ("object" == typeof JSON && null !== JSON && "function" == typeof JSON.parse) try {
          unparsedValue = value, value = JSON.parse(value);
        } catch (e2) {
          value = unparsedValue;
        }
        cookies[name] = value;
      }
      return cookies;
    }, constructor = function() {}, constructor.prototype.get = function(cookieName) {
      var returnValue, ckitem, cookies = parseCookies();
      if ("string" == typeof cookieName) returnValue = "undefined" != typeof cookies[cookieName] ? cookies[cookieName] : null; else if ("object" == typeof cookieName && null !== cookieName) {
        returnValue = {};
        for (ckitem in cookieName) "undefined" != typeof cookies[cookieName[ckitem]] ? returnValue[cookieName[ckitem]] = cookies[cookieName[ckitem]] : returnValue[cookieName[ckitem]] = null;
      } else returnValue = cookies;
      return returnValue;
    }, constructor.prototype.filter = function(cookieNameRegExp) {
      var cookieName, returnValue = {}, cookies = parseCookies();
      "string" == typeof cookieNameRegExp && (cookieNameRegExp = new RegExp(cookieNameRegExp));
      for (cookieName in cookies) cookieName.match(cookieNameRegExp) && (returnValue[cookieName] = cookies[cookieName]);
      return returnValue;
    }, constructor.prototype.set = function(cookieName, value, options) {
      if (("object" != typeof options || null === options) && (options = {}), "undefined" == typeof value || null === value) value = "", 
      options.hoursToLive = -8760; else if ("string" != typeof value) {
        if ("object" != typeof JSON || null === JSON || "function" != typeof JSON.stringify) throw new Error("cookies.set() received non-string value and could not serialize.");
        value = JSON.stringify(value);
      }
      var optionsString = assembleOptionsString(options);
      document.cookie = cookieName + "=" + encodeURIComponent(value) + optionsString;
    }, constructor.prototype.del = function(cookieName, options) {
      var name, allCookies = {};
      ("object" != typeof options || null === options) && (options = {}), "boolean" == typeof cookieName && cookieName === !0 ? allCookies = this.get() : "string" == typeof cookieName && (allCookies[cookieName] = !0);
      for (name in allCookies) "string" == typeof name && "" !== name && this.set(name, null, options);
    }, constructor.prototype.test = function() {
      var returnValue = !1, testName = "cT", testValue = "data";
      try {
        this.set(testName, testValue);
      } catch (e) {
        return !1;
      }
      return this.get(testName) === testValue && (this.del(testName), returnValue = !0), 
      returnValue;
    }, constructor.prototype.setOptions = function(options) {
      "object" != typeof options && (options = null), defaultOptions = resolveOptions(options);
    }, new constructor();
  }(), function() {
    window.jQuery && !function($) {
      $.cookies = jaaulde.utils.cookies;
      var extensions = {
        cookify: function(options) {
          return this.each(function() {
            var i, name, value, nameAttrs = [ "name", "id" ], $this = $(this);
            for (i in nameAttrs) if (!isNaN(i) && (name = $this.attr(nameAttrs[i]), "string" == typeof name && "" !== name)) {
              $this.is(":checkbox, :radio") ? $this.is(":checked") && (value = $this.val()) : value = $this.is(":input") ? $this.val() : $this.html(), 
              ("string" != typeof value || "" === value) && (value = null), $.cookies.set(name, value, options);
              break;
            }
          });
        },
        cookieFill: function() {
          return this.each(function() {
            var n, getN, name, value, nameAttrs = [ "name", "id" ], $this = $(this);
            for (getN = function() {
              return n = nameAttrs.pop(), !!n;
            }; getN(); ) if (name = $this.attr(n), "string" == typeof name && "" !== name) {
              value = $.cookies.get(name), null !== value && ($this.is(":checkbox, :radio") ? $this.val() === value ? $this.check(!0) : $this.check(!1) : $this.is(":input") ? $this.val(value) : $this.html(value));
              break;
            }
          });
        },
        cookieBind: function(options) {
          return this.each(function() {
            var $this = $(this);
            $this.cookieFill().on("change", function() {
              $this.cookify(options);
            });
          });
        }
      };
      $.each(extensions, function(i) {
        $.fn[i] = this;
      });
    }(window.jQuery);
  }(), /*! Copyright (c) Jim Garvin (http://github.com/coderifous), 2008.
	 * Dual licensed under the GPL (http://dev.jquery.com/browser/trunk/jquery/GPL-LICENSE.txt) and MIT (http://dev.jquery.com/browser/trunk/jquery/MIT-LICENSE.txt) licenses.
	 * Written by Jim Garvin (@coderifous) for use on LMGTFY.com.
	 * http://github.com/coderifous/jquery-localize
	 * Based off of Keith Wood's Localisation jQuery plugin.
	 * http://keith-wood.name/localisation.html
	 */
  function($) {
    function normaliseLang(lang) {
      return lang.substring(0, 2).toLowerCase();
    }
    $.localize = function(pkg, options) {
      function loadLanguage(pkg, lang, level) {
        level = level || 1;
        var file;
        options && options.loadBase && 1 == level ? (intermediateLangData = {}, file = pkg + ".js", 
        jsonCall(file, pkg, lang, level)) : 1 == level ? (intermediateLangData = {}, loadLanguage(pkg, lang, 2)) : 2 == level && lang.length >= 2 ? (file = pkg + ".js", 
        jsonCall(file, pkg, lang, level)) : 3 == level && lang.length >= 5 && (file = pkg + "-" + lang.substring(0, 5) + ".js", 
        jsonCall(file, pkg, lang, level));
      }
      function jsonCall(file, pkg, lang, level) {
        options.pathPrefix && (file = options.pathPrefix + "/" + file), $.getJSON(file, null, function(d) {
          $.extend(intermediateLangData, d), notifyDelegateLanguageLoaded(intermediateLangData), 
          loadLanguage(pkg, lang, level + 1);
        });
      }
      function defaultCallback(data) {
        $.localize.data[pkg] = data;
        try {
          $wrappedSet.each(function(i) {
            var elem, key, value;
            elem = $(this), key = elem.attr("data-localize"), "undefined" != typeof key || (key = elem.attr("rel").match(/localize\[(.*?)\]/)[1]), 
            value = valueForKey(key, data), null != value && ("INPUT" == elem.prop("tagName") ? elem.val(value) : elem.html(value));
          });
        } catch (e) {}
      }
      function notifyDelegateLanguageLoaded(data) {
        options.callback ? (defaultCallback(data), options.callback(data, defaultCallback)) : defaultCallback(data);
      }
      function valueForKey(key, data) {
        for (var keys = key.split(/\./), value = data; keys.length > 0; ) {
          if (!value) return null;
          value = value[keys.shift()];
        }
        return value;
      }
      function regexify(string_or_regex_or_array) {
        if ("string" == typeof string_or_regex_or_array) return "^" + string_or_regex_or_array + "$";
        if (string_or_regex_or_array.length) {
          for (var matchers = [], x = string_or_regex_or_array.length; x--; ) matchers.push(regexify(string_or_regex_or_array[x]));
          return matchers.join("|");
        }
        return string_or_regex_or_array;
      }
      var $wrappedSet = this, intermediateLangData = {};
      options = options || {};
      var saveSettings = {
        async: $.ajaxSettings.async,
        timeout: $.ajaxSettings.timeout
      };
      $.ajaxSetup({
        async: !1,
        timeout: options && options.timeout ? options.timeout : 5e3
      });
      var lang = normaliseLang(options && options.language ? options.language : $.defaultLanguage);
      options.skipLanguage && lang.match(regexify(options.skipLanguage)) || (loadLanguage(pkg, lang, 1), 
      $.ajaxSetup(saveSettings));
    }, $.fn.localize = $.localize, $.localize.data = {}, $.defaultLanguage = normaliseLang(navigator.browserLanguage ? navigator.browserLanguage : navigator.language ? navigator.language : navigator.userLanguage ? navigator.userLanguage : navigator.systemLanguage ? navigator.systemLanguage : iLOGlobal.default_language);
  }(jQuery), function(jQuery) {
    "undefined" != typeof iLOGlobal.cache.subscription_hash && iLOGlobal.cache.subscription_hash || (iLOGlobal.cache.subscription_hash = {}), 
    jQuery.publish = function(topic, args) {
      var cache = iLOGlobal.cache.subscription_hash;
      return "undefined" == typeof cache ? !1 : void ("undefined" != typeof cache[topic] && Array.isArray(cache[topic]) && jQuery.each(cache[topic], function(i, val) {
        try {
          this.apply(jQuery, args || []);
        } catch (e) {
          try {
            delete cache[topic][i];
          } catch (e2) {}
        }
      }));
    }, jQuery.subscribe = function(topic, callback) {
      var cache = iLOGlobal.cache.subscription_hash;
      if ("undefined" == typeof cache) return !1;
      if ("undefined" == typeof cache[topic] || !Array.isArray(cache[topic])) return cache[topic] = iLOGlobal.topPage.jQuery.makeArray(callback), 
      [ topic, callback ];
      for (var i in cache[topic]) cache[topic][i] == callback && delete cache[topic][i];
      try {
        cache[topic].push(callback);
      } catch (e) {
        try {
          delete cache[topic], cache[topic] = jQuery.makeArray(callback);
        } catch (e2) {}
      }
      return [ topic, callback ];
    }, jQuery.subscribeToEvent = function(event, callback) {
      return jQuery.subscribe(event, callback);
    }, jQuery.unsubscribe = function(handle) {
      var cache = iLOGlobal.cache.subscription_hash;
      if ("undefined" == typeof cache) return !1;
      var t;
      try {
        t = handle[0];
      } catch (e) {
        return !1;
      }
      cache[t] && jQuery.each(cache[t], function(idx) {
        this == handle[1] && cache[t].splice(idx, 1);
      });
      try {
        if (0 === cache[t].length) return delete cache[t], !0;
      } catch (e2) {}
      return !1;
    };
  }(jQuery), function($) {
    $.fn.hpTooltip = function(options) {
      function hpTooltip(elem) {
        function hide(ev) {
          tip && ($("body").off("mousemove", onMove), $("body").off("click", onMove), source.off("focus", hide), 
          source.off("click", hide), tip.remove(), tip = null);
        }
        function onOver(ev) {
          var refId, tipId, sourceOffset, tipStyle, tipWidth, tipHeight;
          !tip && source.attr("data-tooltip") && (refId = source.attr("id"), tipId = refId + "-tooltip", 
          tip = $('<div id="' + tipId + '" class="hp-tooltip">' + source.attr("data-tooltip") + "</div>"), 
          source.parents(".hp-global").length > 0 && tip.addClass("hp-global"), $("body").append(tip), 
          tipWidth = tip.outerWidth(), tipHeight = tip.outerHeight(), sourceOffset = source.offset(), 
          tipStyle = {
            position: "absolute",
            top: sourceOffset.top - tipHeight - 10,
            left: sourceOffset.left - 15
          }, tipStyle.top < 0 ? (tipStyle.top = sourceOffset.top + source.outerHeight() + 10, 
          tipStyle.left + tipWidth > $(window).width() ? (tipStyle.left = $(window).width() - tipWidth, 
          tip.css(tipStyle).addClass("hp-below-right")) : tip.css(tipStyle).addClass("hp-below")) : tipStyle.left + tipWidth > $(window).width() ? (tipStyle.left = $(window).width() - tipWidth, 
          tip.css(tipStyle).addClass("hp-above-right")) : tip.css(tipStyle).addClass("hp-above"), 
          $("body").on("mousemove", onMove), $("body").on("click", onMove), source.on("focus", hide), 
          source.on("click", hide));
        }
        function initialize(elem) {
          var text = $(elem).attr("tooltip");
          "string" == typeof options && (text = options), source = $(elem), source.attr("data-tooltip", text), 
          text && !source.hasClass("hp-tooltipped") && (source.addClass("hp-tooltipped"), 
          source.on("mouseenter", onOver));
        }
        var source, tip, onMove;
        onMove = function(ev) {
          tip && (ev.pageX < source.offset().left || ev.pageX > source.offset().left + source.outerWidth() || ev.pageY < source.offset().top || ev.pageY > source.offset().top + source.outerHeight()) && hide();
        }, initialize(elem);
      }
      var instance, ret;
      return this.each(function() {
        var $elem = $(this);
        instance = new hpTooltip($elem[0]), ret = ret ? ret.add($elem) : $elem;
      }), ret;
    };
  }(jQuery), function($) {
    function startAnimation($elem) {
      $elem.attr("alt", "UID BLINK").removeClass("indicator-blink indicator-on icon-spinning").addClass("indicator-off");
      var timer = setInterval(function() {
        $elem.toggleClass("indicator-off indicator-on");
      }, 500);
      $elem.attr("data-timer", timer);
    }
    $.fn.extend({
      setUID: function(status) {
        return this.each(function() {
          var $elem = jQuery(this);
          if (iLOGlobal.ie) {
            var timer = $elem.attr("data-timer");
            timer && clearInterval(timer), $elem.removeData("timer");
          }
          switch (status) {
           case "UID_ON":
            $elem.attr("alt", "UID ON").removeClass("indicator-off indicator-blink icon-spinning").addClass("indicator-on");
            break;

           case "UID_OFF":
            $elem.attr("alt", "UID OFF").removeClass("indicator-blink indicator-on icon-spinning").addClass("indicator-off");
            break;

           case "UID_LOADING":
            0 == $elem.find("svg.icon-spinning").length && $elem.prepend(iLOGlobal.icons.spinning), 
            $elem.addClass("icon-spinning");
            break;

           case "UID_BLINK":
            iLOGlobal.ie ? startAnimation($elem) : $elem.attr("alt", "UID BLINK").removeClass("indicator-off indicator-on icon-spinning").addClass("indicator-blink");
            break;

           default:
            $elem.attr("alt", "UID UNKNOWN").removeClass("indicator-off indicator-blink indicator-on icon-spinning");
          }
        });
      }
    });
  }(jQuery), function($) {
    var settings = {
      inEffectDuration: 600,
      outEffectDuration: 800,
      inEffect: "easeOutExpo",
      outEffect: "easeOutCirc",
      stayTime: 1e4,
      maxDepth: 5,
      text: "",
      textKey: "",
      sticky: !1,
      type: "inform",
      position: "top-right",
      closeText: "",
      closeTextKey: "",
      close: null,
      parent: ".app-container"
    }, methods = {
      init: function(options) {
        options && $.extend(settings, options);
      },
      showToast: function(options) {
        var localSettings = {}, orientation = {
          "top-right": "top",
          "bottom-right": "bottom"
        };
        $.extend(localSettings, settings, options), $.isValidString(localSettings.textKey) && (localSettings.text = iLO.translateString(localSettings.textKey)), 
        $.isValidString(localSettings.closeTextKey) && (localSettings.closeText = iLO.translateString(localSettings.closeTextKey));
        var toastWrapAll, toastItemOuter, toastItemInner, toastItemMsg, toastItemClose, toastItemImage, which = orientation[localSettings.position] || "top", parent = localSettings.parent ? localSettings.parent : "body";
        return toastWrapAll = $(parent + " > .toast-container-" + which).length ? $(parent + " > .toast-container-" + which) : $("<div></div>").addClass("toast-container-" + which).addClass("toast-position-" + localSettings.position).appendTo(parent), 
        toastItemOuter = $("<div></div>").addClass("toast-item-wrapper"), toastItemInner = $("<div></div>").hide().addClass("toast-item").attr("which", which), 
        toastItemImage = $("<div></div>").addClass("toast-item-image").addClass("toast-item-image-" + localSettings.type).appendTo(toastItemInner).html(myIcons[localSettings.type]), 
        toastItemMsg = $("<div></div>").addClass("toast-item-msg").html(localSettings.text).appendTo(toastItemInner), 
        toastItemClose = $("<div></div>").addClass("toast-item-close").appendTo(toastItemInner).html(myIcons.close).on("click", function() {
          $().toastmessage("removeToast", toastItemInner, localSettings);
        }), "top" == which ? (toastWrapAll.children(".toast-item-wrapper").length >= localSettings.maxDepth && toastWrapAll.children(".toast-item-wrapper").first().remove(), 
        toastItemInner.appendTo(toastWrapAll).wrap(toastItemOuter).slideToggle(localSettings.inEffectDuration, localSettings.inEffect)) : (toastWrapAll.children(".toast-item-wrapper").length >= localSettings.maxDepth && toastWrapAll.children(".toast-item-wrapper").last().remove(), 
        toastItemInner.prependTo(toastWrapAll).wrap(toastItemOuter).slideToggle(localSettings.inEffectDuration, localSettings.inEffect)), 
        localSettings.sticky || setTimeout(function() {
          $().toastmessage("removeToast", toastItemInner, localSettings);
        }, localSettings.stayTime), toastItemInner;
      },
      removeToast: function(obj, options) {
        try {
          "top" == obj.attr("which") ? obj.first().animate({
            "margin-top": -1 * obj.first()[0].offsetHeight
          }, options.outEffectDuration, options.outEffect, function() {
            obj.parent().remove();
          }) : obj.first().animate({
            "margin-bottom": -1 * obj.first()[0].offsetHeight
          }, options.outEffectDuration, options.outEffect, function() {
            obj.parent().remove();
          });
        } catch (e) {
          $.error("removeToast error: " + e.message);
        }
        options && null !== options.close && options.close();
      }
    };
    $.fn.toastmessage = function(method) {
      return methods[method] ? methods[method].apply(this, Array.prototype.slice.call(arguments, 1)) : "object" != typeof method && method ? void $.error("Method " + method + " does not exist on jQuery.toastmessage") : methods.init.apply(this, arguments);
    };
  }(jQuery);
  var msgBoxQueue;
  "undefined" != typeof msgBoxQueue && msgBoxQueue || (msgBoxQueue = new MsgBoxQueue()), 
  $(window).on("resize", function() {
    $(".msgbox-wrapper").is(":visible") && msgBoxQueue.centerMsgBox();
  }), $(document).on("fullscreenchange", function(event, data) {
    $(".msgbox-wrapper").length > 0 && msgBoxQueue.moveMsgBox();
  }), function($) {
    function buildMessage(msgObj) {
      return $.isValidString(msgObj.messageKey) && (msgObj.message = iLO.translateString(msgObj.messageKey)), 
      $.isValidString(msgObj.timerStringKey) && (msgObj.timerString = iLO.translateString(msgObj.timerStringKey)), 
      msgObj.icon || (msgObj.icon = myIcons[msgObj.type] || null), msgObj.stayTime > 0 && (msgObj.remaining = msgObj.stayTime, 
      msgObj.timerStringFormatter = msgBoxQueue.timerStringFormatter), msgObj.messageFormatter = msgBoxQueue.messageFormatter, 
      msgObj.$overlay = $('<div class="msgbox-overlay"></div>'), msgObj.$msgbox = $('<div class="msgbox-wrapper"></div>').jqoteapp("#msgbox", msgObj), 
      msgObj;
    }
    var defaultOptions = {
      icon: null,
      title: "",
      titleKey: "",
      message: "",
      messageKey: "",
      messageInserts: [],
      action: "",
      actionKey: "",
      timerString: "",
      timerStringKey: "",
      stayTime: 0,
      closeOnEscape: !0,
      closeOnClick: !0,
      callback: null,
      retvalOverride: null
    }, methods = {
      alert: function(options, callback) {
        var opts = {
          buttons: [ {
            text: "OK",
            textKey: "ok",
            isDefault: !0,
            value: !0
          } ]
        };
        $.extend(opts, defaultOptions, options);
        var msgObj = buildMessage(opts);
        msgObj.callback = callback, msgBoxQueue.push(msgObj);
      },
      confirm: function(options, callback) {
        var opts = {
          buttons: [ {
            text: "OK",
            textKey: "ok",
            isDefault: !0,
            value: !0
          }, {
            text: "Cancel",
            textKey: "cancel",
            value: !1
          } ]
        };
        $.extend(opts, defaultOptions, options);
        var msgObj = buildMessage(opts);
        msgObj.callback = callback, msgBoxQueue.push(msgObj);
      }
    };
    $.fn.msgbox = function(method) {
      return methods[method] ? methods[method].apply(this, Array.prototype.slice.call(arguments, 1)) : void $.error("Method " + method + " does not exist on $.msgbox");
    };
  }(jQuery);
}

if ("undefined" == typeof iLO || !iLO) {
  $.cookies.test() || alert("Your browser must be set to accept cookies!");
  var cookieOptions = {
    path: "/",
    secure: !1
  };
  $.cookies.setOptions(cookieOptions), $.ajaxSetup({
    xhr: window.XMLHttpRequest && (window.location && "file:" !== window.location.protocol || !window.ActiveXObject) ? function() {
      return new window.XMLHttpRequest();
    } : function() {
      try {
        var obj = null, types = [ "Msxml2.XMLHTTP", "Microsoft.XMLHTTP" ];
        for (var i in types) try {
          obj = new window.ActiveXObject(types[i]);
          break;
        } catch (e) {}
        return obj;
      } catch (e) {}
      return null;
    },
    cache: !1,
    contentType: "application/json; charset=utf-8",
    beforeSend: function(xhr) {
      try {
        if (document.all && document.cookie && "" != document.cookie) for (var cookies = document.cookie.split(";"), i = 0; i < cookies.length; i++) {
          var cookie = cookies[i].trim();
          if ("sessionKey=" == cookie.substring(0, 11)) {
            var cookieValue = decodeURIComponent(cookie.substring(11));
            if (cookieValue && "" != cookieValue) try {
              xhr.setRequestHeader("Cookie", "blank"), xhr.setRequestHeader("Cookie", "sessionKey=" + cookieValue);
            } catch (e) {}
          }
        }
      } catch (e) {}
      xhr.overrideMimeType && xhr.overrideMimeType("text/plain"), -1 == window.location.protocol.indexOf("http") && "undefined" != typeof netscape && "undefined" != typeof netscape.security && netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead"), 
      document.all || -1 != window.location.protocol.indexOf("http") || (xhr.withCredentials = "true", 
      xhr.setRequestHeader("Content-type", "text/plain"));
    },
    data: {},
    timeout: 6e4,
    dataFilter: function(data, type) {
      return "json" == type && "" == data && (data = null), data;
    }
  });
}

if ("undefined" == typeof iLO || !iLO) {
  var iLO = {
    cache: iLOGlobal.cache,
    remote_address: iLOGlobal.remote_address,
    constants: iLOGlobal.constants,
    logout_message: iLOGlobal.logout_message,
    login_delay: iLOGlobal.login_delay,
    default_language: iLOGlobal.default_language,
    trim: function(val) {
      return (val ? val.toString() : "").trim();
    },
    val: function(selector) {
      return iLO.trim($(selector).val());
    },
    isFunction: function(arg) {
      switch (typeof arg) {
       case "function":
        return "number" != typeof arg.nodeType;

       case "object":
        if (null != arg && arg.constructor.toString().indexOf("Function()") > -1) return !0;

       default:
        return !1;
      }
    },
    doLogout: function(msg, wait) {
      try {
        iLOGlobal.topPage.doLogout(msg, wait);
      } catch (e) {}
    },
    doReset: function(resetOptions) {
      var reset_cause = "config";
      reset_cause = location.href.match("info_diagnostics") ? "diags" : "config", iLO.sendJsonRequest("ilo_status", "POST", "json/ilo_status", {
        method: "reset_ilo",
        cause: reset_cause
      }, function(o, fname, error) {
        if (iLO.checkError(o, fname, error)) iLO.isFunction(resetOptions.errorCallback) && resetOptions.errorCallback(o, fname, error); else {
          iLO.clearSessionKey();
          var tmpver = iLOGlobal.cache.version, tmpcn = iLOGlobal.cache.cn;
          iLOGlobal.init(), iLOGlobal.logout_message = {
            text: resetOptions.message,
            langKey: resetOptions.langKey
          }, iLOGlobal.login_delay = resetOptions.login_delay, iLOGlobal.cache.version = tmpver, 
          iLOGlobal.cache.cn = tmpcn, iLO.favIcon();
          try {
            iLOGlobal.topPage.stopAllPolling();
          } catch (e) {}
          try {
            iLOGlobal.features.alt_mode_err ? iLOGlobal.topPage.showAltModeErrorCases("logout") : iLOGlobal.topPage.showLogin();
          } catch (e) {}
        }
      });
    },
    isiLO5: function() {
      return iLOGlobal.cache.version && jQuery.isValidString(iLOGlobal.cache.version) && iLOGlobal.cache.version.indexOf("9.0") >= 0 || iLOGlobal.alt_tokens && iLOGlobal.alt_tokens.PRODGEN && jQuery.isValidString(iLOGlobal.alt_tokens.PRODGEN) && "iLO 5" === iLOGlobal.alt_tokens.PRODGEN ? !0 : !1;
    },
    normaliseLang: function(lang) {
      return lang.substring(0, 2).toLowerCase();
    },
    getLanguageCookie: function() {
      var lang = $.cookies.get("sessionLang");
      return lang;
    },
    getLanguage: function() {
      var lang = $.cookies.get("sessionLang");
      if (null == lang && null != iLOGlobal.accept_language) {
        for (var i = 0; i < iLOGlobal.accept_language.length; i++) if (iLO.isSupportedLanguage(iLOGlobal.accept_language[i])) return lang = iLOGlobal.accept_language[i];
        lang = iLO.isSupportedLanguage(iLOGlobal.default_language) ? iLOGlobal.default_language : "en";
      }
      return lang;
    },
    setLanguage: function(lang) {
      if (iLO.isSupportedLanguage(lang)) {
        var expires = new Date();
        expires.setDate(expires.getDate() + 3650);
        var r = $.cookies.set("sessionLang", lang, {
          expiresAt: expires,
          path: "/"
        });
        return setTimeout(function() {
          try {
            iLOGlobal.topPage.jQuery.publish("/language/change", [ lang ]);
          } catch (e) {}
        }, 1), r;
      }
    },
    logEvent: function(data, reserved, debugLevel, severity) {
      var s = "";
      jQuery.isValidString(data) ? s = data : jQuery.each(data, function(i, val) {
        s += " : " + val;
      });
    },
    setSupportedLanguages: function(langs) {
      Array.isArray(langs) ? iLOGlobal.langs = langs : iLOGlobal.langs = [ {
        lang: "en",
        trans_name: "English",
        version: "*"
      } ];
    },
    isSupportedLanguage: function(lang) {
      var langs = iLOGlobal.langs;
      if (Array.isArray(langs)) {
        for (var i = 0; i < langs.length; i++) if (lang == langs[i].lang) return !0;
        return !1;
      }
      return "en" == lang;
    },
    translatePage: function(reqLang, reqPathPrefix) {
      var lang = reqLang ? reqLang : iLO.getLanguage(), pPrefix = reqPathPrefix ? reqPathPrefix : "../lang/";
      iLO.isSupportedLanguage(lang) && (document.all && jQuery.isValidString(iLOGlobal.titleLangKey) && (document.title = iLO.translateString(iLOGlobal.titleLangKey, document.title, pPrefix, lang)), 
      $("[data-localize],[rel*=localize]").each(function() {
        var elem = $(this);
        elem.removeData();
        var key = elem.attr("data-localize");
        "undefined" != typeof key || (key = elem.attr("rel").match(/localize\[(.*?)\]/)[1]);
        var translatedText = iLO.translateString(key, null, pPrefix, lang);
        jQuery.isValidString(translatedText) && ("INPUT" == elem.prop("tagName") ? elem.val(translatedText) : elem.html(translatedText));
      }), $("[langKey],[langAttr]").each(function() {
        var attribute = $(this).attr("langAttr") || $(this)[0].getAttribute("langAttr"), key = $(this).attr("langKey") || $(this)[0].getAttribute("langKey"), defaultText = attribute ? $(this).attr(attribute) || $(this)[0].getAttribute(attribute) : "", tableTitle = $(this).attr("data-th") || $(this)[0].getAttribute("data-th");
        try {
          tableTitle ? $(this).attr("data-th", iLO.translateString(key, attribute)) : $(this).attr(attribute, iLO.translateString(key, defaultText, pPrefix, lang));
        } catch (e) {
          key = key;
        }
      }));
    },
    translateString: function(key, defaultText, reqPathPrefix, reqLang, callback) {
      var result = defaultText ? defaultText : "", lang = reqLang ? reqLang : iLO.getLanguage(), pPrefix = reqPathPrefix ? reqPathPrefix : iLOGlobal.reqPathPrefix;
      if (iLO.isSupportedLanguage(lang) && $.isPlainObject(iLOGlobal.alt_tokens)) {
        iLOGlobal.langData[lang] || ($.localize("strings", {
          language: lang,
          pathPrefix: pPrefix + lang,
          callback: callback
        }), iLOGlobal.langData[lang] = {}, jQuery.extend(iLOGlobal.langData[lang], jQuery.fn.localize.data.strings));
        var translatedText = "";
        try {
          var keyArray = key.split("."), o = iLOGlobal.langData[lang];
          $(keyArray).each(function() {
            o = o[this];
          }), translatedText = o;
        } catch (e) {}
        jQuery.isValidString(translatedText) ? result = translatedText : "en" !== lang && (result = iLO.translateString(key, defaultText, null, "en")), 
        result = result.replace(/#\w+#/g, function(matched) {
          var val = iLOGlobal.alt_tokens[matched.replace(/#/g, "")];
          return val ? val : matched;
        });
      }
      return result;
    },
    enableLanguageHotkey: function() {
      $(document).on("keydown", "shift+l", function() {
        if ("en" != iLO.getLanguage()) iLO.setLanguage("en"); else {
          var langs = iLOGlobal.langs;
          if (Array.isArray(langs)) {
            for (var i = 0; i < langs.length; i++) if ("en" != langs[i].lang) {
              iLO.setLanguage(langs[i].lang);
              break;
            }
          } else iLO.setLanguage("en");
        }
        return iLO.translatePage(), iLO.getLanguage();
      });
    },
    showWaitScreen: function(containerId, waitId, mainId) {
      var cId = jQuery.isValidString(containerId) ? containerId : null, mId = jQuery.isValidString(mainId) ? mainId : null, wStr = jQuery.isValidString(waitId) ? "#" + waitId : "#waitContainer, .waitContainer";
      iLO.hideMainScreen(cId, mId), jQuery(wStr, jQuery(cId ? "#" + cId : "body")).show();
    },
    hideWaitScreen: function(containerId, waitId) {
      var cId = jQuery.isValidString(containerId) ? containerId : null, wStr = jQuery.isValidString(waitId) ? "#" + waitId : "#waitContainer, .waitContainer";
      jQuery(wStr, jQuery(cId ? "#" + cId : "body")).hide();
    },
    showMainScreen: function(containerId, mainId, waitId) {
      var cId = jQuery.isValidString(containerId) ? containerId : null, wId = jQuery.isValidString(waitId) ? waitId : null, mStr = jQuery.isValidString(mainId) ? "#" + mainId : "#bodyContent, .bodyContent";
      iLO.hideWaitScreen(cId, wId), jQuery(mStr, jQuery(cId ? "#" + cId : "body")).show();
    },
    hideMainScreen: function(containerId, mainId) {
      var cId = jQuery.isValidString(containerId) ? containerId : null, mStr = jQuery.isValidString(mainId) ? "#" + mainId : "#bodyContent, .bodyContent";
      jQuery(mStr, jQuery(cId ? "#" + cId : "body")).hide();
    },
    clearErrorContainers: function(id) {
      "undefined" != typeof id && id ? jQuery(id).empty().hide() : jQuery(".errorDisplay,#errorDisplay").empty().hide();
    },
    exportText: function(windowName, data) {
      var win = window.open("", windowName.replace(/(?!^_)[^0-9a-zA-Z]/gi, ""), "status=0,toolbar=0,menubar=1,directories=0,resizable=1,scrollbars=1");
      win && win.document && (win.document.open("text/plain"), win.document.write(data), 
      win.document.close());
    },
    selectAll: function(id) {
      document.getElementById(id).focus(), document.getElementById(id).select();
    },
    closeCSV: function(id) {
      $("#" + id).dialog("close");
    },
    csv_popup: function(id, data, defaultFile, msgKey, msg) {
      var saveHelp = "<br/>", height = .85 * $(window).height(), width = .75 * $(window).width(), textboxHeight = 87, $id = $("#" + id);
      $id.dialog({
        autoOpen: !1,
        modal: !0,
        width: width,
        height: height,
        position: "top",
        closeText: "",
        open: function() {
          $(".ui-dialog-titlebar-close").attr("title", iLO.translateString("Close"));
        },
        title: function() {
          $(this).attr("data-localize", "csvOut").attr("id", "csv_title").text(iLO.translateString("csvOut", "CSV Output"));
        }
      }), $id.text(""), msgKey && jQuery.isValidString(msgKey) && msg && jQuery.isValidString(msg) && (saveHelp = '<p class="csv_p" rel="localize[' + msgKey + ']">' + iLO.translateString(msgKey, msg) + "</p>"), 
      iLO.canSaveFile() || (saveHelp += '<p class="csv_p" rel="localize[csvMsg]">To save this data: Copy the text below, paste it into a text editor, and save as a <i>.csv</i> file.</p><br />', 
      textboxHeight = 80), iLOGlobal.features.alt_mode || (textboxHeight -= 5), $id.append([ saveHelp, "<div>", '<textarea id="csv_content" wrap="off" cols=65 rows=25 style="height:' + textboxHeight + '%;"', 'readonly="true" onClick="iLO.selectAll(\'csv_content\')">', iLO.Html2Text(data), "</textarea>", "<br /><br />", '<div id="csv_buttons">', '<button id="csvSave" type="button" class="hpButton primary" style="display:none;" rel="localize[save]">Save</button>&nbsp;', '<button rel="localize[Close]" type="button" class="hpButton" onClick="iLO.closeCSV(\'' + id + "')\">Close</button>", "</div>", "</div>" ].join("")), 
      $(".ui-dialog-titlebar-close").enable(), $id.dialog("open"), $("#csv_content").trigger("blur"), 
      iLO.translatePage(), iLO.canSaveFile() && $("#csvSave").show().on("click", function() {
        defaultFile || (defaultFile = "logs.csv"), iLO.saveFile(data, defaultFile);
      });
    },
    canSaveFile: function() {
      return null != window.Blob;
    },
    saveFile: function(data, fileNameIn) {
      var text = new Blob([ "\ufeff", data ], {
        encoding: "UTF-8",
        type: "text/plain;charset=utf-8"
      }), fileName = $.isValidString(fileNameIn) ? fileNameIn : "file.txt";
      null != window.navigator && null != window.navigator.msSaveOrOpenBlob ? window.navigator.msSaveOrOpenBlob(text, fileName) : saveAs(text, fileName);
    },
    Html2Text: function(htmlString) {
      return htmlString.replace(/&(?!\w+;)/g, "&#38;").split("<").join("&#60;").split(">").join("&#62;").split('"').join("&#34;").split("'").join("&#39;");
    },
    getIEVersion: function() {
      return iLOGlobal.ie;
    },
    pianoStatusHTML: function(system_health, changing, dialog) {
      var statusString = "<div class='hp-dynamic hp-status", changeString = changing ? " hp-changing'" : "'", statusChangeString = changing ? '<div class="hp-status-changing"></div>' : "", healthString = "ok";
      switch (("" + system_health).toUpperCase()) {
       case "OP_STATUS_CRITICAL":
       case "CRITICAL":
       case "ERROR":
        healthString = "error";
        break;

       case "OP_STATUS_DEGRADED":
       case "WARNING":
        healthString = "warning";
        break;

       case "UNKNOWN":
        healthString = "unknown";
      }
      return statusString += changeString + '><div class="hp-status hp-status-' + healthString + '"><span class="hp-value">' + healthString + "</span></div>" + statusChangeString + "</div>", 
      dialog && (statusString = '<div class="hp-status hp-status-' + healthString + '"><span class="hp-value">' + healthString + "</span></div>"), 
      statusString;
    },
    grommetStatusHTML: function(severity, size) {
      var s, title, sort_order = 3, size_string = size ? "small" == size ? " status-icon--small" : "large" == size ? " status-icon--large" : "" : "";
      switch (severity.toUpperCase()) {
       case "REPAIRED":
        s = "ok", sort_order = 2, title = "Repaired";
        break;

       case "OK":
        s = "ok", sort_order = 2, title = "OK";
        break;

       case "INFORMATIONAL":
        s = "info", sort_order = 4, title = "Informational";
        break;

       case "DISABLED":
        s = "disabled", sort_order = 4, title = "Disabled";
        break;

       case "CAUTION":
        s = "warning", sort_order = 6, title = "Caution";
        break;

       case "WARNING":
        s = "warning", sort_order = 6, title = "WARNING";
        break;

       case "CRITICAL":
        s = "error", sort_order = 8, title = "Critical";
        break;

       case "ERROR":
        s = "error", sort_order = 8, title = "ERROR";
        break;

       default:
        s = "unknown", title = "Unknown";
      }
      return s = '<span data-sort="' + sort_order + '" class="status-icon status-icon-' + s + size_string + '" title="' + title + '" langattr="title" langkey="status_labels.' + severity + '"></span>';
    },
    getStatusHtml: function(statusCode, options) {
      if (!jQuery.isValidString(statusCode)) return "";
      var o = jQuery.isPlainObject(options) ? options : null, hasIcon = o && jQuery.existsNonNull(o.icon) && o.icon === !1 ? !1 : !0, hasLabel = o && jQuery.existsNonNull(o.label) && o.label === !1 ? !1 : !0, statusObj = iLO.getStatusIcon(statusCode), imgStyle = jQuery.isValidString(statusObj.style) ? statusObj.style : "";
      o && jQuery.isValidString(o.style) && (imgStyle = o.style);
      var out = '<span class="status-html">';
      return hasIcon && (out += [ '<span class="statusicon ' + (o && o.noSvgClass ? statusObj.className : "") + '" title="', statusObj.label, '" langAttr="title" langKey="', statusObj.langKey, '">' ].join(""), 
      statusObj.svg ? out += statusObj.svg.replace("control-icon ", "control-icon icon13nt " + (o && o.noSvgClass || iLOGlobal.ie && statusObj.className.indexOf("indicator") > -1 ? " " : statusObj.className + " ")) : (out += '<img src="' + statusObj.src + '" class="icon13nt" ', 
      imgStyle.length > 0 && (out += 'style="' + imgStyle + '" '), out += "/>"), out += "</span>"), 
      out += hasLabel ? [ hasIcon ? "&nbsp;" : "", '<span class="status-icon-label" style="white-space: nowrap;" data-localize="', statusObj.langKey, '">', statusObj.label, "</span></span>" ].join("") : "</span>";
    },
    getStringLabel: function(statusStr) {
      if (!jQuery.isValidString(statusStr)) return "";
      var langKey = statusStr.toUpperCase(), moduleStr = langKey.match(/(\D+)|(\d+)/g);
      2 !== moduleStr.length && (moduleStr = "");
      var label = "", out = "";
      switch (moduleStr[0]) {
       case "FAN BLOCK ":
        label = iLO.translateString("fanBlock", moduleStr[0]), out = [ '<span rel="localize[fanBlock]">', label, "</span><span>&nbsp;", moduleStr[1], "</span>" ].join("");
        break;

       case "FAN ":
        label = iLO.translateString("fan", moduleStr[0]), out = [ '<span rel="localize[fan]">', label, "</span><span>&nbsp;", moduleStr[1], "</span>" ].join("");
        break;

       default:
        label = iLO.translateString("StrLabel." + langKey, statusStr), out = [ '<span rel="localize[', "StrLabel." + langKey, ']">', label, "</span>" ].join("");
      }
      return out;
    },
    getStatusIcon: function(statusCode) {
      var iconObj = {};
      return jQuery.extend(iconObj, iLO.getStatusIconImg(statusCode), iLO.getStatusIconLabel(statusCode)), 
      iconObj;
    },
    getStatusIconImg: function(statusCode) {
      if (!jQuery.isValidString(statusCode)) return null;
      var imgObj = {
        src: "../images/icon_status_07_unknown.svg"
      };
      switch (statusCode.toUpperCase()) {
       case "ON":
        imgObj.svg = "" + iLOGlobal.icons.power, imgObj.className = "powered-on";
        break;

       case "OFF":
        imgObj.svg = "" + iLOGlobal.icons.power, imgObj.className = "powered-off";
        break;

       case "UID_ON":
        imgObj.svg = "" + iLOGlobal.icons.indicator, imgObj.className = "indicator-on";
        break;

       case "UID_OFF":
        imgObj.svg = "" + iLOGlobal.icons.indicator, imgObj.className = "indicator-off";
        break;

       case "UID_BLINK":
        imgObj.svg = "" + iLOGlobal.icons.indicator, imgObj.className = "indicator-blink";
        break;

       case "OK":
       case "OP_STATUS_OK":
       case "OP_STATUS_UP":
       case "INTERCONNECT_TRAY_PORT_STATUS_OK":
       case "OP_STATUS_COMPLETED":
       case "REPAIRED":
       case "REDUNDANT":
       case "PDU_REDUNDANT":
       case "AMS_READY":
       case "BOOT_PROGRESS_FABRICLOGINSUCCESS":
       case "BOOT_PROGRESS_COMPLETED":
        imgObj.src = "../images/icon_status_08_normal.svg";
        break;

       case "INFORMATIONAL":
       case "OP_STATUS_OTHER":
       case "OP_STATUS_DORMANT":
       case "OP_STATUS_POWER_MODE":
       case "OP_STATUS_STARTING":
       case "OP_STATUS_STOPPING":
       case "AMS_UNAVAILABLE":
       case "NO_SUPPORTING_CPU":
       case "OP_STATUS_NEGOTIATING":
       case "OP_STATUS_NOT_CONNECTED":
       case "AMS_UNAVAILABLE":
       case "BOOT_PROGRESS_TARGETFOUND":
       case "BOOT_PROGRESS_LUNFOUND":
       case "BOOT_PROGRESS_LOGGEDINTOTGT":
       case "BOOT_PROGRESS_IMAGEDOWNLOAD":
       case "BOOT_PROGRESS_OSHANDOFF":
        imgObj.src = "../images/icon_status_06_informational.svg";
        break;

       case "WARNING":
       case "OP_STATUS_WARNING":
        imgObj.src = "../images/icon_status_04_warning.svg";
        break;

       case "MINOR FAILURE":
       case "DEGRADED/WARNING":
       case "CAUTION":
       case "OP_STATUS_STOPPED":
       case "OP_STATUS_DEGRADED":
       case "OP_STATUS_STRESSED":
       case "OP_STATUS_LOCAL_FAULT":
       case "OP_STATUS_REMOTE_FAULT":
       case "OP_STATUS_NOT_INSTALLED":
       case "NOT_REDUNDANT":
       case "PDU_NOT_REDUNDANT":
       case "NOT_ACTIVE_WARN":
       case "NOT_SUPPORTED":
        imgObj.src = "../images/icon_status_03_minor.gif";
        break;

       case "OP_STATUS_PREDICTIVE_FAILURE":
       case "OP_STATUS_MISMATCHED":
       case "OP_STATUS_ABORTED":
       case "OP_STATUS_SUPPORTING_ENTITY_IN_ERROR":
       case "OP_STATUS_LINK_DOWN":
       case "OP_STATUS_DOWN":
       case "OP_STATUS_SHUTDOWN":
       case "OP_STATUS_LOOP_DEGRADED":
       case "OP_STATUS_LOOP_FAILED":
       case "INTERCONNECT_TRAY_PORT_STATUS_MISMATCH":
       case "OP_STATUS_MAJOR":
        imgObj.src = "../images/icon_status_02_major.gif";
        break;

       case "MAJOR FAILURE":
       case "CRITICALFAILURE":
       case "CRITICAL":
       case "FAILED":
       case "OP_STATUS_ERROR":
       case "OP_STATUS_FAILED":
       case "OP_STATUS_CRITICAL":
       case "OP_STATUS_NON_RECOVERABLE_ERROR":
       case "OP_STATUS_LOST_COMMUNICATION":
       case "FAILED_REDUNDANT":
       case "LIC_EXPIRED":
        imgObj.src = "../images/icon_status_01_critical.svg";
        break;

       case "OP_STATUS_ABSENT":
       case "OP_STATUS_DISABLED":
       case "OP_STATUS_IN_SERVICE":
       case "BOOT_PROGRESS_NONE":
        imgObj.src = "../images/icon_status_05_disabled.svg";
        break;

       case "LOCKED":
        imgObj.src = "../images/icon_lock_16.gif";
        break;

       case "UNKNOWN":
       case "OP_STATUS_UNKNOWN":
       case "OP_STATUS_NO_CONTACT":
       case "RESET":
        imgObj.src = "../images/icon_status_07_unknown.svg";
        break;

       case "OP_STATUS_X":
        imgObj.src = "../images/icon-x.png", iLOGlobal.features.alt_mode_en && "H3C" == iLOGlobal.features.alt_vnd ? jQuery.extend(imgObj, {
          style: "border:0;width:16px; height:16px; vertical-align:middle;"
        }) : jQuery.extend(imgObj, {
          style: "border:0;width:16px; height:16px;"
        });
        break;

       case "OP_STATUS_CHECK":
        imgObj.src = "../images/icon-checkmark.png", iLOGlobal.features.alt_mode_en && "H3C" == iLOGlobal.features.alt_vnd ? jQuery.extend(imgObj, {
          style: "border:0;width:8px; height:8px; vertical-align:middle;"
        }) : jQuery.extend(imgObj, {
          style: "border:0;width:8px; height:8px;"
        });
      }
      return imgObj;
    },
    getStatusIconLabel: function(statusCode) {
      var labelObj = {}, langKey = "";
      if (!jQuery.isValidString(statusCode)) return labelObj.label = iLO.translateString("status_labels.UNKNOWN", "Unknown"), 
      labelObj.langKey = "status_labels.UNKNOWN", labelObj;
      switch (statusCode.toUpperCase()) {
       case "NOT PRESENT":
       case "PRESENT":
       case "PRESENT/NOT ENABLED":
       case "NOT SUPPORTED":
       case "HOST IS UNNAMED":
        langKey = statusCode.toUpperCase().replace(/[\s\/]/g, "_");
        break;

       case "OP_STATUS_ABSENT":
        langKey = "OP_STATUS_NOT_INSTALLED";
        break;

       default:
        langKey = statusCode.toUpperCase();
      }
      return labelObj.label = iLO.translateString("status_labels." + langKey, langKey), 
      labelObj.langKey = "status_labels." + langKey, labelObj;
    },
    getFlashProgressKey: function(flashType) {
      var key;
      switch (flashType) {
       case "ILO_DEVICE":
       case "ILO_DEVICE_FIRMWARE":
        key = "appl.fwUpdateProgress";
        break;

       case "FILES_DEVICE":
        key = "appl.filesDeviceProgress";
        break;

       case "ILO_DEVICE_LANGPK":
        key = "appl.langPackProgress";
        break;

       default:
        key = "appl.installProgress";
      }
      return key;
    },
    getFlashProgressStr: function(flashType) {
      var key = "adm_firmware.flashImg";
      switch (flashType) {
       case "FILES_DEVICE":
       case "ILO_DEVICE_LANGPK":
        key = "adm_lang.pcntComplete";
        break;

       case "ILO_DEVICE":
       case "ILO_DEVICE_FIRMWARE":
       default:
        key = "adm_firmware.flashImg";
      }
      return iLO.translateString(key, "% Flashing Image...");
    },
    getFlashTitle: function(flashType) {
      var key = "adm_firmware.flashing";
      iLO.translateString(key, "% Flashing Firmware Image, please wait ...");
      switch (flashType) {
       case "FILES_DEVICE":
        key = "adm_lang.installing";
        break;

       case "ILO_DEVICE_LANGPK":
        key = "adm_lang.installing";
        break;

       case "ILO_DEVICE":
       case "ILO_DEVICE_FIRMWARE":
       default:
        key = "adm_firmware.flashing";
      }
      return iLO.translateString(key, "% Flashing Firmware Image, please wait ...");
    },
    formatString: function(source, in_format) {
      if (!jQuery.existsNonNull(in_format)) return source;
      switch (in_format.toLowerCase()) {
       case "percentage_10":
        var i = parseInt(source, 10);
        if (i) {
          source = "" + i / 10 + "%";
          break;
        }

       case "percentage":
        source += "%";
        break;

       case "volts":
        source += " Volts";
        break;

       case "celsius":
        -1 == source ? source = "N/A" : source += "C";
        break;

       case "fahrenheit":
        -1 == source ? source = "N/A" : source += "F";
        break;

       case "watts":
        source += " Watts";
        break;

       case "mhz":
        source += " MHz";
        break;

       case "kb":
        source += " KB";
        break;

       case "pwr_reg_mode":
        switch (source) {
         case "osc":
          source = "OS Control";
          break;

         case "dyn":
          source = "Dynamic";
          break;

         case "max":
          source = "Max (static high)";
          break;

         case "min":
          source = "Min (static low)";
          break;

         case "unknown":
         default:
          source = "Unknown";
        }
        break;

       default:
        source += " " + in_format;
      }
      return source;
    },
    buildLink: function(id) {
      var link;
      switch (id) {
       case "support":
        link = '<a class="prod_website" href="' + iLO.translateString("alt.support_web_addr", "http://www.hpe.com/support/ilo4") + '" target="support_web">' + iLO.translateString("alt.support_web_addr", "http://www.hpe.com/support/ilo4") + "</a>";
        break;

       case "prod":
       default:
        link = '<a class="prod_website" href="' + iLO.translateString("alt.product_web_addr", "http://www.hpe.com/info/ilo") + '" target="prod_web">' + iLO.translateString("alt.product_web_addr", "http://www.hpe.com/info/ilo") + "</a>";
      }
      return link;
    },
    httpSuccess: function(status) {
      var xhr = {};
      return xhr.status = status, jQuery.httpSuccess(xhr);
    },
    checkError: function(o, fname, error, errId) {
      if (jQuery.existsNonNull(error) && "success" != error) {
        var errorString = ": call=" + fname + "; error=" + error;
        return jQuery.isPlainObject(o) && (403 !== error || 1 != o.message || o.details ? 0 !== error || "nocontent" !== o.message || o.details ? (jQuery.isValidString(o.message) && (errorString += "; message=" + o.message), 
        o.details && (errorString += "; details=" + o.details)) : errorString = ': <span rel="localize[core.connectionError]">' + iLO.translateString("core.connectionError", "Encountered a communication problem. Try again.") + "</span>" : errorString = ': <span rel="localize[403_Forbidden]">' + iLO.translateString("403_Forbidden", "User does not have required privileges on iLO to perform this operation") + "</span>"), 
        jQuery.isValidString(errId) && $(document).ready(function() {
          $("#" + errId).displayError({
            langKey: "errMakeCall",
            text: "Error making call",
            message: errorString
          });
        }), '<span rel="localize[errMakeCall]">' + iLO.translateString("errMakeCall", "Error making call") + "</span>" + errorString;
      }
      return !1;
    },
    isLocal: function() {
      var loc = !1;
      try {
        loc = "file:" === window.location.protocol;
      } catch (e) {}
      return loc;
    },
    getBaseUrl: function(proxyPath, protocol) {
      var proxy = "undefined" == typeof proxyPath || "" === proxyPath ? "/" : proxyPath, port = "";
      try {
        port = "" === window.location.port ? "" : ":" + window.location.port;
      } catch (e) {
        port = "";
      }
      var proto = (protocol ? protocol : window.location.protocol) + "//", host = window.location.hostname;
      return host.indexOf(":") > -1 ? (-1 === host.indexOf("[") && -1 === host.indexOf("]") && (host = "[" + host + "]"), 
      host = iLO.Html2Text(host)) : host = iLO.fixedEncodeURIComponent(host), proto + host + port + proxy;
    },
    session_info: function() {
      try {
        return iLOGlobal.cache.session_info;
      } catch (e) {
        return null;
      }
    },
    isBlade: function() {
      try {
        return iLOGlobal.cache.masthead.blade;
      } catch (e) {}
      return !1;
    },
    isERS: function() {
      try {
        return iLOGlobal.cache.masthead.ers;
      } catch (e) {}
      return !1;
    },
    isSyFrame: function() {
      try {
        return "t_class" == iLOGlobal.cache.masthead.blade_type;
      } catch (e) {}
      return !1;
    },
    hasLicensingFeature: function() {
      try {
        return "1" == iLOGlobal.cache.masthead.licensing;
      } catch (e) {}
      return !1;
    },
    isSLwithPPIC: function() {
      try {
        return iLOGlobal.cache.masthead.sl_with_ppic;
      } catch (e) {}
      return !1;
    },
    isApplication: iLOGlobal.isApplication,
    init: function(options) {
      var config = {
        helpUrl: "help.html",
        global: !0
      }, settings = jQuery.extend(config, options);
      jQuery.extend(iLOGlobal, settings);
      var domainObj = iLOGlobal.cache;
      return domainObj.isBlade = !1, domainObj.session_key ? !0 : !1;
    },
    getSessionKey: function() {
      var cookie_key = jQuery.cookies.get("sessionKey"), domain_key = iLOGlobal.cache.session_key;
      return domain_key ? (domain_key != cookie_key && $.cookies.set("sessionKey", domain_key, {
        secure: !0,
        path: "/;SameSite=Strict"
      }), domain_key) : cookie_key ? (iLOGlobal.cache.session_key = cookie_key, cookie_key) : null;
    },
    clearSessionKey: function() {
      iLO.setCookie("sessionKey", null), iLOGlobal.cache.session_key = null;
    },
    startHtml5Irc: function() {
      iLO.setCookie("irc", [ "last", "html5" ]);
      try {
        iLOGlobal.topPage.appFrame.window.startHtml5Irc();
      } catch (e) {
        "undefined" == typeof iLOGlobal.topPage.appFrame && alert("Standalone HTML5 Console not yet available"), 
        $.log("startHtml5Irc", e);
      }
    },
    startIrc: function(httpsPort) {
      iLO.setCookie("irc", [ "last", "irc" ]);
      var alt_mode = iLOGlobal.features.alt_mode ? iLOGlobal.features.alt_mode : 0, host = window.location.href, port_value = "" === window.location.port ? httpsPort : window.location.port, addr = iLO.fixedEncodeURIComponent(window.location.hostname);
      addr.indexOf(":") >= 0 && !addr.match(/\133/) && (addr = "[" + addr + "]"), host = host.split("/html")[0], 
      host += "/html/IRC.application", host += "?addr=" + addr + "&sessionKey=" + iLO.getSessionKey() + "&lang=" + iLO.getLanguage() + "&port=" + port_value + "&alt_mode=" + alt_mode + "&cofc_goback=false", 
      iLO.logEvent("IRC URL:" + host, null, 1, 1);
      var ircFrame = null;
      try {
        ircFrame = iLOGlobal.topPage.window.frames.ircFrame.window;
      } catch (e) {
        ircFrame = window;
      }
      ircFrame.location.href = host;
    },
    startJavaRc: function() {
      if (void 0 != iLO.getIEVersion() && iLO.getIEVersion() < 11) alert(iLO.translateString("rc_info.ieVerNotSupported", "The Java Web Start Integrated Remote Console is not supported on this version of Internet Explorer. Consider using the .NET Integrated Remote Console (.NET IRC).")); else {
        iLO.setCookie("irc", [ "last", "jrc" ]);
        var jnlpObj = {
          baseUrl: iLO.getBaseUrl(),
          sessionKey: iLO.getSessionKey(),
          langId: iLO.getLanguage()
        }, blob = new Blob([ $("#jnlpTemplate").jqote(jnlpObj) ], {
          type: "application/x-java-jnlp-file"
        });
        saveAs(blob, "iLO-jirc.jnlp", !0);
      }
    },
    startJavaIrc: function(httpsPort) {
      iLO.setCookie("irc", [ "last", "jrc" ]);
      var host = iLO.fixedEncodeURIComponent(window.location.hostname);
      jQuery.isValidString(host) || (host = iLOGlobal.remote_address), host.indexOf(":") >= 0 && (-1 == host.indexOf("[") || -1 == host.indexOf("]")) && (host = "[" + host + "]"), 
      host = host + ":" + httpsPort;
      var appletFrame = null;
      try {
        appletFrame = iLOGlobal.topPage.appletFrame.window;
      } catch (e) {
        appletFrame = window;
      }
      appletFrame.location = "https://" + host + "/html/java_irc.html?lang=" + iLO.getLanguage();
    },
    setContextHelpUrl: function(url) {
      iLOGlobal.helpUrl = url;
    },
    openContextHelp: function(helpFile) {
      var optionsList = "top=40,left=50,width=800,height=600,location=no,menubar=no,status=no,resizable=yes,scrollbars=yes", topic = (jQuery.isValidString(helpFile) ? helpFile : iLOGlobal.helpUrl).replace(".html", ""), helpUrl = "../lang/" + iLO.getLanguage() + "/help/help.html?topic=" + topic, helpTitle = "helpWin:" + iLO.fixedEncodeURIComponent(window.location.hostname);
      helpTitle = helpTitle.replace(/(?!^_)[^0-9a-zA-Z]/gi, ""), iLOGlobal.helpWin = window.open(helpUrl, helpTitle, optionsList), 
      iLOGlobal.helpWin.focus();
    },
    displayMsgDetails: function(args, errorDivId) {
      var myId = errorDivId ? errorDivId : "errorDisplay";
      if ($errorDisplay = $("#" + myId), $errorDisplay.html('<div id="hp-page-notifications" class="hp-dialog-notification hp-active" style="display: block;"><div class="hp-status"></div><div class="hp-message"></div><div class="hp-full"><div class="hp-contents"><div class="hp-details"><div class="hp-notification-details"><div class="hp-details"><p><span></span></p></div><div class="hp-resolution-container" style="display: none;"><h3 data-localize="core.notify.details.resolution">Resolution</h3><span class="hp-resolution"></span></div><ol class="hp-actions" style="display: none;"></ol></div></div></div></div></div>'), 
      $.isPlainObject(args)) {
        if (args.status) {
          var system_health = args.status;
          isNaN(parseInt(system_health, 10)) || (system_health = 200 > system_health ? "INFORMATIONAL" : 400 > system_health ? "OK" : 500 > system_health ? "ERROR" : "CRITICAL"), 
          $(".hp-status", $errorDisplay).replaceWith(iLO.pianoStatusHTML(system_health, !1, !0));
        }
        if (args.message_key && $(".hp-message", $errorDisplay).attr("data-localize", args.message_key), 
        args.message && $(".hp-message", $errorDisplay).html(args.message), args.details_key && $(".hp-details p span", $errorDisplay).attr("data-localize", args.details_key), 
        args.details && $(".hp-details p span", $errorDisplay).html(args.details), args.resolution_key && $(".hp-resolution", $errorDisplay).attr("data-localize", args.resolution_key), 
        args.resolution && ($(".hp-resolution", $errorDisplay).text(args.resolution), $(".hp-resolution-container").show()), 
        Array.isArray(args.actions)) {
          $(".hp-actions", $errorDisplay).show();
          for (var i in args.actions) {
            var $newLi = $("<li></li>");
            args.actions[i].action_key && $newLi.attr("data-localize", args.actions[i].action_key), 
            args.actions[i].action && $newLi.html(args.actions[i].action), $(".hp-actions", $errorDisplay).append($newLi);
          }
        }
      }
      iLO.translatePage(), $errorDisplay.fadeIn();
    },
    getErrorInfo: function(uri, jqXHR, textStatus, errorThrown) {
      var response;
      try {
        response = JSON.parse(jqXHR.responseText), response && (!response.hasOwnProperty("errorMessage") && response.hasOwnProperty("Message") && (response.errorMessage = response.message), 
        !response.hasOwnProperty("resolution") && response.hasOwnProperty("recommendedActions") ? response.resolution = response.recommendedActions ? response.recommendedActions.join("\n") : null : response.hasOwnProperty("Resolution") && (response.resolution = response.Resolution));
      } catch (err) {
        response = {
          errorMessage: iLO.translateString("core.connectionError", iLO.fixedEncodeURIComponent(window.location.hostname)),
          message: iLO.translateString("core.connectionError", iLO.fixedEncodeURIComponent(window.location.hostname))
        };
      }
      return response.uri = uri, response.jqXHR = jqXHR, response.textStats = textStatus, 
      response.errorThrown = errorThrown, response;
    },
    sendJSONRequest: function(req) {
      return iLO.sendJsonRequest(req.callName, req.httpMethod, req.reqUrl, req.jsonData, req.callback, req.type, req.maxWait);
    },
    sendJsonRequest: function(callName, httpMethod, my_url, jsonData, callback, type, maxWait) {
      if (document.all && iLO.isLocal()) {
        var ip = iLOGlobal.remote_address, cookieString = iLO.getCookie("remote_address");
        $.isValidString(cookieString) && (ip = cookieString);
        for (var msg = jQuery.isValidIPAddress(ip) ? ip : "enter your iLO IP here"; !jQuery.isValidIPAddress(ip); ) ip = prompt("iLO IP address:", msg);
        iLOGlobal.remote_address = ip, iLO.setCookie("remote_address", ip);
      }
      var my_timeout = "undefined" == typeof maxWait || "" == maxWait ? jQuery.ajaxSettings.timeout : maxWait;
      "json/" == my_url.match("^json/") && (my_url = "/" + my_url), "rest/" == my_url.match("^rest/") && (my_url = "/" + my_url), 
      iLO.isLocal() && (my_url = "https://" + iLOGlobal.remote_address + my_url);
      var custHeaders = {};
      return "POST" != httpMethod || "/json/login_session" == my_url.match("/json/login_session$") && "login" == jsonData.method || "/blob/" == my_url.match("^/blob/") || "/rest/" == my_url.match("^/rest/") ? ("/blob/" == my_url.match("^/blob/") || "/rest/" == my_url.match("^/rest/")) && (custHeaders = {
        "X-Auth-Token": iLO.getSessionKey(),
        "X-Client-Type": "Browser"
      }) : jsonData.session_key = iLO.getSessionKey() || "", $.ajax({
        url: my_url,
        headers: custHeaders,
        type: httpMethod,
        dataType: "json",
        data: jsonData ? JSON.stringify(jsonData) : "",
        timeout: my_timeout,
        tryCount: 0,
        retryLimit: 3,
        success: function(data, textStatus) {
          "/json/masthead" == my_url.match("/json/masthead$") && (iLOGlobal.cache.masthead = data), 
          "/json/login_session" == my_url.match("/json/login_session$") && "GET" == httpMethod && (iLO.setAltMode(data), 
          $.publish("login_session"), iLOGlobal.features.alt_mode_en && (iLOGlobal.titleLangKey = "appName.shortName", 
          iLO.setSupportedLanguages(data.langs), jQuery.existsNonNull(data.default_lang) && (iLOGlobal.default_language = data.default_lang), 
          iLOGlobal.features.alt_mode_err && (iLO.getSessionKey() ? iLO.doLogout() : iLOGlobal.topPage.showAltModeErrorCases())), 
          iLOGlobal.setTitle || (iLO.setSupportedLanguages(data.langs), iLO.setBrowserTitle(data)), 
          iLOGlobal.cache.version && "undefined" != typeof iLOGlobal.cache.version || (data.version && (iLOGlobal.cache.version = data.version), 
          data.ilo_fw_pass && jQuery.isValidString(data.ilo_fw_pass) && (iLOGlobal.cache.version = iLOGlobal.cache.version + " " + data.ilo_fw_pass)), 
          iLOGlobal.cache.cn && "undefined" != typeof iLOGlobal.cache.cn || !data.cn || !jQuery.isValidString(data.cn) || (iLOGlobal.cache.cn = data.cn), 
          iLO.translatePage()), iLO.isFunction(callback) && callback(data ? data : "", callName, textStatus);
        },
        error: function(xhr, textStatus, errorThrown) {
          var result, xhr_status = -1;
          try {
            xhr_status = xhr.status;
          } catch (e) {
            xhr_status = -1;
          }
          var errorInfo = iLO.getErrorInfo(this.url, xhr, textStatus, errorThrown);
          if ("undefined" != typeof textStatus && textStatus && "offline" == textStatus && 0 == xhr_status && (xhr_status = -1, 
          result = {}, result.message = "offline", result.details = null), "login" !== callName && (xhr_status >= 12e3 && 13e3 > xhr_status && "login_session" !== callName && "logout" !== callName || errorThrown && "timeout" === errorThrown) && (this.tryCount++, 
          this.tryCount <= this.retryLimit)) return void $.ajax(this);
          if (xhr_status >= 12e3 && 13e3 > xhr_status && "login_session" !== callName && "logout" !== callName) return jQuery.log("Connection error. status = " + xhr_status + "; call = " + callName + "\n"), 
          iLO.doLogout({
            langKey: "login.connectionLost",
            text: "Connection error. status = " + xhr_status + "; call = " + callName + "\n"
          }, 0), !1;
          try {
            errorThrown && "timeout" === errorThrown ? (result = {}, result.message = "timeout", 
            result.details = xhr.responseText) : xhr.responseText.length > 0 ? result = JSON.parse(xhr.responseText) : (result = {}, 
            result.message = "nocontent", result.details = null);
          } catch (e) {
            result = {}, result.message = "parseerror";
            try {
              result.details = xhr.responseText;
            } catch (e2) {
              result.details = e2.message;
            }
          }
          var sessionLost = !1;
          if (("Forbidden" == errorThrown || "Unauthorized" == errorThrown) && Array.isArray(errorInfo.Messages)) for (var i = 0, max = errorInfo.Messages.length; max > i; i++) if (/novalidsession/i.test(errorInfo.Messages[i].MessageID)) {
            sessionLost = !0;
            break;
          }
          if (errorThrown && "timeout" === errorThrown) ; else {
            if (sessionLost || result.message && "JS_ERR_LOST_SESSION" === result.message) {
              if (iLO.isApplication && "logout" !== callName) {
                try {
                  iLOGlobal.topPage.doLogout({
                    langKey: "login.sessionExp",
                    text: "Session expired."
                  }, 0);
                } catch (e) {}
                return !1;
              }
              iLO.logout_message = "Invalid Session. Please log in.", iLO.login_delay = 0, iLO.clearSessionKey();
              var $dialog = $("#login_dialog");
              return $dialog.length < 1 && $dialog.is(":visible") ? !1 : (iLO.hideWaitScreen(), 
              $dialog.remove(), !1);
            }
            if (-1 == xhr_status) ; else if (0 == xhr_status && iLO.isLocal()) {
              $("#local_dialog").remove(), $('<div id="local_dialog"></div>').appendTo("body");
              var $local_dialog = $("#local_dialog");
              return $local_dialog.hide(), $.get("html/login_local.html", function(data) {
                $local_dialog.html(data).dialog({
                  autoOpen: !1,
                  title: "Please Accept Certificate",
                  width: 500,
                  height: 500,
                  modal: !0,
                  closeText: "",
                  open: function() {
                    $(".ui-dialog-titlebar-close").attr("title", iLO.translateString("Close"));
                  },
                  close: function(event, ui) {
                    location.reload();
                  }
                }), $local_dialog.dialog("open");
              }), !1;
            }
          }
          return jQuery.extend(errorInfo, result), iLO.isFunction(callback) && callback(errorInfo, callName, xhr_status), 
          !0;
        }
      });
    },
    getCache: function(req) {
      if (iLOGlobal.cache[req.name]) {
        var generic_ttl = 2e4, cacheData = iLO.getCacheData(req.name, generic_ttl), cacheAvail = null !== cacheData;
        if (cacheAvail && 1 != req.fresh && 1 != req.dynamic) return req.callback && req.callback.call(this, cacheData), 
        cacheData;
      }
      var jsonReq = {
        callName: req.name,
        reqUrl: "/json/" + req.name,
        httpMethod: "GET"
      };
      return jsonReq.callback = function(o, fname, error) {
        var msg = iLO.checkError(o, fname, error);
        if (msg) {
          if (!req.callback) return !1;
          req.callback(o, fname, error);
        } else if (jQuery.isPlainObject(o)) {
          if (iLO.setCacheData(req.name, o), ("session_info" == req.name || "login_session" == req.name) && ("login_session" != req.name || iLOGlobal.setTitle || iLO.setBrowserTitle(o), 
          setTimeout(function() {
            $.publish("/" + req.name, [ o ]);
          }, 1)), !req.callback) return !1;
          req.callback(o, fname, error);
        }
        return null;
      }, iLO.sendJSONRequest(jsonReq), null;
    },
    getCacheData: function(name, ttl) {
      if (iLOGlobal.cache[name]) {
        var time = new Date().getTime();
        return time - iLOGlobal.cache[name].timestamp > ttl ? null : iLOGlobal.cache[name];
      }
      return null;
    },
    setCacheData: function(name, obj) {
      iLOGlobal.cache[name] = obj, iLOGlobal.cache[name] && (iLOGlobal.cache[name].timestamp = new Date().getTime());
    },
    setBrowserTitle: function(o) {
      var title = iLO.translateString("appName.shortName");
      o.cn && (title += jQuery.isValidString(o.server_name) ? ": " + o.server_name + " - " + o.cn : ": " + o.cn, 
      o.blade && (o.bay_num && (title = title + " - " + o.bay_num), o.enc_name && (title = title + " - " + o.enc_name), 
      o.rack_name && (title = title + " - " + o.rack_name)));
      try {
        iLOGlobal.topPage.document.title = title;
      } catch (e) {}
      iLOGlobal.topPage.jQuery(iLOGlobal.topPage.document).attr("title", title), iLOGlobal.setTitle = !0;
    },
    setCookie: function(cookie, cookieValue) {
      if (null == cookieValue) return $.cookies.del(cookie), !0;
      var cookieString = $.cookies.get(cookie);
      if (cookieString ? cookieString += "," : cookieString = "", Array.isArray(cookieValue) && cookieValue.length >= 2 && !(cookieValue.length % 2)) jQuery.each(cookieValue, function(index, value) {
        if (index % 2) value && (cookieString = [ cookieString, value, "," ].join("")); else {
          var fieldValue = iLO.getCookie(cookie, value);
          if (fieldValue) {
            var re = new RegExp(value + "(.*?)\\,", "g");
            cookieString = cookieString.replace(re, "");
          }
          index + 1 < cookieValue.length && cookieValue[index + 1] && (cookieString = [ cookieString, value, "=" ].join(""));
        }
      }), "," == cookieString.charAt(cookieString.length - 1) && (cookieString = cookieString.substring(0, cookieString.length - 1)); else {
        if (!jQuery.isValidString(cookieValue)) return !1;
        cookieString = cookieValue;
      }
      if ($.cookies.del(cookie), "sessionkey" != cookie.toLowerCase()) {
        var expdate = new Date();
        expdate.setMonth(new Date().getYear() + 100), $.cookies.set(cookie, cookieString, {
          expiresAt: expdate
        });
      } else $.cookies.set(cookie, cookieString, {
        secure: !0
      });
      return null;
    },
    getCookie: function(cookie, field) {
      var cookieString = $.cookies.get(cookie);
      if (!cookieString) return cookieString;
      if ("undefined" == typeof field || !field) return cookieString;
      var array1 = [];
      return array1 = cookieString.split(/[,&]/), cookieString = null, jQuery.each(array1, function(index, value) {
        var array2 = value.split("=");
        2 == array2.length && array2[0] == field && (cookieString = array2[1]);
      }), cookieString;
    },
    getSearchValue: function(searchString, key) {
      searchString = iLO.Html2Text(searchString);
      var value = "";
      return searchString.indexOf(key + "=") > -1 && (value = searchString.substring(searchString.indexOf(key + "=") + key.length + 1), 
      value.indexOf("&") > -1 && (value = value.substring(0, value.indexOf("&"))), value.indexOf("'") > -1 && (value = value.substring(0, value.indexOf("'"))), 
      value.indexOf('"') > -1 && (value = value.substring(0, value.indexOf('"'))), value.indexOf(";") > -1 && (value = value.substring(0, value.indexOf(";"))), 
      value = unescape(value), value = value.replace(/[^A-Za-z0-9/_-]/g, "")), value;
    },
    openLink: function(pageURL, tabIndex) {
      tIndex = jQuery.existsNonNull(tabIndex) ? tabIndex : 0;
      var navigationFrame = null;
      try {
        navigationFrame = iLOGlobal.topPage.appFrame.frameDirectory.window;
      } catch (e) {}
      navigationFrame && navigationFrame.openLink(pageURL, tIndex);
    },
    refreshTree: function() {
      var navigationFrame = null;
      try {
        navigationFrame = iLOGlobal.topPage.appFrame.frameDirectory.window;
      } catch (e) {}
      navigationFrame && navigationFrame.refreshTree();
    },
    favIcon: function(system_health) {
      try {
        var path;
        switch (system_health) {
         case "OP_STATUS_CRITICAL":
          path = "images/status_critical_48.png";
          break;

         case "OP_STATUS_DEGRADED":
          path = "images/status_minor_48.png";
          break;

         case "OP_STATUS_OTHER":
         case "OP_STATUS_UNKNOWN":
          path = "images/status_unknown_48.png";
          break;

         case "INFORMATIONAL":
          path = "images/status_info_48.png";
          break;

         default:
          path = iLOGlobal.features.alt_mode_en && !iLOGlobal.features.alt_mode_err ? "alt/images/favico.png" : "favicon.ico";
        }
        path = navigator.userAgent.indexOf("Edge") >= 0 && "localhost" !== window.location.hostname ? iLO.getBaseUrl().replace("https", "http") + path : "/" + path, 
        path += "?v=" + new Date().getTime(), iLOGlobal.topPage.jQuery(iLOGlobal.topPage.document).find("link[rel='shortcut icon']").attr("href", path);
      } catch (e) {
        console.log(e.message);
      }
      return path;
    },
    setAltMode: function(data) {
      data && jQuery.isPlainObject(data.alt) && jQuery.existsNonNull(data.alt.mode) ? (iLOGlobal.features.alt_mode = data.alt.mode, 
      iLOGlobal.features.alt_mode_en = data.alt.mode != iLOGlobal.constants.alt_mode.HP, 
      iLOGlobal.features.alt_mode_err = data.alt.mode >= iLOGlobal.constants.alt_mode.Errors) : (iLOGlobal.features.alt_mode = 0, 
      iLOGlobal.features.alt_mode_en = !1, iLOGlobal.features.alt_mode_err = !1), data && jQuery.isPlainObject(data.alt) && jQuery.existsNonNull(data.alt.level) ? iLOGlobal.features.alt_level = data.alt.level : iLOGlobal.features.alt_level = iLOGlobal.constants.alt_level.Heavy, 
      data && jQuery.isPlainObject(data.alt) && jQuery.existsNonNull(data.alt.vnd) && (iLOGlobal.features.alt_vnd = data.alt.vnd), 
      iLOGlobal.alt_tokens = data.moniker;
    },
    clearAltMode: function() {
      iLOGlobal.features.alt_mode = null, iLOGlobal.features.alt_mode_en = null, iLOGlobal.features.alt_mode_err = null, 
      iLOGlobal.features.alt_level = null;
    },
    fixedEncodeURIComponent: function(str) {
      return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
        return "%" + c.charCodeAt(0).toString(16);
      });
    },
    showToast: function(options) {
      try {
        iLOGlobal.topPage.appFrame.showToastMessage(options);
      } catch (e) {
        $.error("showToast error: " + e.message);
      }
    },
    alert: function(options, callback) {
      try {
        iLOGlobal.topPage.appFrame.showAlertMessage(options, callback);
      } catch (e) {
        $.error("showAlertMessage error: " + e.message);
      }
    },
    confirm: function(options, callback) {
      try {
        iLOGlobal.topPage.appFrame.showConfirmMessage(options, callback);
      } catch (e) {
        $.error("showConfirmMessage error: " + e.message);
      }
    },
    setEventPoll: function(interval) {
      var doc = null != iLOGlobal.applicationDoc ? iLOGlobal.applicationDoc : document;
      try {
        doc.ownerDocument && null == doc.ownerDocument && (doc.ownerDocument = doc);
      } catch (e) {}
      var $doc = $(doc), $elem = $doc.find("#ui_events");
      if ($elem.length < 1 && ($doc.append('<div id="ui_events"></div>'), $elem = $doc.find("#ui_events")), 
      jQuery.existsNonNull(interval)) {
        var cur_date = new Date().getTime();
        return "undefined" == typeof iLOGlobal.cache.eventPoll && (iLOGlobal.cache.eventPoll = {
          timestamp: 0
        }), cur_date - iLOGlobal.cache.eventPoll.timestamp < 1e4 ? !0 : (iLOGlobal.eventAttempts++, 
        iLOGlobal.cache.eventPoll.timestamp = cur_date, iLO.sendJsonRequest("ui_events", "GET", "json/ui_events", null, function(o, fname, error) {
          if (o && "timeout" === o.message) iLO.setEventPoll(interval); else if (error && "success" != error || !jQuery.isPlainObject(o) || "undefined" == typeof o.events) iLO.setEventPoll(interval); else {
            iLOGlobal.eventAttempts = 0;
            var id = o.events.length < 1 ? 0 : o.events[o.events.length - 1].id + 1;
            $elem.doTimeout("ui_events_thread", interval, function() {
              return iLOGlobal.eventAttempts++, iLOGlobal.cache.eventPoll.timestamp = new Date().getTime(), 
              iLO.sendJsonRequest("ui_events", "GET", "json/ui_events/" + id, null, function(inner_o, inner_fname, inner_error) {
                if ((!inner_error || "success" == inner_error) && jQuery.isPlainObject(inner_o) && "undefined" != typeof inner_o.events && (iLOGlobal.eventAttempts = 0, 
                iLOGlobal.isFlashPolling && iLO.sendJsonRequest("flash_status", "GET", "json/flash_status", null, function(o, fname, error) {
                  if ((!error || "success" == error) && jQuery.isPlainObject(o) && "undefined" != typeof o.state) switch (setTimeout(function() {
                    $.publish("/flash_status", [ o ]);
                  }, 1), o.state) {
                   case "COMPLETED":
                   case "ERROR":
                    iLOGlobal.isFlashPolling = !1;
                  }
                }), inner_o.events.length > 0)) {
                  $.publish("/ui_events", [ inner_o.events ]);
                  for (var i = 0; i < inner_o.events.length; i++) $.publish("/ui_events/" + inner_o.events[i].type, [ inner_o.events[i] ]), 
                  "EVT_FLASH_START" === inner_o.events[i].type ? iLOGlobal.isFlashPolling = !0 : "EVT_FLASH_END" === inner_o.events[i].type && (iLOGlobal.isFlashPolling = !1, 
                  iLO.sendJsonRequest("flash_status", "GET", "json/flash_status", null, function(o, fname, error) {
                    error && "success" != error || !jQuery.isPlainObject(o) || "undefined" == typeof o.state || setTimeout(function() {
                      $.publish("/flash_status", [ o ]);
                    }, 1);
                  }));
                  id = inner_o.events[--i].id + 1;
                }
              }), !0;
            });
          }
          return null;
        }, null, 3e4), !0);
      }
      $elem.doTimeout("ui_events_thread"), iLOGlobal.eventAttempts = 0;
    }
  };
  if ("undefined" == typeof iLOGlobal.initialLink) try {
    iLOGlobal.topPage.location.replace(encodeURI(iLO.getBaseUrl()));
  } catch (e) {
    location.reload(!0);
  }
  iLOGlobal.supportsPassiveOption = !1;
  try {
    var opts = Object.defineProperty({}, "passive", {
      get: function() {
        iLOGlobal.supportsPassiveOption = !0;
      }
    });
    window.addEventListener("test", null, opts);
  } catch (e) {}
  jQuery(window).on("load", function() {
    var key = jQuery.cookies.get("sessionKey");
    key && (iLOGlobal.cache.session_key = key), $(window).on("click keypress", function() {
      $.publish("/session_tickle");
    });
    try {
      window.addEventListener("wheel", function(e) {
        $.publish("/session_tickle");
      }, iLOGlobal.supportsPassiveOption ? {
        passive: !0
      } : !1);
    } catch (e) {
      $.log("addEventListener failed in window load: " + e.message);
    }
  });
}