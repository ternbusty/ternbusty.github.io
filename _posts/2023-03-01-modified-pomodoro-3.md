---
layout: post
title: ポモドーロ変法タイマーの実装 (3)
date: 2023-03-01
categories: [Technology, Web]
tags: [JavaScript, Python, Product, Pomodoro]
---

## 動機

[前回記事](https://ternbusty.github.io/posts/modified-pomodoro-2.html) では、ポモドーロタイマーを家の Raspberry Pi で作動させるようにしたうえで、休憩を長く取りすぎていると鬼電がかかってくるようにした。今回は、前回記事に課題として記した

- タイマーを work モードにしたまま、SNS を閲覧するなど怠惰な時間を過ごしてしまう
- そもそもタイマーを開始するのを忘れる

の 2 点を解決していく。具体的には、

- タイマーで休憩中になっているタイミング以外は、Windows PC やスマートフォンで Twitter や Discord を閲覧できないようにする
- 帰宅 or 起床したタイミングでタイマーをスタートさせ、外出 or 就寝するタイミングでタイマーをストップさせる

機能を追加することとする。

## 方法

### 休憩中以外には Twitter と Discord を閲覧できないようにする
PC と iPhone 上で適宜タイマーの状態を取得し、SNS 閲覧不可と判定された場合は閲覧制限を発動、可能と判定された場合は制限を解除する方針とした。SNS を閲覧してよい条件は、`is_lazy` が False であり、かつタイマーの status が `break` である場合に限定することとした。

**PC で Twitter と Discord の閲覧制限をかける**

これについては、以前 [別の場所](https://i-was-a-ki.hatenablog.com/entry/2020/10/09/201702) で書いたように firewall を弄ることにより実現可能である。つまり、Twitter の Net Range 104.244.40.0 - 104.144.46.255 と Discord の Net Range 162.158.0.0 - 162.159.255.255 をブロックすればいいわけである。まずは、Windows の firewall 設定を開き、[この記事](https://www.harukas.org/blog/884/) の要領で新しい規則を設定する。

![firewall](../../assets/img/pomodoro3/firewall.png)

次に、この規則を自動で ON/OFF する Python スクリプトで書く。管理者権限で実行する必要があることに注意が必要。

{:file="block_twitter_discord.py"}
```python
import requests
import json
import subprocess
import sys

POMODORO_URL = "http://192.168.11.11:8080/"

def get_status() -> str:
    try:
        res: requests.models.Response = requests.get(POMODORO_URL + "status/")
        status: str = json.loads(res.text)["status"]
        return status
    except BaseException:
        return "Something is wrong"

def is_lazy() -> bool:
    try:
        is_lazy_str: str = requests.get(POMODORO_URL + "is_lazy/")
        is_lazy_bool: bool = True if is_lazy_str == "true" else False
        return is_lazy_bool
    except BaseException:
        return True

def block_twitter() -> None:
    subprocess.run(["netsh", "advfirewall", "firewall", "set", "rule",
                    "name=block_twitter", "new", "enable=Yes"])

def unblock_twitter() -> None:
    subprocess.run(["netsh", "advfirewall", "firewall", "set", "rule",
                    "name=block_twitter", "new", "enable=No"])

if __name__ == "__main__":
    status: str = get_status()

    if status == "break":
        if not is_lazy():
            print("You can use Twitter!")
            unblock_twitter()
            sys.exit()
    block_twitter()
```

次に、上記のスクリプトが 1 分おきに実行されるようにタスクスケジューラを設定する。特に工夫をしないと 1 分おきにコマンドプロンプトの黒いウィンドウが出現するようになり非常に鬱陶しいので、[この記事](https://qiita.com/trumpet_developer/items/cf7b8cb0981bdcab6c20) を参考に Python スクリプトを走らせるバッチを作成し、さらにそれを VBScript から実行させることにより解決した。

{:file="block_twitter_discord.bat"}
```
C:/Users/ternbusty/AppData/Local/Programs/Python/Python310/python.EXE E:/Dropbox/sandbox/block_twitter_discord.py
```

{:file="DoTaskBatch.vbs"}
```vb
Set ws = CreateObject("Wscript.Shell")
ws.run "cmd /c " & Wscript.Arguments(0), vbhide
```
![task](../../assets/img/pomodoro3/task.png)

**iPhone で Twitter と Discord の閲覧制限をかける**

私の知る限り、iOS 上で直接 firewall を弄る機能は提供されていない。そのため、iOS のオートメーション機能をフル活用し、Twitter と Discord 2 つのネイティブアプリケーションに利用制限をかけることにした。つまり、

- トリガー: 2 つのアプリのいずれかが開かれたとき
- アクション: 家の Wi-Fi につながっており、かつタイマー上休憩をしてはならない時間帯と判定された場合は、自動的に他のアプリケーション (ToDo リストアプリなど) にリダイレクト (+ タイマーが止まっていればスタート) させる。

ようにした。こんなのがノーコードでできるんだからよい時代である。

![automation](../../assets/img/pomodoro3/automation.png)

### 適切なタイミングでタイマーをスタートさせる

**帰宅を検知して自動でタイマーをスタートさせる**

おそらく一番楽なのは、iPhone のオートメーション機能で「Wi-Fi に接続したとき」をトリガーにすることだが、携帯を引っ張り出しロックを解除し通知をわざわざタップして……というのはあまりに面倒すぎる。他の解決策としては、以下のものを考えた。

1. 帰宅や出勤時に押せるような IoT ボタンを玄関に設置する
2. 以前作成した [Wi-Fi 打刻システム](https://ternbusty.github.io/posts/wifi-checkin.html) を利用する

このうち 1 については試しにやってみて概ねうまく行くことが分かった (別記事参照)。が、今回使用したダイソーの Bluetooth Shutter は 60 秒程度でスリープに入ることが知られており、ボタンをトリガーとして何らかの動作を実現させるには、まず適当なボタンを押してから 5 秒ほどあけて再度押下するというかなりエレガントさに欠ける動作をしなくてはならない。照明の消灯 / 点灯と組み合わせることによってボタンを押すモチベーションを保とうともしてみたが、この動作を外出と帰宅の度に繰り返すのはさすがにやってられんという結論に達した。

以上より、今回は 2 の方法を採用することとした。具体的には、[この記事](https://ternbusty.github.io/posts/wifi-checkin.html) で書いたスクリプトを編集し、iPhone が Wi-Fi に接続されたタイミングで `/start/` を、接続が切れたタイミングで `/pause/` を叩くように改変し、無事所望の動作が実現できるようになった。

```python
if file_exist:
   if self.status != 'in':
       send_to_slack(f':arrow_right: in: {dt_str}')
       self.status = 'in'
       try:
           requests.put("http://localhost:8080/start/?break_time=900")
       except:
           print("Cannot restart timer")
else:
   if self.status != 'out':
       send_to_slack(f':arrow_left: out: {dt_str}')
       self.status = 'out'
       try:
           requests.put("http://localhost:8080/pause/")
       except:
           print("Cannot pause timer")
```

**起床後すぐにタイマーをスタートさせる**

起床そのものを検知するのはウェアラブルモニタでも着けていないかぎり不可能である。ここでは、起きてすぐ時刻の確認ついでにまず SNS をチェックする癖があることを利用して「家の Wi-Fi につながっており、かつタイマーがスタートしていない状態で Twitter あるいは Discord を開く」を起床の定義とした。前節でこれはすでに実装済みであるため、起床と概ね同時にタイマーをスタートさせることが可能となった。

## 今後の課題

今回の実装で、家の中にいる際の動作については満足のいくものを作ることができた。今後改善が必要なのは外出時における操作である。本プロダクトはプライベートネットワーク上の HTTP 通信を用いてタイマーの起動やモードの切り替えを行っているため、当然勤務先でタイマーを使うことはできない。そればかりか、この間はうっかりタイマーを break モードのまま止め忘れて外出したせいで lazy モードに突入し、外出先で CallMeBot から繰り返し電話がかかってくるという致命的な事態が発生した (外出は 5 分以内に検知され pause されるものの、それでも誤作動すると厄介である)。

家のネットワーク以外からでもタイマーの操作ができるようにする方法としては、
- 家に VPN サーバを立てて公開することにより、外出先からプライベートネットワークにアクセスする。まず VPN に対応したルータを買い、グローバル IP アドレスを固定し、ポートを開け、セキュリティ対策をし……となると、勉強にはなりそうだがコストとリスクがすごそうだなという印象。
- [remote.it](https://www.remote.it/) の [Persistent Public URL](https://www.remote.it/resources/persistent-url) を利用する。これにより、`192.168.11.11` の代わりに、ランダムな文字列を含む不変の public URL でアクセスができるようになる。このまま放置すると当然 URL を知っている他人から私の作業履歴が見えたりタイマーを操作されたりといった事態が発生するので、何らかの方法でアクセス制限をかけたいところ。せっかく FastAPI を使っていることだし、自分しか認証しない OAuth2 とか導入してみるのもいいかも？

くらいだろうか。物理出社が増えてきたタイミングで実装を検討したい。
