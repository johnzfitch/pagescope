(function() {
  console.log("=== AI STUDIO ELEMENTS ===");

  var msElements = document.querySelectorAll("[class*=ms-], ms-chat-turn, ms-text-chunk, ms-chunk-editor, ms-prompt-renderer, ms-cmark-node");
  console.log("Found " + msElements.length + " ms elements");

  var byTag = {};
  msElements.forEach(function(el) {
    var tag = el.tagName.toLowerCase();
    if (!byTag[tag]) byTag[tag] = [];
    byTag[tag].push({
      role: el.getAttribute("data-turn-role"),
      text: (el.textContent || "").trim().slice(0, 60),
      classes: el.className
    });
  });

  console.log("Elements by tag:");
  for (var tag in byTag) {
    var items = byTag[tag];
    console.log("  <" + tag + "> (" + items.length + "):");
    items.slice(0, 3).forEach(function(item, i) {
      console.log("    " + i + ": role=" + item.role + " text=" + item.text);
    });
    if (items.length > 3) console.log("    ... and " + (items.length - 3) + " more");
  }

  var turns = document.querySelectorAll("[data-turn-role]");
  console.log("=== TURNS BY ROLE (" + turns.length + ") ===");
  turns.forEach(function(t, i) {
    console.log(i + ": [" + t.getAttribute("data-turn-role") + "] <" + t.tagName.toLowerCase() + "> " + (t.textContent || "").trim().slice(0,50));
  });

  return { tags: Object.keys(byTag), turnCount: turns.length };
})();
