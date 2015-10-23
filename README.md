##Bootstrap 4 (Alpha) for Meteor
Modular, configurable, customizable.

##How to use
In your Meteor project, create a file named `bootstrap-settings.json` and place it in any client folder.

The package will automatically populate the file if it is empty.


###bootstrap-settings.json
####`scss`
`enableFlex` **Boolean** (default: *true*)  This turns on opt-in flexbox support.  
`customVariables` **Boolean** (default: *false*)  Enable this to expose a custom bootstrap variables file you can edit.  
`exposeMixins` **Boolean** (default: *false*)  Enable this to expose an importable scss file with the bootstrap mixins for your use.  
`modules` **Object**  Enable or disable specific bootstrap scss modules. *(The listed order of these are unimportant)*

####`javascript`
`namespace` **String** (default: 'Bootstrap')  The namespace to include the Bootstrap js classes in (you can use 'global').  
`modules` **Object**  Enable or disable specific bootstrap js modules. *(The listed order of these are unimportant)*
