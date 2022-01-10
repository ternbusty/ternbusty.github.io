---
layout: post
title: 競プロ用環境構築のメモ
date: 2022-01-10
categories: [Technology, Competitive Programming]
tags: [VSCode, Environment Setup]
---

久々に競プロ環境を整備し直したのでメモしておく。以下、WSL2 (Ubuntu 18.04.1) と VSCode という環境下で、C++17 を用いて問題を解く際の環境設定を記載する。

## VSCode のエディタ設定
- 昨年 9 月のアップデートから公式で提供されるようになった `editor.bracketPairColorization.enabled` を用いれば対応する括弧の色付けができ、さらに `editor.guides.bracketPairs` でペアの対応範囲がカラーガイドで示されるようになる。
- settings.json への記載内容は以下の通り。

```json
{
    "editor.guides.bracketPairs": true,
    "editor.bracketPairColorization.enabled": true,
    "[cpp]": {
        "editor.tabSize": 2
    },
    "editor.formatOnSave": true,
    "files.autoSave": "afterDelay",
}
```

## コードスニペットの登録
- [こちらのレポジトリ](https://github.com/iwasaki501/Competitive_Programming) (Fork 元からほぼ変更していない) をクローンし `snippets/gen.py` を実行。`src` フォルダ内にある C++ ファイルの `// snippet-begin` と `// snippet-end` に挟まれた部分を抽出したうえで、C++ のスニペット用ファイル `/mnt/c/Users/iwasaki/AppData/Roaming/Code/User/snippets/cpp.json` を上書きし、ファイル名をキーとするスニペットとして使えるようになる。
- ほか、スニペットにわざわざ登録するほどでもないちょっとした tips などは [Boostnote](https://boostnote.io/) に書いている。最新版ではコードスニペット機能がなくなってしまった (Markdown しか書けなくなってしまった？) ようなのでしゃーなし `Legacy 0.16.1` を使っているのだけど、ほぼ同等の機能をもつ [massCode](https://masscode.io/) に鞍替えしようかと検討中。

## 拡張機能設定
競プロ関係で用いている拡張機能は以下の通り。

- [Remote - WSL](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl)
- [Visual Studio IntelliCode](https://marketplace.visualstudio.com/items?itemName=VisualStudioExptTeam.vscodeintellicode)
- [Competitive Programming Helper (cph)](https://marketplace.visualstudio.com/items?itemName=DivyanshuAgrawal.competitive-programming-helper)
- [C/C++](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools)
- [Code Runner](https://marketplace.visualstudio.com/items?itemName=formulahendry.code-runner)
- [macros](https://marketplace.visualstudio.com/items?itemName=geddski.macros)

### Competitive Programming Helper (cph)
- 競プロに特化した拡張機能。Google Chrome に [Competitive Companion](https://chrome.google.com/webstore/detail/competitive-companion/cjnmckjndlpiamhfimnnjmnckgghkjbl) をインストールすると「問題のタイトルをファイル名にした新規ソースコードファイルを作成 + 問題文をパースしてサンプル入出力をダウンロード + サイドパネルに表示」してくれる。
- コードを実行し所要時間および各サンプルに対する正誤を表示してくれるのはもちろんのこと、手動でテストケースを追加してまとめてテストすることも可能である。至れり尽くせり。
- 実際の GUI はこんな感じ。
![image](/assets/img/cph.png)
- コードを実行するとこのように表示される。
![image](/assets/img/cph-result.png)
- コンパイルオプションを設定することもできる。

```json
{
    "cph.language.cpp.Args": "-std=c++17",
}
```

### C/C++
公式から提供されている拡張機能をインストールする。`C_Cpp.clang_format_fallbackStyle` での指定を行うとお好みのスタイルで上手いこと整形してくれるので非常に便利。個人的には括弧の補完で改行をしないようにしたい派なので、`Google` スタイルを採用している。 

```json
{
    "C_Cpp.default.intelliSenseMode": "gcc-x64",
    "C_Cpp.default.cppStandard": "c++17",
    "C_Cpp.default.cStandard": "c11",
    "C_Cpp.clang_format_fallbackStyle": "Google",
    "C_Cpp.default.compilerPath": "/usr/bin/g++",
}
```

### Code Runner
- 開いているソースコードのファイルの言語を判別し、任意のコマンドを実行できる拡張機能。C++ の場合は「ソースコードのディレクトリに入る → お気に入りのオプションを付け g++ でコンパイル → バイナリをターミナルで実行」をショートカットキー (デフォルトでは `Ctrl + Alt + N`)  一つで行うことができかなり時短になる。
- 上記のほかもう一つ `customCommand` を決めることができるので「ソースコードのディレクトリに入る → バイナリをターミナルで実行」という動作を設定している。(コンパイルに時間がかかるような巨大なファイルは書かないのであまり関係ないといえばないのだけど) 再コンパイルせずに別のサンプルを与えて出力をみたいだけのときに重宝する。こちらは `Ctrl + Alt + K` で実行できる。

```json
{
    "code-runner.runInTerminal": true,
    "code-runner.executorMap": {
        "c": "cd $dir && gcc $fileName -o $fileNameWithoutExt -lm && $dir$fileNameWithoutExt",
        "cpp": "cd $dir && g++ -std=c++17 -Wall -Wextra -Wshadow -D_GLIBCXX_DEBUG -fsanitize=undefined -DLOCAL -fsplit-stack $fileName -o $fileNameWithoutExt && $dir$fileNameWithoutExt",
        "python": "cd $dir && python3.8 $fileName",
    },
    "code-runner.customCommand": "cd $dir && $dir$fileNameWithoutExt",
}
```

### macros
- 上記の Code Runner を使えばターミナルでバイナリの実行まで済ませてはくれるのだが、一度ターミナルにフォーカスを合わせてからサンプルを貼り付けるという微妙なひと手間が発生するのが気に入らない。このような場合、複数の VSCode コマンドを一つのコマンドにまとめられる拡張機能 macros が有効である。例えば以下のように設定すれば、`runCpp` や `execCpp` というコマンドに対してショートカットを設定し先述の作業を一発で実行できるようになる。

```json
{
    "macros": {
        "runCpp": [
            "code-runner.run",
            "workbench.action.terminal.focus"
        ],
        "execCpp": [
            "code-runner.runCustomCommand",
            "workbench.action.terminal.focus"
        ],
}
```

- 上記は便利なのではあるが、拡張機能のソースコードで非同期処理が壊れている影響で、時間のかかる処理をフローの中に入れた場合順番がめちゃくちゃになってしまう問題がある。以前 [別の記事](https://i-was-a-ki.hatenablog.com/entry/2020/05/09/125839) にも書いた通り現在でも修正されていないため、`/home/ubuntu/.vscode-server/extensions/geddski.macros-1.2.1/extension.js` を [こちら](https://github.com/AlteredConstants/macros/blob/88704802607bfce62c94f3bee303096d244e917f/extension.js) に差し替える必要がある。

- ほかには以下のようなマクロを設定している。`cout_endl` は、`cout <<  << endl` を入力したうえでカーソルを真ん中に持っていきたいという怠惰の極みのようなコマンドである。`temp` は競プロ用テンプレートを貼ったうえで、コード入力開始位置にカーソルを持ってくるためのものである。書き方がダサすぎるのが少し残念。

```json
{
    "macros": {
        "cout_endl": [
            {
                "command": "editor.action.insertSnippet",
                "args": {
                    "langId": "cpp",
                    "name": "output"
                }
            },
            "cursorLeft",
            "cursorLeft",
            "cursorLeft",
            "cursorLeft",
            "cursorLeft",
            "cursorLeft",
            "cursorLeft",
            "cursorLeft",
            "cursorLeft"
        ],
        "temp": [
            {
                "command": "editor.action.insertSnippet",
                "args": {
                    "langId": "cpp",
                    "name": "template"
                }
            },
            "cursorUp",
            "cursorUp",
            "cursorUp",
            "cursorRight"
        ],
    }
}
```

## ショートカットキーの設定
上記で設定したマクロに対してショートカットキーを設定して、おしまい！

```json
[    
    {
        "key": "ctrl+alt+n",
        "command": "macros.runCpp"
    },
    {
        "key": "ctrl+alt+k",
        "command": "macros.execCpp"
    },
    {
        "key": "ctrl+o ctrl+p",
        "command": "macros.cout_endl"
    },
    {
        "key": "ctrl+k ctrl+p",
        "command": "macros.temp"
    },
]
```
