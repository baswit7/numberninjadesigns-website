(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-design-card]"));
  var filter = document.querySelector("[data-gallery-filter]");
  var sort = document.querySelector("[data-gallery-sort]");
  var count = document.querySelector("[data-gallery-count]");
  var empty = document.querySelector("[data-gallery-empty]");
  var modal = document.querySelector("[data-preview-modal]");
  var modalImg = document.querySelector("[data-preview-image]");
  var modalMockup = document.querySelector("[data-preview-mockup]");
  var modalTitle = document.querySelector("[data-preview-title]");
  var modalMeta = document.querySelector("[data-preview-meta]");
  var close = document.querySelector("[data-preview-close]");

  function normalize(value) {
    return (value || "").toLowerCase();
  }

  function applyGalleryState() {
    var selected = filter ? filter.value : "all";
    var visible = cards.filter(function (card) {
      var show = selected === "all" || card.dataset.category === selected;
      card.hidden = !show;
      return show;
    });

    if (sort && sort.value === "title") {
      visible.sort(function (a, b) {
        return normalize(a.dataset.title).localeCompare(normalize(b.dataset.title));
      });
    } else {
      visible.sort(function (a, b) {
        return Number(a.dataset.index) - Number(b.dataset.index);
      });
    }

    visible.forEach(function (card) {
      card.parentNode.appendChild(card);
    });

    if (count) {
      count.textContent = visible.length + " designs visible";
    }
    if (empty) {
      empty.hidden = visible.length !== 0;
    }
  }

  function openPreview(card) {
    if (!modal || !modalImg || !modalMockup || !modalTitle || !modalMeta) return;
    modalMockup.src = card.dataset.mockupImage || card.querySelector("img").src;
    modalMockup.alt = card.dataset.title + " product mockup";
    modalImg.src = card.dataset.fullImage || card.querySelector("img").src;
    modalImg.alt = card.dataset.title + " original PNG artwork";
    modalTitle.textContent = card.dataset.title;
    modalMeta.textContent = card.dataset.categoryLabel;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    if (close) close.focus();
  }

  function closePreview() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  cards.forEach(function (card) {
    var img = card.querySelector("img");
    var links = card.querySelector(".buy-links");
    var channels = [
      ["Etsy", card.dataset.etsyUrl],
      ["Redbubble", card.dataset.redbubbleUrl],
      ["TeePublic", card.dataset.teepublicUrl],
      ["Spreadshirt", card.dataset.spreadshirtUrl],
      ["Printify", card.dataset.printifyUrl]
    ];
    if (links && !links.children.length) {
      channels.forEach(function (channel) {
        if (!channel[1]) return;
        var anchor = document.createElement("a");
        anchor.href = channel[1];
        anchor.rel = "noopener";
        anchor.textContent = channel[0];
        links.appendChild(anchor);
      });
    }
    if (img) {
      if (img.complete) img.classList.add("is-loaded");
      img.addEventListener("load", function () {
        img.classList.add("is-loaded");
      });
    }
    var button = card.querySelector("[data-preview-trigger]");
    if (button) {
      button.addEventListener("click", function () {
        openPreview(card);
      });
    }
  });

  if (filter) filter.addEventListener("change", applyGalleryState);
  if (sort) sort.addEventListener("change", applyGalleryState);
  if (close) close.addEventListener("click", closePreview);
  if (modal) {
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closePreview();
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closePreview();
  });

  applyGalleryState();
})();
