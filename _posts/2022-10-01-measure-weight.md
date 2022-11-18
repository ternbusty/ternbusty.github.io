---
layout: post
title: IoT を使って毎朝体重を測らざるを得ないようにする
date: 2022-10-01
categories: [Technology, IoT]
tags: [Python, Raspberry Pi, Product]
---

## 概要

外食続きであった出張から帰京し、一カ月ぶりに恐る恐る乗った体重計にはびっくりするような値が表示されていた。体重計を乗り降りして何度か測り直してみたものの値は変わらず……というわけで、出張前の体重に戻すまでは嫌々ながらも毎朝体重計に乗って現実と向き合うこととした。いわゆるレコーディングダイエットというやつである。

普通に考えてこんな精神的負荷を伴う行為を習慣づけられるはずがないので、今回も [前回](https://ternbusty.github.io/posts/take-a-bath/) と同様「体重計に乗らないとめちゃくちゃ嫌なことが起こる」方式での動機付けを行うこととした。具体的には「**体重計に乗らない限り、心停止のときに作動するアラーム音が延々と鳴り続ける**」システムを構築していこうと思う。

## 方針

まず「心停止のときに作動するアラーム音」というものがどんなものがご存じない方もいらっしゃると思うので聞いていただくとしよう。下記動画の 10 分ごろから流れているものである。

<iframe width="560" height="315" class="youtube" src="https://www.youtube.com/embed/IKfJOQkzVNU?start=601" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen ></iframe>

実際の臨床現場では救急外来やスタッフステーションなどでこのアラームを聞く機会が多い。心停止が起こるとダッシュで駆けつけて心マなどをしなければならないため、いかに眠い当直中であってもこれが耳に入ると一瞬で目が覚め、いてもたってもいられなくなるのが職業病というものである。今回はこれをフル活用して、一刻も早く体重を測らねばという気持ちになるようにしたい。

実装の概略を以下に示す。体重の計測はこちらの [Withings Body](https://www.withings.com/jp/ja/body) を使って行う。いわゆるスマート体重計というやつなので、計測した体重が自動的に Withings のサーバに送信されるようになっており、さらに API 経由で計測データにアクセスすることもできる。

![roadmap](../../assets/img/measure-weight/roadmap.png)

実装としては、Raspberry Pi 上でスマート体重計 (Withings) の API を 3 秒おきに叩き、その日の体重データが取得できるようになるまで心停止アラーム (mp3 ファイル) を再生し続ける、という方針で進めていく。

## 実装

### Withings API を用いたデータの取得

まずは、Withings のサーバへアップロードされたデータに Raspberry Pi からアクセスしてみよう。Withings API は一般的な OAuth2 アプリケーションと同様、以下のように利用できる。

まずは [ここ](https://developer.withings.com/) にアクセスして developer 登録を行い、Client ID と secret を取得したのち以下の URL にアクセスする。

```
https://account.withings.com/oauth2_user/authorize2?response_type=code&client_id=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&scope=user.metrics&redirect_uri=http://localhost:8000/&state=dev
```

ブラウザで認証を行い、リダイレクトされた URL の中から code を抽出。以下に code を埋め込んで実行する。

```bash
curl --data "action=requesttoken&grant_type=authorization_code&client_id=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&client_secret=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&code=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&redirect_uri=http://localhost:8000/" 'https://wbsapi.withings.net/v2/oauth2'
```

これの応答から得られた access_token を Bearer として渡すと、体重データを取得できるようになる。

```bash
curl --header "Authorization: Bearer xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" --data "action=getmeas" 'https://wbsapi.withings.net/measure'
```

access_token は 3 時間で失効するので注意。そのため、[これ](https://developer.withings.com/api-reference#operation/oauth2-refreshaccesstoken) を叩いて access_token と refresh_token を更新する必要がある。

### Raspberry Pi から心電図アラームを再生する

Raspberry Pi からオーディオを再生する方法はいろいろあるが、今回は python-vlc を用いる。

```bash
sudo pip3 install python-vlc
```

Raspberry Pi 自体にはスピーカーがついていないので、何かしら外付けのものを用意する必要がある。今回は音が鳴りさえすればええやろと思いとりあえずダイソーへ行ってみたところ、小型の Bluetooth スピーカーが 700 円という高いんだか安いんだか分からん値段で売っていたのでこれを使うことにした。CUI から Bluetooth 接続する方法については [こちら](https://hymd3a.hatenablog.com/entry/2022/01/22/211335) を参照 (ちなみにダイソーで買ったスピーカーは LBS と表示されていた)。

これを用いると、以下のような Python スクリプトでオーディオが再生できるようになる。

```python
from time import sleep
import vlc

if __name__ == '__main__':
    p = vlc.MediaPlayer()
    p.set_mrl('/home/ternbusty/withings/output.mp3')
    p.play()
    sleep(3)
    p.stop()
```

### Cron による定時実行

以上をまとめると、上記の条件を満たす Python スクリプトは以下のようになる。

{: file="withings.py"}
```python
import requests
import json
import datetime
from time import sleep
import vlc

class WeightGetter():
    def __init__(self) -> None:
        today: datetime.date = datetime.date.today()
        self.today_ts = int(datetime.datetime(today.year, today.month, today.day, 0, 0).timestamp())
        self.config_file_path = '/home/ternbusty/withings/config.json'
        with open(self.config_file_path, 'r') as f:
            self.config = json.load(f)

    def refresh_tokens(self) -> None:
        data: dict = {
            'action': 'requesttoken',
            'grant_type': 'refresh_token',
            'client_id': self.config['client_id'],
            'client_secret': self.config['consumer_secret'],
            'refresh_token': self.config['refresh_token'],
        }
        response: requests.Response = requests.post('https://wbsapi.withings.net/v2/oauth2', data=data)
        res_dict: dict = json.loads(response.text)
        self.config['access_token'] = res_dict['body']['access_token']
        self.config['refresh_token'] = res_dict['body']['refresh_token']
        with open(self.config_file_path, 'w') as f:
            json.dump(self.config, f)

    def get_weight(self):
        headers: dict = {'Authorization': f'Bearer {self.config["access_token"]}'}
        data: dict = {
            'action': 'getmeas',
            'meastype': 1,
            'startdate': self.today_ts}
        response: requests.Response = requests.post('https://wbsapi.withings.net/measure', headers=headers, data=data)
        res_dict: dict = json.loads(response.text)
        if res_dict['status'] == 401:
            self.refresh_tokens()
            return self.get_weight()
        return res_dict

if __name__ == '__main__':
    p = vlc.MediaPlayer()
    p.set_mrl('/home/ternbusty/withings/output.mp3')
    p.play()

    wg = WeightGetter()
    measure_today: dict = []
    while len(measure_today) == 0:
        res_dict = wg.get_weight()
        measure_today = res_dict['body']['measuregrps']
        print(datetime.datetime.now())
        sleep(3)
    else:
        p.stop()
        print('measured!')
```

これを crontab に登録して毎朝実行してみようとしたものの、なぜか音が鳴らない現象が発生したので [これ](https://stackoverflow.com/questions/42497130/audio-doesnt-play-with-crontab-on-raspberry-pi) のベストアンサーを用いて解決した。 以下の通り `XDG_RUNTIME_DIR` を指定したうえで、crontab を登録したところ定時実行に成功した。

```bash
XDG_RUNTIME_DIR=/run/user/1000
PATH=/home/pi/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
5 6 * * * /usr/bin/python $HOME/withings/withings.py
```

## 課題と感想

実際にこの心電図アラーム大音量攻撃に遭ってみると、自分で考えたとはいえ普通にやめてくれ～という気持ちになった。さらに、単に毎朝体重を測るようになるだけでなく、少しでも小さい値を出そうととりあえず着ている服を全部脱ぐので、そのままスムーズに入浴できるようになることも分かった。結果的に、10 日間で 2kg の減量にも成功した (やったね！)

課題としては、体重を測定してからアラームが止まるので 30 秒程度かかることである (Withings API の仕様によるものなのでこちらにはどうしようもない)。これを本当になんとかしようとするなら、体重取得の判定を Withings API に依存するのではなく、体重計の下に圧センサでも敷いておいて、体重計に乗ったかどうかを判定するようにするのがよいのかもしれない。

<style/>
.youtube {
  display: block;
  margin: 0 auto;
  margin-bottom: 20px;	
  max-width: 100%;
}
</style>