---
layout: post
title: 自宅の Raspberry Pi で立てているサービスを Cloudflare Zero Trust で公開する
date: 2023-04-01
categories: [Technology, Network]
tags: [Network, Product, Pomodoro]
---

## 動機

[前回記事](https://ternbusty.github.io/posts/modified-pomodoro-3.html) までで、自宅鯖で動く生活管理用のタイマーを完成させることができた。末尾に記したように外出先からアクセスできないという問題点があるため、Raspberry Pi の local で動かしているサービスを外部に公開できないかと考えていた。

<center>
<blockquote class="twitter-tweet" data-lang="en"><p lang="en" dir="ltr"></p><a href="https://twitter.com/furifuri_mono/status/1654307579852648448?s=46&t=-BScNIPEluMnICOKhdlAWQ">May 5, 2023</a></blockquote>
<script async="" src="//platform.twitter.com/widgets.js" charset="utf-8"></script>
</center>

IP アドレス固定するのとかポートフォワーディングするのとか大変だしリスクも高いしなあ～と思ってダラダラ Twitter を見ていたら上記が流れてきたので、今回は Cloudflare Zero Trust を使って自宅鯖のサービス公開を試してみることとする。

## CloudFlare Zero Trust とは

[CloudFlare Zero Trust](https://www.cloudflare.com/ja-jp/zero-trust/products/) は、CloudFlare が提供するゼロトラスト型のアクセス制御サービスであり、クラウド型の VPN サービスとして用いることができる。ローカルに立てたサーバに tunnel を導入することによって、インターネット側からアクセスできるようにする ngrok 的なものである。公式サイトの画像が分かりやすい。

![image](https://developers.cloudflare.com/assets/handshake-dc58ec8d.jpg)


さらに、単なるクラウド VPN サービスと違って Cloudflare Access を用いたアクセス制御が可能であるため、ユーザーごとにアクセスできるサービスを制限することができる。今回やりたいことは以下のような感じ。

- RaspberryPi 上で cloudflared を用いて tunnel を作成。ローカルで動いているサービスにインターネットからアクセスできるようにする。
- このままでは全世界の誰でもアクセスできてしまうので、Cloudflare Access を用いてアクセス制御を行う。具体的には、Google を Identity Provider として、自分の Google アカウントでログインしている人しかアクセスできないようにする。

大体公式 Ref の手順に従えばよいが、以下ログ的に今回の作業の流れをまとめておく。

## Cloudflare の事前準備

まず Cloudflare にログインしたうえで、Zero Trust の Free Plan に申し込む。ユーザ 50 人までは無料で利用できるらしい、慈善事業か？

### Cloudflare の Domain Registration

まず Cloudflare にログインしたうえでダッシュボードの「Domain Registration」から、自分のドメインを登録する必要がある。Cloudflare Zero Trust では、例えば `hoge.com` というドメインを持っていた場合、サービスは `test.hoge.com` というようにサブドメインを用いて公開することになるため、Cloudflare の DNS に登録できるドメインを用意する必要がある。

他サービスで取得したドメインの DNS 設定を Cloudflare に移行しようとするとなかなか大変であるが ([こちら](https://qiita.com/echikara/items/c8e95733609c1f8dd51e) を参照)、このあたりの作業はそもそも Cloudflare Register でドメインを新規取得することで大幅に楽になる。今回はちょうど `ternbusty.com` を取っておきたかったこともあり、潔く新規登録することにした。


## Raspeberry Pi の設定

まず Cloudflared のインストール & ログイン。このあたりの一連の手順については [公式 Ref](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/local/) を参照。

```bash
wget https://github.com/cloudflare/cloudflared/releases/download/2023.5.0/cloudflared-linux-armhf.deb
sudo apt install ./cloudflared-linux-armhf.deb
cloudflared tunnel login
```

適当な名前 (ここでは test) のトンネルを作成。標準出力される credentials file のパス名を控えておく。また、list コマンドを用いて tunnel ID を確認しておく。

```bash
cloudflared tunnel create test
cloudflared tunnel list
```

次に、控えておいた tunnel ID を用いて `~/.cloudflared/config.yml` を以下のように編集する。今回は `http://localhost:3000` を `test.ternbusty.com` に公開するので以下のようになる。`ingress` ルールについては [こちら](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/local/local-management/ingress/) を参照。hostname と service の組を複数記載し、同じサーバ上で動いている別のサービスを一緒にマッピングすることもできる。

```yaml
tunnel: xxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxxx
credentials-file: /home/ternbusty/.cloudflared/xxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxxx.json

ingress:
  - hostname: test.ternbusty.com
    service: http://localhost:3000
  - service: http_status:404
```

続いて DNS の設定を行う。`cloudflared tunnel route dns <UUID or NAME> <hostname>` のようにすれば サブドメイン test について CNAME が設定される。コマンド実行後、Cloudflare のダッシュボードにある DNS -> Records を見ると、CNAME として test が追加されたのが確認できる。

```bash
cloudflared tunnel route dns test test
```

最後に実行。これにより、`test.ternbusty.com` にアクセスできるようになる。

```bash
cloudflared tunnel run test
```

## Cloudflare Access の設定

### Google でのログインを追加

このままでは全人類にアクセスされてしまうので、Cloudflare Access を用いてアクセス制御を行う。基本的には [公式 Ref](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/google/) に従えばよい。まずは Google の方の設定から。

- GCP を開いて新規プロジェクトを作成。APIs & Services -> Credentials -> Configure Consent Screen で各種設定を行う。User Type は External にしておく。
- APIs & Services -> Credentials -> Create Credentials -> OAuth Client ID で OAuth Client ID を作成する
  - Application Type: Web Application
  - Authorized JavaScript origins: 今回は `https://ternbusty.com`
  - Authorized redirect URIs: 今回は `https://ternbusty.cloudflareaccess.com/cdn-cgi/access/callback`

続いて、Cloudflare 側の設定を行う。Zero Trust -> Setting -> Authentication -> Login methods -> Add new から Google を選択し、先ほど作成した App ID と Client secret を入力する。これで Google アカウントでのログインができるようになる。

### Application の設定

Zero Trust -> Access -> Applications -> Add an application から新規アプリケーションを作成する。今回は Raspberry Pi 上で動いているサービスを `test.ternbusty.com` というサブドメインで公開するので、以下のように設定する。

- Select type
  - Application type: Self-hosted を選択

- Configure app
  - Application name, Session Duration: 任意に設定
  - Application domain: `test.ternbusty.com` を指定する。Domain は Cloudflare の DNS に登録されているものをプルダウンで選ぶ形式。
  - Enable App in App Launcher: Disable
  - Identity providers: Accept all available providers を無効にし、Google のみを指定

- Add policies
  - Policy name は任意に設定。Action は Allow としておく。
  - Configure rules は Emails を選択したうえで、Value には自分の Google アカウントのメールアドレスを入力する。

以上の設定を終えたうえで `test.ternbusty.com` にアクセスしてみると、以下のようにログイン画面が表示される。いい感じ。

![overview](../../assets/img/cloudflare/login.png)

ここで自分のアカウントでログインしてみると当然サービスが利用できるし、試しに別垢でログインを試みたところ「That account does not have access」と表示されて失敗する。やったね！

## トラブルシューティング

- `cloudflared tunnel run` した際に `failed to sufficiently increase receive buffer size.` が表示される問題。これについては、リンク先の instruction 通り buffer size を増やせばよい。

```bash
sudo sysctl -w net.core.rmem_max=2500000
```

- 同じく `cloudflared tunnel run` した際に `Incoming request ended abruptly: context canceled` が大量発生する問題。要はタイムアウトしているということだと思うが、手元の環境では実行時に IPv6 を指定することで改善した。

```bash
cloudflared tunnel --edge-ip-version 6 run test
```

## 感想
今回、Cloudflare zero trust を利用することによって、自宅鯖それ自体を外部に公開することなくインターネットから利用し、さらに Google アカウントを用いたアクセス制御を行うことができた。Cloudflare Zero Trust はユーザ数が 1 人なので無料プランのままで利用できるし、かかっているコストは Cloudflare で新規取得したドメインの料金くらいである (これに関してはもともと取りたかったドメインだし、年間 1400 円くらいなので別にいいかな)。

自宅鯖で動かしている自分用のサービス (今回の例では自分用タイマー、冒頭の例では Grafana) にインターネットからアクセスしたい場合 Cloudflare zero trust はかなり有力な選択肢と考えられる。今後もインターネットから利用したいサービスを自作した場合は積極的に利用していきたい。
