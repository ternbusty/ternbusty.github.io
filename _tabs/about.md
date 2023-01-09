---
title: About
icon: fas fa-info-circle
order: 5
---

## Work experience

| Duration        | Company              | Position             | Programming Language                                                                                  |
| :-------------- | :------------------- | :------------------- | :---------------------------------------------------------------------------------------------------- |
| 2021.4-         | (Somewhere in Tokyo) | Resident doctor      | -                                                                                                     |
| 2020.5 - 2021.3 | RIKEN                | Part-time researcher | <span class="language-tag my-orange">Python</span> <span class="language-tag my-blue">R</span>        |
| 2018.9 - 2021.3 | Quadlytics Inc.      | Part-time researcher | <span class="language-tag my-orange">Python</span>                                                    |
| 2018.3 - 2019.3 | CO-CONV, Corp.       | Cooperate enginner   | <span class="language-tag my-purple">JavaScript</span> <span class="language-tag my-brown">PHP</span> |

## Skills & Activities

- Interested in applications of machine-learning algorithm to medicine, low-level programming, network, IoT and automation.

- Programming languages

  - Competitive programming: <span class="language-tag my-red">C++</span>
  - Research: <span class="language-tag my-red">C++</span> <span class="language-tag my-orange">Python</span> <span class="language-tag my-blue">R</span>
  - Automation: <span class="language-tag my-orange">Python</span> <span class="language-tag my-purple">JavaScript</span>

- Contribution to OSS

  - [cotes2020/jekyll-theme-chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) <span class="language-tag my-moegi">CSS</span>

