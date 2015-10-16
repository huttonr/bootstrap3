echo "Initializing bootstrap submodule..."
git submodule update --init

submodulepath=.git/modules/$(grep -oP "path\s*\=\s*\K(.+)" .gitmodules)

$(cd $submodulepath && git config core.sparsecheckout true)

echo '' > $submodulepath/info/sparse-checkout
echo 'js/dist/*.js' >> $submodulepath/info/sparse-checkout
echo 'scss/*.scss' >> $submodulepath/info/sparse-checkout
echo 'scss/mixins/*.scss' >> $submodulepath/info/sparse-checkout

cd $submodulepath
git reset --hard
