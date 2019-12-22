/******************************************************************************
 *                                                                            *
 *  JavaScript helpers class                                                  *
 *                                                                            *
 ******************************************************************************/

var JS = (function() {

/*
 * private:
 */

    /**
     * Time to wait between two self-call of `wait_for_*` functions.
     */
    var wait_for_retry_time_ = 250; //ms

    /**
     * Maximum number of retry for the `wait_for_*` functions.
     */
    var wait_for_max_retry_ = 10;

    /**
     * Store the Safari callbacks.
     */
    var safari_callbacks_ = null;

    /**
     * Safely insert code through JSON.
     * @link https://developer.mozilla.org/en-US/Add-ons/Overlay_Extensions/XUL_School/DOM_Building_and_HTML_Insertion
     */
    var jsonToDOM = function(xml, doc, nodes)
    {
        function namespace(name) {
            var m = /^(?:(.*):)?(.*)$/.exec(name);
            return [jsonToDOM.namespaces[m[1]], m[2]];
        }

        function tag(name, attr) {
            if (Array.isArray(name)) {
                var frag = doc.createDocumentFragment();
                Array.forEach(arguments, function (arg) {
                    if (!Array.isArray(arg[0])) {
                        frag.appendChild(tag.apply(null, arg));
                    } else {
                        arg.forEach(function (arg) {
                            frag.appendChild(tag.apply(null, arg));
                        });
                    }
                });
                return frag;
            }

            var args = Array.prototype.slice.call(arguments, 2);
            var vals = namespace(name);
            var elem = doc.createElementNS(vals[0] || jsonToDOM.defaultNamespace, vals[1]);

            for (var key in attr) {
                if (attr.hasOwnProperty(key)) {
                    var val = attr[key];
                    if (nodes && key === "key") {
                        nodes[val] = elem;
                    }

                    vals = namespace(key);
                    if (typeof val === "function") {
                        elem.addEventListener(key.replace(/^on/, ""), val, false);
                    } else {
                        elem.setAttributeNS(vals[0] || "", vals[1], val);
                    }
                }
            }
            args.forEach(function(e) {
                elem.appendChild(typeof e === "object" ? tag.apply(null, e) :
                                 e instanceof Node    ? e : doc.createTextNode(e));
            });
            return elem;
        }
        return tag.apply(null, xml);
    };
    jsonToDOM.namespaces = {
        html: "http://www.w3.org/1999/xhtml",
        xul: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
    };
    jsonToDOM.defaultNamespace = jsonToDOM.namespaces.html;

    var keydown_event_ = {
        previous_keycode: null,
        previous_keycode_timestamp: 0, // ms
        already_bind: false
    };

    /**
     * Generic wait_for_ function. See wait_for_id for the purpose of this
     * function.
     * @param function search A closure returning the searched element
     * @param function is_found A closure taking the searched element and
     * returning true or false whether it was found or not
     * @param function callback The function to call if the element was found
     * @param integer max The maximum number of retry if the first search fails
     * @param function not_found_callback The function to call if the element
     * was not found
     */
    var wait_for_ = function(search, is_found, callback, max, not_found_callback) {
            max = (typeof max === "number") ? max : wait_for_max_retry_;

            // try to find it
            var el = search();
            if (is_found(el)) {
                return callback(el);
            }

            // if max is defined and is reached, stop research
            if (max <= 0) {
                // if a callback has been given, call it
                if (JS.is_defined(not_found_callback) && typeof not_found_callback === 'function') {
                    not_found_callback();
                }
            } else { // else try again
                setTimeout(function() {
                    wait_for_(search, is_found, callback, max - 1, not_found_callback);
                }, wait_for_retry_time_);
            }
    };

/*
 * public:
 */

    return {

        /**
         * Execute an asynchronous network request.
         * @param string method POST, GET...
         * @param string urn path
         * @param string data query string
         * @param JSON headers
         * @param callback on_success in case of success
         * @param callback on_failure in case of failure
         */
        network_request: function(method, urn, data, headers, on_success, on_failure) {

            var uri = JS.form_uri(null, urn);

            // Google Chrome script / GreaseMonkey
            if (typeof GM_xmlhttpRequest !== 'undefined') {
                if(typeof GM_xmlhttpRequest === 'function') {
                    return GM_xmlhttpRequest({
                        method: method,
                        url: uri,
                        data: '' + data,
                        headers: headers,
                        onload: function(r) { on_success(r.responseText, r.responseHeaders); },
                        onerror: function(r) { on_failure(); }
                    });
                } else {
                    return new GM_xmlhttpRequest({
                        method: method,
                        url: uri,
                        data: '' + data,
                        headers: headers,
                        onload: function(r) { on_success(r.responseText, r.responseHeaders); },
                        onerror: function(r) { on_failure(); }
                    });
                }
            }

            // Safari needs to dispatch the request to the global page if the
            // request is Cross Domain
            if (typeof safari !== 'undefined' && JS.is_cross_domain(uri)) {
                // Only register the listener once
                if (safari_callbacks_ === null) {
                    safari.self.addEventListener('message', function(event) {
                        var request_id = event.message.request_id;

                        // if the callback for the given URI can't be found, abort
                        if (!(request_id in safari_callbacks_)) {
                            return;
                        }

                        switch (event.name) {
                            case 'network_request_succeed':
                                safari_callbacks_[request_id].on_success(event.message.response_text);
                                break;

                            case 'network_request_failed':
                                safari_callbacks_[request_id].on_failure();
                                break;
                        }

                        // Delete the callback
                        safari_callbacks_[request_id] = null;
                        delete safari_callbacks_[request_id];
                    }, false);
                }

                var request_unique_id = +new Date() + Math.random() + uri;

                // Save callbacks to keep the context
                safari_callbacks_ = safari_callbacks_ || {};
                safari_callbacks_[request_unique_id] = {
                    on_success: on_success,
                    on_failure: on_failure
                };

                // Ask to the global page to do the request
                return safari.self.tab.dispatchMessage('do_network_request', {
                    method: method,
                    url: uri,
                    data: '' + data,
                    headers: headers,
                    request_id: request_unique_id
                });
            }

            // All other cases
            var xmlhttp = new XMLHttpRequest();
            xmlhttp.open(method, uri, true);
            for (var header in headers) {
                if (headers.hasOwnProperty(header)) {
                    xmlhttp.setRequestHeader(header, headers[header]);
                }
            }
            xmlhttp.onreadystatechange = function() {
                if (xmlhttp.readyState === 4) {
                    if (xmlhttp.status >= 200 && xmlhttp.status < 300) {
                        return on_success(xmlhttp.responseText, xmlhttp.responseHeaders);
                    }
                    return on_failure();
                }
            };
            xmlhttp.send(data);
        },

        /**
         * Check if a given variable is defined and is not null.
         * @param mixed variable The variable to check
         * @return bool true if the variable is defined and is not null, otherwise
         * false
         */
        is_defined: function(variable)
        {
            return (typeof variable !== 'undefined' && variable !== null);
        },

        /**
         * Reset the keydown_event_ object. Forget about the last key stroke.
         */
        reset_previous_keycode: function()
        {
            keydown_event_.previous_keycode = null;
            keydown_event_.previous_keycode_timestamp = 0;
        },

        /**
         * Catch a keydown event (abort if the cursor is in an input field). Call
         * the callback `callback` with the current keycode and the last one (if it
         * exists).
         * @param callback callback The function to call, should look like the
         * following prototype: `function(keycode, previous_keycode){};`.
         * previous_keycode will be null if it doesn't exists.
         * @param integer time_limit The maximum amount of time (in ms) to wait
         * between two binds.
         */
        keydown_event: function(callback, time_limit)
        {
            // Update/set the callback
            keydown_event_.callback = callback;

            // defaut 1000ms between two key strokes
            keydown_event_.time_limit = (typeof time_limit === "number") ? time_limit : 1000;

            // Ensure it can only be bound once (though the callback can still
            // be updated)
            if (keydown_event_.already_bind) {
                return;
            }
            keydown_event_.already_bind = true;

            document.addEventListener('keydown', function(event) {
                // Cancel event if the cursor is in an input field or textarea
                if (event.target.nodeName === 'INPUT' || event.target.nodeName === 'TEXTAREA') {
                    return;
                }

                var current_timestamp = +new Date(); // ms

                // Cancel previous keycode if the elapsed time is too long
                // between the last two keystrokes
                if (current_timestamp - keydown_event_.previous_keycode_timestamp > keydown_event_.time_limit) {
                    JS.reset_previous_keycode();
                }

                // Invoke callback
                keydown_event_.callback(event.keyCode, keydown_event_.previous_keycode);

                // Save keycode
                keydown_event_.previous_keycode = event.keyCode;
                keydown_event_.previous_keycode_timestamp = current_timestamp;
            }, false);
        },

        /**
         * Inject CSS code in the page context.
         * @param string code The CSS code to inject
         */
        injectCSS: function(code)
        {
            var css = document.createElement('style');
            css.setAttribute('type', 'text/css');
            css.textContent = code;

            JS.wait_for_tag('head', function(nodes) {
                nodes[0].appendChild(css);
            });
        },

        /**
         * Inject and execute JavaScript code in the page context.
         * @link http://wiki.greasespot.net/Content_Script_Injection
         * @param string/callback source The JS code to inject
         */
        injectJS: function(source)
        {
            // Check for function input.
            if ('function' === typeof source) {
                // Execute this function with no arguments, by adding parentheses.
                // One set around the function, required for valid syntax, and a
                // second empty set calls the surrounded function.
                source = '(' + source + ')();';
            }

            // Create a script node holding this  source code.
            var script = document.createElement('script');
            script.setAttribute('type', 'application/javascript');
            script.textContent = source;

            // Insert the script node into the page, so it will run, and immediately
            // remove it to clean up.
            JS.wait_for_selector('html > body', function(node) {
                node.appendChild(script);
                node.removeChild(script);
            });
        },

        /**
         * Remove a DOM node.
         * @link http://stackoverflow.com/a/14782/1071486
         * @param DOMNode node The DOM node to delete
         */
        remove_DOM_node: function(node)
        {
            if (JS.is_defined(node)) {
                node.parentNode.removeChild(node);
            }
        },

        /*
         * Recursively merge properties of 2 objects. The first object properties
         * will be erased by the second ones.
         * @link http://stackoverflow.com/a/383245/1071486
         * @param Object obj1 The first object which will receive the merge
         * @param Object obj2 The second object to merge
         * @return Object The first object
         */
        merge: function(obj1, obj2) {
            for (var p in obj2) {
                if (obj2.hasOwnProperty(p)) {
                    try {
                        // Property in destination object set; update its value.
                        if (obj2[p].constructor === Object) {
                            obj1[p] = JS.merge(obj1[p], obj2[p]);
                        } else {
                            obj1[p] = obj2[p];
                        }
                    } catch(e) {
                        // Property in destination object not set; create it and set
                        // its value.
                        obj1[p] = obj2[p];
                    }
                }
            }

            return obj1;
        },

        /**
         * Execute a callback when a node with the given $id is found.
         * @param string id The id to search
         * @param callback callback The function to call when a result is found
         * @param integer max The maximum number of try
         * @param callback not_found_callback The function called if the element
         *                                    isn't found
         */
        wait_for_id: function(id, callback, max, not_found_callback)
        {
            return wait_for_(function search() {
                    return document.getElementById(id);
                }, function is_found(result) {
                    return JS.is_defined(result);
                }, callback, max, not_found_callback);
        },

        /**
         * Execute a callback with an array containing all the nodes matching the
         * given class.
         * @param string class The class to search
         * @param callback callback The function to call when a result is found
         * @param integer max The maximum number of try
         * @param callback not_found_callback The function called if the element
         *                                    isn't found
         */
        wait_for_class: function(class_name, callback, max, not_found_callback)
        {
            return wait_for_(function search() {
                    return JS.nodelist_to_array(document.getElementsByClassName(class_name));
                }, function is_found(result) {
                    return JS.is_defined(result) && result.length > 0;
                }, callback, max, not_found_callback);
        },

        /**
         * Execute a callback with an array containing all the nodes matching the
         * given tag.
         * @param string tag The tag to search
         * @param callback callback The function to call when a result is found
         * @param integer max The maximum number of try
         * @param callback not_found_callback The function called if the element
         *                                    isn't found
         */
        wait_for_tag: function(tag, callback, max, not_found_callback)
        {
            return wait_for_(function search() {
                    return JS.nodelist_to_array(document.getElementsByTagName(tag));
                }, function is_found(result) {
                    return JS.is_defined(result) && result.length > 0;
                }, callback, max, not_found_callback);
        },

        /**
         * Execute a callback with the first node matching the given selector.
         * @param string selector The selector to execute
         * @param callback callback The function to call when a result is found
         * @param integer max The maximum number of try
         * @param callback not_found_callback The function called if the element
         *                                    isn't found
         */
        wait_for_selector: function(selector, callback, max, not_found_callback)
        {
            return wait_for_(function search() {
                    return document.querySelector(selector);
                }, function is_found(result) {
                    return JS.is_defined(result);
                }, callback, max, not_found_callback);
        },

        /**
         * Execute a callback with an array containing all the nodes matching the
         * given selector.
         * @param string selector The selector to execute
         * @param callback callback The function to call when a result is found
         * @param integer max The maximum number of try
         * @param callback not_found_callback The function called if the element
         *                                    isn't found
         */
        wait_for_selector_all: function(selector, callback, max, not_found_callback)
        {
            return wait_for_(function search() {
                    return JS.nodelist_to_array(document.querySelectorAll(selector));
                }, function is_found(result) {
                    return JS.is_defined(result) && result.length > 0;
                }, callback, max, not_found_callback);
        },

        /**
         * Redirect to the given urn.
         * @param string urn The URN to redirect to
         */
        redirect: function(urn)
        {
            window.location.href = JS.form_uri(null, urn);
        },

        /**
         * Reload the current page.
         */
        reload: function()
        {
            location.reload();
        },

        /**
         * Instanciate a Regex object and test to see if the given string matches
         * it. Useful when the Regex should be constructed from a string.
         * @param string/RegExp The regex to match the string with
         * @param string The string to test
         * @return bool true if the regex matches the string, false otherwise
         */
        regex_test: function(regex, string)
        {
            var r;

            if (regex instanceof RegExp) {
                r = regex;
            } else {
                r = new RegExp(regex);
            }

            return r.test(string);
        },

        /**
         * Iterate over an object and pass the key/value to a callback.
         */
        each: function(object, callback)
        {
            for (var key in object) {
                if (object.hasOwnProperty(key)) {
                    callback(key, object[key]);
                }
            }
        },

        /**
         * Dispatch a custom event on the desired DOM Node
         * @param string key The event key
         * @param Object detail (optional) The event details
         * @param DOMNode node (optional) The node to dispatch the event on
         */
        dispatch_event: function(key, detail, node)
        {
            detail = detail || null;
            node = node || document;
            var bubbles = true;
            var cancelable = true;

            var event;

            if (typeof CustomEvent === "function") {
                event = new CustomEvent(key, {
                    detail: detail,
                    bubbles: bubbles,
                    cancelable: cancelable
                });
            } else { // deprecated
                event = document.createEvent("CustomEvent");
                event.initCustomEvent(key, bubbles, cancelable, detail);
            }

            node.dispatchEvent(event);
        },

        /**
         * Assign an attribute to the current object. This function is only
         * relevant if you call it by specifying a `this` context (with bind(),
         * call() or apply()).
         * @param string key The specific key where to assign the value
         * @param string value The value to store
         */
        assign_attribute: function(key, value)
        {
            this[key] = value;
        },

        /**
         * Insert a DOM node after another.
         * @link http://stackoverflow.com/a/4793630/1071486
         * @param Node reference_node
         * @param Node new_node
         */
        insert_after: function(reference_node, new_node)
        {
            reference_node.parentNode.insertBefore(new_node, reference_node.nextSibling);
        },

        /**
         * Parse a XML string.
         * @param string xml The XML to parse
         */
        parse_xml: function(xml)
        {
            var parser = new DOMParser();

            return parser.parseFromString(xml, "text/xml");
        },

        /**
         * Convert a nodelist to an array.
         * @link http://stackoverflow.com/a/2735133/1071486
         * @param Object obj The object to convert.
         */
        nodelist_to_array: function(obj) {
            var array = [];
            for (var i = 0, max = obj.length; i < max; i++) {
                array[i] = obj[i];
            }
            return array;
        },

        /**
         * Form the complete URI from the URL and the URN.
         * @param string url Can be null, in this case fetched from
         * window.location
         * @param string urn The URN
         * @return string The URN prefixed by the URL (if needed)
         */
        form_uri: function(url, urn)
        {
            // if the URN is relative, prefix it with the URL
            if (/^\/[^\/]/.test(urn)) {
                url = url || window.location.protocol + '//' + window.location.host;
                return url + urn;
            }

            // else leave it as is
            return urn;
        },

        /**
         * Check if the given URI is another domain.
         * @param string uri The URI to check.
         * @return boolean true if on a different domain, else false
         */
        is_cross_domain: function(uri)
        {
            var regex = "^(?:/.+|" + window.location.protocol + "//" + window.location.host + ")";
            return !JS.regex_test(regex, uri);
        },

        /**
         * Delete all the children of the given node.
         * @link http://stackoverflow.com/a/3955238/1071486
         * @param DOMElement node
         */
        delete_all_children: function(node)
        {
            while (node.firstChild) {
                node.removeChild(node.firstChild);
            }
        },

        /**
         * Scroll to the bottom of the given element.
         * @link http://stackoverflow.com/a/270628/1071486
         * @param DOMElement node
         */
        scroll_to_bottom: function(node)
        {
            node.scrollTop = node.scrollHeight;
        },

        jsonToDOM: jsonToDOM

    };

})();
