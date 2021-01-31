Aries Easier
====

## Description
予定・実績工数管理用ツールAriesにおける、
予定工数を元にした入力元WBSレコード設定を自動化するためのツール。

## Demo
なし

## VS. 
なし

## Requirement
以下を必要とする。
- Node.js
- VS Code

## Install
- 本資材をローカルにcloneする
- Node.jsのインストールコマンドより、pakage.jsonに記載のライブラリを追加取得する。（以下コマンド例）
	- npm install
- 'src/const.js'に、実行者のSalesforceユーザID/Pass/パスワードトークンを入力する
	- ※パスワードトークンは、パスワードリセット時にメールで送付されるもの。

## Usage
#### １．事前準備
- 操作対象Ariesプロジェクトを、Ariesアプリケーション上から手動作成する
- 操作対象Ariesプロジェクトに、アサイン対象メンバを手動登録する
- WBSレコードを1件以上手動作成する
	- ※レコード作成操作においてトリガー的な内部動作をしているらしく、一度WBSレコードを作成しなければAPIによるレコード作成ができないもの。

#### ２．ツール実行
- 'src/index.js'の一部について、操作対象Ariesプロジェクト/WBSを指定する箇所を修正する。
	- 'crat_ins.setTargetProject('637-992', 2021, 1);'などと記載している箇所について、引数３つを以下のように変更する。
		- 第1引数: 操作対象開発案件のコード値
		- 第2引数: 操作対象年
		- 第3引数: 操作対象月
- VS Codeのデバッグ実行機能より、'プログラムの起動'を行う
	- 'src/index.js'の処理が自動的に呼び出される
	- 対象ファイル内の処理により、Aries管理用オブジェクトへ直接レコード挿入/更新する
- デバッグコンソール上に結果が表示される
	- 正常終了の場合、'results'に'insert done'など表示される。

## Licence

MIT

## Author

[yu saito](https://github.com/yu36)