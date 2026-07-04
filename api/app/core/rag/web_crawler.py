"""网页正文抓取（含 SSRF 防护）。"""
import ipaddress
import socket
from urllib.parse import urlparse

import httpx
import trafilatura

from app.core.exceptions import BizError


def _is_safe_url(url: str) -> bool:
    """SSRF 防护：禁止访问内网/本地地址。"""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    host = parsed.hostname
    if not host:
        return False
    try:
        # 解析所有 IP，任一为内网则拒绝
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip_str = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            return False
    return True


_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
}


async def _fetch_direct(url: str) -> tuple[str, str]:
    """直连抓取 + trafilatura 抽正文。失败/抽不到正文都抛 BizError。"""
    last_err: Exception | None = None
    html = ""
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(
                timeout=20, follow_redirects=True, max_redirects=5
            ) as client:
                resp = await client.get(url, headers=_BROWSER_HEADERS)
                resp.raise_for_status()
                html = resp.text
                break
        except httpx.HTTPError as e:
            last_err = e
            if attempt == 0:
                continue
            raise BizError(f"网页抓取失败：{e}", code=3003) from e
    if not html:
        raise BizError(f"网页抓取失败：{last_err}", code=3003)

    extracted = trafilatura.extract(html, include_comments=False, include_tables=True)
    if not extracted:
        raise BizError("未能从该网页提取到正文", code=3004)
    meta = trafilatura.extract_metadata(html)
    title = (meta.title if meta and meta.title else url)[:200]
    return title, extracted


async def _fetch_via_reader(url: str) -> tuple[str, str]:
    """经第三方 Reader 服务抓取（如 Jina Reader r.jina.ai）。

    这类服务在服务端用真实浏览器渲染并绕过 Cloudflare/JS 挑战，直接返回清洗后的
    正文（markdown/纯文本），因此不需要再走 trafilatura。用于直连被 403/521 拦下时兜底。
    注意：URL 会被发送到该第三方服务，请自行评估隐私/合规，默认关闭。
    """
    from app.config import settings

    endpoint = (settings.research_reader_endpoint or "").rstrip("/")
    if not endpoint:
        raise BizError("未配置 Reader 服务地址", code=3005)
    reader_url = f"{endpoint}/{url}"
    async with httpx.AsyncClient(
        timeout=settings.research_reader_timeout, follow_redirects=True, max_redirects=5
    ) as client:
        resp = await client.get(reader_url, headers=_BROWSER_HEADERS)
        resp.raise_for_status()
        text = (resp.text or "").strip()
    if not text:
        raise BizError("Reader 服务未返回正文", code=3006)
    # Reader 输出通常首行是标题（# Title:...），这里粗略取标题，取不到就用 url
    title = url
    for line in text.splitlines():
        line = line.strip()
        if line:
            title = line.lstrip("# ").removeprefix("Title:").strip()[:200] or url
            break
    return title, text


async def fetch_url_content(url: str) -> tuple[str, str]:
    """抓取网页正文，返回 (标题, 正文文本)。

    先直连抓取（浏览器请求头 + 一次重试）；若被反爬拦截（Cloudflare 521/403 等）或抽不到
    正文，且开启了 research_reader_fallback，则改走 Reader 服务兜底。全都失败才抛错，
    由上层退回搜索摘要。
    """
    if not _is_safe_url(url):
        raise BizError("不允许访问该地址（内网/非法 URL）", code=3002)

    from app.config import settings

    try:
        return await _fetch_direct(url)
    except BizError as direct_err:
        if not settings.research_reader_fallback:
            raise
        try:
            return await _fetch_via_reader(url)
        except Exception:
            # Reader 也失败，抛原始直连错误（信息更贴切），上层照常兜底摘要
            raise direct_err
