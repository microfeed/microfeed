</br>
</br>
<div align="center">
  <a href="https://www.microfeed.org/" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/1719237/210119945-50e1d444-2d12-43d2-a96d-65bdbccecb70.png">
    <img src="https://user-images.githubusercontent.com/1719237/207514210-99ddbd03-f8f0-410a-96c8-80da1afb804d.png" width="280" alt="ロゴ"/>
  </picture>
  </a>
</div>

<h1 align="center">microfeed: Cloudflare 上で自己ホストできる軽量 CMS</h1>

  <p align="center">
    <a href="https://github.com/microfeed/microfeed/issues/new?assignees=&labels=bug"><b>バグ報告</b></a>
    ·
    <a href="https://github.com/microfeed/microfeed/discussions/new?category=ideas"><b>機能リクエスト</b></a>
    ·
    <a href="mailto:support@microfeed.org"><b>メールで問い合わせる</b></a>
  </p>

microfeedへようこそ。これはCloudflare上でセルフホスティングされた軽量なコンテンツマネジメントシステム（CMS）です。
microfeedを使えば、オーディオ、ビデオ、写真、ドキュメント、ブログポスト、外部URLなど、さまざまなコンテンツを
ウェブ、RSS、JSONの形でフィードに簡単に公開できます。自分自身でサーバーを運用することなくCMSをセルフホスティングしたい
テクノロジーに詳しい人々にとって、これは完璧な解決策です。

