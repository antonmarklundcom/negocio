/* =============================================================
   preview.js — PREVIEW CHROME ONLY. Do NOT port to JetEngine.

   Flips body[data-state] between "free" and "premium" so you can
   eyeball both states of the one template. In WordPress there is
   no toggle: JetEngine Dynamic Visibility shows each .is-free /
   .is-premium block based on the `negocio_premium` boolean.
   Delete this file (and the .preview-toggle markup) on port.
   ============================================================= */
(function () {
  var body = document.body;
  var buttons = document.querySelectorAll('.preview-toggle [data-set-state]');

  function setState(state) {
    body.setAttribute('data-state', state);
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.setState === state));
    });
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () { setState(b.dataset.setState); });
  });

  // honour ?state=free|premium for quick sharing of a specific view
  var q = new URLSearchParams(location.search).get('state');
  if (q === 'free' || q === 'premium') setState(q);
})();
