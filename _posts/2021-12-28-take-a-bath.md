---
layout: post
title: IoT を使って嫌でも風呂に入らざるを得ないようにする
date: 2021-12-28
categories: [Technology, IoT]
tags: [Python, IoT, Products]
---

## 概要
今に始まったことではないが、入浴というものが基本的にあまり好きではない (入浴より重要でかつ楽しいことはたくさんあるので)。現代を生きている人間である以上回避不可能なイベントなのでしゃーなし毎朝シャワーを浴びてはいるものの、億劫すぎて毎日ギリギリまで入浴を引き延ばした挙句髪のセットがおろそかになり、結果的に崩壊したヘアスタイルでの出勤を余儀なくされている。今回はこのような状況を打破すべく、毎朝決まった時間にシャワーを浴びることに対して何らかの動機付けをするシステム構築に取り組むことにした。

動機付けの方法はいろいろ考えられるが、今回は「シャワーを浴びないとすごく嫌なことが発生する」形式を採用することにした。具体的には「**朝 6 時に風呂場の湿度が一定以上になっていないと、寝室の照明が数秒おきに点滅を繰り返す**」という非常に迷惑な仕組みを以下で実現していく。実装の概略は以下の通り。

1. 浴室に設置しておいた SwitchBot 温湿度計から、Bluetooth を介して Raspberry Pi で値を取得する
2. 浴室の湿度が一定の値以下である場合、Raspberry Pi から Nature Remo の Local API を叩き、寝室の照明のスイッチを切り替える
3. 1, 2 を朝 6 時に開始したうえで数秒おきに繰り返し、浴室の温度が一定の値以上になったところでプログラムを終了させる

