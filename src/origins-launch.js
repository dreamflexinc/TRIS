(function () {
  'use strict';
  window.TRIScoreOriginsRelease = Object.freeze({ version: '4.3.3', parent: '4.3.1' });
  // Desktop opens Origins itself. The browser home page keeps all prior links.
  if (location.hash === '#origins' && window.TRIScoreOrigins) window.TRIScoreOrigins.open();
})();
