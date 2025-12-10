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

## 旧 Access Token 如何处理？

很多 OAuth 实现／服务商／库 —— 出于安全考虑 —— 在 refresh 时同时 revoke 旧 access token +旧 refresh token（即“Refresh Token Rotation + 强制 Revoke” 模式）。这样可以确保当 refresh token 被盗或滥用时，旧 token 不再有效。这个设计是基于标准允许撤销机制 + 最小化 token 泄露风险。

另一方面，也有实现 **只 revoke old refresh token，不 revoke old access token** —— 特别是当 access token 是短暂（**几分钟**）的时候。这样的做法牺牲一部分安全（短时间内旧 token 仍有效），但对用户体验友好（减少多设备冲突、多 tab 失效的问题）。

因此，根据不同应用／服务的安全策略与 trade-off（安全 vs 可用性），实际做法并不一致。

Laravel Passport 的实现属于 **“refresh → revoke old access token + old refresh token (rotate)”**。也就是说，它选择了标准允许范围内的一种“更安全、更激进”的策略。

- 这个策略 **有利于安全**（防止 refresh token 泄露后的滥用、保证 session 清理可控）；但在 SPA / 多 tab 场景，会带来 “一个 tab 刷新，其他 tab 被登出／token 无效” 的 UX/同步问题
- 因为规范（RFC 6749 / RFC 7009）并不强制 revoke，Passport 选了**更安全**的一边。

https://www.rfc-editor.org/pdfrfc/rfc7009.txt.pdf?utm_source=chatgpt.com

## 思维实验

原则如下：

1.  RefreshToken1 使用后，得到RefreshToken2和AccessToken2, AccessToken1过期
2.  Web端不允许存储 LocalStorage，不允许通过 broadcast 跨Tab共享 AccessToken。防止XSS

当 Tab 2 打开后，首先通过 /auth/refresh 得到 Access Token 2, 此时 Tab 1 的 Access Token 1 失效 这 相当于 Tab 2 把 Tab 1 顶下去了。

当用户返回 Tab 1  操作时，Tab 1 有几种选择：

A. 拿到 Tab 2 的 Access Token 2

❌ 违背原则2

B. 发起请求，得到 401 失败后，执行 /auth/refresh 得到 Access Token 3，重试请求

⚠️  体验差，会有至少一次请求失败

看起来 B 选项能够满足上面两点原则，只是因为 Tab 1 感知不到自身的 Access Token 1 被 revoke，所以发出了一次 401 请求。

C. Tab 2  /auth/refresh 后，广播一个 REFRESHED 事件，Tab 1 收到事件后，将当前的 Access Token 1标记为失效。先发起一次 /auth/refresh 再发起请求。同时 Tab 2 也广播一个 REFRESHED 事件, 当 Tab 1 开始操作时，也主动 /auth/refresh

用一个更加形象的说明方式是，两个 Tab 在交替使用，同一个瞬间，只能有一个 Tab 处于激活状态。

总结如下：

1. 所有 Tab 都有自己的 AccessToken。
2. refresh token 只放 HttpOnly Cookie，每个 Tab 共用同一个。
3. 某个 Tab 使用 refresh token 刷新后：
   1. 得到新的 access token
   2. 旧 access token 全部失效
   3. broadcast 一个 “REFRESHED” 事件（无敏感数据）
4. 其他 Tab 监听到该事件后：
   1. 标记当前 access token 已过期（但不立刻刷新）
5. 当用户在该 Tab 上进行下一次 API 调用时：
   1. 该 Tab 先 refresh 一次，得到自己的新 access token
   2. 再广播 REFRESHED 事件
6. 所有 Tab 循环以上流程

##  Laravel Passport & Umi Request 实践 （多Tab）

1. 服务端需要确保 登录接口和Refresh接口都能在 Http Only Cookie 中返回新的 Refresh Token

