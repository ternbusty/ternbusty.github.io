---
layout: post
title: YouTube Playlist Shuffler
date: 2022-12-15
categories: [Technology, Web]
tags: [JavaScript, Product]
---

<head>
<link href="/assets/css/youtube.css" rel="stylesheet" type="text/css">
<script src="https://kit.fontawesome.com/ddf1feedf5.js" crossorigin="anonymous"></script>
</head>

<div id="how-to-use">
<input id="id_input" type="text" placeholder="Type your playlist ID">

<input type="button" value="Random" onclick="redirect('random')">
<input type="button" value="Reverse" onclick="redirect('reverse')">
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
