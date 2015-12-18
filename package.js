
Package.describe({
  name: 'huttonr:bootstrap3',
  summary: 'Modular, customizable Bootstrap 3.',
  version: '3.3.5_10',
  git: 'https://github.com/huttonr/bootstrap3',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.0.2');
  api.use('isobuild:compiler-plugin@1.0.0');
  api.use('jquery');
  api.use('huttonr:bootstrap3-assets@3.3.5_6');
  api.use('less');

  api.addFiles('check-settings.js', 'client');
});

Package.registerBuildPlugin({
  name: 'build-bootstrap3',
  use: [
    'ecmascript@0.1.6',
    'huttonr:bootstrap3-assets@3.3.5_6'
  ],
  sources: [
    'plugin/bootstrap3.js'
  ],
  npmDependencies: {
    'less': '2.5.3'
  }
});
