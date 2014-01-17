/**
 * Die2Nite helpers
 */

var D2N_helpers = (function() {

/*
  public:
*/

    /**
     * Check whether the user is logged.
     * @param callback callback The callback to call with the result
     */
    function is_logged(callback)
    {
        js.wait_for_id('tid_sidePanel_user', function(node) {
            callback(true); // logged if the side panel exists
        }, 20, function(node) {
            callback(false); // else not logged
        });
    }

    /**
     * Check if the player is on the forum.
     * @return bool true if on the forum, false otherwise
     */
    function is_on_forum()
    {
        return (window.location.pathname === '/tid/forum');
    }

    /**
     * Check if the user is playing in a town or not (do not confound with
     * `is_in_city`). Call the function `callback` with the result
     */
    function is_in_town(callback)
    {
        js.wait_for_id('clock', function if_found() {
            callback(true);
        }, 5, function if_not_found() {
            callback(false);
        });
    }

    /**
     * Check if the player is in the city. Return false if the user is in the city
     * but on the forum.
     * @return bool true if inside the city, false otherwise
     */
    function is_in_city()
    {
        return js.match_regex(
            window.location.hash,
            '^#city'
        );
    }

    /**
     * Check if the player is outside the city. Return false if the user is
     * outside but on the forum.
     * @return string true if outside, false otherwise
     */
    function is_outside()
    {
        return js.match_regex(
            window.location.hash,
            '^#outside\\?(?:go=outside\\/refresh;)?sk=[a-z0-9]{5}$'
        );
    }

    /**
     * Check if the given page is loaded (in or out of city).
     * @param string page The page to check (a key from pages_url_)
     * @return string true if on the selected page
     */
    function is_on_page(page)
    {
        return (is_on_page_in_city(page) ||
                is_on_page_out_of_city(page));
    }

    /**
     * Check if the given city page is loaded.
     * @param string page The page to check (a key from pages_url_)
     * @return string true if on the selected city page
     */
    function is_on_page_in_city(page)
    {
        return js.match_regex(
            window.location.hash,
            '^#city\\/enter\\?go=' + pages_url_[page].replace('/', '\\/') + ';sk=[a-z0-9]{5}$'
        ) || js.match_regex(
            window.location.hash,
            '^#ghost\\/city\\?go=' + pages_url_[page].replace('/', '\\/') + ';sk=[a-z0-9]{5}$'
        );
    }

    /**
     * Check if the given page is loaded (not in city).
     * @param string page The page to check (a key from pages_url_)
     * @return string true if on the selected page (not in city)
     */
    function is_on_page_out_of_city(page)
    {
        return js.match_regex(
            window.location.hash,
            '^#ghost\\?go=' + pages_url_[page].replace('/', '\\/') + ';sk=[a-z0-9]{5}$'
        );
    }

    /**
     * Load a specific city page.
     * @param string page The page to go (a key from pages_url_)
     */
    function go_to_city_page(page)
    {
        // if not in a town, outside city or already on the page, abort
        is_in_town(function(in_town) {
            if (!(in_town ||
                  is_outside() ||
                  is_on_page_in_city(page)
                 )) {
                return;
            }

            get_sk(function(sk) {
                var page_url = pages_url_[page];

                if (is_on_forum()) { // if on the forum, redirect to the desired page
                    js.redirect('/#city/enter?go=' + page_url + ';sk=' + sk);
                } else { // else just download the content with an ajax request
                    js.injectJS('js.XmlHttp.get(' + JSON.stringify(page_url + '?sk=' + sk) + ');');
                }
            });
        });
    }

    /**
     * Find the sk (session/secret key?).
     * @param callback callback The function to call once the sk is fetched
     */
    function get_sk(callback)
    {
        js.wait_for_selector('a.mainButton.newsButton', function(node) {
            var arr = node.href.split('=');

            // return string after the last equal which should be the session
            // key
            callback(arr[arr.length - 1]);
        });
    }

    /**
     * Give the website language (specific to D2N/Hordes). Return 'en' by
     * default.
     * @return string The language of the current page ('en' / 'fr')
     * @return null if no corresponding language can be found
     */
    function get_website_language()
    {
        var hostname = window.location.hostname;

        if (js.is_defined(hostname) &&
            js.is_defined(websites_language_[hostname])) {
            return websites_language_[hostname];
        }

        return null;
    }

    /**
     * Call the given callback with the number of AP.
     * @param callback callback The function to call
     */
    function get_number_of_ap(callback)
    {
        js.wait_for_selector('#movesCounter > div', function(node) {
            var ap = parseInt(node.textContent.split('/')[0]);
            callback(ap);
        });
    }

    /**
     * Add custom events on the interface:
     * - to watch when the gamebody is reloaded
     * - to watch the number of AP: 'apchange'
     */
    function add_custom_events()
    {
        /*
         * Gamebody
         */

        // Emit Gamebody reloaded event
        var emit_gamebody_reloaded_event = function() {
            var event = new CustomEvent(
                'd2n_gamebody_reloaded', {
                    bubbles: true,
                    cancelable: true
                }
            );
            document.dispatchEvent(event);
        };

        var loading_wheel_old_observer = null;
        var loading_wheel_observer = null;

        var setup_loading_wheel_observer = function() {
            js.wait_for_id('loading_section', function(node) {
                loading_wheel_old_observer = loading_wheel_observer;
                loading_wheel_observer = new MutationObserver(function(mutations) {
                    for (var i = 0, max = mutations.length; i < max; ++i) {
                        // if the loading wheel disappears, then the page loading is
                        // done, emit a gamebody reloaded event
                        if (mutations[i].target.style.display === 'none') {
                            return emit_gamebody_reloaded_event();
                        }
                    }
                });

                loading_wheel_observer.observe(node, { attributes: true });

                if (loading_wheel_old_observer !== null) {
                    loading_wheel_old_observer.disconnect();
                    loading_wheel_old_observer = null;
                }
            });
        };

        // Watch for the first gamebody load and emit an event. Then setup the
        // observer
        var watch_for_hash = function(limit) {
            limit = (typeof limit === 'undefined') ? 20 : limit;

            // If the limit isn't reached and the hash isn't defined, call this
            // function again
            if (limit > 0 && window.location.hash === '') {
                return setTimeout(function() { watch_for_hash(limit - 1); }, 200);
            }

            // If the hash exists, the page is loaded. Then emit an event and
            // setup the mutation observer

            // 1. Emit the event
            emit_gamebody_reloaded_event();

            // 2. Set up the observer
            setup_loading_wheel_observer();

            // 3. Re-set the observer on some pages
            var body_observer = new MutationObserver(function(mutations) {
                for (var i = 0, max = mutations.length; i < max; ++i) {
                    // if the loading wheel appears, then the page is loading
                    // and the observer is set on the loading wheel
                    if (mutations[i].target.style.cursor === 'progress') {
                        setup_loading_wheel_observer();
                    }
                }
            });
            js.wait_for_tag('body', function(nodes) {
                body_observer.observe(nodes[0], { attributes: true });
            });

            // 4. Emit event on news and help page
            window.addEventListener('hashchange', function() {
                if (js.match_regex(window.location.hash, '^\#news') ||
                    js.match_regex(window.location.hash, '^\#help')) {
                    emit_gamebody_reloaded_event();
                }
            }, false);
        };
        watch_for_hash();

        /*
         * AP
         */

        // Emit AP change event
        var emit_ap_change_event = function() {
            var event = new CustomEvent(
                'd2n_apchange', {
                    bubbles: true,
                    cancelable: true
                }
            );
            document.dispatchEvent(event);
        };

        var ap_observer = null;
        var ap_old_observer = null;

        var watch_for_ap = function() {
            is_in_town(function(in_town) {
                if (in_town) { // only watch AP in town
                    js.wait_for_id('movesCounter', function(node) {
                        ap_old_observer = ap_observer;

                        // Watch for AP change
                        ap_observer = new MutationObserver(function(mutations) {
                            emit_ap_change_event();
                        });

                        ap_observer.observe(node, { childList: true, subtree: true });

                        if (ap_old_observer !== null) {
                            ap_old_observer.disconnect();
                            ap_old_observer = null;
                        }
                    });
                }
            });
        };
        watch_for_ap();

        window.addEventListener('hashchange', function() {
            watch_for_ap();
        }, false);
    }

    /**
     * Return the hostname of the current webpage.
     */
    function get_website()
    {
        return window.location.hostname;
    }

/*
  private:
*/

    var pages_url_ = {
        // in town
        overview: 'city/enter',
        home: 'home',
        well: 'city/well',
        bank: 'city/bank',
        citizens: 'city/co',
        buildings: 'city/buildings',
        doors: 'city/door',
        upgrades: 'city/upgrades',
        tower: 'city/tower',
        refine: 'city/refine',
        guard: 'city/guard',

        // in/out of town
        ghost: 'ghost/user',
        ghost_exp: 'ghost/heroUpgrades',
        settings: 'ghost/options'
    };

    var websites_language_ = {
        'www.die2nite.com': 'en',
        'www.hordes.fr': 'fr',
        'www.zombinoia.com': 'es',
        'www.dieverdammten.de': 'de'
    };

/*
*/

    return {
        is_on_forum: is_on_forum,
        is_in_town: is_in_town,
        is_in_city: is_in_city,
        is_outside: is_outside,
        is_on_page: is_on_page,
        is_on_page_in_city: is_on_page_in_city,
        is_on_page_out_of_city: is_on_page_out_of_city,
        go_to_city_page: go_to_city_page,
        get_sk: get_sk,
        get_website_language: get_website_language,
        get_number_of_ap: get_number_of_ap,
        add_custom_events: add_custom_events,
        is_logged: is_logged,
        get_website: get_website
    };

})();
