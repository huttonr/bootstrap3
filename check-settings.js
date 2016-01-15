// Displays warning if no bootstrap settings json file is present
if (Meteor.isClient) {
  Meteor.startup(function () {
    if (typeof _bootstrapSettingsFileLoaded === 'undefined' || !_bootstrapSettingsFileLoaded) {
      console.warn("Bootstrap disabled. Create a file named 'bootstrap-settings.json' to enable.");
    } else {
      try {
        _bootstrapSettingsFileLoaded = undefined;
        delete _bootstrapSettingsFileLoaded;
      } catch (e) {}
    }
  });
}
