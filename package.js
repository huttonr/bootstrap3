
Package.describe({
  name: 'huttonr:bootstrap4',
  summary: 'Modular, customizable Bootstrap 4.',
  version: '4.0.0_2',
  git: 'https://github.com/huttonr/bootstrap4',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.0.2');
  api.use('isobuild:compiler-plugin@1.0.0');

  api.addFiles('check-settings.js', 'client');
});

Package.registerBuildPlugin({
  name: 'build-bootstrap4',
  use: [
    'underscore',
    'ecmascript',
    'babel-compiler',
    'huttonr:bootstrap4-assets'
  ],
  sources: [
    'plugin/bootstrap4.js'
  ],
  npmDependencies: {
    'node-sass': '3.3.3'
  }
});
