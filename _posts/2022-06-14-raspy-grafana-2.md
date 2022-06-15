---
layout: post
title: 自宅ネットワークを Grafana でモニタリング (2)
date: 2022-06-14
categories: [Technology, Network]
tags: [Network, IoT, Product, Python, Grafana, raspy-grafana]
---

## 概要

- 前回のネットワーク構築を経て、自宅ネットワークすべての機器におけるトラフィックがRaspberry Pi へ流入するように設定することができた。本記事では Raspberry Pi にてパケットキャプチャを行い、Grafana での可視化を行う。最終的に、どの時間帯にどのウェブサービスへ接続していたかを知るのが目標である。
- 全体の構成は以下の通り。 `tcpdump` を用いて pcap ファイルを書き出し、それを Python を用いて解析する。同じ Raspberry Pi 上に立てておいた MariaDB に解析後のアクセスログを蓄積し、Grafana からはそのデータベースを読み込んで可視化する形式を採る。以下、具体的な実装方法を見ていこう。

![software-overview](../../assets/img/raspy-grafana/software-overview.png)

## tcpdump でパケットキャプチャ

- tcpdump の Raspberry Pi へのインストール自体は `sudo apt install tcpdump` で簡単にできる。
- tcpdump には `-w` というオプションがあり、生データをそのままファイルに書き込むことができる。`-G` オプションと組み合わせれば、以下のように 10 秒おきにカレントディレクトリへ pcap ファイルを書き出すことができる。
- ここでは、フィルタをかけて http, https および後述する理由で DNS をキャプチャするようにした。

```bash
sudo tcpdump -v -n port 53 or port 80 or port 443 -G 10 -w %Y%m%d_%H%M%S.pcap
```

## パケット解析

今回、パケット解析には Python 3.10.1 を用いることとした。作成する Python スクリプトは、以下の機能を備えなくてはならない。

1. カレントディレクトリにある pcap を読み込み、通信先の IP アドレスを抽出する
2. IP アドレスから web サービス名を特定する
3. pcap ファイル 1 つ (10 秒間) で、どの web サービスに対するアクセスが何回行われていたかを集計する
4. 3 のデータを MariaDB に投げる

以降は手順を一つずつ追ってみていこう。

### Python で pcap ファイルの読み込み

