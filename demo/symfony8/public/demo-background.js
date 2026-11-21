// Demo only: loads the icon selector fragment on click and injects it; the bundle's MutationObserver initialises the widget.
(function () {
  var btn = document.getElementById('demo-background-load-btn');
  var container = document.getElementById('demo-background-container');
  if (!btn || !container) return;
  btn.addEventListener('click', function () {
    btn.disabled = true;
    btn.textContent = btn.dataset.labelLoading;
    fetch(btn.dataset.fragmentUrl)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        container.innerHTML = html;
        btn.disabled = false;
        btn.textContent = btn.dataset.labelAgain;
      })
      .catch(function () {
        container.replaceChildren();
        var p = document.createElement('p');
        p.className = 'nowo-ui-flash nowo-ui-flash--error';
        p.setAttribute('role', 'alert');
        p.textContent = btn.dataset.labelError;
        container.appendChild(p);
        btn.disabled = false;
        btn.textContent = btn.dataset.labelLoad;
      });
  });
})();
