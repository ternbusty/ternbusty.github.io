---
layout: page
title: About
permalink: /about/
---

# 基本情報

- 医学系の研究 (生体信号処理など) をしています
- 好きな言語
    - 競プロ: C++
    - 研究, 趣味: Python, JavaScript, R など
- 本サイトは日々の進捗記録や雑多な記述用です. まとまった内容の記事は [ブログ](https://i-was-a-ki.hatenablog.com/) をご覧ください

# つくったもの
#### [全自動布団引きはがし機](https://qiita.com/iwasaki501/items/bef574953391021e4e10)
- 使用言語: Python
- 冬場に布団から出られないため, RaspberryPi とモータを用いて布団を引きはがす機械を製作した
- RaspberryPi は web サーバとして運用し, スマートフォンからの時刻設定を可能にした

#### [家計簿入力自動化](https://i-was-a-ki.hatenablog.com/entry/2020/03/01/143801)
- 使用言語: JavaScript (Google Apps Script)
- レシートを入力するのがダルいため、[スキャナ](https://scansnap.fujitsu.com/jp/product/ix100/) を用いて読み取ったレシートを OCR し [家計簿サービス](https://zaim.net/) に登録するシステムを作った
- OCR 部分は [Google Cloud Vision AI](https://cloud.google.com/vision/?hl=ja&utm_source=google&utm_medium=cpc&utm_campaign=japac-JP-all-ja-dr-bkws-all-all-trial-e-dr-1009137&utm_content=text-ad-none-none-DEV_c-CRE_285865410190-ADGP_Hybrid+%7C+AW+SEM+%7C+BKWS+~+T1+%7C+EXA+%7C+ML+%7C+M:1+%7C+JP+%7C+ja+%7C+Vision+%7C+General+%7C+en-KWID_43700016101235133-kwd-203288729047&userloc_1009507-network_g&utm_term=KW_cloud%20vision%20api&gclid=Cj0KCQjwy8f6BRC7ARIsAPIXOjiXrWHV-wmmtFB5hamuqR_tZgKcM0tJx-_Qyo62-YI6wN8GePn-0iQaAvrpEALw_wcB) を叩いている
- 読み取り結果に不審な点のあるレシートに関しては, [LINE Messaging API](https://developers.line.biz/ja/services/messaging-api/) を用いた対話型システムにより修正している

#### [検査値自動整形スクリプト](https://gist.github.com/iwasaki501/2342b470dda55985393a16c04b21c1eb)
- 使用言語: Visual Basic
- 病院実習でレポートを書く際, 電子カルテからコピペした検査値をフォーマットするのが非常にダルいため, 単位付与および整形を自動化する Word マクロを書いた
- おそらく IBM の電子カルテにしか対応していない

#### [天気予報 bot](https://i-was-a-ki.hatenablog.com/entry/2017/11/27/084606)
- 使用言語: JavaScript (Google Apps Script)
- 天気予報を確認するのがダルいため, 京都の天気を毎朝 6:30 にツイートする [Twitter bot](https://twitter.com/kyoto__weather) を作った

#### [フォロー外鍵垢のフォロワー探索ツール](https://i-was-a-ki.hatenablog.com/entry/2020/04/23/233749)
- 使用言語: Python
- Twitter API を叩いて「自分がフォローしているアカウント、およびそれらがフォローしているアカウント」を走査し、フォロー外鍵垢のフォロワーを探す

#### [LINE ログビューワ](https://i-was-a-ki.hatenablog.com/entry/2020/04/17/125311)
- 使用言語: Python
- macOS に存在する iOS のバックアップを Reverse Engineering して情報を抜き出し, 会話内容を記録した Markdown ファイルを書き出す

#### [誕生日お祝い用シェルスクリプト](https://qiita.com/iwasaki501/items/c6c0c0cd5d67a470eb6a)
- 使用言語: ShellScript, C
- 友人の Twitter アイコンおよびお祝いメッセージを含んだ画像を数式で表現し、それを gnuplot で描画させる


<!-- This is the base Jekyll theme. You can find out more info about customizing your Jekyll theme, as well as basic Jekyll usage documentation at [jekyllrb.com](https://jekyllrb.com/)

You can find the source code for Minima at GitHub:
[jekyll][jekyll-organization] /
[minima](https://github.com/jekyll/minima)

You can find the source code for Jekyll at GitHub:
[jekyll][jekyll-organization] /
[jekyll](https://github.com/jekyll/jekyll)


[jekyll-organization]: https://github.com/jekyll -->
