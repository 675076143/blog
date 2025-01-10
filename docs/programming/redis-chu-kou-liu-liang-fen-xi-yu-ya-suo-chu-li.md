# Redis出口流量分析与压缩处理

> 2024-12-05

### 现象说明

从2024-11-25开始到今天，一直有redis流量告警，阿里云面板也没有发现热key或符合条件的大key，猜测是不满足标准

https://help.aliyun.com/zh/redis/user-guide/identify-and-handle-large-keys-and-hotkeys

在不考虑尖峰的情况下，出口流量基本跟请求量匹配，考虑并不是因为某个版本业务需求导致在09:00-12:00，13:30-18:00这两个时间段，基本占用都处于60%\~80%之间 （最大带宽36MB/s）并且qps，cpu，延迟等各项指标都很健康

虽然告警是从2024-11-25出现的，但通过3周的环比数据看，没有明显的增长，可以认为就是业务量的上涨导致的带宽不足

### 单个请求的流量占用

这边本地准备了一个grafana, 挑选了几个高频接口用于测试，流量开销基本都在1m

![image](../assets/image%20(1).png)

这个流量主要是因为每次请求都需要完整读取laravel-permission


[laravel-permission 缓存导致的Redis带宽占用问题](laravelpermission-huan-cun-dao-zhi-de-redis-dai-kuan-zhan-yong-wen-ti.md)

这个大key虽然已经过了一轮处理，但是随着系统增加的权限越来越多还是无法避免。。。截止到当前，系统总权限数量有**1031**个，占用**1.65mb**, 妥妥的大key，可恨的是，几乎每个请求，都需要读取这个缓存。

![image](../assets/image%20(2).png)

### 针对permissions的压缩

选用cpu等各项指标都十分优秀的lz4算法，**单独**对permission缓存做压缩phpredis扩展支持加载该算法，需要在docker容器里做进一步配置

https://github.com/phpredis/phpredis?tab=readme-ov-file#session-compression

https://laravel.com/docs/8.x/redis#phpredis-serialization

注意这个配置是在laravel8才支持的，如果低于8可以考虑单独抽取这个pr

https://github.com/laravel/framework/pull/40282/files#diff-6a8e18e894ab849a0ff821f0a5f2127282c9c1fbe0ae3de7c17745ec7f4a0906

```dockerfile
RUN apk add lz4-dev
RUN pecl install -o -f -D 'enable-redis-igbinary="yes" enable-redis-lz4="yes"' igbinary redis \
 && docker-php-ext-enable igbinary redis 
```

项目里修改三个文件config/database.php 新增redis链接，配置压缩选项为lz4

```php
<?php

return [
    'connections' => [
      'redis' => [
        'cache-compress' => [
            'url' => env('REDIS_CACHE_URL'),
            'host' => env('REDIS_CACHE_HOST', '127.0.0.1'),
            'password' => env('REDIS_CACHE_PASSWORD', null),
            'port' => env('REDIS_CACHE_PORT', 6379),
            'database' => env('REDIS_CACHE_COMPRESSION_DB', 2),
            'timeout' => 8 * 3600,
            'read_timeout' => 8 * 3600,
            'read_write_timeout' => 8 * 3600,
            'persistent' => true,
            'options' => [
//                'serializer' => 2, //Redis::SERIALIZER_IGBINARY,
                'compression' => 3, // Redis::COMPRESSION_LZ4
            ]
        ],
    ]
];
```

config/cache.php 增加一个store, 并指定redis链接

```php
<?php

return [   
    'stores' => [
        'redis-compress' => [
            'driver' => 'redis',
            'connection' => 'cache-compress',
        ],
    ],

];
```

config/permission.php 修改缓存store为redis-compress

```php
<?php
return [
    'cache' => [
        // 'store' => 'default',
        'store' => 'redis-compress',
    ],
];
```

### Igbinary
一开始在 database.php里尝试了 igbinary, 然而key大小并没有什么变化，依旧是1.6mb，所以就放弃了这个选项。
```php
<?php

return [
    'connections' => [
      'redis' => [
        'cache-compress' => [
            'options' => [
                'serializer' => \Redis::SERIALIZER_IGBINARY
            ]
        ],
    ]
];
```
今天重新研究了一下igbinary，发现 Redis 里存储的数据 既有php serialize的特征，也有 igbinary_serialize 的特征。

