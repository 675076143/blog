import fs from "fs";
import path from "path";

const postsDir = path.resolve(__dirname, "../programming");

const posts = [
  { text: "给 LLM 建一个知识库", link: "/programming/gei-llm-jian-yi-ge-zhi-shi-ku" },
  { text: "我是怎么放弃 RAG 和 MCP 的", link: "/programming/wo-shi-zen-yang-fang-qi-mcp-de" },
  { text: "PHP-FPM SIGSEGV 故障排查实录", link: "/programming/php-fpm-sigsegv-pai-cha" },
  { text: "Hologres 499 超时根因分析", link: "/programming/hologres-499-chao-shi-gen-yin-fen-xi" },
  { text: "Hologres 高负载诊断", link: "/programming/hologres-mo-shi-fen-zhong-gao-fu-zai-zhen-duan" },
  { text: "一个搜索框的思考", link: "/programming/yi-ge-sou-suo-kuang-de-shi-shi" },
  { text: "重生之路", link: "/programming/chong-sheng-zhi-lu" },
  { text: "Access Token 和 Refresh Token", link: "/programming/access-token-and-refresh-token" },
  { text: "Excel导出图片的各类方案与利弊", link: "/programming/excel-dao-chu-tu-pian-de-ge-lei-fang-an-yu-li-bi" },
  { text: "Laravel Schedule 优雅退出实现", link: "/programming/laravel-schedule-you-ya-tui-chu-shi-xian" },
  { text: "Redis出口流量分析与压缩处理", link: "/programming/redis-chu-kou-liu-liang-fen-xi-yu-ya-suo-chu-li" },
  { text: "如何加载动态代码", link: "/programming/ru-he-jia-zai-dong-tai-dai-ma" },
  { text: "Php-fpm 多pool实践", link: "/programming/phpfpm-duo-pool-shi-jian" },
  { text: "Laravel Cache Tag 导致的大Key问题", link: "/programming/laravel-cache-tag-dao-zhi-de-da-key-wen-ti" },
  { text: "Knex.js TypeScript 友好 (Interface篇)", link: "/programming/knex.js-typescript-you-hao-interface-pian" },
  { text: "Hyperf Insert 性能问题", link: "/programming/hyperf-insert-xing-neng-wen-ti" },
  { text: "Mysql 使用 Prepared Statements 导致的性能问题", link: "/programming/mysql-shi-yong-prepared-statements-dao-zhi-de-xing-neng-wen-ti" },
  { text: "laravel-permission 缓存导致的Redis带宽占用问题", link: "/programming/laravelpermission-huan-cun-dao-zhi-de-redis-dai-kuan-zhan-yong-wen-ti" },
  { text: "Filtering系统与AST的应用", link: "/programming/filtering-xi-tong-yu-ast-de-ying-yong" },
];

const sorted = posts
  .map((post) => {
    const slug = post.link.split("/").pop();
    const filePath = path.join(postsDir, `${slug}.md`);
    const mtime = fs.existsSync(filePath)
      ? fs.statSync(filePath).mtimeMs
      : 0;
    return { ...post, mtime };
  })
  .sort((a, b) => b.mtime - a.mtime);

export default {
  lastUpdated: true,
  themeConfig: {
    siteTitle: "Minecraft",
    sidebar: [
      {
        text: "Self-host",
        items: [
          { text: "自建漫画图书服务器选型", link: "/programming/zi-jian-man-hua-tu-shu-fu-wu-qi-dui-bi" },
          { text: "Local LLM 迁移选型", link: "/programming/local-llm-qian-yi-qwen3" },
          { text: "Linux Jellyfin 桌面客户端选型", link: "/programming/linux-jellyfin-ke-hu-duan-dui-bi" },
          { text: "Linux Navidrome 客户端选型", link: "/programming/linux-navidrome-ke-hu-duan-dui-bi" },
          { text: "Synology Drive 同步 .git 文件夹", link: "/programming/synology-drive-tong-bu-git-wen-jian-jia" },
          { text: "NAS CIFS 挂载问题排查", link: "/programming/nas-cifs-mount-wen-ti-pai-cha" },
        ],
      },
      {
        text: "Linux",
        items: [
          { text: "北通手柄 Linux USB 断连排查与修复", link: "/programming/bei-tong-shou-bing-linux-usb-duan-lian-pai-cha" },
          { text: "CachyOS 游戏串流方案选型", link: "/programming/cachyos-you-xi-chuan-liu-fang-an-dui-bi" },
          { text: "Linux 浏览器选择对比", link: "/programming/linux-liu-lan-qi-xuan-ze-dui-bi" },
          { text: "Linux Docker 替代方案对比", link: "/programming/linux-docker-ti-dai-fang-an-dui-bi" },
          { text: "Pacman 更新后系统进入应急模式", link: "/programming/pacman-geng-xin-jin-ru-ying-ji-mo-shi" },
          { text: "独立双系统物理隔离安装方案", link: "/programming/du-li-shuang-xi-tong-wu-li-ge-li" },
          { text: "Clash Verge 局域网连接被防火墙拦截", link: "/programming/clash-verge-lan-fang-huo-qiang-jie-huo" },
        ],
      },
      {
        text: "Programming",
        items: sorted,
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/675076143" }],
  },
};
