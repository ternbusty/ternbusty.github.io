// ==UserScript==
// @name         YouTube Playlist Shuffler
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  try to take over the world!
// @author       ternbusty
// @match        http://localhost:4000/posts/youtube/*
// @grant        GM.xmlHttpRequest
// @connect      www.youtube.com
// ==/UserScript==

const shuffle = ([...array]) => {
    for (let i = array.length - 1; i >= 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
  function createShuffledArray(num) {
    let arr = [...Array(num)].map((_, i) => i);
    let shuffled_arr = shuffle(arr);
    return shuffled_arr;
  }
  
  function makeGetRequest(url) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: "GET",
        url: url,
        onload: function(response) {
          resolve(response.responseText);
        }
      });
    });
  }
  
  async function getPlaylistLength(playlist_id) {
      const url = "https://www.youtube.com/playlist?list=" + playlist_id;
      let res = await makeGetRequest(url);
      try {
          let result = /"stats":\[{"runs":\[{"text":"(\d*?)"}/.exec(res);
          return result[1];
      } catch (error) {
          document.failflag = 1;
          return undefined;
     }
  }
  
  async function getVideoID(playlist_id, index){
      const url = "https://www.youtube.com/watch?v=+&list=" + playlist_id + "&index=" + index;
      let res = await makeGetRequest(url);
      let video_id = /"watchEndpoint":{"videoId":"(.*?)",/.exec(res);
      return video_id[1];
  }
  
  async function getVideoTitle(video_id){
      const url = "https://www.youtube.com/watch?v=" + video_id;
      let res = await makeGetRequest(url);
      let title = /<meta name="title" content="(.*?)">/.exec(res);
      return title[1];
  }
  
  async function main() {
      const href = window.location.href;
      let splitted = href.split('?');
      if (splitted.length === 1) return;
      let playlist_id = splitted[1];
      console.log(playlist_id);
      let num = await getPlaylistLength(playlist_id);
      if (document.failflag) {
          console.log("failed to get information of the playlist");
          return;
      }
      num = Number(num);
      let shuffled_arr = createShuffledArray(num);
      document.shuffled = shuffled_arr;
      document.id_arr = Array(num);
      let id_set = new Set();
      document.title_arr = Array(num);
      for (let i = 0; i < num; i++) {
          let video_id = await getVideoID(playlist_id, document.shuffled[i]);
          let video_title;
          if (id_set.has(video_id)) {
              video_id = '';
              video_title = '非公開動画';
          } else {
              try {
                  video_title = await getVideoTitle(video_id);
              } catch {
                  console.log(video_id);
                  video_id = '';
                  video_title = '非公開動画';
              }
              id_set.add(video_id);
          }
          console.log(i + ' ' + video_id + ' ' + video_title);
          document.id_arr[i] = video_id;
          document.title_arr[i] = video_title;
          await new Promise(s => setTimeout(s, 1000))
      }
  }
  
  
  main();
  