"""LINE OA Manager (manager.line.biz) Playwright スクレイパー.

配信メッセージの一覧・配信数・開封率・クリック率を取得する。
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime

logger = logging.getLogger(__name__)

# LINE OA Manager URLs
LOGIN_URL = "https://account.line.biz/login"
MANAGER_BASE = "https://manager.line.biz"


def _parse_number(text: str) -> int:
    """'1,234' や '1234人' のような文字列を int に変換."""
    if not text:
        return 0
    cleaned = re.sub(r"[^\d]", "", text)
    return int(cleaned) if cleaned else 0


def _parse_percentage(text: str) -> float:
    """'45.2%' のようなパーセント文字列を float に変換."""
    if not text:
        return 0.0
    m = re.search(r"([\d.]+)", text)
    return float(m.group(1)) if m else 0.0


class LineOAScraper:
    """LINE OA Manager から配信メッセージデータをスクレイピング."""

    def __init__(self, email: str, password: str, account_id: str | None = None):
        self.email = email
        self.password = password
        self.account_id = account_id

    async def scrape_messages(self, max_pages: int = 5) -> list[dict]:
        """メッセージ配信一覧をスクレイピングして dict リストを返す.

        Returns:
            list[dict]: 各メッセージの配信データ
                - date: str (YYYY-MM-DD)
                - title: str
                - sent_count: int
                - open_count: int
                - click_count: int
                - message_type: str ("text" | "rich" | "image" | "video")
                - body_preview: str
        """
        from playwright.async_api import async_playwright

        messages = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                locale="ja-JP",
            )
            page = await context.new_page()

            try:
                # --- 1. ログイン ---
                await self._login(page)

                # --- 2. アカウント選択 ---
                account_url = await self._select_account(page)

                # --- 3. メッセージ配信一覧へ遷移 ---
                broadcast_url = f"{account_url}/message/list/broadcast"
                await page.goto(broadcast_url, wait_until="networkidle", timeout=30000)
                await page.wait_for_timeout(2000)

                # --- 4. メッセージデータ抽出 ---
                messages = await self._extract_messages(page, max_pages)

                logger.info(f"LINE OA scraper: {len(messages)}件のメッセージを取得")

            except Exception as e:
                logger.error(f"LINE OA scraper error: {e}")
                raise
            finally:
                await browser.close()

        return messages

    async def _login(self, page):
        """LINE Business ログインを実行."""
        logger.info("LINE OA Manager: ログイン開始")

        await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1000)

        # メールアドレスでログイン のリンクをクリック（LINEアプリログインではなく）
        email_login_btn = page.locator("text=メールアドレスでログイン").or_(
            page.locator("text=Log in with email")
        ).or_(
            page.locator('a[href*="email"]')
        )
        if await email_login_btn.count() > 0:
            await email_login_btn.first.click()
            await page.wait_for_timeout(1000)

        # メールアドレス入力
        email_input = page.locator('input[type="email"]').or_(
            page.locator('input[name="email"]')
        ).or_(
            page.locator('input[placeholder*="メール"]')
        ).or_(
            page.locator('input[placeholder*="email" i]')
        )
        await email_input.first.fill(self.email)

        # パスワード入力
        pw_input = page.locator('input[type="password"]').or_(
            page.locator('input[name="password"]')
        )
        await pw_input.first.fill(self.password)

        # ログインボタンをクリック
        login_btn = page.locator('button[type="submit"]').or_(
            page.locator("button:text('ログイン')").or_(
                page.locator("button:text('Log in')")
            )
        )
        await login_btn.first.click()

        # ログイン完了を待機（manager.line.biz へのリダイレクト）
        try:
            await page.wait_for_url(
                f"{MANAGER_BASE}/**",
                timeout=30000,
            )
        except Exception:
            # URL変化しなかった場合、エラーメッセージを確認
            error_el = page.locator(".MdTxtError").or_(
                page.locator('[class*="error"]')
            ).or_(
                page.locator('[role="alert"]')
            )
            if await error_el.count() > 0:
                error_text = await error_el.first.text_content()
                raise RuntimeError(f"ログイン失敗: {error_text}")
            raise RuntimeError("ログイン失敗: タイムアウト。メールアドレスまたはパスワードを確認してください。")

        logger.info("LINE OA Manager: ログイン成功")
        await page.wait_for_timeout(2000)

    async def _select_account(self, page) -> str:
        """アカウントを選択し、アカウントページのURLを返す."""
        current_url = page.url

        # 既にアカウントページにいる場合
        account_match = re.search(r"(https://manager\.line\.biz/account/[^/]+)", current_url)
        if account_match:
            return account_match.group(1)

        # アカウント選択ページの場合
        if self.account_id:
            # 指定されたアカウントIDに直接遷移
            account_url = f"{MANAGER_BASE}/account/{self.account_id}"
            await page.goto(account_url, wait_until="networkidle", timeout=30000)
            return account_url

        # アカウントIDが未指定の場合、最初のアカウントを選択
        account_links = page.locator('a[href*="/account/"]')
        if await account_links.count() > 0:
            href = await account_links.first.get_attribute("href")
            if href:
                if href.startswith("/"):
                    href = f"{MANAGER_BASE}{href}"
                await page.goto(href, wait_until="networkidle", timeout=30000)
                account_match = re.search(r"(https://manager\.line\.biz/account/[^/]+)", page.url)
                if account_match:
                    return account_match.group(1)

        raise RuntimeError("アカウントが見つかりません。アカウントIDを確認してください。")

    async def _extract_messages(self, page, max_pages: int) -> list[dict]:
        """メッセージ一覧ページからデータを抽出."""
        all_messages = []

        for page_num in range(max_pages):
            # ページ内のメッセージ行を取得
            # LINE OA Manager のメッセージリストは table or card 形式
            page_messages = await self._parse_message_list(page)

            if not page_messages:
                break

            all_messages.extend(page_messages)
            logger.info(f"ページ {page_num + 1}: {len(page_messages)}件取得")

            # 次のページボタンを探す
            next_btn = page.locator('button:text("次へ")').or_(
                page.locator('a:text("次へ")').or_(
                    page.locator('[aria-label="Next"]').or_(
                        page.locator('button:text("もっと見る")')
                    )
                )
            )
            if await next_btn.count() > 0 and await next_btn.first.is_enabled():
                await next_btn.first.click()
                await page.wait_for_timeout(2000)
            else:
                # スクロールで追加読み込み
                prev_count = len(all_messages)
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(2000)
                new_messages = await self._parse_message_list(page)
                if len(new_messages) <= len(page_messages):
                    break
                # 新しく表示された分のみ追加
                new_items = new_messages[len(page_messages):]
                if not new_items:
                    break
                all_messages.extend(new_items)

        return all_messages

    async def _parse_message_list(self, page) -> list[dict]:
        """現在表示されているメッセージリストをパースして返す."""
        messages = []

        # 方法1: テーブル行から抽出
        rows = page.locator("table tbody tr").or_(
            page.locator('[class*="message-list"] [class*="item"]').or_(
                page.locator('[class*="MessageList"] [class*="Item"]')
            )
        )
        row_count = await rows.count()

        if row_count > 0:
            for i in range(row_count):
                row = rows.nth(i)
                msg = await self._parse_row(row)
                if msg:
                    messages.append(msg)
            return messages

        # 方法2: カード形式のメッセージリスト
        cards = page.locator('[class*="card"]').or_(
            page.locator('[class*="Card"]').or_(
                page.locator('[data-testid*="message"]')
            )
        )
        card_count = await cards.count()

        if card_count > 0:
            for i in range(card_count):
                card = cards.nth(i)
                msg = await self._parse_card(card)
                if msg:
                    messages.append(msg)
            return messages

        # 方法3: リスト全体のテキストからパース
        list_container = page.locator('[class*="list"]').or_(
            page.locator("main")
        )
        if await list_container.count() > 0:
            messages = await self._parse_from_text(page)

        return messages

    async def _parse_row(self, row) -> dict | None:
        """テーブル行からメッセージデータを抽出."""
        try:
            cells = row.locator("td")
            cell_count = await cells.count()
            if cell_count < 2:
                return None

            cell_texts = []
            for i in range(cell_count):
                text = (await cells.nth(i).text_content() or "").strip()
                cell_texts.append(text)

            # 日付を探す（YYYY/MM/DD or YYYY-MM-DD or MM/DD 形式）
            date_str = ""
            title = ""
            sent_count = 0
            open_count = 0
            click_count = 0

            for text in cell_texts:
                date_match = re.search(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})", text)
                if date_match and not date_str:
                    date_str = f"{date_match.group(1)}-{int(date_match.group(2)):02d}-{int(date_match.group(3)):02d}"
                    continue

            # タイトルは通常最初の非日付セル
            for text in cell_texts:
                if text and not re.match(r"^\d{4}[/\-.]", text) and len(text) > 1:
                    title = text
                    break

            # 数値セルから配信数を抽出
            numbers = [_parse_number(t) for t in cell_texts if re.search(r"\d", t)]
            if len(numbers) >= 1:
                sent_count = numbers[0]
            if len(numbers) >= 2:
                open_count = numbers[1]
            if len(numbers) >= 3:
                click_count = numbers[2]

            # パーセントから実数を計算
            for text in cell_texts:
                if "%" in text:
                    pct = _parse_percentage(text)
                    if sent_count > 0 and open_count == 0:
                        open_count = int(sent_count * pct / 100)
                    elif sent_count > 0 and click_count == 0:
                        click_count = int(sent_count * pct / 100)

            if not title and not date_str:
                return None

            return {
                "date": date_str or datetime.now().strftime("%Y-%m-%d"),
                "title": title,
                "sent_count": sent_count,
                "open_count": open_count,
                "click_count": click_count,
                "message_type": "text",
                "body_preview": "",
            }
        except Exception as e:
            logger.debug(f"Row parse error: {e}")
            return None

    async def _parse_card(self, card) -> dict | None:
        """カード形式のメッセージデータを抽出."""
        try:
            full_text = (await card.text_content() or "").strip()
            if not full_text or len(full_text) < 5:
                return None

            # 日付を探す
            date_str = ""
            date_match = re.search(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})", full_text)
            if date_match:
                date_str = f"{date_match.group(1)}-{int(date_match.group(2)):02d}-{int(date_match.group(3)):02d}"

            # タイトル: 見出し要素から取得
            title_el = card.locator("h3, h4, h5, [class*='title'], [class*='Title'], [class*='name']")
            title = ""
            if await title_el.count() > 0:
                title = (await title_el.first.text_content() or "").strip()

            if not title:
                # テキストの最初の行をタイトルとする
                lines = [l.strip() for l in full_text.split("\n") if l.strip()]
                title = lines[0] if lines else ""

            # 配信数・開封・クリック
            numbers = re.findall(r"[\d,]+", full_text)
            int_numbers = [_parse_number(n) for n in numbers if _parse_number(n) > 0]

            sent_count = int_numbers[0] if len(int_numbers) >= 1 else 0
            open_count = int_numbers[1] if len(int_numbers) >= 2 else 0
            click_count = int_numbers[2] if len(int_numbers) >= 3 else 0

            # パーセント表記の処理
            pct_matches = re.findall(r"([\d.]+)%", full_text)
            if pct_matches and sent_count > 0:
                if open_count == 0 and len(pct_matches) >= 1:
                    open_count = int(sent_count * float(pct_matches[0]) / 100)
                if click_count == 0 and len(pct_matches) >= 2:
                    click_count = int(sent_count * float(pct_matches[1]) / 100)

            if not title:
                return None

            # メッセージタイプ推定
            msg_type = "text"
            type_lower = full_text.lower()
            if "リッチ" in type_lower or "rich" in type_lower:
                msg_type = "rich"
            elif "画像" in type_lower or "image" in type_lower:
                msg_type = "image"
            elif "動画" in type_lower or "video" in type_lower:
                msg_type = "video"

            return {
                "date": date_str or datetime.now().strftime("%Y-%m-%d"),
                "title": title,
                "sent_count": sent_count,
                "open_count": open_count,
                "click_count": click_count,
                "message_type": msg_type,
                "body_preview": "",
            }
        except Exception as e:
            logger.debug(f"Card parse error: {e}")
            return None

    async def _parse_from_text(self, page) -> list[dict]:
        """ページ全体のテキストからメッセージデータを抽出（フォールバック）."""
        messages = []
        try:
            # 全リンク要素からメッセージ詳細ページへのリンクを探す
            links = page.locator('a[href*="/message/"]')
            link_count = await links.count()

            for i in range(min(link_count, 50)):
                link = links.nth(i)
                text = (await link.text_content() or "").strip()
                href = await link.get_attribute("href") or ""

                if not text or "/list/" in href:
                    continue

                # リンクテキストからタイトルを取得
                # 親要素からその他の情報を取得
                parent = link.locator("..")
                parent_text = (await parent.text_content() or "").strip()

                date_match = re.search(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})", parent_text)
                date_str = ""
                if date_match:
                    date_str = f"{date_match.group(1)}-{int(date_match.group(2)):02d}-{int(date_match.group(3)):02d}"

                numbers = [_parse_number(n) for n in re.findall(r"[\d,]+", parent_text) if _parse_number(n) > 0]

                messages.append({
                    "date": date_str or datetime.now().strftime("%Y-%m-%d"),
                    "title": text[:100],
                    "sent_count": numbers[0] if numbers else 0,
                    "open_count": numbers[1] if len(numbers) >= 2 else 0,
                    "click_count": numbers[2] if len(numbers) >= 3 else 0,
                    "message_type": "text",
                    "body_preview": "",
                })

        except Exception as e:
            logger.debug(f"Text parse error: {e}")

        return messages


def run_scraper(email: str, password: str, account_id: str | None = None, max_pages: int = 5) -> list[dict]:
    """同期的にスクレイパーを実行するヘルパー関数."""
    scraper = LineOAScraper(email, password, account_id)
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(scraper.scrape_messages(max_pages))
    finally:
        loop.close()
