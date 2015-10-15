// npm
var Sass = Npm.require('node-sass');
var fs = Plugin.fs;
var path = Plugin.path;



// Paths and filenames
var basePath = path.join('packages', 'bootstrap4');
var defaultsPath = path.join(basePath, 'assets', 'defaults');
var scssPath = path.join(basePath, 'assets', 'bootstrap', 'scss');
var jsPath = path.join(basePath, 'assets', 'bootstrap', 'js', 'dist');
var jsLoadFirst = [
  'util.js',
  'tooltip.js'
];
var bootstrapSettings = 'bootstrap-settings.json';
var bootstrapVariables = '_bootstrap-variables.scss';
var bootstrapMixins = '_bootstrap-mixins.scss';

var variablesFilesInstruction = '// These are custom bootstrap variables for you to edit.\n' +
                                '// These simply override any default bootstrap variables.\n' +
                                '// This means that you may delete anything in this file\n' +
                                '// and the default bootstrap values will be used instead.\n';
                                //'\n' +
                                //'// Keep this file named "' + bootstrapVariables + '"\n' +
                                //'// However it can be moved to anywhere within the project.\n';

var mixinFilesInstruction = '// This file is not editable.\n' +
                            '// These mixins are exposed here for your convenience.\n' +
                            '// They can be imported using @import "path/to/' +
                            bootstrapMixins.replace(/^\_(.+)\.scss*/, '$1') + '"\n';



// Register the compiler for the bootstrap-settings json file
Plugin.registerCompiler({
  extensions: [],
  filenames: [bootstrapSettings, bootstrapVariables, bootstrapMixins]
}, function () { return new BootstrapCompiler(); });


// BootstrapCompiler constructor
function BootstrapCompiler() {}


