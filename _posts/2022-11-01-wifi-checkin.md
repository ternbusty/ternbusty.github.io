---
layout: post
title: Wi-Fi 打刻システムの構築
date: 2022-11-01
categories: [Technology, Network]
tags: [Python, Raspberry Pi, Product]
---

## 概要

現在の職場にはいわゆる打刻システムというものがなく、その月にした時間外勤務を月末までにまとめて入力する制度になっている。どの日にどのくらい残業していたのか (≒ 何時に帰宅したか) を把握するために、帰宅を検知しその時刻を記録するシステムを作ることにした。

帰宅の検知にはドア開閉の検知や照明のオンオフなどが利用できそうであるが、前者は出勤と帰宅の区別がつかない (勤務時間帯が不規則になりうるのでこれらは明確に弁別したい)、後者については睡眠と出勤の区別がつかない、という問題がある。そこで今回は、出勤の時はだいたい私物の iPhone を持ち歩いているということを踏まえ、iPhone が家の Wi-Fi につながっているか否かによって在宅かどうかを判定することにした。

## Wi-Fi への接続をどのように検知するか

検知の方法としては大きく分けて以下の 2 通りが存在する。

1. iPhone 上で、自身が接続されているネットワークの情報を取得することにより、在宅かどうかを判定する
2. 自宅ネットワーク上に存在する何らかのサーバ (Raspberry Pi などを想定) 上で、iPhone が同一ネットワーク上にあるかどうかを判定する

まず 1 について。iPhone にプリインストールされている「ショートカット」を用いれば、自身が接続しているネットワークの情報を取得することが可能である。同一アプリ内にある「オートメーション」にはわざわざ「Wi-Fi が特定のネットワークに接続されたとき」というトリガーも用意されているが、わざわざタップして応答しなければならないのが玉に瑕である。特に何の操作もせず打刻をしてほしいので、今回は 2 の路線で考えることにした。

### iPhone が同一ネットワーク上にあるかどうかを判定する

これについても 2 通りの方法が考えられる。

- 2-1. iPhone の private IP を固定しておき、自宅サーバから ping を打つなどして通るかどうかによって存在を確認する 
- 2-2. 自宅ネットワーク内でパケットキャプチャを行い、iPhone からのトラフィックが存在するかどうか確認する

まず 2-1 について。これには「iPhone がスリープ状態になっているときも ping は通らなくなるので、外出時との区別がつかない」という問題がある。

