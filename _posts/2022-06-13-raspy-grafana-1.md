---
layout: post
title: 自宅ネットワークを Grafana でモニタリング (1)
date: 2022-06-13
categories: [Technology, Network]
tags: [Network, IoT, Product, Python, Grafana, raspy-grafana]
---

## 動機

いわゆるコロナ禍が始まってはや 2 年、必然的に自宅にいる時間が長くなったものの、その時間を最大限勉強など活用できているかと言われると非常に怪しい。業務後には YouTube をだらだら自動再生しながら作業をし、何か一区切り発生するたびに気付けば Tweetdeck をぼーっと眺め、休日には Amazon Prime Video にあるアニメを一気見してしまう。こんな生産性のない毎日をどうにかするため、まずは「おうち時間」における現状の web サービス利用状況をセルフ監視することとした。

ネットワークの監視をするとき真っ先に思いつくのはパケットキャプチャであるが、今回はメインで使っている PC 以外の通信も監視したい (寝っ転がって iPhone で Twitter を眺めているときのトラフィックも取得したい) ためいろいろと工夫を凝らす必要があった。最終的には大分前に見た以下ツイートのような形式を目指すとして、本稿ではまず自宅ネットワークの再構築を行う。

<center>
<blockquote class="twitter-tweet" data-lang="en"><p lang="en" dir="ltr"></p><a href="https://twitter.com/kaitou_ryaku/status/1440337734946594823">Sep 22, 2021</a></blockquote>
<script async="" src="//platform.twitter.com/widgets.js" charset="utf-8"></script>
</center>


## 概要

![overview](../../assets/img/raspy-grafana/overview.png)

- 今回目指すネットワークの構成は上図の通り。まず、パケットキャプチャ自体はその辺に転がっていた Raspberry Pi で行うこととした。ここにすべてのパケットが流入するようにする必要があるため、ルータと有線接続の間にミラーリングポート対応のスイッチを挟むこととした。
- 通常のようにルータから Wi-Fi を用いて各種モバイル端末に接続してしまうと、そのパケットはスイッチを通過しないのでキャプチャすることができない。そこで、今回は既存のルータに備わっている無線 LAN 機能を無効化したうえで、スイッチから接続した無線 LAN アクセスポイントを新設し、そこから iPhone 等に接続するようにした。

## 各種機器の設定

- スイッチの設定 ([NETGEAR GS305E](https://www.netgear.com/jp/business/wired/switches/plus/gs305e/))
    
    Amazon タイムセールでポートミラーリングに対応したスイッチが売っていたのでそれを購入した。管理画面にアクセスできさえすればポートミラーリングは非常に簡単で、以下のようにミラー元 (複数選択可) とミラー先を選択できるようになっている。
    
    ![netgear](../../assets/img/raspy-grafana/netgear.png)
    
    ここでは、②アクセスポイント ⑤ 有線接続の PC のパケットを ③ Raspberry Pi へミラーする方針とした。
    
- アクセスポイントの設定
    
    Wi-Fi ルータをもう一つ購入しブリッジモードにするなりなんなりすることも可能であったが、別にルーティング機能が必要なわけではないしなあ……と思い今回は [tp-link RE330](https://www.tp-link.com/jp/home-networking/range-extender/re330/) を購入した。本来の使い道は Wi-Fi の中継器でありおそらくほとんどの人がその用途で使っていると思われるが、実はルータから有線で接続し Wi-Fi のアクセスポイントとして利用することも可能である。設定は [こちら](https://www.tp-link.com/jp/support/faq/1695/) を参考に行った。
    
- 携帯端末の接続設定
    
    携帯端末などにおける Wi-Fi の接続先を、ルータから飛んでいる方ではなくアクセスポイントからの方へ切り替える必要がある。今回は、紛らわしい状態になるのを避けるためルータの無線設定を無効化することにした。
    

## 実験

上記の接続を終えたあと、携帯や PC における通信がきちんと拾えているかどうかを確認するため、Raspberry Pi 上で tcpdump を用いてパケットをキャプチャしてみることとした。以下は、iPhone (192.168.11.18) から Twitter (net range 104.244.40.0 - 104.244.47.255) にアクセスしてみた際の出力冒頭である。

```bash
pi@raspberrypi:~ $ sudo tcpdump src host 192.168.11.18
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), capture size 262144 bytes
21:30:52.465080 IP 192.168.11.18.56217 > 104.244.42.194.https: Flags [S], seq ...
```

iPhone と Twitter サーバ間の通信が拾えていそうだ。やったね！

以上でハードウェアの環境構築は終了、次稿ではパケットしたキャプチャを可視化する方法について検討していく。