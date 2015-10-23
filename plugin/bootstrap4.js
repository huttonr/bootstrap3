// npm
const fs =    Plugin.fs;
const path =  Plugin.path;
const Sass =  Npm.require('node-sass');


// Paths and filenames
const assetsPath =        path.join('assets');
const defaultsPath =      path.join(assetsPath, 'defaults');
const scssPath =          path.join(assetsPath, 'bootstrap', 'scss');
const jsPath =            path.join(assetsPath, 'bootstrap', 'js', 'src');

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

      if (settingsContents.trim()) {
        settings = JSON.parse(settingsContents);
      }
      else {
        // Populate the settings json file because it empty

        // Load in the template settings file
        let src = getAsset(path.join(defaultsPath, 'bootstrap-settings.default.json'));


        // Get the default trailing whitespace
        let scssWhitespace = src.match(/\n(\s*)\/\*SCSS_MODULES\*\//)[1] || '';
        let jsWhitespace = src.match(/\n(\s*)\/\*JS_MODULES\*\//)[1] || '';


        // Get all scss modules specified in default bootstrap.scss
        let bootstrapDefaultScss = getAsset(path.join(scssPath, 'bootstrap.scss'));
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
        let jsModules = _.clone(getJsFilenames());


        // Create js modules json
        let jsJson = _.map(jsModules, name => `${ jsWhitespace }"${ name.match(/(.*)\.js/i)[1] }": true`)
                      .join(',\n');


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
      let bootstrapDefaultScss = getAsset(path.join(scssPath, 'bootstrap.scss'));
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
      scssModules = _.filter(scssModules, moduleName => settings.scss.modules[moduleName]);


      // Reinsert default variables and mixins modules
      scssModules.splice(0, 0, 'variables', 'mixins');


      // Insert custom variables module (after default variables module)
      if (settings.scss.customVariables) {
        if (!fs.existsSync(path.join(settingsPathDir, bootstrapVariables))) {
          // Generate the custom variables file because it doesn't exist
          let src = getAsset(path.join(scssPath, '_variables.scss'));
          src = src.substr(Math.max(src.indexOf('\n\n'), 0));
          src = src.replace(/\s*\!default/g, '');
          src = variablesFilesInstruction + src;

          fs.writeFileSync(path.join(settingsPathDir, bootstrapVariables), src);
        }

        scssModules.splice(scssModules.indexOf('variables') + 1, 0, bootstrapVariables.replace(/_(.+)\.scss/, '$1'));
      }


      // Expose mixins if specified
      if (settings.scss.exposeMixins && !fs.exists(path.join(settingsPathDir, bootstrapMixins))) {
        // Generate the mixins file because it doesn't exist
        let src = getAsset(path.join(scssPath, '_mixins.scss'));
        src = src.substr(Math.max(src.indexOf('\n\n'), 0));
        src = src.replace(/\@import\s+\"mixins\/(.+)\"\;?/g, (match, mixin) => {
          let fullPath = path.join(scssPath, 'mixins', '_' + mixin + '.scss');

          return getAsset(fullPath);
        });
        src = mixinFilesInstruction + src;

        fs.writeFileSync(path.join(settingsPathDir, bootstrapMixins), src);
      }


      // Enable flex if specified
      let scssPrefix = '';
      if (settings.scss.enableFlex) scssPrefix += '$enable-flex: true;\n';


      // Render the scss into css using a custom importer
      let rendered = Sass.renderSync({
        data: scssPrefix + _.map(scssModules, fn => { return '@import "' + fn + '";'; }).join('\n'),
        importer: (url, prev, done) => {
          // I will admit that this regexp could have more possible cases, but this works for the current bootstrap
          url = url.replace(/(.*)(?:\/|^)(?!.+\/)(.+)/, (match, dir, fn) => path.join(dir, '_' + fn + '.scss'));

          // XXX There is a pitfall here which is that a mixin could possibly import something in the future,
          //     in which case it would not know to look in the mixin folder, but would look in the scss folder
          //     however this is not currently the case so we're not going to worry about it yet.

          // So let's try two potential locations
          try {
            // First the bootstrap scss location (asset)
            return { contents: getAsset(path.join(scssPath, url)) };
          }
          catch (err) {
            // Second the directory the bootstrap settings file is in (in the actual meteor project)
            return { file: path.join(settingsPathDir, url) };
          }
        }
      });


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


      // Kill the imports
      src = src.replace(/import\s+(?:\S+)\s+from\s+\'.+\'/g, '');


      // Build the exports
      if (settings.javascript.namespace !== false) {
        src = `if (typeof window. ${ settings.javascript.namespace } === "undefined")
                window. ${ settings.javascript.namespace } = {};
                ${ src }`;

        src = src.replace(
          /export\s+default\s+(\S+)/g,
          `window.${ settings.javascript.namespace }.$1 = $1`
        );
      }

      src = `if (Meteor.isClient) {
              ${ src }
            }`;


      // Compile the ES6
      let babelOptions = Babel.getDefaultOptions();
      let filename = path.join('client', 'lib', 'bootstrap', 'bootstrap.generated.js');
      babelOptions.sourceMap = true;
      babelOptions.filename = filename;
      babelOptions.sourceFileName = path.join('/', filename);
      babelOptions.sourceMapName = path.join('/', filename + '.map');
      let compiled = Babel.compile(src, babelOptions);


      // Add the javascript
      settingsFile.addJavaScript({
        data: compiled.code,
        map: compiled.map,
        path: filename
      });
    }
  }
};