上記については [こちら](https://github.com/pimatic/pimatic/issues/209) で議論があり、以下の方法が提案されている。が、自分の環境で試してみたところ、どれもスリープ状態の iPhone を検知したりしなかったりで安定性に欠ける印象だった。

- `sudo arp-scan -I eth0 -l`: iPhone の private IP (192.168.11.18) が表示されるか調べる
- `tcping 192.168.11.18 62078`: `sudo nmap -Pn 192.168.11.18` をすると iPhone の空いているポートを調べられるので、そのポートに対して tcping をしてみる
- 単に `sudo nmap -sT -Pn 192.168.11.18` を打つ: スリープ状態でも正しく存在を検知できる場合 (ただし数十秒かかる) があるが、逆に iPhone がネットワーク上にないときでもそれっぽい応答を返すこともあった (謎)

また、[この記事
](https://tech.raksul.com/2018/09/14/wifi%E6%89%93%E5%88%BB%E3%82%B7%E3%82%B9%E3%83%86%E3%83%A0%E3%82%92%E3%81%A4%E3%81%8F%E3%81%A3%E3%81%9F%E8%A9%B1/) に登場する `snmpwalk` も試してみた。これについては別記事を書いたが、結果的に得られるものは `arp-scan` の出力と大差なく、スリープ中の iPhone を正しく検知することはできなかった。

### 自宅ネットワーク内で iPhone からのパケットをキャプチャする

上記の議論を踏まえ、今回は 2-2 の方針を採用することにした。[以前の記事](https://ternbusty.github.io/posts/raspy-grafana-1.html)で作成した図を再掲するが、我が家のネットワーク構成は以下のようになっており、iPhone → アクセスポイント → ポートミラーリング機能付きスイッチ → Raspberry Pi という流れでパケットキャプチャができるのである。

![network-map](../../assets/img/wifi-checkin/network-map.png)

Raspberri Pi 上で以下のコマンドを実行してみると、スリープ中の iPhone であっても 30 秒に一回は arp が流れていることが分かった。

```bash
sudo tcpdump -n -v arp and src host 192.168.11.18
```

今回は、このキャプチャ結果を 2 分おきにファイルに保存し、新規のファイルが存在するか (直近 2 分間で iPhone からの ARP が流れているか = iPhone がネットワーク上に存在するかどうか) を 5 分おきにチェックするようにした。これにより、最大 5 分の誤差で出勤と帰宅を検知することができる。

## 実装

以下、今回 Wi-Fi 打刻システムを実現するうえで最終的に行ったことをまとめていく。まず、下記コマンドで tcpdump から pcap ファイルを出力するようにする。

```bash
sudo tcpdump -n -v arp and src host 192.168.11.18 -G 120 -w %Y%m%d_%H%M%S.pcap -Z ternbusty
```

続いて、ファイルの存在を判定する簡単な Python スクリプトを書いた。ついでに、帰宅 or 出勤を検知したときは Slack にその旨を通知するようにもしてみた。

```python
from time import sleep
from glob import glob
import os
from datetime import datetime

class CellPhoneDetector():
    def __init__(self) -> None:
        self.status: str = None

    def send_to_slack(self, message):
        WEBHOOK_URL: str = "https://hooks.slack.com/services/xxxxxxxxxxxxxxxxxxxxxxxxxx"
        requests.post(WEBHOOK_URL, data=json.dumps({
            'text': message,
        }))

    def run(self) -> None:
        file_exist: bool = False
        files: list[str] = glob('./*.pcap')
        dt_str: str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        for file in files:
            filesize: int = os.path.getsize(file)
            if filesize != 0:
                file_exist = True
                os.remove(file)
        if file_exist:
            if self.status != 'in':
                self.send_to_slack(f':arrow_right: in: {dt_str}')
                self.status = 'in'
        else:
            if self.status != 'out':
                self.send_to_slack(f':arrow_left: out: {dt_str}')
                self.status = 'out'
        print(dt_str, ':', self.status)

if __name__ == '__main__':
    cpd = CellPhoneDetector()
    while(1):
        cpd.run()
        sleep(300)
```

これにより、出勤 or 退勤を自動で検知して以下のように slack にメッセージが送信されるようになる。

![example1](../../assets/img/wifi-checkin/example1.png)

あとはこれを月末にみて手動で打刻すれば、ヨシ！

## 運用してみての感想

今回はパケットキャプチャを行うことにより無事 Wi-Fi 打刻システムを実現することができた。先行事例 ([ここ](https://qiita.com/utisam/items/7ba65bd84c911faaad79#%E4%BB%96%E7%A4%BE%E3%81%95%E3%82%93%E3%81%AE%E4%BA%8B%E4%BE%8B) にまとまっている) では snmpwalk あるいは arp-scan を用いて接続している MAC address を取得しているものが多かったが、いずれもスリープ状態の iPhone を検知することはできなかった。

最初に出社した時刻と最後に Wi-Fi につながっていた時刻を取得できればいいのであれば上記でも事足りるのかもしれないが、問題は現職の都合上ブツ切れのめちゃくちゃな勤務時間になりがちということである。実際、ある日の夜間オンコール (00:00-03:30, 06:00-07:00 に勤務) の際などは以下のような出力になった。

![example2](../../assets/img/wifi-checkin/example2.png)

このような労働時間を正確に把握するうえでは iPhone が単にスリープになっている状態と、外出している状態を判別することは critical になりうる。その意味でも、パケットキャプチャを利用したシステムをわざわざ構築した甲斐はあったと考える。

## 今後の展望

今回書いた Python スクリプトによって、自分が家にいるかどうかを数分の誤差で判定できるようになった。例えば FastAPI などを用いて上記コード中の `cpd.status` を返すような API を構築すれば、今後何らか「自分が家にいるとき or いないときのみ実行したい」ようなスクリプトを思いついたとき実現が容易になると考えられる。