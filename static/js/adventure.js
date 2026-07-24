/* The gray dot, done properly. Robinett, 1979.
   The dot sleeps in the catacombs (404). Carry it home. The east wall below
   the castle is thin. */
(function () {
  var KEY = "oh-adventure";
  var state = localStorage.getItem(KEY);
  var carried = state === "carried" || state === "found";

  var art = [
    "   ___   __ _(_)",
    "  / _ \\ / _` | |",
    " | (_) | (_| | |",
    "  \\___(_)__,_|_|",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  ].join("\n");
  console.log("%c" + art, "color:#7dcfff;font-family:monospace;line-height:1.2");
  console.log(
    "%cagent or human, the map is at /llms.txt · the person is kai@oceanheart.ai",
    "color:#9aa5ce;font-family:monospace"
  );
  if (!carried) {
    console.log(
      "%csomewhere in the catacombs, where lost paths end, a gray dot. Robinett would understand.",
      "color:#7a84ad;font-family:monospace;font-style:italic"
    );
  } else {
    console.log(
      "%cyou are carrying the dot. home, below the castle, the east wall is thin.",
      "color:#7a84ad;font-family:monospace;font-style:italic"
    );
  }

  /* 1. The catacombs. The dot only exists on the 404 page. */
  var dot = document.getElementById("catacomb-dot");
  if (dot) {
    if (carried) {
      dot.remove();
    } else {
      dot.addEventListener("click", function () {
        localStorage.setItem(KEY, "carried");
        carried = true;
        dot.remove();
        attachCarriedDot();
        console.log(
          "%cyou feel heavier. home, below the castle, the east wall is thin.",
          "color:#7a84ad;font-family:monospace;font-style:italic"
        );
      });
    }
  }

  /* 2. Carrying. In Adventure, objects travel beside your square. Here the
     square is your pointer. */
  var carryEl = null;
  function attachCarriedDot() {
    if (!carried || carryEl) return;
    carryEl = document.createElement("div");
    carryEl.className = "carried-dot";
    carryEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(carryEl);
    var pointerSeen = false;
    document.addEventListener("pointermove", function (e) {
      pointerSeen = true;
      carryEl.classList.remove("carried-dot-corner");
      carryEl.style.transform =
        "translate(" + (e.clientX + 16) + "px," + (e.clientY + 16) + "px)";
    });
    /* No pointer (touch device): the dot waits in the corner instead. */
    setTimeout(function () {
      if (!pointerSeen) carryEl.classList.add("carried-dot-corner");
    }, 1200);
  }
  if (carried) attachCarriedDot();

  /* 3. The thin east wall, only at home, only while carrying. */
  var isHome = location.pathname === "/" || location.pathname === "/index.html";
  if (carried && isHome) {
    var wall = document.createElement("button");
    wall.type = "button";
    wall.className = "east-wall";
    wall.setAttribute("aria-label", "a thin section of the east wall");
    document.body.appendChild(wall);
    wall.addEventListener("click", openRoom);
  }

  /* 4. The room. */
  var room = null;
  function openRoom() {
    if (room) return;
    localStorage.setItem(KEY, "found");
    if (!document.getElementById("atari-font")) {
      var link = document.createElement("link");
      link.id = "atari-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
      document.head.appendChild(link);
    }

    room = document.createElement("div");
    room.className = "atari-room";
    room.setAttribute("role", "dialog");
    room.setAttribute("aria-modal", "true");
    room.setAttribute("aria-label", "Secret room");
    room.innerHTML =
      '<div class="atari-wall atari-wall-top"><span></span><span></span></div>' +
      '<p class="atari-text" id="atari-text">Created by Rick Hallett</p>' +
      '<div class="atari-player" id="atari-player"></div>' +
      '<p class="atari-contact" id="atari-contact" hidden>' +
      '<a href="mailto:kai@oceanheart.ai?subject=I%20carried%20the%20dot">kai@oceanheart.ai</a>' +
      " · you carried the dot all the way · write to the maker</p>" +
      '<div class="atari-wall atari-wall-bottom"><span></span><span></span></div>';
    document.body.appendChild(room);
    document.body.style.overflow = "hidden";

    var player = document.getElementById("atari-player");
    var text = document.getElementById("atari-text");
    var contact = document.getElementById("atari-contact");
    var px = Math.round(window.innerWidth * 0.22);
    var py = Math.round(window.innerHeight * 0.6);
    place();

    function place() {
      var size = 26;
      var minY = 56;
      var maxY = window.innerHeight - 56 - size;
      var maxX = window.innerWidth - size;
      px = Math.max(0, Math.min(px, maxX));
      py = Math.max(minY, Math.min(py, maxY));
      player.style.transform = "translate(" + px + "px," + py + "px)";
      if (overlapsText()) reveal();
    }

    function overlapsText() {
      var a = player.getBoundingClientRect();
      var b = text.getBoundingClientRect();
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    function reveal() {
      contact.hidden = false;
    }
    text.addEventListener("click", reveal);

    function onKey(e) {
      if (e.key === "Escape") {
        closeRoom();
        return;
      }
      var step = 14;
      if (e.key === "ArrowUp") py -= step;
      else if (e.key === "ArrowDown") py += step;
      else if (e.key === "ArrowLeft") px -= step;
      else if (e.key === "ArrowRight") px += step;
      else return;
      e.preventDefault();
      place();
    }
    document.addEventListener("keydown", onKey);

    function closeRoom() {
      document.removeEventListener("keydown", onKey);
      room.remove();
      room = null;
      document.body.style.overflow = "";
    }
  }
})();
