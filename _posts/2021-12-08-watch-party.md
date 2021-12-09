---
layout: post
title: Amazon Prime Video の Watch Party でチャット履歴を保存する
date: 2021-12-08
categories: [Technology, Products]
tags: [JavaScript]
---

## 動機
最近 Amazon Prime Video で動画を複数人で同時視聴できるサービス (Watch Party) を使い始めた。再生しながら視聴者どうしでチャットができるという便利なものなのだが、ホストが Watch Party を終了させるとチャット履歴が消失するという問題がある。そこで、Watch Party のページをスクレイピングすることによりチャット履歴を記録したテキストファイルをダウンロードするスクリプトを書いた。

## 実装
- めちゃくちゃ意識が低くてアレだが、Watch Party にあるチャットウィンドウの要素を漁り、innerText からチマチマ情報を抽出していく (下記コードの `create_chat_text()` 部分)。これを `text/plain` の blob として作成したうえで、ダウンロードリンクをページに追加する。以上の作業を Tampermonkey の UserScript で行う。
- ブラウザで Watch Party のリンクにアクセスした場合、まず参加設定 (チャットに用いるハンドルネームなど) に飛ばされ、入力後に再生画面およびチャットウィンドウが表示される仕様になっている (URL の変更はなし)。つまりアクセス直後はチャットウィンドウがまだ表示されていないため、要素を取得するためにはユーザが設定を終えて再生画面に遷移するのを待つ必要がある。これを実現するため、チャットウィンドウの要素が表示されるまで 1 秒おきに要素の取得を繰り返すという脳筋仕様にしてしまった (下記コードの `wait_load()` 部分)。絶対もっとマシな書き方があるはずなので、暇なときに改訂したい。

```javascript
// ==UserScript==
// @name         Watch Party
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Add button to download chat histories in Amazon Prime Watch Party
// @author       You
// @match        https://www.amazon.co.jp/gp/video/watchparty/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    window.dl = function() {
        var blob = update_blob();
        var newA = document.getElementById("download_link");
        newA.href = window.URL.createObjectURL(blob);
    }
    wait_load();
})();

var get_footer = function () {
  var footer = document.evaluate(
    '//*[@id="embeddedChat"]/div/div/div/div/div/div/div/div[3]',
    document,
    null,
    XPathResult.ORDERED_NODE_ITERATOR_TYPE,
    null
  );
  return footer;
};

function create_chat_text() {
  var chat_text = "";
  var chats_elems = document.evaluate(
    '//*[@id="embeddedChat"]/div/div/div/div/div/div/div/div[2]/div/div',
    document,
    null,
    XPathResult.ORDERED_NODE_ITERATOR_TYPE,
    null
  );
  var this_elem = chats_elems.iterateNext();
  Array.prototype.forEach.call(this_elem.children, function (elem) {
    var inner_text = elem.innerText;
    var splitted;
    if (elem.getAttribute("data-testid") === "MessageClusterIncoming") {
      splitted = inner_text.split("\n");
      if (splitted[3] != null) {
        for (var i = 3; i < splitted.length; i++) {
          chat_text += `${splitted[2]}\t${splitted[0]}\t${splitted[i]}\n`;
        }
      } else {
        chat_text += `${splitted[2]}\t${splitted[0]}\tStamp\n`;
      }
    } else if (elem.getAttribute("data-testid") === "MessageClusterOutgoing") {
      splitted = inner_text.split("\n");
      if (splitted[1] != null) {
        var time = splitted[splitted.length - 1];
        for (var i = 0; i < splitted.length - 1; i++) {
          chat_text += `${time}\tMe\t${splitted[i]}\n`;
        }
      } else {
        chat_text += `${inner_text}\tMe\tStamp\n`;
      }
    } else {
      chat_text += inner_text === "" ? "" : `--- ${inner_text} ---\n`;
    }
  });
  return chat_text;
}

function update_blob() {
  var header_text = `Exported at ${new Date()}\n\n`;
  var chat_text = create_chat_text();
  var blob = new Blob([header_text + chat_text], { type: "text/plain" });
  return blob;
}

function init() {
  var footer = get_footer();
  var this_elem = footer.iterateNext();
  var stamp = this_elem.firstChild;
  var newA = document.createElement("a");
  newA.id = "download_link";
  newA.innerHTML = "Download Chat History";
  newA.style.color = 'rgb(242, 244, 246)';
  newA.setAttribute("onclick", "dl()");
  newA.download = '';
  stamp.after(newA);
}

function wait_load() {
  var fn = function () {
  var footer = get_footer();
    if (footer.iterateNext() != null) {
      console.log('found');
      clearInterval(id);
      init();
    } else {
      console.log("not found");
    }
  };
  var id = setInterval(fn, 1000);
}
```
## できたもの
これを Tampermonkey に追加すると以下のようになる。

![image](/assets/img/watch-party.png)

チャットウィンドウに表示された Download Chat History をクリックすると、以下のテキストファイルがダウンロードされる。
```
Exported at Wed Dec 08 2021 17:10:40 GMT+0900 (日本標準時)

--- ビデオを一時停止しています ---
--- hoge参加 ---
--- hogeが再生をコントロールします ---
19 分	hoge	Hello!
--- hogeが退出しました ---
--- fuga参加 ---
--- fugaが再生をコントロールします ---
19 分	Me	Hello!
19 分	Me	How are you?
```

## 今後やりたいこと
- ダウンロードボタンが追加されるのが気に入らないので、Tampermonkey ではなく Chrome 拡張機能として導入し、拡張機能のアイコンをクリックでダウンロードできるようにしたい
- 動画のタイトルを自動で取得しテキストファイルのファイル名に設定するようにしたい。動画再生中なら `h1` `h2` タグ抽出により取得できるのだが、終了後には要素ごと消えてしまう模様。何らかの方法で動画のメタデータを入手できればよいのだけど……