## 事前準備
### 用意するもの
今回は以下の製品を購入した。湿度計付きの [Remo3](https://www.amazon.co.jp/dp/B08BLSLWH4/?coliid=I2YZX6L7JP40MX&colid=2QNA7G7A5RMMX&ref_=lv_ov_lig_dp_it&th=1) を買っておけば SwitchBot は不要だったのではないかという気はするが、浴室に Remo を設置すると部屋の家電に赤外線が届かないのでこのような構成を採ることになった。

- [Raspberry Pi3 Model B+](https://akizukidenshi.com/catalog/g/gM-13470/) with Python 3.10
- [Nature Remo mini2](https://www.amazon.co.jp/gp/product/B08P6ZSXWZ/ref=as_li_tl?ie=UTF8&tag=naturejapan01-22&camp=247&creative=1211&linkCode=as2&creativeASIN=B08P6ZSXWZ&linkId=e2f97c67178375253e6ee3f93dc1842f)
- [SwitchBot 温湿度計](https://www.amazon.co.jp/Alexa%E8%AA%8D%E5%AE%9A%E3%80%91SwitchBot-%E3%82%B9%E3%82%A4%E3%82%B9%E8%A3%BD%E3%82%BB%E3%83%B3%E3%82%B5%E3%83%BC-%E3%82%B9%E3%83%9E%E3%83%9B%E3%81%A7%E6%B8%A9%E5%BA%A6%E6%B9%BF%E5%BA%A6%E7%AE%A1%E7%90%86-Alexa%E3%80%81Google-home%E3%80%81HomePod%E3%80%81IFTTT/dp/B07L4QNZVF)

### 湿度の閾値を決定する
浴室に SwitchBot 温湿度計を設置し、試しにシャワーを浴びてみたところ以下のようになった。

![image](/assets/img/humidity.png)

この日は朝 8 時ごろに入浴しており、ちょうどその時間帯に湿度が著明に上昇していることが分かる。今の季節はベースの湿度が低めなので今後もう少し閾値を上げる必要があるかもしれないが、とりあえずは 50% 程度に設定しておけばよさそうだ。

## 実装
### SwitchBot 温湿度計から湿度を取得する
特に何もしなくても上記のように湿度を確認することはできるが、これはアプリを手動で開くたびに湿度計と iPhone が Bluetooth を介して通信し今までのログをまとめて受信するという形式であり、今回の用途には向かない。リアルタイムでの自動的な計測値取得には二通りの方法が考えられる。

- SwitchBot Hub Mini を購入し、[cloud-based API](https://github.com/OpenWonderLabs/SwitchBotAPI) を叩く
- Raspberry Pi と BLE (Bluetooth Low Energy) で接続して値を取得する

今回は、API に Rate Limit (10000 requests/day, 9 秒に一回程度しか実行できない) が存在するということを踏まえて後者の方法を採用した。まず、BLE 通信の下準備として Raspberry Pi にパッケージ bluepy のインストールを行う。

```console
pip install bluepy
```

このライブラリを用いて、SwitchBot 温湿度計からの BLE Advertisement パケットを受け取り値を取得する方針とする。BLE を用いて通信するには SwitchBot 側の BLE MAC アドレスが必要であるが、こちらは SwitchBot アプリのデバイス情報から確認できる。

下記コードは [こちらの記事](https://qiita.com/warpzone/items/11ec9bef21f5b965bce3) を参考にさせていただいた。これを実行すると、約 2 秒おきに湿度データが取得できる。

```python
import binascii
from bluepy.btle import Scanner, DefaultDelegate

class ScanDelegate(DefaultDelegate):
    def __init__(self) -> None:
        self.MAC_ADDRESS: str = 'xx:xx:xx:xx:xx:xx' # lower case
        DefaultDelegate.__init__(self)

    def handleDiscovery(self, dev, isNewDev, isNewData) -> None:
        if dev.addr == self.MAC_ADDRESS:
            for (adtype, desc, value) in dev.getScanData():
                if (adtype == 22):
                    servicedata: bytes = binascii.unhexlify(value[4:])
                    humidity: int = servicedata[5] & 0b01111111
                    print('humidity: ' + str(humidity))

if __name__ == '__main__':
    scanner = Scanner().withDelegate(ScanDelegate())
    scanner.scan(0)
```

### 部屋の照明を点滅させる
事前準備として、部屋の照明を Nature Remo に登録しておく。照明を操作するには [Nature Could API](https://swagger.nature.global/) を利用することもできるが、こちらも Rate Limit (30 requests/5 min, 10 秒に一回程度) が存在する。照明の点滅が 10 秒おきでは嫌がらせとして少々迫力に欠けるので、今回はサーバを介さずに [Local API](https://local-swagger.nature.global/) の方を使うことにした。使用方法については [こちらの記事](https://blog.yuu26.com/nature-remo-local-api/) を参考にさせていただいた。

**リクエストの送信先を指定**

Local API の利用には Nature Remo のプライベート IP アドレスが必要であるため、ルータの管理画面 (Baffalo の場合は [こちら](https://www.buffalo.jp/support/faq/detail/129.html)) から調べる必要がある。ついでにプライベート IP の固定もしてしまおう。

**Local API で Nature Remo と通信**

直前にリモコンを用いて Remo に向けて当該信号を送っておき、

```console
curl http://<private IP>/messages -H "X-Requested-With: local"
```

と叩くと JSON が返ってくる。赤外線信号を送信するには、返ってきたものをそのまま POST すればよい。

```python
class Light():
    def __init__(self) -> None:
        self.headers: dict = {
            'X-Requested-With': 'local',
        }
        self.data: str = '{"format":"us","freq":38,"data":[3397, ...]}'

    def switch(self) -> None:
        requests.post('http://<private IP>/messages', headers=self.headers, data=self.data)
```

## 定時実行
あとはこれを毎朝 6 時に実行させればよいだけである。BLE の scan には sudo 権限が必要であるため、`crontab -e` で以下を登録しておく。

```console
PATH=/home/pi/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
0 6 * * * sudo /usr/local/bin/python3.10 $HOME/take-a-bath.py
```

最終的なコードは以下の通り。

```python
import datetime
import requests
import binascii
from bluepy.btle import Scanner, DefaultDelegate
import sys


class Light():
    def __init__(self) -> None:
        self.headers: dict = {
            'X-Requested-With': 'local',
        }
        self.data: str = '{"format":"us","freq":38,"data":[3397, ...]}'

    def switch(self) -> None:
        requests.post('http://<private IP>/messages', headers=self.headers, data=self.data)


class ScanDelegate(DefaultDelegate):
    def __init__(self) -> None:
        self.MAC_ADDRESS: str = 'xx:xx:xx:xx:xx:xx' # lower case
        self.light = Light()
        DefaultDelegate.__init__(self)

    def handleDiscovery(self, dev, isNewDev, isNewData) -> None:
        if dev.addr == self.MAC_ADDRESS:
            for (adtype, desc, value) in dev.getScanData():
                if (adtype == 22):
                    servicedata: bytes = binascii.unhexlify(value[4:])
                    humidity: int = servicedata[5] & 0b01111111
                    print(datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'), str(humidity))
                    if humidity < 50:
                        self.light.switch()
                    else:
                        sys.exit()


if __name__ == '__main__':
    scanner = Scanner().withDelegate(ScanDelegate())
    scanner.scan(0)
```
{: file="take-a-bath.py" }

## 感想
実際にこの嫌がらせの被害に遭ってみると、特に冬場まだ陽が出ていない時間帯は明暗の差が激しいので特にきついということを身をもって体感した。とりあえず寝室 (ワンルームなので実質浴室と居間しかないのだが) から逃げ出したくなるので、朝とりあえず目覚めたはいいものの布団から出られずベッドでだらだらスマホをいじってしまうといった事態の防止にもなり一石二鳥であった。今後暇があったら以下の機能も追加したい。

- 夜間勤務の影響で朝 6 時に不在の場合への対応
- (あまりないだろうが) 朝 5 時ごろに入浴を済ませてしまい、6 時にはすでに湿度が低下していた場合の対策