```PHP
class AuthorizationsController extends \Laravel\Passport\Http\Controllers\AccessTokenController
{
    public function login($request)
    {
        // 密码校验等逻辑
        $this->createSecureTokenResponse($tokenData)
    }
    
    public function refreshToken($request)
    {
        // refresh token 换取新 refresh token 和 access token
        // 新 refresh token 也要放到 cookie 里
        $this->createSecureTokenResponse($token)
    }
    
    /**
     * 创建安全的令牌响应 - 根据客户端类型决定返回方式, 如果是非web，就丢到response body里
     */
    private function createSecureTokenResponse(array $tokenData, Request $request = null): JsonResponse
    {
        // 检测是否为非web端客户端
        $isNonWebClient = $this->isNonWebClient($request);

        // 构建响应数据
        $responseData = [
            'access_token' => $tokenData['access_token'],
            'token_type' => $tokenData['token_type'] ?? 'Bearer',
            'expires_in' => $tokenData['expires_in'] ?? config('auth.oauth.access_token_expires_in'),
        ];

        // 对于非web端客户端，在响应体中包含 refresh token
        if ($isNonWebClient && isset($tokenData['refresh_token'])) {
            $responseData['refresh_token'] = $tokenData['refresh_token'];
            $responseData['refresh_token_expires_in'] = config('auth.oauth.refresh_token_expires_in');
        }

        $response = response()->json($responseData);

        // 对于web端客户端，将 Refresh Token 存储在 HttpOnly Cookie 中
        if (!$isNonWebClient && isset($tokenData['refresh_token'])) {
            $response->cookie(
                'refresh_token',
                $tokenData['refresh_token'],
                config('auth.oauth.refresh_token_expires_in') / 60, // 从配置读取过期时间（秒转换为分钟）
                '/api/authorizations/refresh', // 只能对刷新令牌端点发送
                null, // 域名
                false, // HTTPS only (生产环境)
                true, // HttpOnly - JavaScript 无法访问
                false, // SameSite
                'Strict' // SameSite 模式
            );
        }

        return $response;
    }
    
    /**
     * 检测是否为非web端客户端（移动应用、API客户端等）
     */
    private function isNonWebClient(?Request $request): bool
    {
        if (!$request) {
            return false; // 默认为web端，如果无法确定
        }

        // 检查请求头中是否包含移动应用或API客户端的标识
        $userAgent = $request->header('User-Agent', '');
        $clientType = $request->header('X-Client-Type', '');

        // 明确指定客户端类型
        if ($clientType) {
            return in_array(strtolower($clientType), ['mobile', 'api', 'app', 'native']);
        }

        // 使用正则表达式一次性匹配所有常见的非浏览器客户端关键词
        $apiClientPattern = '/(okhttp|alamofire|retrofit|afnetworking|cfnetwork|java|python-requests|httpclient|resttemplate|dart|curl|wget|node-fetch|got|postman|insomnia|httpie|swagger|react-native|flutter|cordova|phonegap)/i';

        return preg_match($apiClientPattern, $userAgent) === 1;
    }
   
}
```

1. 浏览器端在请求拦截器里实现 Token 轮换

token.js

```JavaScript
// Token 工具函数 - 直接使用内存变量存储token
let memoryToken = null;

// 获取 token
export function getToken() {
  if (memoryToken) {
    return { ...memoryToken };
  }
  return {};
}

// 设置 token
export function setToken(token) {
  memoryToken = {
    access_token: token.access_token,
    token_type: token.token_type || 'Bearer',
    expires_in: token.expires_in || 0,
    token_created_at: token.token_created_at || Date.now(),
  };
}

// 清除 token
export function clearToken() {
  memoryToken = null;
}
```

broadcaseChannel.js

```TypeScript
/**
 * Broadcast Channel 工具 - 用于跨标签页通信
 * 主要用于同步token刷新，确保多个标签页之间的token保持一致
 */

const CHANNEL_NAME = 'token-sync-channel';

class TokenBroadcastChannel {
  constructor() {
    this.channel = null;
    this.listeners = new Set();
    this.init();
  }

  init() {
    if (typeof window === 'undefined' || !window.BroadcastChannel) {
      console.warn('BroadcastChannel is not supported in this browser');
      return;
    }

    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = event => {
        // 忽略自己发送的消息
        if (event.data.source === this.tabId) {
          return;
        }
        this.listeners.forEach(listener => {
          try {
            listener(event.data);
          } catch (e) {
            console.error('Error in broadcast channel listener:', e);
          }
        });
      };
    } catch (e) {
      console.error('Failed to create BroadcastChannel:', e);
    }
  }

  // 生成唯一的标签页ID
  get tabId() {
    if (!this._tabId) {
      this._tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }
    return this._tabId;
  }

  // 发送消息到其他标签页
  postMessage(type, data = {}) {
    if (!this.channel) {
      return;
    }
    try {
      this.channel.postMessage({
        type,
        source: this.tabId,
        timestamp: Date.now(),
        ...data,
      });
    } catch (e) {
      console.error('Failed to post message to BroadcastChannel:', e);
    }
  }

  // 监听消息
  onMessage(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // 关闭通道
  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
  }
}

// 创建单例
const tokenBroadcastChannel = new TokenBroadcastChannel();

export default tokenBroadcastChannel;
```

