// Active link on scroll — tutorial.html
(function () {
  var sections = document.querySelectorAll('.doc-section[id]');
  var navLinks  = document.querySelectorAll('.doc-sidebar-nav a');

  function updateActiveNav() {
    var scrollY = window.scrollY + 120;
    sections.forEach(function (section) {
      var id = section.getAttribute('id');
      if (scrollY >= section.offsetTop && scrollY < section.offsetTop + section.offsetHeight) {
        navLinks.forEach(function (link) {
          link.classList.remove('active');
          if (link.getAttribute('href') === '#' + id) link.classList.add('active');
        });
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav);
  updateActiveNav();
})();
