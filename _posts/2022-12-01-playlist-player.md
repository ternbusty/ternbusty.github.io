---
layout: post
title: YouTube の再生リストをシャッフル / 逆順で再生させる
date: 2022-12-01
categories: [Technology, Web]
tags: [JavaScript, Product]
---

## TL;DR
- 概要: YouTube のプレイリストをシャッフル再生したり、逆順で再生したりする web サービス ([これ](https://ternbusty.github.io/youtube.html)) を作った。自分が高評価した動画のリストや非公開プレイリストでも利用できるのが特徴。
- 環境: 拡張機能 Tampermonkey のインストールが可能なブラウザ (PC 上からの閲覧を想定)
- 使い方:
  1. 拡張機能 [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=ja) をインストール
  2. [Userscript](https://gist.github.com/ternbusty/373d3d88ddfd690ae454715f377c283b/raw/e39a92854d02399efd2aecca0e92a5c8c8dda70e/youtube.user.js) をインストール
  3. [本ツール](https://ternbusty.github.io/youtube.html) にアクセス
  4. プレイリスト ID を入力し、Normal (通常再生) か Reverse (逆順) か Random (シャッフル) をクリック 
- スクリーンショット
![kyomuradi](../../assets/img/playlist-player/kyomuradi.png)

## 動機
作業用 BGM として YouTube で高評価した動画など適当な再生リスト (プレイリスト) をシャッフル再生していることが多いのだが、動画が 200 を超えたあたりからどうやら挙動がおかしくなる (特定の動画の繰り返しでループになってしまう) ことに気づいた。試しに 344 個の動画が登録されているプレイリストをブラウザでシャッフル再生してみたところ、表示される動画のインデックスは以下のような順序となった。

```
1 79 138 197 256 315 340 321 341 323 325 312 340 321 341 323 325 312 340 321 341 323
```

ご覧の通り、動画インデックスが単調増加していったと思えば、`340 321 341 323 325 312` という流れの繰り返しに突入してしまい抜け出せなくなっていることが分かった。これをシャッフル再生と呼ぶのはどう考えても無理があるだろう。

この問題については既に方々で報告がなされており、公式ヘルプサイトでユーザによる [ブチギレ投稿](https://support.google.com/youtube/thread/37012274/youtube-shuffle-broken-youtube-shuffle-not-working-youtube-shuffle-repeats-videos?hl=en) などもなされているが、数年を経ていまだ Bug Fix には至っていないようだ。これを回避するために、[プレイリストの ID を入力するとプレイリストの動画をシャッフル再生してくれるサービス](https://youtube-playlist-randomizer.bitbucket.io/) も提供されており、こちらはきちんと再生リスト全体を並べ替えてくれる。公開されている再生リストについてはこのようなサイトを使えばいいとして、非公開のリスト (自分が個人的に作っており特に公開予定がない再生リストや、自分が高評価した動画リスト) をシャッフル再生するためにそれ用のウェブサービスを自作することにした。

上記と直接の関係はないが、以前ブラウザ版 YouTube で提供されていた「並べ替え」機能が消失したらしく (これについて公式による情報は見つからず詳細は不明)、プレイリストを逆順に再生することもできなくなっているようである。特定のチャンネルでアップロードされた動画を古い順に再生したいなどの需要は存在すると思われるので、ついでにこれも実装してしまうことにする。

## 実装

概略を以下に示す。実装は、JavaScript (ブラウザ + Tampermonkey) により ページに埋め込まれたプレーヤー ([IFrame Player](https://developers.google.com/youtube/iframe_api_reference)) を操作することにした。

1. プレイリスト内にある動画インデックスをシャッフルした配列を用意する
2. 動画インデックスからどうにかして動画 ID なり URL なりを取得し、それを格納する配列を用意する
3. 2 を順番に再生する

### 動画インデックスの配列を作成する
まず 1 を実現するためにはプレイリスト内にある動画の数を把握する必要があるが、これには 2 つの方法が考えられる。
- 1-1. 普通に YouTube Data API を利用する
- 1-2. プレイリストのウェブサイトにアクセスし、スクレイピングする

1-1 についてはおそらく私が発行した API key を使うことになるが、Rate Limit があるので万が一ユーザが増えた場合大変な事態になること、他ユーザがこのサービスを利用した場合に (当然ながら) 当該ユーザが作成した非公開プレイリストの情報を取得できないこと、などの問題がある。なので今回は 1-2 の方法を採用することにした。1-2 をブラウザ上にて JavaScript を利用して実行すると CORS を踏むので、Tampermonkey を利用してユーザスクリプトで行うことにした。

```javascript
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
```

### 動画インデックスから動画 ID を取得する
続いて 2 について。プレイリスト再生中の動画 URL は例えば `https://www.youtube.com/watch?v=dQ1V3EF6WdA&list=UUlSsb_e0HDQ-w7XuwNPgGqQ&index=210` のようになっており、動画 ID、プレイリスト ID、インデックスの 3 つが含まれている。
YouTube のプレイリスト ID と動画インデックスを `&index=` みたいな形で与えれば勝手にリダイレクトしてくれるんじゃないかと期待していたのだが、`https://www.youtube.com/watch?list=UUlSsb_e0HDQ-w7XuwNPgGqQ&index=210` などとしてみてもエラーページに行きつくのみである。

これについても [先人の議論](https://webapps.stackexchange.com/questions/146127/is-it-possible-to-navigate-to-a-video-in-a-youtube-playlist-by-index) があり、`v=+` など動画 ID 部分に適当な一文字を入れて `https://www.youtube.com/watch?v=+&list=UUlSsb_e0HDQ-w7XuwNPgGqQ&index=210` などとすると上手いことリダイレクトされることが判明した。よって、これをスクレイピングすることにより動画 ID を取得することにした。前節と同様の理由で、この作業も Tampermonkey 上で行った。

```javascript
async function getVideoID(playlist_id, index){
    const url = "https://www.youtube.com/watch?v=+&list=" + playlist_id + "&index=" + index;
    let res = await makeGetRequest(url);
    let video_id = /"watchEndpoint":{"videoId":"(.*?)",/.exec(res);
    return video_id[1];
}
```

### 動画を再生する
動画の再生に関しては、YouTube により提供されている [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) を用いることとした。この API 自体にもプレイリスト内の動画を順番に再生する機能がついているものの、仕様上 200 個の動画しか読み込みできないようなので今回は使用しなかった。Player にイベントリスナーを追加したうえで、動画の再生終了が検知されたタイミングで次の動画を読み込むようにした。

```javascript
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
```

## 今後の展望
上記によりプレイリストのシャッフルや逆順再生ができるようになった。個人的に特に困ってはいないが、今後の改良点などを書いておく。
- ページを再読み込みしたり閉じたりすると一度読み込んだ動画 ID のリストなどが消失する。これについては、公式で提供されているプレイリストシャッフル機能もそのような仕様だしまあええかと思っている。
- ブラウザに Tampermonkey をインストールできる環境でしか使うことができない。PC 版の Chrome でしか動作検証をしていないが、どうやら iOS 版の Safari 等でも拡張機能が導入できるようになっており頑張れば Userscript を動かせるようなので、暇なときに試してみたい。