request.js

```JavaScript
/**
 * umi-request 封装 - 支持 access token 刷新 & 多 tab 广播
 */
import { extend } from 'umi-request';
import { getToken, setToken, clearToken } from '@/utils/token';
import tokenBroadcastChannel from '@/utils/broadcastChannel';

// ----------------- 配置 -----------------
const REFRESH_LEEWAY = 10 * 1000; // 提前 10 秒刷新 token
let refreshPromise: Promise<any> | null = null;
let lastRefreshCompletedAt = 0;
let needRefreshFromOtherTab = false;
let lastBroadcastNotificationAt = 0;


// ----------------- 辅助 -----------------
const isAuthPath = (url: string) =>
  url === '/api/authorizations' || url === '/api/authorizations/refresh' || window.location.pathname === '/user/login';

const shouldRefreshSoon = (token: any) => {
  if (!token?.access_token) return false;
  const expiresInMs = Number(token.expires_in) * 1000;
  const createdAt = Number(token.token_created_at) || 0;
  if (!Number.isFinite(expiresInMs) || !createdAt) return false;
  return createdAt + expiresInMs - Date.now() <= REFRESH_LEEWAY;
};

// ----------------- Token 刷新 -----------------
export const refreshAccessToken = async (options = { broadcast: true }) => {
  // 确保不会因为并发导致多次 refresh
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch('/api/authorizations/refresh', { method: 'POST', credentials: 'include' })
    .then(async res => {
      if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
      const data = await res.json();
      if (!data?.access_token) throw new Error('refresh no token');

      const tokenPayload = {
        access_token: data.access_token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in || 0,
        token_created_at: Date.now(),
      };
      setToken(tokenPayload);

      if (options.broadcast) {
        tokenBroadcastChannel.postMessage('TOKEN_REFRESHED', { timestamp: Date.now() });
      }
      return data;
    })
    .catch(err => {
      clearToken();
      setUser({});
      throw err;
    })
    .finally(() => {
      lastRefreshCompletedAt = Date.now();
      refreshPromise = null;
    });

  return refreshPromise;
};

// ----------------- 多 Tab 广播监听 -----------------
if (typeof window !== 'undefined') {
  const unsubscribe = tokenBroadcastChannel.onMessage(event => {
    if (event.type === 'TOKEN_REFRESHED') {
      needRefreshFromOtherTab = true;
      lastBroadcastNotificationAt = event.timestamp || Date.now();
    }
  });
  window.addEventListener('beforeunload', () => unsubscribe && unsubscribe());
}

// ----------------- umi-request -----------------
const request = extend({});

// ----------------- 请求拦截器 -----------------
request.interceptors.request.use(async (url, options) => {
  let token = getToken();

  // 等待正在进行的刷新完成
  if (!isAuthPath(url) && refreshPromise) {
    try { await refreshPromise; token = getToken(); } catch { token = {}; }
  }

  // 其他tab激活，或access token过期的情况，都需要refresh
  const needRefresh = !isAuthPath(url) && (shouldRefreshSoon(token) || needRefreshFromOtherTab);
  const alreadyRefreshed = lastBroadcastNotificationAt && lastRefreshCompletedAt >= lastBroadcastNotificationAt;

  if (needRefresh && !alreadyRefreshed) {
    needRefreshFromOtherTab = false;
    try { await refreshAccessToken({ broadcast: !needRefreshFromOtherTab }); token = getToken(); } catch { token = {}; }
  }
  return { url, options: {..., {header: Authorization = `Bearer ${token.access_token}`} } };
});

export default request;
```



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