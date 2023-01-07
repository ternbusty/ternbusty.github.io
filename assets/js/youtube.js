function isValidURL(url) {
  var parser = new URL(url);
  if (
    !parser.searchParams.has("playlist_id") ||
    !parser.searchParams.has("type")
  ) {
    return false;
  }
  let type = parser.searchParams.get("type");
  if (type !== "random" && type !== "reverse") {
    return false;
  }
  return true;
}

function displayInvalidMessage() {
  window.alert("Invalid query parameters. Please try again.");
  document.getElementById("youtube").style.display = "none";
  document.getElementById("how-to-use").style.display = "block";
}

function processURL() {
  let url = window.location.href;
  let splitted = url.split("?");
  if (url === splitted[0]) {
    // If no '?' in URL
    return;
  }
  if (!isValidURL(url)) {
    displayInvalidMessage();
    return;
  }
  document.getElementById("how-to-use").style.display = "none";
  document.getElementById("youtube").style.display = "block";
}

function redirect(type) {
  let playlist_id = document.getElementById("id_input").value;
  window.location.href = `https://ternbusty.github.io/youtube.html?type=${type}&playlist_id=${playlist_id}`;
  // window.location.href = `http://localhost:4000/youtube.html?type=${type}&playlist_id=${playlist_id}`;
}

processURL();
// Load YouTube API
let tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
let firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    height: "360",
    width: "640",
    events: {
      onReady: this.onPlayerReady,
      onStateChange: this.onPlayerStateChange,
    },
  });
  document.player = player;
  player.yts = new YouTubeShuffler();
}

function onPlayerReady(event) {
  document.not_found_cnt = 0;
  let id = setInterval(() => {
    if (document.id_arr && document.id_arr[0] !== undefined) {
      console.log("found");
      clearInterval(id);
      event.target.yts.loadVideoByCnt(event.target, 0);
    } else if (document.failflag === 1) {
      displayInvalidMessage();
      clearInterval(id);
    } else {
      console.log("not found");
      document.not_found_cnt++;
      if (document.not_found_cnt++ > 5) {
        console.log("Please install tampermonkey script");
        clearInterval(id);
      }
    }
  }, 1000);
}

function onPlayerStateChange(event) {
  if (event.data == 0) {
    // Erase the now playing mark
    let table = document.getElementById("que");
    table.rows[event.target.yts.cnt].cells[1].innerHTML = "";
    // Load next video
    event.target.yts.loadVideoByCnt(event.target, event.target.yts.cnt + 1);
  }
}

class YouTubeShuffler {
  constructor() {
    this.cnt = 0;
  }

  loadVideoByCnt(player, cnt) {
    if (this.cnt < 0 || this.cnt >= document.id_arr.length) return;
    this.cnt = cnt;
    // If the video specified by cnt is unavailable, move forward
    while (document.id_arr[this.cnt] === "") {
      if (this.cnt === document.id_arr.length - 1) return;
      this.cnt++;
    }
    console.log("Loading " + document.id_arr[this.cnt]);
    player.loadVideoById(document.id_arr[this.cnt], 0);
    let table = document.getElementById("que");
    table.rows[this.cnt].cells[1].innerHTML =
      '<i class="fa-solid fa-volume-high"></i>';
  }

  changeVideoByClick(player, cnt) {
    // Erase the now playing mark
    let table = document.getElementById("que");
    table.rows[this.cnt].cells[1].innerHTML = "";
    // Load the specified video
    player.yts.loadVideoByCnt(player, cnt);
  }
}