// Actual processing of file (bootstrap-settings json)
BootstrapCompiler.prototype.processFilesForTarget = function (files) {
  console.log('\n');

  var settingsFile;
  //var variablesFile;
  //var mixinsFile;

  // Loop through and figure out which file is which
  _.each(files, function (file) {
    var fn = path.basename(file.getDisplayPath());
    if (fn === bootstrapSettings) {
      if (settingsFile)
        throw new Error('You cannot have more than one ' + bootstrapSettings + ' in your Meteor project.');

      settingsFile = file;
    }
    // else if (fn === bootstrapVariables) {
    //   if (variablesFile)
    //     throw new Error('You cannot have more than one ' + bootstrapVariables + ' in your Meteor project.');

    //   variablesFile = file;
    // }
    // else if (fn === bootstrapMixins) {
    //   // Note: Doesn't matter if this one is in the project more than once

    //   mixinsFile = file;
    // }
  });

  if (settingsFile) {
    var settingsPathDir = path.dirname(path.join('.', settingsFile.getDisplayPath()));

    // (1) Get the bootstrap-settings json
    var settings = JSON.parse(settingsFile.getContentsAsString())
    _.defaults(settings, {
      scss: {},
      javascript: {}
    });
    _.defaults(settings.scss, {
      enableFlex: false,
      customVariables: false,
      exposeMixins: false,
      modules: {}
    });
    _.defaults(settings.javascript, {
      namespace: 'Bootstrap',
      modules: {}
    });
    if (!settings.javascript.namespace ||
        settings.javascript.namespace === 'false' ||
        !_.isString(settings.javascript.namespace) ||
        !/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(settings.javascript.namespace)) {

      settings.javascript.namespace = false;
    }
    else if (settings.javascript.namespace.toLowerCase() === 'global') {
      settings.javascript.namespace = 'window';
    }



    // (2) Handle the scss

    // Get all scss modules specified in default bootstrap.scss
    // This will give a nicely ordered list of all bootstrap modules
    var bootstrapDefaultScss = fs.readFileSync(path.join(scssPath, 'bootstrap.scss'));
    var scssModules = [];
    var re = /\@import\s+\"(.+)\"/g;
    var found;
    while (found = re.exec(bootstrapDefaultScss)) {
      if (found[1]) scssModules.push(found[1]);
    }


    // Remove default variables module and mixins module
    scssModules.splice(scssModules.indexOf('variables'), 1);
    scssModules.splice(scssModules.indexOf('mixins'), 1);


    // Filter the modules to include only those enabled in the bootstrap-settings json
    scssModules = _.filter(scssModules, function (moduleName) {
      return settings.scss.modules[moduleName];
    });


    // Reinsert default variables and mixins modules
    scssModules.splice(0, 0, 'variables', 'mixins');


    // Insert custom variables module (after default variables module)
    if (settings.scss.customVariables) {
      if (!fs.exists(path.join(settingsPathDir, bootstrapVariables))) {
        // Generate the custom variables file because it doesn't exist
        var src = fs.readFileSync(path.join(scssPath, '_variables.scss')).toString();
        src = src.substr(Math.max(src.indexOf('\n\n'), 0));
        src = src.replace(/\s*\!default/g, '');
        src = variablesFilesInstruction + src;

        fs.writeFileSync(path.join(settingsPathDir, bootstrapVariables), src);
      }

      scssModules.splice(scssModules.indexOf('variables') + 1, 0, bootstrapVariables);
    }


    // Expose mixins if specified
    if (settings.scss.exposeMixins && !fs.exists(path.join(settingsPathDir, bootstrapMixins))) {
      // Generate the mixins file because it doesn't exist
      var src = fs.readFileSync(path.join(scssPath, '_mixins.scss')).toString();
      src = src.substr(Math.max(src.indexOf('\n\n'), 0));
      src = src.replace(/\@import\s+\"mixins\/(.+)\"\;?/g, function (match, mixin) {
        var fullPath = path.join(scssPath, 'mixins', '_' + mixin + '.scss');

        return fs.readFileSync(fullPath).toString();
      });
      src = mixinFilesInstruction + src;

      fs.writeFileSync(path.join(settingsPathDir, bootstrapMixins), src);
    }


    // Enable flex if specified
    var scssPrefix = '';
    if (settings.scss.enableFlex) scssPrefix += '$enable-flex: true;\n';


    // Render the scss into css
    var rendered = Sass.renderSync({
      data: scssPrefix + _.map(scssModules, function (fn) { return '@import "' + fn + '";'; }).join('\n'),
      includePaths: [scssPath, settingsPathDir]
    });


    // Add the newly generated css as a stylesheet
    settingsFile.addStylesheet({
      data: rendered.css.toString(),
      path: path.join('client', 'stylesheets', 'bootstrap', 'bootstrap.generated.css')
    });



    // (3) Handle the js

    // Get all js modules
    var jsModules = fs.readdirSync(jsPath);


    // Filter the modules to include only those enabled in the bootstrap-settings json
    jsModules = _.filter(jsModules, function (moduleName) {
      return settings.javascript.modules[moduleName.match(/(.*)\.js/i)[1]];
    });


    // Push 'load first' modules to top of list
    jsLoadFirst.reverse();
    _.each(jsLoadFirst, function (fn) {
      var index = jsModules.indexOf(fn);

      if (index > -1)
        jsModules.unshift(jsModules.splice(index, 1)[0]);
    });


    // Get source from each bootstrap js file and compile it into one file
    var src = '';
    _.each(jsModules, function (moduleFn) {
      src += fs.readFileSync(path.join(jsPath, moduleFn)).toString() + '\n';
    });


    // Build the exports
    var jsSuffix = '\n';
    if (settings.javascript.namespace !== false) {
      jsSuffix += 'if (typeof window.' + settings.javascript.namespace + ' === "undefined") ' +
                  'window.' + settings.javascript.namespace + ' = {};\n\n';

      var re = /var\s+(.+)\s+\=\s+\(\s*function\s*\(\s*\$\s*\)\s\{/g
      var found;
      while (found = re.exec(src)) {
        if (found[1])
          jsSuffix += 'window.' + settings.javascript.namespace + '.' + found[1] + ' = ' + found[1] + ';\n';
      }
    }

    src = 'if (Meteor.isClient) {\n' + src + jsSuffix + '}';


    // Add the javascript (adding suffix code which contains the generated exports)
    settingsFile.addJavaScript({
      data: src,
      path: path.join('client', 'lib', 'bootstrap', 'bootstrap.generated.js')
    });
  }
  else {
    // Create the settings json file because it doesn't exist

    // Load in the template settings file
    var src = fs.readFileSync(path.join(defaultsPath, 'bootstrap-settings.default.json')).toString();


    // Get the default trailing whitespace
    var scssWhitespace = src.match(/\n(\s*)\/\*SCSS_MODULES\*\//)[1] || '';
    var jsWhitespace = src.match(/\n(\s*)\/\*JS_MODULES\*\//)[1] || '';


    // Get all scss modules specified in default bootstrap.scss
    var bootstrapDefaultScss = fs.readFileSync(path.join(scssPath, 'bootstrap.scss'));
    var scssModules = [];
    var re = /\@import\s+\"(.+)\"\;?/g;
    var found;
    while (found = re.exec(bootstrapDefaultScss)) {
      if (found[1]) scssModules.push(found[1]);
    }


    // Remove default variables module and mixins module
    scssModules.splice(scssModules.indexOf('variables'), 1);
    scssModules.splice(scssModules.indexOf('mixins'), 1);


    // Sort them alphabetically
    scssModules.sort();


    // Create scss modules json
    var scssJson = _.map(scssModules, function (name) {
      return scssWhitespace + '"' + name + '": true';
    }).join(',\n');


    // Get all js modules
    var jsModules = fs.readdirSync(jsPath);


    // Create js modules json
    var jsJson = _.map(jsModules, function (name) {
      return jsWhitespace + '"' + name.match(/(.*)\.js/i)[1] + '": true';
    }).join(',\n');


    // Replace the json in
    src = src.replace(/\n\s*\/\*SCSS_MODULES\*\//, '\n' + scssJson);
    src = src.replace(/\n\s*\/\*JS_MODULES\*\//, '\n' + jsJson);

    fs.writeFileSync(path.join('.', bootstrapSettings), src);
  }

  console.log('\n');
};