- 保存された pcap ファイルはバイナリであるため、そのまま Python で読み込むことはできない。
- 今回は [dpkt](https://github.com/kbandla/dpkt) というライブラリを用いて pcap ファイルの読み取りを行った。これを用いれば、[参考記事](https://takahoyo.hatenablog.com/entry/2013/12/20/143153) のようにパケット 1 つ 1 つの種類判定から IP アドレス抽出まで簡単に行うことができる。

### IP アドレスから web サービス名の特定

- 抽出したアドレスがどの web サービスに対応するかを判定する箇所。こんなん `nslookup` なり `dig -x` なり使って逆引きすれば簡単だろと思ったら意外な落とし穴があった。
- 例えば `dig github.com` で返ってくるのは `52.192.72.89` であるが、いざ `dig -x 52.192.72.89` を打ってみると返ってくるのは `ec2-52-192-72-89.ap-northeast-1.compute.amazonaws.com.` である。IP アドレスを逆引きしたところで分かるのはそれがなんらか AWS でホスティングされているサービスであることくらいで、意図した宛先が github.com であったことは分からないのである。
- これを解決するため、今回は以下の方法を採ることにした。
    1. (DNS cache 等に残っていない限り、HTTP リクエストの前には DNS があるはずなので) まず先行する DNS レスポンスを読み、この後登場する IP アドレスとドメイン名の組み合わせをテーブルに記録しておく
    2. 上記のテーブルに基づいて、その後に現れる TCP なり UDP なりのパケットに含まれる IP アドレスをドメイン名に変換する
- 上記の方針は完璧に見えるが、実際は `ipconfig /flushdns` などしておいた状態であっても、先行する DNS なしで初見の IP アドレスを含むパケットが飛び込んでくるケースがある。その場合はとりあえず `dig -x` を用いてドメイン名を仮決定しておき、以降何らかのタイミングでその IP アドレスを含む DNS レスポンスが登場することがあればレコードを上書きしドメイン名を正式に決定する方針とした。
- これを pcap ファイルに含まれるすべてのパケットについて行えば、pcap ファイル 1 つ (10 秒間) のなかでどの web サービスに対するアクセスが何回行われていたかを集計することができる。

### Nickname の設定

- 上記のようにすれば IP アドレスに対応するドメイン名を取得できるが、例えば `t8.dropbox.com`  と `bolt.dropbox.com` を区別して可視化する意義があるかと言われればそうではない。むしろ、同じ web サービスとの通信は一つにまとめて `Dropbox` としてしまいたい。
- まとめたいサービス (Dropbox, Google など) については、例えばドメインの文字列の中に  `dropbox` が含まれていたら nickname `Dropbox` を、`google` が含まれていたら nickname `Google` を設定する、という作業をやっておくことにした。その他の初出のサービスについては、domain 名を `.` で split したうえで、generic TLD および country code TLD を除いた一番末尾の文字列を nickname として採用する……つもりだったのが、generic TLD 自体

## データベースの準備

- 上記を踏まえると、今回必要なテーブルは以下の 2 つとなる。
    1. 前節に登場した、DNS リクエストのレコードを蓄積するテーブル `dns_records`
    2. 集計された情報 (いつどの web サービスに対して何回アクセスが行われていたか) を蓄積するテーブル `tcpdump_records`
    
    今回は、[こちら](https://raspberrytips.com/install-mariadb-raspberry-pi/)  を参考に Raspberry Pi へ MariaDB をインストールすることで上記 2 つを実現する方針とした。
    
- 適当なデータベース (ここでは `network`)を作成したうえで、1 のテーブルを以下のように作成した。`is_definite` は、パケットキャプチャ内の DNS レスポンスに基づいてテーブルに登録された場合は 1、そうでない場合 (`dig -x` で逆引きされた場合など) は 0 が登録される。

```bash
CREATE TABLE dns_records (
  id INT AUTO_INCREMENT,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_addr TEXT,
  domain TEXT,
  is_definite BOOL,
  PRIMARY KEY(id))
DEFAULT CHARSET=utf8;
```

- 続いて 2 のテーブルを以下のように作成した。pcap 取得時の時刻が timestamp として記録され、以下は domain, nickname, count (1 ファイル内で何回アクセスがあるか) の列を作成する。

```bash
CREATE TABLE tcpdump_records (
  id INT AUTO_INCREMENT,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  domain TEXT,
  nickname TEXT,
  count INT,
  PRIMARY KEY(id))
DEFAULT CHARSET=utf8;
```

- データベースを Python から操作するにあたり、今回は [mysqlclient](https://github.com/PyMySQL/mysqlclient) というライブラリを用いることとした。Python 上からデータベースとの通信を確立し、簡単に SQL 文が実行できる。 実装は [こちら](https://www.python.ambitious-engineer.com/archives/818) のコードを参考にした。

## Grafana の準備

- 上記でデータベースの準備まで整ったので、あとは Grafana で可視化すればよいだけである。インストールは [こちら](https://grafana.com/tutorials/install-grafana-on-raspberry-pi/) を参考にした。
- インストールできたら localhost:3000 (別に Rapberry Pi の private IP を指定して [`http://192.168.11.9:3000/`](http://192.168.11.4:3000/) などとすれば別端末のブラウザでも接続できる) にアクセス。新しいデータソースとして、[localhost:3306](http://localhost:3306) 上に立ち上がっている MySQL サーバを登録する。

![mysql](../../assets/img/raspy-grafana/mysql.png)

- 続いてグラフを作成し、Query 部分に以下を入力する。Grafana での可視化には nickname を用いたいので、`nickname AS metric`、`GROUP BY nickname, ts` とした。

```bash
SELECT
  UNIX_TIMESTAMP(ts) AS time,
  nickname AS metric,
  sum(count) AS value
FROM tcpdump_records
WHERE
   $__timeFilter(ts)
GROUP BY nickname, ts
ORDER BY ts;
```

- 上記を入力して適当なところをクリックすると……やったね！

![visualize](../../assets/img/raspy-grafana/visualize.png)

今回書いたコードは [こちら](https://github.com/ternbusty/tcpdump_recorder)。以上でとりあえずの実装は終了、次稿では可視化結果をもとにいろいろ遊んでみることにする。