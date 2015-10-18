// Displays warning if no bootstrap settings json file is present
Meteor.startup(() => {
  if (typeof _bootstrapSettingsFileLoaded === 'undefined' || !_bootstrapSettingsFileLoaded)
    console.warn("Bootstrap disabled. Create a file named 'bootstrap-settings.json' to enable.");
  else
    delete _bootstrapSettingsFileLoaded;
});
