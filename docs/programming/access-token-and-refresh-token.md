# Access Token 和 Refresh Token

> 2025-12-05


> ⚠️ There Is No Such Thing As Absolute Security.
>
> 不存在绝对的安全。


## Access Token 不能存！
常见一个错误做法是，access token存储到local storage中。

如果存在 localStorage／sessionStorage／IndexedDB，一旦页面发生 XSS（跨站脚本），恶意脚本可以直接通过 `localStorage.getItem(...)` 或 `sessionStorage.getItem(...)` 或直接读 IndexedDB，把 token 取走。

而如果 token 存在仅仅是 JS 内存变量（比如 React context、Vue store、闭包变量等），它不会被写入磁盘或持久存储，页面刷新 / 关闭就丢了。这样比 localStorage 永久存留更安全。

需要注意的是这也不等同于绝对安全，还是可能存在泄漏的风险，因为Access token 是每个请求都会带的，一旦被截获、复制、盗走，甚至用户自行通过浏览器控制台读取泄漏...

所以Access Token 的时效性应该尽可能短，即便被盗走危险性也相对长期低的多。

## 为什么要有Refresh Token

让 Access Token 可以非常短命（15~60min, 提高安全性），同时又不让用户频繁登录（保持体验）。

Refresh token 本身也可能暴露 但暴露概率和暴露危害都比 access token 小得多

前面提到由于AccessToken必须暴露给js，导致xss依然有能力偷盗
这时候就需要引入 HttpOnly Cookie，这个状态可以确保 js 根本没有能力读到，也不需要读取

1. 调用 /auth 获取凭证, response body 中只返回 access token, refresh token保存到cookie中，并设置该cookie仅 /auth/refresh可用。

```
HTTP/1.1 200 OK
Set-Cookie: refresh_token=eyJ...xx;
             HttpOnly; Secure; SameSite=None; Path=/auth/refresh;
Content-Type: application/json

{
  "access_token": "eyJ...."
}
```
2. 调用 /auth/refresh 浏览器会自动把 refresh token带上，这个过程js是无法读取到 Refresh Token的，全部由浏览器自行完成，这个安全性远比存储到js变量中高得多

```javascript
fetch('/auth/refresh', {
  method: 'POST',
  credentials: 'include',  // 带上 cookie
});
```
可以发现Refresh Token只在两个时机暴露，首次在是在返回的时候（未使用），第二次是在使用的时候。

而在第二次暴露的情况下，已经处于使用过的状态，所以即便暴露了也没有任何问题，这个也是令牌轮换的核心思想。轮换机制保证每个 Refresh Token 只能使用一次

而未使用的状态下，可以对RefreshToken做基本限制，比如RefreshToken仅允许在本客户端使用(User-Agent, IP)

若出现盗刷的情况（使用已使用过的，ua变化使用未使用的），则撤销所有的 AccessToken和RefreshToken, 强制要求用户重新登陆。

## 浏览器多Tab
Tab 1 使用 Access Token 1 简称 AT1, Cookie 中存放 Refresh Token 1 简称 RT1

新开 Tab 2，使用 /auth/refresh 得到 AT2, RT2, 此时RT1过期
Tab 1 AT1依然可用，当AT1过期时，Tab 1调用 /auth/refresh 浏览器会自动带上 RT2

这个机制其实等同于客户端无法判断此刻是否用户已登陆，因为本质上一定需要 RT2 来得到新的 AT1

也就是访问系统一定会调用一次 /auth/refreh, 如果失败则提示登录。本质上系统刚进入的时候, js是没有任何凭证的。

## Q&A

Q: 非浏览器的情况, Response Body是否应该返回RefreshToken?

A: 是的，并且最好在登陆接口通过Header区分客户端来源，如果是浏览器，则服务端仅在Cookie中返回RefreshToken, 如果是非浏览器端的情况，只能相信我们的友军了。

Q: Access Token 通过 BroadcastChannel 发送给新 Tab?

A: 歪门邪道，存在泄漏风险 

Q: Access Token 也能用 cookie？

A: 这就很像 Session了，没必要

## 参考链接

https://oauth.net/2/browser-based-apps/

https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps

https://stackoverflow.com/questions/78096088/how-bad-is-it-to-broadcast-the-access-token-in-a-spa-pkce-flow