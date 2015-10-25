// npm
const fs =      Plugin.fs;
const path =    Plugin.path;
const less =    Npm.require('less');
const Future =  Npm.require('fibers/future');


// Paths and filenames
const assetsPath =        path.join('assets');
const defaultsPath =      path.join(assetsPath, 'defaults');
const lessPath =          path.join(assetsPath, 'bootstrap', 'less');
const jsPath =            path.join(assetsPath, 'bootstrap', 'js');
const fontsUrl =          'packages/huttonr_bootstrap3-assets/assets/bootstrap/fonts/';

const jsLoadFirst = [ // Specifies which js modules should be loaded first due to other js modules depending on them
  'tooltip.js'
];

const bootstrapSettings =   'bootstrap-settings.json';
const bootstrapVariables =  'bootstrap-variables.less';
const bootstrapMixins =     'bootstrap-mixins.less';

const variablesFilesInstruction =
`// These are custom bootstrap variables for you to edit.
// These simply override any default bootstrap variables.
// This means that you may delete anything in this file
// and the default bootstrap values will be used instead.
`;

const mixinFilesInstruction =
`// Editing these mixins will not edit the mixins used by the core bootstrap modules.
// They are exposed here for your use and convenience.
// They can be imported using @import "path/to/${ bootstrapMixins }"
`;




