/**
 * Module to add a shipping rates calculator to cart page.
 *
 * Copyright (c) 2011-2016 Caroline Schnapp (11heavens.com)
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 * Modified by Adil Mukarram, MassTechnologist, 2023 to use vanilla JS instead of jQuery
 */

if (typeof Countries === "object") {
  Countries.updateProvinceLabel = function (e, t) {
    if (typeof e === "string" && Countries[e] && Countries[e].provinces) {
      if (typeof t !== "object") {
        t = document.getElementById("address_province_label");
        if (t === null) return;
      }
      t.innerHTML = Countries[e].label;
      var r = t.parentElement;
      r.querySelector("select");
      if(r.querySelector(".custom-style-select-box-inner")){
        r.querySelector(".custom-style-select-box-inner").innerHTML = Countries[e].provinces[0];
      }
    }
  };
}

if (typeof Shopify === "undefined") {
  Shopify = {};
}

if (typeof Shopify.Cart === "undefined") {
  Shopify.Cart = {};
}

Shopify.Cart.ShippingCalculator = (function () {
  var _config = { 
    submitButton: "Calculate shipping",
    submitButtonDisabled: "Calculating...",
    templateId: "shipping-calculator-response-template",
    wrapperId: "wrapper-response",
    customerIsLoggedIn: false,
    moneyFormat: "${{amount}}",
  };

  function _render(e) {
    var t = document.getElementById(_config.templateId);
    var r = document.getElementById(_config.wrapperId);
    if (t && r) {
      var n = Handlebars.compile(t.textContent.trim());
      var a = n(e);
      r.insertAdjacentHTML("beforeend", a);
      if (typeof Currency !== "undefined" && typeof Currency.convertAll === "function") {
        var i = "";
        var currencyElement = document.querySelector("[name=currencies]");
        if (currencyElement) {
          i = currencyElement.value;
        } else {
          var selectedCurrency = document.querySelector("#currencies span.selected");
          if (selectedCurrency) {
            i = selectedCurrency.getAttribute("data-currency");
          }
        }
        if (i !== "") {
          //Currency.convertAll(shopCurrency, i, "#wrapper-response span.money, #estimated-shipping span.money");
          Currency.convertAll(shopCurrency, i, "#wrapper-response span.money");
        }
      }
    }
  }

  function _enableButtons() {
    var buttons = document.querySelectorAll(".get-rates");
    buttons.forEach(function (button) {
      button.removeAttribute("disabled");
      button.classList.remove("disabled");
      button.value = _config.submitButton;
    });
  }

  function _disableButtons() {
    var buttons = document.querySelectorAll(".get-rates");
    buttons.forEach(function (button) {
      button.value = _config.submitButtonDisabled;
      button.setAttribute("disabled", "disabled");
      button.classList.add("disabled");
    });
  }

  function _getCartShippingRatesForDestination(e) {
    var t = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "shipping_address[zip]": e.zip,
        "shipping_address[country]": e.country,
        "shipping_address[province]": e.province,
      }),     
      // body: new URLSearchParams({
      //   shipping_address: e,
      // }),
    };
    fetch(window.Shopify.routes.root + "cart/prepare_shipping_rates", t)
      .then(function () {
        _pollForCartShippingRatesForDestination(e);
      })
      .catch(_onError);
  }

  function _pollForCartShippingRatesForDestination(e) {
    var t = function () {
      var queryParams = new URLSearchParams({
        "shipping_address[zip]": e.zip,
        "shipping_address[country]": e.country,
        "shipping_address[province]": e.province,
      });
      fetch(window.Shopify.routes.root + "cart/async_shipping_rates.json?" + queryParams.toString())
        .then(function (response) {
          if (response.status === 200) {
            return response.json();
          } else {
            throw new Error("Failed to fetch shipping rates");
          }
        })
        .then(function (data) {
          _onCartShippingRatesUpdate(data.shipping_rates, e);
        })
        .catch(_onError);
    };
    setTimeout(t, 500);
  }

  // function _pollForCartShippingRatesForDestination(e) {
  //   var t = function () {
  //     fetch("/cart/async_shipping_rates")
  //       .then(function (response) {
  //         if (response.status === 200) {
  //           console.log(response);
  //           return response.json();
  //         } else {
  //           throw new Error("Failed to fetch shipping rates");
  //         }
  //       })
  //       .then(function (data) {
  //         _onCartShippingRatesUpdate(data.shipping_rates, e);
  //       })
  //       .catch(_onError);
  //   };
  //   setTimeout(t, 500);
  // }

  function _fullMessagesFromErrors(e) {
    var t = [];
    Object.entries(e).forEach(function (entry) {
      var key = entry[0];
      var value = entry[1];
      value.forEach(function (error) {
        t.push(key + " " + error);
      });
    });
    return t;
  }

  function _onError(error) {
    //document.getElementById("estimated-shipping").style.display = "none";
    //document.querySelector("#estimated-shipping em").innerHTML = "";
    _enableButtons();
    var feedback = "";
    try {
      var data = JSON.parse(error.responseText);
      feedback = data.message ? data.message + "(" + data.status + "): " + data.description : "Error : " + _fullMessagesFromErrors(data).join("; ") + ".";
    } catch (err) {
      feedback = "Error : country is not supported.";
    }
    if (feedback === "Error : country is not supported.") {
      feedback = "We do not ship to this destination.";
    }
    _render({
      rates: [],
      errorFeedback: feedback,
      success: false,
    });
    document.getElementById(_config.wrapperId).style.display = "block";
  }

  function _onCartShippingRatesUpdate(e, t) {
    _enableButtons();
    var r = "";
    if (t.zip) {
      r += t.zip + ", ";
    }
    if (t.province) {
      r += t.province + ", ";
    }
    r += t.country;
    if (e.length) {
      if (e[0].price === "0.00") {
        //document.querySelector("#estimated-shipping em").innerHTML = "FREE";
        document.getElementById(_config.wrapperId).innerHTML = "FREE";
      } else {
        //document.querySelector("#estimated-shipping em").innerHTML = _formatRate(e[0].price);
        document.getElementById(_config.wrapperId).innerHTML = _formatRate(e[0].price);
      }
      for (var n = 0; n < e.length; n++) {
        e[n].price = _formatRate(e[n].price);
      }
    }
    _render({
      rates: e,
      address: r,
      success: true,
    });
    document.getElementById(_config.wrapperId).style.display = "block";
    //document.getElementById("estimated-shipping").style.display = "block";
  }

  function _formatRate(e) {
    function t(e, t) {
      return typeof e === "undefined" ? t : e;
    }
    function r(e, r, n, a) {
      if (((r = t(r, 2)), (n = t(n, ",")), (a = t(a, ".")), isNaN(e) || e === null)) return 0;
      e = (e / 100).toFixed(r);
      var i = e.split(".");
      var o = i[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1" + n);
      var s = i[1] ? a + i[1] : "";
      return o + s;
    }

    if (typeof Shopify.formatMoney === "function") {
      return Shopify.formatMoney(e, _config.moneyFormat);
    }
    if (typeof e === "string") {
      e = e.replace(".", "");
    }
    var n = "";
    var a = /\{\{\s*(\w+)\s*\}\}/;
    var i = _config.moneyFormat;
    i = document.createRange().createContextualFragment(i).textContent;
    var matched = i.match(a);
    if (matched && matched[1]) {
      switch (matched[1]) {
        case "amount":
          n = r(e, 2);
          break;
        case "amount_no_decimals":
          n = r(e, 0);
          break;
        case "amount_with_comma_separator":
          n = r(e, 2, ".", ",");
          break;
        case "amount_no_decimals_with_comma_separator":
          n = r(e, 0, ".", ",");
      }
    }
    return i.replace(a, n);
  }

  function _init() {
    new Shopify.CountryProvinceSelector("address_country", "address_province", {
      hideElement: "address_province_container",
    });
    var e = document.getElementById("address_country");
    var t = document.getElementById("address_province_label");
    if (typeof Countries !== "undefined") {
      Countries.updateProvinceLabel(e.value, t);
      e.addEventListener("change", function () {
        Countries.updateProvinceLabel(e.value, t);
      });
    }

    document.querySelectorAll(".get-rates").forEach(function (button) {
      button.addEventListener("click", function () {
        _disableButtons();
        document.getElementById(_config.wrapperId).innerHTML = "";
        document.getElementById(_config.wrapperId).style.display = "none";

        var e = {};
        e.zip = document.getElementById("address_zip").value || "";
        e.country = document.getElementById("address_country").value || "";
        e.province = document.getElementById("address_province").value || "";
        _getCartShippingRatesForDestination(e);
      });
    });

    if (_config.customerIsLoggedIn) {
      document.querySelector(".get-rates").click();
    }
  }

  return {
    show: function (e) {
      e = e || {};
      Object.assign(_config, e);
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          _init();
        });
      } else {
        _init();
      }  
    },
    getConfig: function () {
      return _config;
    },
    formatRate: function (e) {
      return _formatRate(e);
    },
  };
})();
