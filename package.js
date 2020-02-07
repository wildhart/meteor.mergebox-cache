Package.describe({
  name: 'wildhart:mergebox-cache',
  version: '0.0.2',
  summary: 'https://github.com/wildhart/meteor.mergebox-cache',
  git: 'https://github.com/wildhart/meteor.mergebox-cache',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.8.1');
  api.use('ecmascript');
  api.use('mongo');
  api.use('wildhart:env-var-set@0.0.1');
  api.mainModule('mergebox-cache.js', 'server');
});
