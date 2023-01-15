---
layout: post
title: YouTube Playlist Player
date: 2022-12-15
categories: [Technology, Web]
tags: [JavaScript, Product]
---

<head>
<link href="/assets/css/youtube.css" rel="stylesheet" type="text/css">
<script src="https://kit.fontawesome.com/ddf1feedf5.js" crossorigin="anonymous"></script>
</head>

<div id="how-to-use">
<details>
<summary>How To Use</summary>
<ol>
  <li>Install <a href="https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=ja">Tampermonkey</a> to your chrome browser</li>
  <li>Install <a href="https://gist.github.com/ternbusty/373d3d88ddfd690ae454715f377c283b/raw/ff1d87d02cd39c67bb4502f1a69d9cc425674fb6/youtube.user.js">this script</a></li>
  <li>Reload this page</li>
</ol>
<p style="text-indent:1rem">For more details, see <a href="https://ternbusty.github.io/posts/playlist-player.html">this article</a></p>
</details>

<input id="id_input" type="text" placeholder="Type your playlist ID">

<div id="buttons">
<input type="button" value="Normal" onclick="redirect('normal')">
<input type="button" value="Reverse" onclick="redirect('reverse')">
<input type="button" value="Random" onclick="redirect('random')">
</div>
</div>

<div id="youtube">
<html>
  <body>
    <div id="player"></div>
  </body>
</html>

<div class="table-wrapper"><table id="que">
  <tbody>
  </tbody>
</table></div>
</div>

<script type="text/javascript" src="/assets/js/youtube.js"></script>
