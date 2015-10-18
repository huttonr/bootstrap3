// npm
const fs =    Plugin.fs;
const path =  Plugin.path;
const Sass =  Npm.require('node-sass');


// Paths and filenames
const pluginName =    'huttonr:bootstrap4';  // It's dumb that this has to be hardcoded, but it's better than a hacky solution
const basePath =      path.join('packages', 'bootstrap4');
const assetsPath =    path.join('.meteor', 'local', 'build', 'programs', 'server', 'assets', 'packages', pluginName.replace(':', '_'));
const defaultsPath =  path.join(assetsPath, 'assets', 'defaults');
const scssPath =      path.join(assetsPath, 'assets', 'bootstrap', 'scss');
const jsPath =        path.join(assetsPath, 'assets', 'bootstrap', 'js', 'dist');

const jsLoadFirst = [ // Specifies which js modules should be loaded first due to other js modules depending on them
  'util.js',
  'tooltip.js'
];

const bootstrapSettings =   'bootstrap-settings.json';
const bootstrapVariables =  '_bootstrap-variables.scss';
const bootstrapMixins =     '_bootstrap-mixins.scss';

const variablesFilesInstruction =
`// These are custom bootstrap variables for you to edit.
// These simply override any default bootstrap variables.
// This means that you may delete anything in this file
// and the default bootstrap values will be used instead.
`;

const mixinFilesInstruction =
`// Editing these mixins will not edit the mixins used by the core bootstrap modules.
// They are exposed here for your use and convenience.
// They can be imported using @import "path/to/${ bootstrapMixins.replace(/^\_(.+)\.scss*/, '$1') }'
`;





// Register the compiler for the bootstrap-settings json file
Plugin.registerCompiler({
  extensions: [],
  filenames: [bootstrapSettings, bootstrapVariables, bootstrapMixins]
}, () => new BootstrapCompiler());


// BootstrapCompiler class
class BootstrapCompiler {
  // Actual processing of file (bootstrap-settings json)
  processFilesForTarget(filesFound) {
    let settingsFile;

    // Loop through and find the settings file
    _.each(filesFound, function (file) {
      let fn = path.basename(file.getDisplayPath());
      if (fn === bootstrapSettings) {
        if (settingsFile)
          throw new Error('You cannot have more than one ' + bootstrapSettings + ' in your Meteor project.');

        settingsFile = file;
      }
    });

    if (settingsFile) {
      // (1) Get the bootstrap-settings json


      // Flag the settings file as having been found so a warning isn't displayed later
      //fs.writeFileSync(path.join(assetsPath, 'found-settings-file'), 'true');


      // Get the settings file dir
      let settingsPathDir = path.dirname(path.join('.', settingsFile.getDisplayPath()));

      // This will throw if settings file is blank/empty or invalid
      let settings;
      try {
        settings = JSON.parse(settingsFile.getContentsAsString());
      }
      catch (err) {
        // Create the settings json file because it doesn't exist

        // Load in the template settings file
        let src = fs.readFileSync(path.join(defaultsPath, 'bootstrap-settings.default.json')).toString();


        // Get the default trailing whitespace
        let scssWhitespace = src.match(/\n(\s*)\/\*SCSS_MODULES\*\//)[1] || '';
        let jsWhitespace = src.match(/\n(\s*)\/\*JS_MODULES\*\//)[1] || '';


        // Get all scss modules specified in default bootstrap.scss
        let bootstrapDefaultScss = fs.readFileSync(path.join(scssPath, 'bootstrap.scss'));
        let scssModules = [];
        let re = /\@import\s+\"(.+)\"\;?/g;
        let found;
        while (found = re.exec(bootstrapDefaultScss)) {
          if (found[1]) scssModules.push(found[1]);
        }


        // Remove default variables module and mixins module
        scssModules.splice(scssModules.indexOf('variables'), 1);
        scssModules.splice(scssModules.indexOf('mixins'), 1);


        // Sort them alphabetically
        scssModules.sort();


        // Create scss modules json
        let scssJson = _.map(scssModules, function (name) {
          return scssWhitespace + '"' + name + '": true';
        }).join(',\n');


        // Get all js modules
        let jsModules = fs.readdirSync(jsPath);


        // Create js modules json
        let jsJson = _.map(jsModules, function (name) {
          return jsWhitespace + '"' + name.match(/(.*)\.js/i)[1] + '": true';
        }).join(',\n');


        // Insert the json modules into the template settings file
        src = src.replace(/\n\s*\/\*SCSS_MODULES\*\//, '\n' + scssJson);
        src = src.replace(/\n\s*\/\*JS_MODULES\*\//, '\n' + jsJson);

        fs.writeFileSync(path.join('.', settingsFile.getDisplayPath()), src);

        settings = JSON.parse(src);
      }
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
      let bootstrapDefaultScss = fs.readFileSync(path.join(scssPath, 'bootstrap.scss'));
      let scssModules = [];
      let re = /\@import\s+\"(.+)\"/g;
      let found;
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
        if (!fs.existsSync(path.join(settingsPathDir, bootstrapVariables))) {
          // Generate the custom variables file because it doesn't exist
          let src = fs.readFileSync(path.join(scssPath, '_variables.scss')).toString();
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
        let src = fs.readFileSync(path.join(scssPath, '_mixins.scss')).toString();
        src = src.substr(Math.max(src.indexOf('\n\n'), 0));
        src = src.replace(/\@import\s+\"mixins\/(.+)\"\;?/g, function (match, mixin) {
          let fullPath = path.join(scssPath, 'mixins', '_' + mixin + '.scss');

          return fs.readFileSync(fullPath).toString();
        });
        src = mixinFilesInstruction + src;

        fs.writeFileSync(path.join(settingsPathDir, bootstrapMixins), src);
      }


      // Enable flex if specified
      let scssPrefix = '';
      if (settings.scss.enableFlex) scssPrefix += '$enable-flex: true;\n';


      // Render the scss into css
      let rendered = Sass.renderSync({
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
      let jsModules = fs.readdirSync(jsPath);


      // Filter the modules to include only those enabled in the bootstrap-settings json
      jsModules = _.filter(jsModules, function (moduleName) {
        return settings.javascript.modules[moduleName.match(/(.*)\.js/i)[1]];
      });


      // Push 'load first' modules to top of list
      let jsReversedLoadFirst = _.clone(jsLoadFirst).reverse();
      _.each(jsReversedLoadFirst, function (fn) {
        let index = jsModules.indexOf(fn);

        if (index > -1)
          jsModules.unshift(jsModules.splice(index, 1)[0]);
      });


      // Get source from each bootstrap js file and compile it into one file
      let src = '';
      _.each(jsModules, function (moduleFn) {
        src += fs.readFileSync(path.join(jsPath, moduleFn)).toString() + '\n';
      });


      // Build the exports
      let jsSuffix = '\n';
      if (settings.javascript.namespace !== false) {
        jsSuffix += 'if (typeof window.' + settings.javascript.namespace + ' === "undefined") ' +
                    'window.' + settings.javascript.namespace + ' = {};\n\n';

        let re = /let\s+(.+)\s+\=\s+\(\s*function\s*\(\s*\$\s*\)\s\{/g
        let found;
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
      console.warn('\n\nCreate a file named bootstrap-settings.json to enable Bootstrap.\n\n');
    }
  }
};
