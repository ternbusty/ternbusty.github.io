function process_input(message) {
  let playlist_id = window.prompt(message, "");
  console.log(playlist_id);
  if ((playlist_id !== "") & (playlist_id !== null))
    window.location.href =
      "https://ternbusty.github.io/youtube.html?" + playlist_id;
  else process_input("不正なプレイリスト ID です。正しい値を入力してください");
}

// Process URL
let loc = window.location.href;
let splitted_href = loc.split("?");
if (loc === splitted_href[0]) {
  // If no '?' in URL
  process_input("プレイリスト ID を入力してください");
}

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
  let id = setInterval(() => {
    if (document.id_arr && document.id_arr[0] !== undefined) {
      console.log("found");
      clearInterval(id);
      event.target.yts.loadVideoByCnt(event.target, 0);
    } else if (document.failflag === 1) {
      process_input("不正なプレイリスト ID です。正しい値を入力してください");
      clearInterval(id);
    } else {
      console.log("not found");
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
