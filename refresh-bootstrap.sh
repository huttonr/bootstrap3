echo "Initializing bootstrap submodule..."
git submodule update --init

submodulepath=.git/modules/$(grep -oP "path\s*\=\s*\K(.+)" .gitmodules)

$(cd $submodulepath; git config core.sparsecheckout true)

echo '' > $submodulepath/info/sparse-checkout
echo 'js/dist/*.js' >> $submodulepath/info/sparse-checkout
echo 'scss/*.scss' >> $submodulepath/info/sparse-checkout
echo 'scss/mixins/*.scss' >> $submodulepath/info/sparse-checkout

$(cd $submodulepath; git checkout)

echo "Generating asset list for package.js..."

bootstrapFiles="$(find assets/bootstrap -not -path '*/\.*' -type f -exec echo '"{}"' \; | grep -v '^$' | paste -s -d ",")"
sed '/assetsList.*=.*/d' -i package.js
echo "assetsList = [$bootstrapFiles];" >> package.js

echo "DONE"