- Other activities

  - Joined [Google STEP program](https://buildyourfuture.withgoogle.com/programs/step/) 2020 ([repository](https://github.com/ternbusty/STEP)) <span class="language-tag my-red">C++</span> <span class="language-tag my-orange">Python</span>

## Research experience

### Honors and awards

- JSAI Annual Conference Student Incentive Award (2019)

### Publications

- **Iwasaki A**, Fujiwara K, Nakayama C, et al. R-R interval-based sleep apnea screening by a recurrent neural network in a large clinical polysomnography dataset. Clinical Neurophysiology. 2022
- **Iwasaki A**, Nakayama C, Fujiwara K, et al. Screening of sleep apnea based on heart rate variability and long short-term memory. Sleep Breath. 2021.
- Okada D, Nakamura N, Wada T, **Iwasaki A** and Yamada R, Extension of Sinkhorn Method: Optimal Movement Estimation of Agents Moving at Constant Velocity, Transactions of the Japanese Society for Artificial Intelligence Vol.34 No.5 pp D-J13 1-7, 2019

### Oral presentations

- **岩崎** ら, 長期短期記憶と心拍変動に基づく睡眠時無呼吸症候群のスクリーニング, 人工知能学会全国大会, 2019
- **Iwasaki A**, Nakayama C, Fujiwara K, et al. , Development of a Sleep Apnea Detection Algorithm Using Long Short-Term Memory and Heart Rate Variability, IEEE EMBC 2019, 2019
- **岩崎**, AI 技術をどのように循環器診療に役立たせるか, 第 84 回日本循環器学会学術集会, 2020
- **岩崎** ら, 頸部痛を契機に診断を見直された強直性脊椎炎の一例, 第 676 回日本内科学会関東地方会

### Poster presentations

- **Iwasaki A**, Nakayama C, Hori K, et al, Development and Validation of a Sleep Apnea Syndrome Screening Algorithm Using Heart Rate Variability and Long Short-Term Memory, European Sleep Research Society, 2020

## Products

### 低レイヤ関連

**[Jack 言語のアセンブラ・コンパイラ自作](https://ternbusty.github.io/tags/nand2tetris/,)** <span class="language-tag my-orange">Python</span> <span class="language-tag my-gray">Assembly</span>
- [コンピュータシステムの理論と実装](https://www.oreilly.co.jp/books/9784873117126/) を参考に、Python を用いて実装した
- アセンブラ・コンパイラが動作するアーキテクチャそのものも HDL を用いて自作した

### ネットワーク関連

**[自宅ネットワークを Grafana でモニタリング](https://ternbusty.github.io/tags/raspy-grafana/)** <span class="language-tag my-orange">Python</span>
- Raspberry Pi で自宅ネットワークのパケットキャプチャを行ったうえで、IP アドレスから通信先 web サービスを特定し Grafana で可視化した
- ポートミラーリング機能付きスイッチおよび無線 LAN アクセスポイントを用いて、全てのパケットが Raspberry Pi に届くように工夫した

**[Wi-Fi 打刻システムの構築](https://ternbusty.github.io/posts/wifi-checkin/)** <span class="language-tag my-orange">Python</span>
- 職場に打刻システムがないため、自分の帰宅時刻を記録することにより時間外勤務の実態を把握しようという試み
- パケットキャプチャを行うことにより iPhone が自宅ネットワークに接続されているかどうかを判定。これを用いて出勤や帰宅を検知し、Slack へ通知した

### IoT 関連

**[全自動布団引きはがし機](https://qiita.com/ternbusty/items/bef574953391021e4e10)** <span class="language-tag my-orange">Python</span>

- 冬場に布団から出られないため, RaspberryPi とモータを用いて布団を引きはがす機械を製作した
- RaspberryPi は web サーバとして運用し, スマートフォンからの時刻設定を可能にした

**[IoT を使って毎朝風呂に入らざるを得ないようにする](https://ternbusty.github.io/posts/take-a-bath/)** <span class="language-tag my-orange">Python</span>

- 毎朝決まった時間に風呂場の湿度を一定以上にしないと、部屋の電気が永遠に点滅し続ける
- Nature Remo と SwitchBot 湿度計を RaspberryPi で制御

**[IoT を使って毎朝体重を測らざるを得ないようにする](https://ternbusty.github.io/posts/measure-weight/)** <span class="language-tag my-orange">Python</span>

- 毎朝決まった時間にその日の体重が計測されていないと、心停止のときに作動するアラームが延々と鳴り続ける
- スマート体重計 (Withings Body) からサーバへアップロードされた体重データを、Raspberry Pi から API 経由で取得

### Google Apps Script を用いた自動化

**[家計簿入力自動化](https://i-was-a-ki.hatenablog.com/entry/2020/03/01/143801)** <span class="language-tag my-purple">JavaScript</span>

- レシートを入力するのがダルいため、[スキャナ](https://scansnap.fujitsu.com/jp/product/ix100/) を用いて読み取ったレシートを OCR し [家計簿サービス](https://zaim.net/) に登録するシステムを作った
- OCR 部分は [Google Cloud Vision AI](https://cloud.google.com/vision/?hl=ja&utm_source=google&utm_medium=cpc&utm_campaign=japac-JP-all-ja-dr-bkws-all-all-trial-e-dr-1009137&utm_content=text-ad-none-none-DEV_c-CRE_285865410190-ADGP_Hybrid+%7C+AW+SEM+%7C+BKWS+~+T1+%7C+EXA+%7C+ML+%7C+M:1+%7C+JP+%7C+ja+%7C+Vision+%7C+General+%7C+en-KWID_43700016101235133-kwd-203288729047&userloc_1009507-network_g&utm_term=KW_cloud%20vision%20api&gclid=Cj0KCQjwy8f6BRC7ARIsAPIXOjiXrWHV-wmmtFB5hamuqR_tZgKcM0tJx-_Qyo62-YI6wN8GePn-0iQaAvrpEALw_wcB) を叩いている
- 読み取り結果に不審な点のあるレシートに関しては, [LINE Messaging API](https://developers.line.biz/ja/services/messaging-api/) を用いた対話型システムにより修正している

**[天気予報 bot](https://i-was-a-ki.hatenablog.com/entry/2017/11/27/084606)** <span class="language-tag my-purple">JavaScript</span>

- 天気予報を確認するのがダルいため, 京都の天気を毎朝 6:30 にツイートする [Twitter bot](https://twitter.com/kyoto__weather) を作った
- その日の予報に合わせてアイコンを変化させることにより、一目で天気が分かるようにした
- [東京版](https://twitter.com/tokyo__weather) もあり

### ウェブサイト
**[SCP Network Wiki](https://ternbusty.github.io/scp_network_wiki/)** <span class="language-tag my-orange">Python</span>
- [SCP Foundation](https://scp-wiki.wikidot.com/) および [SCP 財団](http://scp-jp.wikidot.com/) をスクレイピングし、各 SCP や tale の引用・被引用関係を可視化するサイト。Jekyll を用いて構築した
- [ネットワークの可視化](https://ternbusty.github.io/scp_network_wiki/visualization/SCP%20network%20visualization.html) 部分には、[Flourish network chart](https://app.flourish.studio/@flourish/network-graph) を用いている

**[オモコロチャンネルサーチ](https://omoch.net/)** <span class="language-tag my-orange">Python</span> <span class="language-tag my-green">ShellScript</span>
- [オモコロチャンネル](https://www.youtube.com/c/omocorochannel) をキーワード検索するサービス。Wordpress を用いて構築した
- データは YouTube Data API を用いて取得。新規動画データの Wordpress への追加も含め完全な自動化を行った。構築についての記事は [こちら](https://ternbusty.github.io/posts/omoch/)

### 医学関連

**[血ガス自動判定ツール](https://ternbusty.github.io/posts/gas/)** <span class="language-tag my-purple">JavaScript</span>

- 血ガスの結果を入力すると解釈と考えられる病態を出力する web フォーム

**[薬剤情報管理ツール](https://github.com/ternbusty/DrugInfo)** <span class="language-tag my-purple">JavaScript</span>

- 薬剤名を入力すると分類と副作用を自動で取得して自動で埋めてくれる Google Spreadsheet

**[検査値自動整形スクリプト](https://gist.github.com/ternbusty/2342b470dda55985393a16c04b21c1eb)** <span class="language-tag my-pink">Visual Basic</span>

- 病院実習でレポートを書く際, 電子カルテからコピペした検査値をフォーマットするのが非常にダルいため, 単位付与および整形を自動化する Word マクロを書いた
- おそらく IBM の電子カルテにしか対応していない

### その他

**[Modified Pomodoro Technique](https://ternbusty.github.io/timer.html)** <span class="language-tag my-purple">JavaScript</span>
- 休憩の前借り・借金制度を導入したポモドーロタイマー
- 詳細は [こちら](https://ternbusty.github.io/posts/modified-pomodoro/)

**[YouTube Playlist Player](https://ternbusty.github.io/youtube.html)** <span class="language-tag my-purple">JavaScript</span>
- YouTube の再生リストをシャッフル / 逆順再生するツール
- 詳細は [こちら](https://ternbusty.github.io/posts/playlist-player/)

**[誕生日お祝い用シェルスクリプト](https://qiita.com/ternbusty/items/c6c0c0cd5d67a470eb6a)** <span class="language-tag my-gray">C</span> <span class="language-tag my-green">ShellScript</span>

- 友人の Twitter アイコンおよびお祝いメッセージを含んだ画像を数式で表現し、それを gnuplot で描画させる

**[フォロー外鍵垢のフォロワー探索ツール](https://i-was-a-ki.hatenablog.com/entry/2020/04/23/233749)** <span class="language-tag my-orange">Python</span>

- Twitter API を叩いて「自分がフォローしているアカウント、およびそれらがフォローしているアカウント」を走査し、フォロー外鍵垢のフォロワーを探す

**[Amazon Prime Video の Watch Party でチャット履歴を保存する](https://ternbusty.github.io/posts/watch-party/)** <span class="language-tag my-purple">JavaScript</span>

- Amazon Prime Video の Watch Party のチャット履歴が保存されないため、チャットウィンドウ内をスクレイピングして会話記録をダウンロードできるようにする

**[D カードの履歴ダウンロードツール](https://github.com/ternbusty/DCardHistoryDownloader/blob/main/scrapeHistory.py)** <span class="language-tag my-orange">Python</span>

- D カードのマイページにログインして利用履歴をスクレイピングする

**[LINE ログビューワ](https://i-was-a-ki.hatenablog.com/entry/2020/04/17/125311)** <span class="language-tag my-orange">Python</span>

- macOS に存在する iOS のバックアップを Reverse Engineering して情報を抜き出し, 会話内容を記録した Markdown ファイルを書き出す
