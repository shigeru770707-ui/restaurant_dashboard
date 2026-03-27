# API連携設定ガイド

飲食店マルチメディア統合ダッシュボードで各SNS/Webサービスと連携するための設定手順書です。

---

## 目次

1. [Google Analytics 4 (GA4)](#1-google-analytics-4-ga4)
2. [LINE Messaging API](#2-line-messaging-api)
3. [Instagram Graph API](#3-instagram-graph-api)
4. [Google ビジネスプロフィール (GBP)](#4-google-ビジネスプロフィール-gbp)
5. [ダッシュボードへの設定方法](#5-ダッシュボードへの設定方法)

---

## 難易度一覧

| メディア | 難易度 | 必要な認証情報数 | 備考 |
|---------|--------|----------------|------|
| GA4 | ⭐ 簡単 | 2 | サービスアカウント方式 |
| LINE | ⭐ 簡単 | 1 | トークン1つのみ |
| Instagram | ⭐⭐ 普通 | 2 | Meta開発者アプリの設定が必要 |
| GBP | ⭐⭐⭐ 複雑 | 4 | OAuthフロー実行が必要 |

---

## 1. Google Analytics 4 (GA4)

### 必要な認証情報

| 項目 | 説明 |
|------|------|
| **プロパティID** | GA4プロパティの数値ID（例: `386992448`） |
| **サービスアカウントJSON** | Google Cloudで発行したJSON鍵ファイル |

### 取得手順

#### Step 1: GA4プロパティIDを確認

1. [Google Analytics](https://analytics.google.com) にログイン
2. 左下の **管理**（歯車アイコン）をクリック
3. **プロパティ設定** を開く
4. 「プロパティID」の数値をメモ

#### Step 2: Google Cloudプロジェクトの設定

1. [Google Cloud Console](https://console.cloud.google.com) にアクセス
2. プロジェクトを選択（または新規作成）
3. **APIとサービス** → **ライブラリ** を開く
4. 「**Google Analytics Data API**」を検索して **有効化**

#### Step 3: サービスアカウントの作成

1. **IAMと管理** → **サービスアカウント** を開く
2. **サービスアカウントを作成** をクリック
3. 名前を入力（例: `analytics-reader`）
4. **作成して続行** をクリック（ロールの付与はスキップ可）
5. **完了** をクリック

#### Step 4: JSONキーの発行

1. 作成したサービスアカウントをクリック
2. **キー** タブを開く
3. **鍵を追加** → **新しい鍵を作成** → **JSON** を選択
4. JSONファイルが自動ダウンロードされる

> **重要**: このJSONファイルは安全に保管してください。秘密鍵が含まれています。

#### Step 5: GA4プロパティへのアクセス権付与

1. [Google Analytics](https://analytics.google.com) に戻る
2. **管理** → **プロパティのアクセス管理** を開く
3. **ユーザーを追加**（＋ボタン）をクリック
4. サービスアカウントのメールアドレスを入力
   - JSONファイル内の `client_email` の値（例: `analytics-reader@project-id.iam.gserviceaccount.com`）
5. 権限は **閲覧者** で十分
6. **追加** をクリック

### 取得できるデータ

- セッション数、アクティブユーザー数、新規ユーザー数
- ページビュー数、直帰率、平均セッション時間
- 流入元チャネル別データ（検索、SNS、直接など）
- 人気ページランキング

---

## 2. LINE Messaging API

### 必要な認証情報

| 項目 | 説明 |
|------|------|
| **チャンネルアクセストークン（長期）** | LINE Developersで発行するトークン |

### 取得手順

#### Step 1: LINE公式アカウントの準備

- [LINE公式アカウント](https://www.linebiz.com/jp/entry/) が未開設の場合は先に開設

#### Step 2: LINE Developersでチャネル作成

1. [LINE Developers Console](https://developers.line.biz/console/) にログイン
2. プロバイダーを選択（または新規作成）
3. **新しいチャネルを作成** → **Messaging API** を選択
4. 必要情報を入力して作成

#### Step 3: チャンネルアクセストークンの発行

1. 作成したチャネルを開く
2. **Messaging API設定** タブを開く
3. ページ下部の「チャネルアクセストークン（長期）」セクション
4. **発行** ボタンをクリック
5. 表示されたトークンをコピー

> **注意**: トークンは一度しか表示されません。安全に保管してください。

### 取得できるデータ

- 友だち数の推移
- ターゲットリーチ数
- ブロック数
- メッセージ配信実績（配信数、インプレッション、クリック数）

---

## 3. Instagram Graph API

### 必要な認証情報

| 項目 | 説明 |
|------|------|
| **ユーザーID** | Instagramビジネスアカウントの数値ID |
| **長期アクセストークン** | Meta開発者ポータルで取得 |

### 前提条件

- Instagramアカウントが **ビジネスアカウント** または **クリエイターアカウント** であること
- **Facebookページ** と連携済みであること

### 取得手順

#### Step 1: Instagramをビジネスアカウントに切り替え

1. Instagramアプリ → **設定** → **アカウント**
2. **プロアカウントに切り替える** → **ビジネス** を選択
3. Facebookページとの連携を設定

#### Step 2: Meta開発者アプリの作成

1. [Meta for Developers](https://developers.facebook.com) にログイン
2. **マイアプリ** → **アプリを作成**
3. 「**ビジネス**」タイプを選択
4. アプリ名を入力して作成

#### Step 3: Instagram Graph APIの追加

1. アプリダッシュボード → **製品を追加**
2. **Instagram Graph API** の「設定」をクリック

#### Step 4: アクセストークンの取得

1. **ツール** → **グラフAPIエクスプローラ** を開く
2. 右上のアプリを選択
3. 必要な権限を追加:
   - `instagram_basic`
   - `instagram_manage_insights`
   - `pages_show_list`
   - `pages_read_engagement`
4. **Generate Access Token** をクリック
5. Facebook/Instagram認証を完了

#### Step 5: 長期アクセストークンへの交換

短期トークン（有効期限1時間）を長期トークン（60日間）に交換:

```
GET https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={app-id}
  &client_secret={app-secret}
  &fb_exchange_token={short-lived-token}
```

> **注意**: 長期トークンも60日で期限切れします。定期的な更新が必要です。

#### Step 6: InstagramユーザーIDの取得

```
GET https://graph.facebook.com/v21.0/me/accounts?access_token={access-token}
```

レスポンスからFacebookページIDを取得し、次に:

```
GET https://graph.facebook.com/v21.0/{page-id}?fields=instagram_business_account&access_token={access-token}
```

レスポンスの `instagram_business_account.id` がユーザーIDです。

### 取得できるデータ

- フォロワー数の推移
- リーチ数、インプレッション数
- プロフィール閲覧数、ウェブサイトクリック数
- 投稿別のいいね数、コメント数、保存数、シェア数

---

## 4. Google ビジネスプロフィール (GBP)

### 必要な認証情報

| 項目 | 説明 |
|------|------|
| **ロケーションID** | Googleビジネスプロフィールの店舗識別子 |
| **OAuthクライアントID** | Google Cloudで作成したOAuth 2.0クライアント |
| **OAuthクライアントシークレット** | 同上 |
| **OAuthリフレッシュトークン** | OAuth認証フローで取得 |

### 取得手順

#### Step 1: Googleビジネスプロフィールの準備

- [Google ビジネスプロフィール](https://business.google.com) で店舗が登録・オーナー確認済みであること

#### Step 2: ロケーションIDの確認

1. [Google ビジネスプロフィール](https://business.google.com) にログイン
2. 店舗を選択
3. URLに含まれる数値がロケーションID
   - 例: `https://business.google.com/n/XXX/profile` の `XXX` 部分
4. または [Business Profile API](https://developers.google.com/my-business/reference/rest) の `accounts.locations.list` で取得

#### Step 3: Google Cloud APIの有効化

1. [Google Cloud Console](https://console.cloud.google.com) にアクセス
2. **APIとサービス** → **ライブラリ**
3. 以下のAPIを有効化:
   - **Business Profile Performance API**
   - **My Business Business Information API**

#### Step 4: OAuth 2.0クライアントの作成

1. **APIとサービス** → **認証情報**
2. **認証情報を作成** → **OAuthクライアントID**
3. アプリケーションの種類: **ウェブアプリケーション**
4. 名前を入力（例: `GBP Dashboard`）
5. 承認済みのリダイレクトURI: `http://localhost:8080` を追加
6. **作成** をクリック
7. **クライアントID** と **クライアントシークレット** をメモ

#### Step 5: OAuth同意画面の設定

1. **APIとサービス** → **OAuth同意画面**
2. **外部** を選択（社内の場合は内部）
3. 必要情報を入力
4. スコープに以下を追加:
   - `https://www.googleapis.com/auth/business.manage`

#### Step 6: リフレッシュトークンの取得

ブラウザで以下のURLにアクセス（改行なしで1行）:

```
https://accounts.google.com/o/oauth2/v2/auth
  ?client_id={クライアントID}
  &redirect_uri=http://localhost:8080
  &response_type=code
  &scope=https://www.googleapis.com/auth/business.manage
  &access_type=offline
  &prompt=consent
```

1. Googleアカウントで認証
2. リダイレクト先URLの `code` パラメータをコピー
3. 以下のcurlコマンドでリフレッシュトークンを取得:

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "code={認証コード}" \
  -d "client_id={クライアントID}" \
  -d "client_secret={クライアントシークレット}" \
  -d "redirect_uri=http://localhost:8080" \
  -d "grant_type=authorization_code"
```

4. レスポンスの `refresh_token` をメモ

> **重要**: リフレッシュトークンは `prompt=consent` を指定した初回認証時のみ返されます。

### 取得できるデータ

- 直接検索数、間接検索数
- Googleマップ表示回数、Google検索表示回数
- ウェブサイトクリック数、電話タップ数、ルート検索数

---

## 5. ダッシュボードへの設定方法

### フロントエンド（推奨）

1. ブラウザで `http://localhost` にアクセス
2. サイドバーから **設定**（⚙️）ページを開く
3. 各メディアのタブで認証情報を入力
4. **接続テスト** ボタンで動作確認
5. GA4の場合、接続テスト成功時に自動保存＆データ取得が実行されます

### Streamlit UI

1. `http://localhost:8501` にアクセス
2. **⚙️ API連携設定** ページを開く
3. 各タブで認証情報を入力・保存

### secrets.toml（直接編集）

`.streamlit/secrets.toml` を編集して直接設定することも可能です:

```toml
[stores.store_a.ga4]
property_id = "123456789"
service_account_json = '{"type": "service_account", ...}'

[stores.store_a.line]
channel_access_token = "xxxxx"

[stores.store_a.instagram]
access_token = "xxxxx"
user_id = "17841400000000000"

[stores.store_a.gbp]
location_id = "12345678901234567"
oauth_client_id = "xxxxx.apps.googleusercontent.com"
oauth_client_secret = "xxxxx"
oauth_refresh_token = "xxxxx"
```

---

## データ取得スケジュール

認証情報の設定後、以下のスケジュールで自動取得されます:

| メディア | 取得間隔 | 備考 |
|---------|---------|------|
| Instagram | 6時間ごと | |
| LINE | 24時間ごと | 前日分のデータのみ取得可能 |
| GA4 | 6時間ごと | |
| GBP | 24時間ごと | 3〜5日の遅延あり |

初回はダッシュボードの接続テスト成功時に自動取得、またはスケジューラの次回実行時に取得されます。

---

## トラブルシューティング

### 共通

- **接続テスト失敗**: 認証情報が正しいか確認。コピー時に余分な空白が入っていないか注意
- **データが表示されない**: 接続テスト成功後、データ取得に数分かかる場合があります。ページをリロードしてください

### GA4

- **`No module named 'google'`**: バックエンドコンテナの再ビルドが必要 → `docker-compose up --build -d backend`
- **`User does not have sufficient permissions`**: サービスアカウントにGA4プロパティの閲覧権限を付与してください

### Instagram

- **`Invalid OAuth access token`**: トークンの有効期限切れ。長期トークンを再発行してください
- **`Unsupported get request`**: ユーザーIDが正しいか確認。ビジネスアカウントIDである必要があります

### LINE

- **`Authentication failed`**: チャンネルアクセストークンの再発行を試してください

### GBP

- **`Request had invalid authentication credentials`**: リフレッシュトークンの期限切れ。Step 6を再実行してください
