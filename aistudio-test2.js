(function() {
  var turns = document.querySelectorAll("[data-turn-role='User']");
  console.log("User turns: " + turns.length);
  turns.forEach(function(turn, i) {
    console.log("--- User turn " + i + " ---");
    console.log("HTML preview: " + turn.innerHTML.slice(0, 300));
    console.log("Direct text: " + turn.textContent.trim().slice(0, 100));
    var textarea = turn.querySelector("textarea");
    var input = turn.querySelector("input");
    var contentEditable = turn.querySelector("[contenteditable]");
    var msPrompt = turn.querySelector("ms-prompt-renderer, ms-chunk-editor");
    console.log("textarea: " + (textarea ? textarea.value.slice(0,50) : "none"));
    console.log("input: " + (input ? input.value.slice(0,50) : "none"));
    console.log("contentEditable: " + (contentEditable ? contentEditable.textContent.slice(0,50) : "none"));
    console.log("ms-prompt: " + (msPrompt ? msPrompt.textContent.slice(0,50) : "none"));
  });
})();