microfeedは[Listen Notes](https://www.listennotes.com/)によって開発され、Cloudflareの[Pages](https://pages.cloudflare.com/)、
[R2](https://www.cloudflare.com/products/r2/)、[D1](https://developers.cloudflare.com/d1/)、[Zero Trust](https://www.cloudflare.com/products/zero-trust/)上でホスティングされています。

ご質問やフィードバックがあれば、どうぞお気軽にsupport@microfeed.orgまでご連絡ください。皆様の声をお待ちしています！

## 📚 目次
[![Cloudflare Pageにデプロイ](https://github.com/microfeed/microfeed/actions/workflows/deploy.yml/badge.svg?event=workflow_dispatch)](https://github.com/microfeed/microfeed/actions/workflows/deploy.yml)
[![CI](https://github.com/microfeed/microfeed/actions/workflows/ci.yml/badge.svg)](https://github.com/microfeed/microfeed/actions/workflows/ci.yml)
[![Eメールサポート](https://img.shields.io/badge/Email-support%40microfeed.org-blue)](mailto:support@microfeed.org)
[![stability-alpha](https://img.shields.io/badge/stability-alpha-f4d03f.svg)](https://www.microfeed.org/i/introducing-microfeed-self-hosted-cms-on-cloudflare-opensource-serverless-free-uhbQEmArlC2/)

* [⭐️ 使い方](#%EF%B8%8F-how-it-works)
* [🚀 インストール](#-installation)
  * [前提条件](#prerequisites)
  * [ステップ1: microfeed リポジトリを GitHub にフォークする](#step-1-fork-the-microfeed-repo-to-your-github)
  * [ステップ2: フォークしたリポジトリにいくつかのシークレットを設定する](#step-2-put-some-secrets-on-your-forked-repo)
  * [ステップ3: GitHub Action を実行してコードをデプロイする](#step-3-run-github-action-to-deploy-code)
  * [ステップ4: Cloudflare ダッシュボードで数回クリックする](#step-4-make-a-few-clicks-on-cloudflare-dashboard)
  * [ステップ5: 完了。公開を開始する](#step-5-done-start-publishing)
  * [ボーナス: microfeed の最新バージョンに更新する](#bonus-update-to-the-latest-version-of-microfeed)
* [💻 よくある質問](#-faqs)
* [💪 コントリビューション](#-contributions)
  * [microfeed をローカルで実行する](#run-microfeed-on-local)
* [🛡️ ライセンス](#%EF%B8%8F-license)

## ⭐️ 使い方

1990年代以降、ウェブの大部分はフィードによって動いています。
人々（そしてボット）はフィードにアイテムを公開し、他の人々はそのフィードを購読して新しいコンテンツを受け取ることができます。

microfeedは、以下を含むがこれに限らず、個々の人々がCloudflare上で独自のフィードを自分でホストするのを簡単にします。
* オーディオのポッドキャストフィード
* 投稿のブログフィード
* 画像のInstagram風フィード（例：[llamacorn.listennotes.com](https://llamacorn.listennotes.com/)、[brand-assets.listennotes.com](https://brand-assets.listennotes.com/)）
* 動画のYouTube風フィード
* カスタムリンク付きの個人ウェブサイト（例：[wenbin.org](https://www.wenbin.org/)）
* 外部のニュース記事URLのコンテンツキュレーションフィード
* アップデートと報道関連の情報があるマーケティングサイト（例：[microfeed.org](https://www.microfeed.org/)）
* GUIダッシュボードと公開されているjsonフィードがあるヘッドレスCMS（例：[microfeed.org/json](https://www.microfeed.org/json/) にはOpenAPI仕様が[YAML](https://www.microfeed.org/json/openapi.yaml)と[HTML](https://www.microfeed.org/json/openapi.html)であります）
* 販売用のドメイン名のリスト（例：[listen411.com](https://www.listen411.com/)、[ListenHost.com](https://www.listenhost.com/)...）
* 1冊の本全体のウェブサイト（例：[The Art of War](https://the-art-of-war.dripbook.xyz/)）
* ...

microfeedは、Cloudflare [Pages](https://pages.cloudflare.com/) を使用してコードをホストおよび実行し、
[R2](https://www.cloudflare.com/products/r2/) を使用してメディアファイルをホストおよび提供し、
[D1](https://developers.cloudflare.com/d1/) を使用してメタデータを保存し、
[Zero Trust](https://www.cloudflare.com/products/zero-trust/) を使用して管理ダッシュボードへのログインを提供します。
Cloudflareは非常に寛大な無料利用枠を提供しており、個人や小規模企業向けの手頃な価格のソリューションとなっています。
ドメイン名の料金は支払う必要がありますが、Cloudflare上でのmicrofeedのホスティングは基本的に無料です。

microfeedを使用すると、オーディオ、ビデオ、写真、ドキュメント、ブログ記事、
外部URLなどのさまざまなコンテンツを、カスタマイズ可能なウェブサイト、RSSフィード、および [JSONフィード](https://www.jsonfeed.org/) に公開できます。
microfeedの実例をいくつかご覧ください：
* Webフィード: [https://llamacorn.listennotes.com/](https://llamacorn.listennotes.com/)
* Rssフィード: [https://llamacorn.listennotes.com/rss/](https://llamacorn.listennotes.com/rss/)
* Jsonフィード: [https://llamacorn.listennotes.com/json/](https://llamacorn.listennotes.com/json/)

microfeedはシンプルでありながら強力な管理ダッシュボードを提供し、フィードにアイテムを追加したり、
メディアファイルをアップロードしたり、ウェブページのスタイルをカスタマイズしたりするのが簡単になります。WordPressを使ったことがあるなら、使い慣れた感じがするでしょう。

![image-6d056193c81c0b8f5de0503f5af18116](https://user-images.githubusercontent.com/1719237/209486588-00acefe0-dd51-4bfc-aed7-1f63850aa720.png)

[戻る📚TOC](#-table-of-contents)

## 🚀 インストール

大まかに言って、Cloudflareにmicrofeedインスタンスをインストールするには、以下の手順を実行します：

1. [microfeedリポジトリ](https://github.com/microfeed/microfeed) を個人（または組織）のGitHubアカウントにフォークします。
2. Cloudflare APIトークンを取得し、フォークしたGitHubリポジトリのシークレットとして保存します。
3. ステップ2のシークレットを使用して、フォークしたリポジトリ内の定義済みのGitHubアクションを使って、コードをCloudflareページにデプロイします。
4. Cloudflareのダッシュボードでいくつかのクリックを行い、カスタムドメインを設定し、セキュリティ設定を構成します。
5. 完了。公開を開始！

> すべての人がドキュメントの読み方に慣れているわけではないことを理解しているので、できるだけ簡単に
> microfeedを始められるようにしました。ただし、Cloudflareが "Login with Cloudflare" OAuth機能を実装してくれると嬉しいです。
> これにより、microfeedのほぼワンクリックデプロイが可能になります。それまでの間、できるだけ分かりやすい設定プロセスを
> 試みました。

### 前提条件

* Cloudflareアカウントをお持ちであること。まだお持ちでない場合は、[Cloudflare.comで無料で登録](https://dash.cloudflare.com/sign-up)できます。
* GitHubアカウントをお持ちであること。まだお持ちでない場合は、[GitHub.comで無料で登録](https://github.com/signup)できます。

[TOCに戻る](#-table-of-contents)

### ステップ1. microfeedリポジトリをGitHubにフォークする

[https://github.com/microfeed/microfeed/fork](https://github.com/microfeed/microfeed/fork) をクリックしてリポジトリをフォークしてください。

将来的にフォークしたリポジトリのコードを変更することができますが、おそらく
コードに触れる必要はありません。リポジトリをフォークし、今後の使用のために同期を保ちます。

[📚TOCに戻る](#-table-of-contents)

### ステップ2. フォークしたリポジトリにシークレットを追加する

フォークしたリポジトリの [Settings -> Secrets -> Actions](../../settings/secrets/actions) に移動し、5つのシークレットを作成します（詳細はクリックしてください）。
これらのシークレットがあることで、GitHub Actionsを使ってCloudflare Pagesにmicrofeedインスタンスをデプロイできます。

<details>
  <summary><b>CLOUDFLARE_ACCOUNT_ID</b></summary>

CloudflareアカウントIDは、ダッシュボードのURLから取得できます：

[Cloudflareアカウントにログイン](https://dash.cloudflare.com/login?lang=en-US)すると、次のようなURLにリダイレクトされます
```
https://dash.cloudflare.com/[CloudflareアカウントID]
```
URLの最後の部分がCloudflareアカウントIDです。

例えば、このようなURLが表示された場合：
```
https://dash.cloudflare.com/fff88980eeeeedcc3ffffd4f555f4999
```

**CLOUDFLARE_ACCOUNT_ID** を **fff88980eeeeedcc3ffffd4f555f4999** に設定します：

<img width="846" alt="Screenshot 2022-12-17 at 10 31 10 AM" src="https://user-images.githubusercontent.com/1719237/208216752-56f00f51-29cb-43ea-b720-75244719898d.png">
</details>

<details>
  <summary><b>CLOUDFLARE_API_TOKEN</b></summary>

ここでAPIトークンを作成する必要があります：[https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)

カスタムトークンを作成します：

<img width="925" alt="Screenshot 2022-12-04 at 4 30 57 PM" src="https://user-images.githubusercontent.com/1719237/205525627-14da54ae-1733-4db5-b65d-94f5ec48f360.png">

Cloudflare PagesとD1の両方に編集権限が必要です：

<img width="990" alt="Screenshot 2022-12-04 at 4 31 41 PM" src="https://user-images.githubusercontent.com/1719237/205525675-4c8a6bce-21a8-45e3-bf0c-28981f123da3.png">

最後に、ここでAPIトークンをコピーします：

<img width="682" alt="Screenshot 2022-12-04 at 4 34 01 PM" src="https://user-images.githubusercontent.com/1719237/205525785-6fed8e49-7342-4b36-9d07-348e1c28cbcc.png">


  </details>

<details>
  <summary><b>R2_ACCESS_KEY_ID</b> および <b>R2_SECRET_ACCESS_KEY</b></summary>

[R2ダッシュボードページ](https://dash.cloudflare.com/sign-up/r2)に移動します。まずクレジットカード情報を入力する必要があるかもしれません。利用量が非常に寛容な無料枠制限（つまり、10GBのストレージ + 月1000万回の読み取り + 月100万回の書き込み）を超えない限り、支払いは必要ありません。

ここでR2 APIトークンを作成します：

  <img width="1328" alt="Screenshot 2022-12-04 at 4 43 58 PM" src="https://user-images.githubusercontent.com/1719237/205526381-cc11d4fe-b053-49d0-9072-de54db31b3b7.png">

Select "Admin Read & Write" permission and create an API token:

  <img width="858" alt="Screenshot 2023-08-08 at 4 33 55 PM" src="https://github.com/microfeed/microfeed/assets/1719237/1a90df29-5660-49d4-b66a-24873812492d">


R2_ACCESS_KEY_IDのためにAccess Key IDをコピーし、R2_SECRET_ACCESS_KEYのためにSecret Access Keyをコピーします
  <img width="728" alt="Screenshot 2022-12-04 at 4 45 35 PM" src="https://user-images.githubusercontent.com/1719237/205526582-92f440ac-21c4-46d9-a065-cfc1937391c8.png">


</details>


<details>
  <summary><b>CLOUDFLARE_PROJECT_NAME</b></summary>

正当なプロジェクト名は、次の文字を含む必要があります：[a-z]、[A-Z]、[0-9]、および -

このプロジェクトで使用するカスタムドメイン名を使用し、ドット（.）をダッシュ（-）に置き換えることをお勧めします

たとえば、photos.mycustomdomain.comを使用する場合、プロジェクト名はphotos-mycustomdomain-comにする必要があります。

注意：アンダースコア（_）、スペース（ ）および[a-z]、[A-Z]、[0-9]および-以外の文字を使用しないでください。そうしないと、Cloudflare Pagesでプロジェクトを作成できません。
</details>

合計で、GitHub Actionsに5つのシークレットを追加します：

<img width="826" alt="Screenshot 2022-12-04 at 4 10 46 PM" src="https://user-images.githubusercontent.com/1719237/205524410-268abf92-af61-467a-8883-78b8d4de3c56.png">

[📚TOCに戻る](#-table-of-contents)

### ステップ3. GitHub Actionを実行してコードをデプロイする

[Actions -> Deploy to Cloudflare Pages](../../actions/workflows/deploy.yml)に移動し、ワークフローを実行します。

<img width="1606" alt="Screenshot 2022-12-04 at 4 11 19 PM" src="https://user-images.githubusercontent.com/1719237/205526856-05ea0ff4-703a-4d08-bc7f-4ae2dfc07cfe.png">

緑のチェックマークが表示されたら、デプロイが成功しています。[Cloudflareダッシュボード](https://dash.cloudflare.com/sign-up/pages)でPagesプロジェクトが表示されます。

<img width="880" alt="Screenshot 2022-12-04 at 4 55 10 PM" src="https://user-images.githubusercontent.com/1719237/205527141-277620dd-586b-42dd-be97-edb7875d0705.png">

サイトには${CLOUDFLARE_PROJECT_NAME}.pages.devを介してアクセスできます。例：[https://microfeed-org.pages.dev/](https://microfeed-org.pages.dev/)

[📚TOCに戻る](#-table-of-contents)

### ステップ4. Cloudflareダッシュボードでいくつかのクリックを行う

microfeedインスタンスを管理するには、${CLOUDFLARE_PROJECT_NAME}.pages.dev/adminの管理ダッシュボードを使用します。例えば、[https://microfeed-org.pages.dev/admin/](https://microfeed-org.pages.dev/admin/)（管理ダッシュボードはCloudflare Zero Trustで保護する必要があります）。

初めて管理ダッシュボードにアクセスすると、チェックリストに従ってセットアッププロセスを完了します。

<img width="1182" alt="Screenshot 2022-12-17 at 10 34 05 AM" src="https://user-images.githubusercontent.com/1719237/208216864-38a65086-77ef-4595-bc05-c87be2676e6d.png">

[📚TOCに戻る](#-table-of-contents)

### ステップ5. 完了。公開を開始する

セットアッププロセスが完了すると、microfeedインスタンスが使用可能になります。
管理ダッシュボードからアイテムを追加、更新、または削除できます。

また、Settings / Custom codeで生のHTMLとCSSを編集することで、ウェブサイトの外観をカスタマイズできます。

<img width="1098" alt="Screenshot 2022-12-30 at 7 57 45 PM" src="https://user-images.githubusercontent.com/1719237/210062910-e56135f6-557e-419e-a00d-b25dd391c93d.png">

HTMLコードでは、[mustache.js](https://github.com/janl/mustache.js)をテンプレート言語として使用し、Feed JsonまたはItem Jsonから変数にアクセスできます。例えば、マーケティングウェブサイト[microfeed.org](https://www.microfeed.org/)のホームページ（Feed Web）では、[microfeed.org/json/](https://www.microfeed.org/json/)からHTMLコード内の変数を使用し、[アイテムのページ](https://www.microfeed.org/i/introducing-microfeed-a-self-hosted-open-source-cms-on-cloudflare-open-alpha-uhbQEmArlC2/)（Item Web）では、[${item_url}/json](https://www.microfeed.org/i/introducing-microfeed-a-self-hosted-open-source-cms-on-cloudflare-open-alpha-uhbQEmArlC2/json)から変数を使用します。

microfeedインスタンスのjsonデータ（つまり、[Feed Json](https://www.microfeed.org/json/)および[Item Json](https://www.microfeed.org/i/introducing-microfeed-a-self-hosted-open-source-cms-on-cloudflare-open-alpha-uhbQEmArlC2/json)）に簡単にアクセスできるため、それをヘッドレスCMSとして使用し、コンテンツを表示する独自のクライアントアプリを構築できます。

[📚TOCに戻る](#-table-of-contents)

### ボーナス. microfeedの最新バージョンに更新する

このmicrofeedリポジトリに新機能を追加し、バグを修正していきます。
新しいコードを含むフォークしたリポジトリを更新することができます。

まず、フォークしたリポジトリのコードを同期させます：

<img width="488" alt="Screenshot 2022-12-26 at 7 58 32 AM" src="https://user-images.githubusercontent.com/1719237/209483973-c82e7808-0d21-4aad-ac2d-c4e80da691bc.png">

次に、[Actions -> Deploy to Cloudflare Pages](../../actions/workflows/deploy.yml)に移動し、Workflowを実行して新しいコードをデプロイします。

[📚TOCに戻る](#-table-of-contents)

## 💻 よくある質問

<details>
<summary><b>ポッドキャスト/ビデオ/画像のダウンロードをどのように追跡できますか？</b></summary>

microfeedでポッドキャスト、ビデオ、または画像のダウンロードを追跡するには、追跡URL機能を使用できます。
これにより、[OP3](https://op3.dev/)、[Podtrac](http://analytics.podtrac.com/)、[Chartable](https://chartable.com/) など、メディアファイルに対してサードパーティの追跡URLを設定できます。

追跡URLを設定するには、設定/追跡URLに移動する必要があります：
![Screenshot 2023-01-05 at 7 57 02 AM](https://user-images.githubusercontent.com/1719237/210665674-39f9b0a9-1f28-4608-b0cd-c67b8a5c87ec.png)

そこから、使用したいサードパーティの追跡URLを追加できます。
microfeedは自動的にこれらのURLをメディアファイルのURLの先頭に追加し、ダウンロード統計を追跡できるようにします。

これは[ポッドキャスト業界で一般的な方法](https://lowerstreet.co/blog/podcast-tracking)であり、コンテンツのパフォーマンスを監視し、視聴者がどのようにコンテンツを消費しているかを理解するのに役立ちます。

</details>

<details>
<summary><b>なぜCloudflareなのですか？利益追求企業を信用するのは危険ではありませんか？</b></summary>

多くの個人や組織が、信頼性があり効果的なサービスを提供しているという評判のあるCloudflareのサービスを信頼して使用しています。
私たち（[Listen Notes](https://www.listennotes.com/)）も、Cloudflareを長年使用しています。

Cloudflareのようなワンストッププラットフォームですべてのものを管理することが便利です（例：DNS、キャッシュ、ファイアウォール、コードの実行、CDN、信頼性のないログインなど）。

microfeedはまだオープンアルファ段階です。Cloudflareは、最初にサポートするプラットフォームです。
他のサーバーレスプラットフォームをサポートすることも検討しており、必要に応じて簡単に移行できるようになります。
</details>


<details>
<summary><b>もしCloudflareが私のmicrofeedインスタンスをデプラットフォームする場合はどうすればいいですか？</b></summary>

Cloudflareを含む、使用するすべてのサービスの利用規約を慎重に確認することが重要です。
利用規約に違反した場合、サービスがインスタンスのデプラットフォームなどの対応を取る可能性があります。

デプラットフォームされる可能性に備えて、Cloudflareから定期的にデータをバックアップすることが良いアイデアです。
これにより、コンテンツを回復し、必要に応じて別のプラットフォームに移行することができます。
また、独自のカスタムドメインを使用することも良いアイデアです。これにより、コンテンツに対する制御が向上し、必要に応じてデータを別のプラットフォームに移行するのが容易になります。
</details>

<details>
<summary><b>なぜmicrofeedを使うべきですか？</b></summary>

すでにCloudflareを使用しており、そのサービスに満足している場合、microfeedを使うことは良い選択肢になるかもしれません。

自分でサーバーを管理したくない場合、microfeedはCloudflareのインフラストラクチャとセキュリティ機能を利用できる便利な代替手段になります。

サーバー費用を支払いたくない場合、microfeedはCloudflareが提供する無料使用枠が豊富であるため、費用対効果の高い解決策になります。

新しいものを探していて、さまざまな選択肢を試してみたい場合、microfeedは検討する価値がある選択肢です。
あなたのニーズに適合し、使用例に適したサービスであることを確認するために、使用する前にサービスを慎重に評価することが常に良いアイデアです。
</details>

<details>
<summary><b>microfeed / Cloudflareからデータをダウンロード/バックアップする方法は？</b></summary>

microfeedは、Cloudflare D1およびR2にデータを保存します。したがって、microfeedデータをバックアップするには、次の2つのデータをダウンロードする必要があります。
* [Cloudflare D1](https://developers.cloudflare.com/d1/)からのsqliteデータベース。すべてのメタデータを含みます。
* [Cloudflare R2](https://developers.cloudflare.com/r2/)からのメディアファイル。オーディオ、画像、ビデオなどを含みます。

<b>D1からsqliteデータベースをダウンロードする方法は？</b>

コマンドラインツール `wrangler` を使用して、sqliteデータベースファイルを見つけてバックアップをダウンロードできます。

[https://developers.cloudflare.com/workers/wrangler/commands/#d1](https://developers.cloudflare.com/workers/wrangler/commands/#d1)

<b>R2からメディアファイルをダウンロードする方法は？</b>

As of Feb 16, 2023, Cloudflare has not provided tools to to batch download all files from a R2 bucket.

特定のR2バケットからすべてのオブジェクトをフェッチするために、[S3互換API](https://developers.cloudflare.com/r2/data-access/s3-api/api/)を使用するスクリプトを記述する必要があります。

</details>

[📚TOCに戻る](#-table-of-contents)

## 💪 貢献
microfeedへの貢献を歓迎します！
新しい機能のアイデアがある、またはバグを見つけた場合は、リポジトリで[問題を開く](https://github.com/microfeed/microfeed/issues/new)してください。
修正や新機能を提出したい場合は、変更内容について詳細な説明を加えたプルリクエストを作成してください。

### ローカルでmicrofeedを実行

前提条件: node / npm、yarn、およびwrangler

まず、microfeedのルートディレクトリ（このREADME.mdファイルと同じレベル）に `.vars.toml` ファイルを作成し、 `.vars.toml` ファイルに5つのシークレットを入れてください（[ステップ2. フォークしたリポジトリにいくつかのシークレットを置く](#step-2-put-some-secrets-on-your-forked-repo) に似ています）。
```toml
# .vars.toml
CLOUDFLARE_PROJECT_NAME = "your-project-org"
CLOUDFLARE_ACCOUNT_ID = "account id"
CLOUDFLARE_API_TOKEN = 'api token'

R2_ACCESS_KEY_ID = "access key"
R2_SECRET_ACCESS_KEY = "secret key"
```

次に、ローカルの開発サーバーを実行します：
```bash
npm run dev
```

http://127.0.0.1:8788/ を介してローカルのmicrofeedインスタンスにアクセスできるはずです。

[📚TOCに戻る](#-table-of-contents)

## 🛡️ ライセンス
microfeedは、[AGPL-3.0](https://github.com/microfeed/microfeed/blob/main/LICENSE)ライセンスの下でライセンスされています。詳細については、[LICENSEファイル](https://github.com/microfeed/microfeed/blob/main/LICENSE)を参照してください。

[📚TOCに戻る](#-table-of-contents)