const getAsset = _bootstrapGetAsset;
const getJsFilenames = _bootstrapGetJsList;



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
    _.each(filesFound, file => {
      let fn = path.basename(file.getDisplayPath());
      if (fn === bootstrapSettings) {
        if (settingsFile)
          throw new Error('You cannot have more than one ' + bootstrapSettings + ' in your Meteor project.');

        settingsFile = file;
      }
    });

    if (settingsFile) {
      // (1) Get the bootstrap-settings json

      // Flag the settings file as being present so a warning isn't displayed later
      settingsFile.addJavaScript({
        data: 'this._bootstrapSettingsFileLoaded = true;\n',
        path: path.join('client', 'lib', 'settings-file-checked.generated.js')
      });


      // Get the settings file dir
      let settingsPathDir = path.dirname(path.join('.', settingsFile.getDisplayPath()));


      // Get the settings data
      let settingsContents = settingsFile.getContentsAsString();
      let settings;
      if (settingsContents.trim()) {
        settings = JSON.parse(settingsContents);
      }
      else {
        // Populate the settings json file because it empty

        // Load in the template settings file
        let src = getAsset(path.join(defaultsPath, 'bootstrap-settings.default.json'));


        // Get the default trailing whitespace
        let lessWhitespace = src.match(/\n(\s*)\/\*LESS_MODULES\*\//)[1] || '';
        let jsWhitespace = src.match(/\n(\s*)\/\*JS_MODULES\*\//)[1] || '';


        // Get all less modules specified in default bootstrap.less
        let bootstrapDefaultLess = getAsset(path.join(lessPath, 'bootstrap.less'));
        let lessModules = [];
        let re = /\@import\s+[\"\'](.+)\.less[\"\']\;?/g;
        let found;
        while (found = re.exec(bootstrapDefaultLess)) {
          if (found[1]) lessModules.push(found[1]);
        }


        // Remove default variables module and mixins module
        lessModules.splice(lessModules.indexOf('variables'), 1);
        lessModules.splice(lessModules.indexOf('mixins'), 1);


        // Sort them alphabetically
        lessModules.sort();


        // Create less modules json
        let lessJson = _.map(lessModules, function (name) {
          return lessWhitespace + '"' + name + '": true';
        }).join(',\n');


        // Get all js modules
        let jsModules = _.clone(getJsFilenames());


        // Create js modules json
        let jsJson = _.map(jsModules, name => `${ jsWhitespace }"${ name.match(/(.*)\.js/i)[1] }": true`)
                      .join(',\n');


        // Insert the json modules into the template settings file
        src = src.replace(/\n\s*\/\*LESS_MODULES\*\//, '\n' + lessJson);
        src = src.replace(/\n\s*\/\*JS_MODULES\*\//, '\n' + jsJson);

        fs.writeFileSync(path.join('.', settingsFile.getDisplayPath()), src);

        settings = JSON.parse(src);
      }

      _.defaults(settings, {
        less: {},
        javascript: {}
      });
      _.defaults(settings.less, {
        customVariables: false,
        exposeMixins: false,
        modules: {}
      });
      _.defaults(settings.javascript, {
        modules: {}
      });




      // (2) Handle the less

      // Get all less modules specified in default bootstrap.less
      // This will give a nicely ordered list of all bootstrap modules
      let bootstrapDefaultLess = getAsset(path.join(lessPath, 'bootstrap.less'));
      let lessModules = [];
      let re = /\@import\s+[\"\'](.+)\.less[\"\']/g;
      let found;
      while (found = re.exec(bootstrapDefaultLess)) {
        if (found[1]) lessModules.push(found[1]);
      }


      // Remove default variables module and mixins module
      lessModules.splice(lessModules.indexOf('variables'), 1);
      lessModules.splice(lessModules.indexOf('mixins'), 1);


      // Filter the modules to include only those enabled in the bootstrap-settings json
      lessModules = _.filter(lessModules, moduleName => settings.less.modules[moduleName]);


      // Reinsert default variables and mixins modules
      lessModules.splice(0, 0, 'variables', 'mixins');


      // Insert custom variables module (after default variables module)
      if (settings.less.customVariables) {
        if (!fs.existsSync(path.join(settingsPathDir, bootstrapVariables))) {
          // Generate the custom variables file because it doesn't exist
          let src = getAsset(path.join(lessPath, 'variables.less'));
          src = src.substr(Math.max(src.indexOf('\n\n'), 0));
          src = src.replace(/(?:\n|^|\*\/|\;)\s*\@icon\-font\-.*/g, '// $1'); // Comment out the glyphicon settings
          src = variablesFilesInstruction + src;

          fs.writeFileSync(path.join(settingsPathDir, bootstrapVariables), src);
        }

        lessModules.splice(lessModules.indexOf('variables') + 1, 0, bootstrapVariables.replace(/(.+)\.less/, '$1'));
      }


      // Expose mixins if specified
      if (settings.less.exposeMixins && !fs.exists(path.join(settingsPathDir, bootstrapMixins))) {
        // Generate the mixins file because it doesn't exist
        let src = getAsset(path.join(lessPath, 'mixins.less'));
        src = src.substr(Math.max(src.indexOf('\n\n'), 0));
        src = src.replace(/\@import\s+\"(.+)\"\;?/g, (match, mixin) => getAsset(path.join(lessPath, mixin)));
        src = mixinFilesInstruction + src;

        fs.writeFileSync(path.join(settingsPathDir, bootstrapMixins), src);
      }


      // Build src starting with a bunch of imports
      let lessSrc = _.map(lessModules, module => `@import "${ module }.less";`).join('\n');


      // Cute little recursive function to explode all of the less imports
      function resolveLessImports(src, currentPath = '.') {
        // Find all of the imports
        return src.replace(/(?:\n|^|\*\/|\;)\s*\@import\s+[\"\'](.+)[\"\']\s*\;\s*?/g, (match, fn) => {
          let res;
          try {
            // First try to get it from the assets
            res = getAsset(path.join(lessPath, currentPath, fn));
          }
          catch (err) {
            // Getting from the assets failed so it should just be the custom variables file in the settings json dir
            res = fs.readFileSync(path.join(settingsPathDir, fn)).toString();
          }

          // Recursively explode the imports in the imported file keeping the path in mind (just in case)
          return resolveLessImports(res, path.join(currentPath, path.dirname(fn)));
        });
      }


      // Actually resolve (explode) the imports now
      lessSrc = resolveLessImports(lessSrc);


      // Fix the glyphicon variables
      lessSrc = lessSrc.replace(/((?:\n|^|\*\/|\;)\s*\@icon\-font\-path\s*\:\s*)(?:.+)/g,
                                `$1"${ fontsUrl }";`)
                       .replace(/((?:\n|^|\*\/|\;)\s*\@icon\-font\-name\s*\:\s*)(?:.+)/g,
                                '$1"glyphicons-halflings-regular";')
                       .replace(/((?:\n|^|\*\/|\;)\s*\@icon\-font\-svg\-id\s*\:\s*)(?:.+)/g,
                                '$1"glyphicons_halflingsregular";');


      // Render the less
      const f = new Future();
      less.render(lessSrc, f.resolver());
      let rendered = f.wait();


      // Add the newly generated css as a stylesheet
      settingsFile.addStylesheet({
        data: rendered.css.toString(),
        path: path.join('client', 'stylesheets', 'bootstrap', 'bootstrap.generated.css')
      });




      // (3) Handle the js

      // Get all js modules
      let jsModules = _.clone(getJsFilenames());


      // Filter the modules to include only those enabled in the bootstrap-settings json
      jsModules = _.filter(jsModules, moduleName => settings.javascript.modules[moduleName.match(/(.*)\.js/i)[1]]);


      // Push 'load first' modules to top of list
      let jsReversedLoadFirst = _.clone(jsLoadFirst).reverse();
      _.each(jsReversedLoadFirst, fn => {
        let index = jsModules.indexOf(fn);

        if (index > -1)
          jsModules.unshift(jsModules.splice(index, 1)[0]);
      });


      // Get source from each bootstrap js file and compile it into one file
      let src = '';
      _.each(jsModules, moduleFn => {
        src += getAsset(path.join(jsPath, moduleFn)) + '\n';
      });


      // Add the javascript
      settingsFile.addJavaScript({
        data: src,
        path: path.join('client', 'lib', 'bootstrap', 'bootstrap.generated.js')
      });
    }
  }
};
