---
layout: post
title: ポモドーロ変法タイマーの実装 (2)
date: 2023-02-01
categories: [Technology, Web]
tags: [JavaScript, Python, Product, Pomodoro]
---

## 動機

[前回記事](https://ternbusty.github.io/posts/modified-pomodoro-1.html) ではブラウザ上で動くポモドーロ変法 (筆者が勝手に命名した) を実装したわけだが、末尾に課題として記したように

- 端末自体がスリープされるとカウントダウン自体がストップしてしまう
- 休憩可能時間をオーバーした際、アラームが鳴っていたとしても離席中やそもそもブラウザを開いていないタイミングでは気づくことができない

という問題が残っていた。本稿では上記の点の改善として、

- ブラウザ上でタイマーを管理するのをやめ、家で常時電源に接続されている RaspberryPi で動作させるようにする
- 休憩可能時間をオーバーした際、スマートフォンに電話がかかってくるようにする。一定時間 (今回は 90 秒) 経過してもまだ休憩している際は繰り返し電話をかける

ことにより解決をはかることにした。これにより、ダラダラしている (つまり、休んでいい時間を超過して休んでしまっている) と「はやくなんかしろ」という意味を込めた戒めの鬼電が 90 秒おきにかかってくるようになるわけである。完成したものは [こちら](https://github.com/ternbusty/pomodoro)。

## 方法

### タイマーを RaspberryPi 上に移植する
- まずはタイマーそのものをバックエンドで動かすことにした。フレームワークはなんでもよかったのだけど、個人的に興味のあった FastAPI と、フロントエンドは前回のコードを流用し生 JavaScript で書いた。
- タイマーの残り時間やタスクの履歴はすべてバックエンドで管理する方針とした。一応タイマーなのでフロントエンドの方では 1 秒おきに表示を更新したいものの、バックエンドに対して 1 秒おきにリクエストを送って同期するのもそれはそれでどうなんだというところではある (いいアイデアがあったら誰か教えてください)。結局、フロントエンドの方では前回記事同様自律的に ticktock してタイマーが動いている雰囲気を出していただき、適宜バックエンドと同期して表示を更新するような実装になった。
- FastAPI さんが自動生成してくれた document を以下に載せておく。

![fastapi](../../assets/img/pomodoro2/fastapi.png)

- 状態の取得
  - タイマーの状態 (status) は not_started, work, break, finished, pause の 5 種類とし、タイマーの残り時間やタスクの名前も合わせて `/status/` で取得できるようにした。
  - 休憩タイマーが負の値になっている (つまり、休憩可能時間を過ぎて休憩してしまっている) 状態を `lazy` と定義し、`/is_lazy/` で lazy かどうかの bool を返す方針とした。
  - 食事休憩を考慮して `Take a 30 min break` というボタンをフロントエンド側で用意しているのだが、むやみに押されると困るので、一度実行されたら 6 時間は `can_take_long_break` が偽を返すようにしておいた。長い休憩を取ろうとした際にこれが偽だと拒否される設計。
- タイマーの操作
  - `PUT` を用いてタイマーの status を切り替えるようにした。これ `PUT` でよかったのか？
  - 普通に while 文とかを用いて ticktock させる処理を書くと、タイマーをスタートさせる `start` への応答が終了していないとみなされてハングしまうため、以下のように background で動作させる方針とした。

    ```python
    @app.put("/start/")
    async def start(background_tasks: BackgroundTasks, break_time: int = 0) -> None:
        background_tasks.add_task(timer.main, break_time)
    ```

  - 既にタイマーが動作している状態で `start` へアクセスされるとバックグラウンドタスクが二重に起動して時間が二倍の速さで進むようになるため、`start` へのアクセスがあった場合はタイマーの status を確認し、既に動作しているときは無視する方針とした。
  - 外出などで一時的にタイマーを止めたいとき用に `pause` メソッドも用意しておいた。 

- 以上を実装したうえで、FastAPI を RaspberryPi 上で起動しておく。リクエストが失敗したときそれを伝える応答も何も用意しておらず API の設計としてやばすぎるが、とりあえず動く用にはなった。

  ```bash
  uvicorn main:app --reload --host 0.0.0.0 --port 8080
  ```

### 休憩時間が負の値になったとき自分に電話をかける
- 長く休憩しすぎている (lazy) であることを自分に気づかせるためにはスマートフォンへ何らかの通知をすることが有効であると考えられ、今回は一番鬱陶しいであろう着信でそれを実現することにした。当初は [Twilio](https://www.twilio.com/ja/) を用いて自分の電話番号へ発信することを考えていたが、別に通話がしたいわけでもないのに課金するのもなあという気分になったので、VoIP を実装しておりかつ API を公開している無料のサービスを探すことにした。
- この用途にはこちらの [API 経由で Telegram Voice Call するサービス](https://www.callmebot.com/telegram-call-api/) がぴったりであった。Telegram のアプリをスマートフォンにインストールしたうえで、CallMeBot を Telegram アカウントで認証すると、ユーザー名を用いてコマンドラインから当該ユーザに Voice Call できるようになる。Reference に明文化されてはいないが、おおよそ 90 秒に一回という API 制限がある模様であった。今回は、90 秒後にもまだ lazy な場合は再度電話を掛けるようにした。

  ```bash
  curl "https://api.callmebot.com/start.php?source=auth&user=@username&text=Back+to+work!!&lang=en-US-Standard-B"
  ```

- 上記をそのまま同期処理で行う Python スクリプト内で呼び出すと、電話に対してユーザ (筆者) が応答あるいは拒否するまで Response がないとみなされ処理が終了せず、ticktock がストップするという問題が発生した。これを回避するため、以下のように `thread` を分けることにより解決した。

  ```python
  if self.break_timer % 90 == 0:
      try:
          thread = threading.Thread(target=self.utils.call_me, name="callMe")
          thread.start()
      except BaseException:
          print("Failed to call me")
  ```

## 今後の課題
タイマーで lazy 判定されていれば自分に鬼電をかけられるとはいえ、
- 根本的な話になるが、タイマーの status を work にしたままダラダラされたら今回の試みは何の意味もなさなくなる。これについては、例えば status が work になっている場合は (ダラダラする元凶であるところの) SNS の閲覧をできないようにするなどの制限が有効かもしれない。
- そもそもタイマーを作動させるのを怠ったら終わりである。帰宅したら自動的に、あるいは何らか自然な方法でタイマーをスタートさせる仕組みが必要と考えられる。これには以前構築した [Wi-Fi 打刻システムの構築](https://ternbusty.github.io/posts/wifi-checkin.html) を利用できるかもしれない。
