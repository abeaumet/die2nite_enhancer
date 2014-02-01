/*
 * This Gruntfile is used to develop, test and compile this project. Here are
 * the callable tasks:
 *
 *   - `grunt compile`
 *       Concatenate all the files present in ./sources/ into one.
 *
 *   - `grunt pack`
 *       Call `grunt compile` and then pack the compiled script into the
 *       different wrappers.
 *
 *   - `grunt pack --chrome --firefox`
 *       Same as `grunt pack` but only for the specified wrappers (available
 *       wrappers: 'chrome', 'chrome_zip', 'firefox', 'opera', 'safari' and
 *       'userscript').
 *
 *   - `grunt test`
 *       Run the `test:*` tasks.
 *
 *   - `grunt test:static_check`:
 *       Run `grunt compile`, `grunt jsvalidate` and then `grunt jshint`.
 *
 *   - `grunt test:unit`:
 *       Run `grunt karma:run`.
 *
 *   - `grunt dev`:
 *       Recompile the packages and launch the static analysis and the unit
 *       tests on the fly.
 *
 *   - `grunt dev --userscript --firefox`:
 *       Same as `grunt dev` but only for the specified wrappers (see the `grunt
 *       pack` comment above for the available wrappers).
 *
 */

module.exports = function(grunt) {

    /*
     * Modules
     */

    var userhome = require("userhome");
    var merge = require("merge");
    var path = require("path");


    /*
     * Load placeholders
     */

    var placeholders = grunt.file.readJSON("placeholders.json");


    /*
     * Configuration
     */

    var config = {
        buildDir: path.join(path.resolve(), "build"), // Use an absolute path to fix problems when using the external extension compilers
        iconsDir: path.join(path.resolve(), "icons"),
        testsDir: path.join(path.resolve(), "tests"),
        wrappersDir: path.join(path.resolve(), "wrappers"),

        path: {
            cfx: path.join(userhome(), "bin", "cfx"), // https://ftp.mozilla.org/pub/mozilla.org/labs/jetpack/jetpack-sdk-latest.zip
            chrome: path.join(path.sep, "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
            chrome_pem: path.join(userhome(), ".d2ne", "chrome.pem"), // Generated by Chrome the first time
            openssl: "openssl",
            safari_cert_dir: path.join(userhome(), ".d2ne", "safari"), // http://developer.streak.com/2013/01/how-to-build-safari-extension-using.html
            xar: path.join(userhome(), "bin", "xar"), // https://github.com/downloads/mackyle/xar/xar-1.6.1.tar.gz
            zip: "zip" // Must support -j and -@
        },

        compiled_script: {},
        userscript: {},
        chrome: {},
        chrome_zip: {},
        firefox: {},
        opera: {},
        safari: {}
    };

    config.compiled_script.outputFile = path.join(config.buildDir, placeholders.compiled_script);
    config.userscript.outputFile = path.join(config.buildDir, "userscript.user.js");
    config.chrome.outputFile = path.join(config.buildDir, "chrome.crx");
    config.chrome_zip.outputFile = path.join(config.buildDir, "chrome.zip");
    config.firefox.outputFile = path.join(config.buildDir, "firefox.xpi");
    config.opera.outputFile = path.join(config.buildDir, "opera.nex");
    config.safari.outputFile = path.join(config.buildDir, "safari.safariextz");

    config.compiled_script.workingDir = null;
    config.userscript.workingDir = path.join(config.buildDir, "userscript");
    config.chrome.workingDir = path.join(config.buildDir, "chrome");
    config.chrome_zip.workingDir = path.join(config.buildDir, "chrome");
    config.firefox.workingDir = path.join(config.buildDir, "firefox");
    config.opera.workingDir = path.join(config.buildDir, "opera");
    config.safari.workingDir = path.join(config.buildDir, "safari.safariextension");

    config.compiled_script.inputDir = path.join(path.resolve(), "sources");
    config.userscript.inputDir = path.join(config.wrappersDir, "userscript");
    config.chrome.inputDir = path.join(config.wrappersDir, "chrome");
    config.chrome_zip.inputDir = path.join(config.wrappersDir, "chrome");
    config.firefox.inputDir = path.join(config.wrappersDir, "firefox");
    config.opera.inputDir = path.join(config.wrappersDir, "opera");
    config.safari.inputDir = path.join(config.wrappersDir, "safari");


    /*
     * Grunt init
     */

    grunt.config.init({
        pkg: grunt.file.readJSON("package.json"),

        _pack: {
            userscript: {
                custom: function(workingDir, OutputFile) {
                    grunt.task.run("concat:pack_userscript");
                }
            },
            chrome: {
                custom: function(workingDir, OutputFile) {
                    grunt.task.run("shell:pack_chrome");
                }
            },
            chrome_zip: {
                custom: function(workingDir, OutputFile) {
                    grunt.task.run("shell:pack_chrome_zip");
                }
            },
            firefox: {
                custom: function(workingDir, OutputFile) {
                    grunt.task.run("shell:pack_firefox");
                }
            },
            opera: {
                custom: function(workingDir, OutputFile) {
                    grunt.task.run("shell:pack_opera");
                }
            },
            safari: {
                custom: function(workingDir, OutputFile) {
                    grunt.task.run("shell:pack_safari");
                }
            }
        },

        clean: {
            all: [config.buildDir],
            all_working_dirs: [
                config.userscript.workingDir,
                config.chrome.workingDir,
                config.chrome_zip.workingDir,
                config.firefox.workingDir,
                config.opera.workingDir,
                config.safari.workingDir
            ],
            userscript: [config.userscript.workingDir],
            chrome: [config.chrome.workingDir],
            chrome_zip: [config.chrome_zip.workingDir],
            firefox: [config.firefox.workingDir],
            opera: [config.opera.workingDir],
            safari: [config.safari.workingDir]
        },

        concat: {
            options: {
                separator: "\n"
            },
            compiled_script: {
                src: [
                    path.join(config.compiled_script.inputDir, "header.js"),
                    path.join(config.compiled_script.inputDir, "classes", "*.js"),
                    path.join(config.compiled_script.inputDir, "modules", "*.js"),
                    path.join(config.compiled_script.inputDir, "footer.js")
                ],
                dest: config.compiled_script.outputFile
            },
            pack_userscript: {
                src: [path.join(config.userscript.workingDir, "metadata.js"),
                      config.compiled_script.outputFile],
                dest: config.userscript.outputFile,
                options: {
                    process: function(content) {
                        return grunt.template.process(content, {
                            data: merge(grunt.config("pkg"), placeholders)
                        });
                    }
                }
            }
        },

        copy: {
            options: {
                process: function(content) {
                    return grunt.template.process(content, {
                        data: merge(grunt.config("pkg"), placeholders)
                    });
                },
                processContentExclude: [path.join("**", "*.png")]
            },

            userscript: {
                cwd: config.userscript.inputDir,
                src: ["**"],
                dest: config.userscript.workingDir,
                filter: "isFile",
                expand: true
            },
            chrome: {
                files: [
                    {
                        cwd: config.chrome.inputDir,
                        src: ["**"],
                        dest: config.chrome.workingDir,
                        filter: "isFile",
                        expand: true
                    },
                    {
                        src: [config.compiled_script.outputFile],
                        dest: config.chrome.workingDir,
                        filter: "isFile",
                        expand: true,
                        flatten: true
                    },
                    {
                        cwd: config.iconsDir,
                        src: ["icon48.png", "icon128.png"],
                        dest: config.chrome.workingDir,
                        filter: "isFile",
                        expand: true
                    }
                ]
            },
            chrome_zip: {
                files: [
                    {
                        cwd: config.chrome_zip.inputDir,
                        src: ["**"],
                        dest: config.chrome_zip.workingDir,
                        filter: "isFile",
                        expand: true
                    },
                    {
                        src: [config.compiled_script.outputFile],
                        dest: config.chrome_zip.workingDir,
                        filter: "isFile",
                        expand: true,
                        flatten: true
                    },
                    {
                        cwd: config.iconsDir,
                        src: ["icon48.png", "icon128.png"],
                        dest: config.chrome_zip.workingDir,
                        filter: "isFile",
                        expand: true
                    }
                ]
            },
            firefox: {
                files: [
                    {
                        cwd: config.firefox.inputDir,
                        src: ["**"],
                        dest: config.firefox.workingDir,
                        filter: "isFile",
                        expand: true
                    },
                    {
                        src: [config.compiled_script.outputFile],
                        dest: path.join(config.firefox.workingDir, "data"),
                        filter: "isFile",
                        expand: true,
                        flatten: true
                    }
                ]
            },
            opera: {
                files: [
                    {
                        cwd: config.opera.inputDir,
                        src: ["**"],
                        dest: config.opera.workingDir,
                        filter: "isFile",
                        expand: true
                    },
                    {
                        src: [config.compiled_script.outputFile],
                        dest: config.opera.workingDir,
                        filter: "isFile",
                        expand: true,
                        flatten: true
                    },
                    {
                        cwd: config.iconsDir,
                        src: ["icon48.png", "icon128.png"],
                        dest: config.opera.workingDir,
                        filter: "isFile",
                        expand: true
                    }
                ]
            },
            safari: {
                files: [
                    {
                        cwd: config.safari.inputDir,
                        src: ["**"],
                        dest: config.safari.workingDir,
                        filter: "isFile",
                        expand: true
                    },
                    {
                        src: [config.compiled_script.outputFile],
                        dest: config.safari.workingDir,
                        filter: "isFile",
                        expand: true,
                        flatten: true
                    }
                ]
            }
        },

        shell: {
            options: {
                stdout: false
            },
            pack_chrome: {
                command: function() {
                    var cmd = "'" + config.path.chrome + "' --pack-extension='" + config.chrome.workingDir + "' --pack-extension-key='" + config.path.chrome_pem + "'";
                    return cmd;
                }
            },
            pack_chrome_zip: {
                command: function() {
                    var cmd = "echo " + grunt.file.expand(config.chrome_zip.workingDir + "**" + path.sep + "*").join(" ") + " | tr ' ' '\n' | " + config.path.zip + " -j " + config.chrome_zip.outputFile + " -@";
                    return cmd;
                }
            },
            pack_firefox: {
                command: function () {
                    var cmd = "cd '" + config.firefox.workingDir + "' && '" + config.path.cfx + "' xpi --output-file='" + config.firefox.outputFile + "'";
                    return cmd;
                }
            },
            pack_opera: {
                command: function() {
                    var cmd =
                        "'" + config.path.chrome + "' --pack-extension=" + config.opera.workingDir + " --pack-extension-key=" + config.path.chrome_pem + ";" +
                        "mv '" + path.join(config.buildDir, "opera.crx") + "' '" + config.opera.outputFile + "'";
                    return cmd;
                }
            },
            pack_safari: {
                command: function() {
                    var cmd =
                        "digest_file='" + path.join(config.safari.workingDir, "digest.dat") + "';" +
                        "sig_file='" + path.join(config.safari.workingDir, "sig.dat") + "';" +
                        "cd '" + path.join(config.safari.workingDir, "..") + "' && " + config.path.xar + " -czf " + config.safari.outputFile + " --distribution \"$(basename '" + config.safari.workingDir + "')\";" +
                        config.path.xar + " --sign -f '" + config.safari.outputFile + "' --digestinfo-to-sign \"$digest_file\" --sig-size \"$(cat '" + path.join(config.path.safari_cert_dir, "size") + "')\" --cert-loc '" + path.join(config.path.safari_cert_dir, "cert.der") + "' --cert-loc '" + path.join(config.path.safari_cert_dir, "cert01") + "' --cert-loc '" + path.join(config.path.safari_cert_dir, "cert02") + "';" +

                        config.path.openssl + " rsautl -sign -inkey '" + path.join(config.path.safari_cert_dir, "key.pem") + "' -in \"$digest_file\" -out \"$sig_file\";" +
                        config.path.xar + " --inject-sig \"$sig_file\" -f '" + config.safari.outputFile + "'";
                    return cmd;
                }
            }
        },

        karma: {
            options: {
                configFile: path.join(config.testsDir, "karma.conf.js"),
            },

            run: {
                singleRun: true,
                browsers: ["PhantomJS", "Firefox"],
                reporters: ["dots", "coverage"],

                // CoverAlls

                preprocessors: {
                    "**/*.js" : ["coverage"]
                },

                coverageReporter: {
                    type: "lcov",
                    dir: "coverage/"
                }
            },

            // Should be launched by `grunt:dev`
            daemon: {
                background: true
            }
        },

        coveralls: {
            options: {
                coverage_dir: "coverage/PhantomJS 1.9.7 (Mac OS X)/"
            }
        },

        watch: {
            karma: {
                // if a spec file is modifed, relaunch the tests
                files: [
                    "tests/**/*.spec.js"
                ],
                tasks: ["karma:daemon:run"]
            },
            pack: {
                // if a source file is modified, re-statically check the files,
                // relaunch the tests and finally re-pack
                files: [
                    "sources/**/*.js"
                ],
                tasks: ["static_check", "karma:daemon:run", "pack"]
            }
        },

        jsvalidate: {
            options:{
                globals: {},
                esprimaOptions: {},
                verbose: false
            },
            compiled_script:{
                files: {
                    src: [config.compiled_script.outputFile]
                }
            }
        },

        jshint: {
            src: [config.compiled_script.outputFile],
            options: {
                // --------------------------------------------------------------------
                // JSHint Configuration, Strict Edition
                // --------------------------------------------------------------------
                //
                // This is a options template for [JSHint][1], using [JSHint example][2]
                // and [Ory Band"s example][3] as basis and setting config values to
                // be most strict:
                //
                // * set all enforcing options to true
                // * set all relaxing options to false
                // * set all environment options to false, except the browser value
                // * set all JSLint legacy options to false
                //
                // [1]: http://www.jshint.com/
                // [2]: https://github.com/jshint/node-jshint/blob/master/example/config.json
                // [3]: https://github.com/oryband/dotfiles/blob/master/jshintrc
                //
                // @author http://michael.haschke.biz/
                // @license http://unlicense.org/

                // == Enforcing Options ===============================================
                //
                // These options tell JSHint to be more strict towards your code. Use
                // them if you want to allow only a safe subset of JavaScript, very
                // useful when your codebase is shared with a big number of developers
                // with different skill levels.

                "bitwise"       : true,     // Prohibit bitwise operators (&, |, ^, etc.).
                "curly"         : true,     // Require {} for every new block or scope.
                "eqeqeq"        : true,     // Require triple equals i.e. `===`.
                "forin"         : true,     // Tolerate `for in` loops without `hasOwnPrototype`.
                "immed"         : true,     // Require immediate invocations to be wrapped in parens e.g. `( function(){}() );`
                "latedef"       : true,     // Prohibit variable use before definition.
                "newcap"        : true,     // Require capitalization of all constructor functions e.g. `new F()`.
                "noarg"         : true,     // Prohibit use of `arguments.caller` and `arguments.callee`.
                "noempty"       : true,     // Prohibit use of empty blocks.
                "nonew"         : true,     // Prohibit use of constructors for side-effects.
                "plusplus"      : true,     // Prohibit use of `++` & `--`.
                "regexp"        : true,     // Prohibit `.` and `[^...]` in regular expressions.
                "undef"         : true,     // Require all non-global variables be declared before they are used.
                "strict"        : true,     // Require `use strict` pragma in every file.
                "trailing"      : true,     // Prohibit trailing whitespaces.

                // == Relaxing Options ================================================
                //
                // These options allow you to suppress certain types of warnings. Use
                // them only if you are absolutely positive that you know what you are
                // doing.

                "asi"           : false,    // Tolerate Automatic Semicolon Insertion (no semicolons).
                "boss"          : false,    // Tolerate assignments inside if, for & while. Usually conditions & loops are for comparison, not assignments.
                "debug"         : false,    // Allow debugger statements e.g. browser breakpoints.
                "eqnull"        : false,    // Tolerate use of `== null`.
                "es5"           : false,    // Allow EcmaScript 5 syntax.
                "esnext"        : false,    // Allow ES.next specific features such as `const` and `let`.
                "evil"          : false,    // Tolerate use of `eval`.
                "expr"          : false,    // Tolerate `ExpressionStatement` as Programs.
                "funcscope"     : false,    // Tolerate declarations of variables inside of control structures while accessing them later from the outside.
                "globalstrict"  : false,    // Allow global "use strict" (also enables "strict").
                "iterator"      : false,    // Allow usage of __iterator__ property.
                "lastsemic"     : false,    // Tolerat missing semicolons when the it is omitted for the last statement in a one-line block.
                "laxbreak"      : false,    // Tolerate unsafe line breaks e.g. `return [\n] x` without semicolons.
                "laxcomma"      : false,    // Suppress warnings about comma-first coding style.
                "loopfunc"      : false,    // Allow functions to be defined within loops.
                "multistr"      : false,    // Tolerate multi-line strings.
                "onecase"       : false,    // Tolerate switches with just one case.
                "proto"         : false,    // Tolerate __packroto__ property. This property is deprecated.
                "regexdash"     : false,    // Tolerate unescaped last dash i.e. `[-...]`.
                "scripturl"     : true,    // Tolerate script-targeted URLs.
                "smarttabs"     : false,    // Tolerate mixed tabs and spaces when the latter are used for alignmnent only.
                "shadow"        : false,    // Allows re-define variables later in code e.g. `var x=1; x=2;`.
                "sub"           : false,    // Tolerate all forms of subscript notation besides dot notation e.g. `dict["key"]` instead of `dict.key`.
                "supernew"      : false,    // Tolerate `new function () { ... };` and `new Object;`.
                "validthis"     : true,    // Tolerate strict violations when the code is running in strict mode and you use this in a non-constructor function.

                // == Environments ====================================================
                //
                // These options pre-define global variables that are exposed by
                // popular JavaScript libraries and runtime environments—such as
                // browser or node.js.

                "browser"       : true,     // Standard browser globals e.g. `window`, `document`.
                "couch"         : false,    // Enable globals exposed by CouchDB.
                "devel"         : false,    // Allow development statements e.g. `console.log();`.
                "dojo"          : false,    // Enable globals exposed by Dojo Toolkit.
                "jquery"        : false,    // Enable globals exposed by jQuery JavaScript library.
                "mootools"      : false,    // Enable globals exposed by MooTools JavaScript framework.
                "node"          : false,    // Enable globals available when code is running inside of the NodeJS runtime environment.
                "nonstandard"   : false,    // Define non-standard but widely adopted globals such as escape and unescape.
                "prototypejs"   : false,    // Enable globals exposed by Prototype JavaScript framework.
                "rhino"         : false,    // Enable globals available when your code is running inside of the Rhino runtime environment.
                "wsh"           : false,    // Enable globals available when your code is running as a script for the Windows Script Host.

                // == JSLint Legacy ===================================================
                //
                // These options are legacy from JSLint. Aside from bug fixes they will
                // not be improved in any way and might be removed at any point.

                "nomen"         : false,    // Prohibit use of initial or trailing underbars in names.
                "onevar"        : false,    // Allow only one `var` statement per function.
                "passfail"      : false,    // Stop on first error.
                "white"         : false,    // Check against strict whitespace and indentation rules.

                // == Undocumented Options ============================================
                //
                // While I"ve found these options in [example1][2] and [example2][3]
                // they are not described in the [JSHint Options documentation][4].
                //
                // [4]: http://www.jshint.com/options/

                "maxerr"        : 100,      // Maximum errors before stopping.
                "predef"        : [         // Extra globals.
                    "GM_xmlhttpRequest",
                    "safari"
                ]//,
                //"indent"        : 4         // Specify indentation spacing
            }
        }
    });


    /*
     * Register custom tasks
     */

    grunt.registerTask("default", "Call the task `pack`.", ["pack"]);

    grunt.registerTask("pack", "Pack all the extensions", function(target) {
        var options = false;

        grunt.task.run("compile");

        // Browse all the possible _pack. Pack it if the concerned wrapper
        // options is found and enabled.
        var _packs = grunt.config("_pack");
        for (var key in _packs) {
            if (!_packs.hasOwnProperty(key) ||
                typeof grunt.option(key) === "undefined" ||
                grunt.option(key) === false) {
                continue;
            }
            options = true;
            grunt.task.run("copy:" + key);
            grunt.task.run("_pack:" + key);
            grunt.task.run("clean:" + key);
        }

        // if no options provided, pack everything
        if (!options) {
            grunt.task.run("copy");
            grunt.task.run("_pack");
            grunt.task.run("clean:all_working_dirs");
        }
    });

    grunt.registerMultiTask("_pack", " ", function() {
        // If the target needs a custom process
        if (typeof this.data.custom === "function") {
            // Use file(s) in the working directory to generate the output file
            this.data.custom(this.data.workingDir, this.data.outputFile);
        }
    });

    grunt.registerTask("test", "Launch the static tests and the unit tests.", function(target) {
        var tests = ["static_check", "unit"];

        // if no target provided, launch all the tests
        if (typeof target === "undefined") {
            tests.forEach(function(test) {
                grunt.task.run(test);
            });
        } else {
            // else launch the test if it is known
            if (tests.indexOf(target) > -1) {
                grunt.task.run(target);
            } else {
                grunt.warn("test:" + target + " does not exist.");
            }
        }
    });

    grunt.registerTask("static_check", "Statically check the JS files.", ["compile", "jsvalidate", "jshint"]);

    grunt.registerTask("unit", "Launch the unit tests.", ["karma:run"]);

    grunt.registerTask("compile", "Concatenate the JavaScript files into one.", ["clean:all", "concat:compiled_script"]);

    grunt.registerTask("dev", "Watch for modifications and recompile/relaunch tests on the fly.", ["karma:daemon:start", "watch"]);


    /*
     * Load NPM tasks
     */

    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-jsvalidate");
    grunt.loadNpmTasks("grunt-karma");
    grunt.loadNpmTasks('grunt-karma-coveralls');
    grunt.loadNpmTasks("grunt-shell");

};