🙄 下面是最简的重现步骤
```php
$input = ['a','b'];
$key = 'SERIALIZER_IGBINARY';
$redisClient = Redis::connection('cache-compress')->client();
$redisClient->set($key, $input); // 单独使用 igbinary
Cache::store('redis-compress')->put($key, $input); // 共同使用 php serialize 和 igbinary
```
直接使用 PhpRedis Client的时候，事情就如期望一样运作，但搭配 Laravel Cache 的时候，就不对劲了。

翻了一源码，发现 Laravel 对 Redis 又包装了一个 Store, 在这个 Store里做了一次序列化处理

https://github.com/laravel/framework/blob/8.x/src/Illuminate/Cache/RedisStore.php#L332

```php
protected function serialize($value)
{
    return is_numeric($value) && ! in_array($value, [INF, -INF]) && ! is_nan($value) ? $value : serialize($value);
}
```
这就会导致，Laravel先对输入做 `serialize()`，然后再转交给 PhpRedis 再处理一次 `igbinary_serialize()`

为了理解这个行为，可能要追溯到 Laravel 5.8 的版本，那时，官方选择的redis库是predis, predis是不处理序列化，序列化需要由程序自行完成。

这个问题直到今天也没有解决，相关issue也只是从表面上解决了igbinary参数没有传递给redis，并没有解决laravel硬编码的序列化问题。

https://github.com/laravel/framework/issues/44652

解决办法有两个：

1. 直接在php内完成, 也就是laravel目前的实现，将 serialize 函数变为 igbinary_serialize 即可

2. 选择将动作交由PhpRedis完成，由于配置已经开启，直接 `return $value` 即可

考虑到PhpRedis本身就已经是c实现的高性能库了，序列化仅仅只会额外增加一些负载，这里选择通过PhpRedis完成

将 `laravel/framework/src/Illuminate/Cache/RedisStore.php `

复制到 `app/overwrite/laravel/framework/src/Illuminate/Cache/RedisStore.php`

重写 `serialize()` 和 `unserialize()`


```php
// gbinary是否开启
protected $enableIgbinary = false;

public function __construct(Redis $redis, $prefix = '', $connection = 'default')
{
    // blabla...
    // 加载igbinary配置，判断开启
    if ($this->connection()->client()->getOption(\Redis::OPT_SERIALIZER) === \Redis::SERIALIZER_IGBINARY) {
        $this->enableIgbinary = true;
    }
}

protected function serialize($value)
{
    if (is_numeric($value) && !in_array($value, [INF, -INF]) && !is_nan($value)) {
        return $value;
    }
    if ($this->enableIgbinary) {
        return $value;
    }
    return serialize($value);
}

protected function unserialize($value)
{
    if (is_numeric($value)) {
        return $value;
    }
    if ($this->enableIgbinary) {
        return $value;
    }
    return unserialize($value);
}
```

通过 composer.json 替换处理
```json
{
    "autoload": {
        "exclude-from-classmap": [
            "vendor/laravel/framework/src/Illuminate/Cache/RedisStore.php"
        ],
        "files": [
            "app/overwrite/laravel/framework/src/Illuminate/Cache/RedisStore.php"
        ]
    },
}
```

### 最终效果

默认: 1.69mb

开启lz4: 205.96kb

开启igbinary: 336kb

👀 同时开启igbinary和lz4: 111.95kb 

![image](../assets/image%20(3).png)

单次请求的流量占用也缩小到了100kb+

![image](../assets/image%20(4).png)

### 参考文档

https://tech.meituan.com/2021/01/07/pack-gzip-zstd-lz4.html

https://deliveroo.engineering/2016/10/07/optimising-session-key-storage.html

https://github.com/laravel/framework/pull/40282/files#diff-6a8e18e894ab849a0ff821f0a5f2127282c9c1fbe0ae3de7c17745ec7f4a0906

https://github.com/laravel/framework/pull/47531